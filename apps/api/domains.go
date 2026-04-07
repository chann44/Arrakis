package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"

	db "github.com/chann44/TGE/internals/db"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

var hostnamePattern = regexp.MustCompile(`^(?i)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$`)

type domainRecord struct {
	Type  string `json:"type"`
	Name  string `json:"name"`
	Value string `json:"value"`
	TTL   int    `json:"ttl"`
}

type customDomainResponse struct {
	ID       int64          `json:"id"`
	Hostname string         `json:"hostname"`
	Status   string         `json:"status"`
	Error    string         `json:"error"`
	Records  []domainRecord `json:"records"`
}

type createCustomDomainRequest struct {
	Hostname string `json:"hostname"`
}

type listCustomDomainsResponse struct {
	Domains []customDomainResponse `json:"domains"`
}

func normalizeHostname(input string) string {
	v := strings.ToLower(strings.TrimSpace(input))
	v = strings.TrimPrefix(v, "https://")
	v = strings.TrimPrefix(v, "http://")
	if idx := strings.Index(v, "/"); idx >= 0 {
		v = v[:idx]
	}
	return strings.TrimSuffix(v, ".")
}

func requestHost(r *http.Request) string {
	host := strings.TrimSpace(r.Header.Get("X-Forwarded-Host"))
	if host == "" {
		host = strings.TrimSpace(r.Host)
	}
	if host == "" {
		return ""
	}
	if strings.Contains(host, ",") {
		host = strings.TrimSpace(strings.Split(host, ",")[0])
	}
	if parsedHost, _, err := net.SplitHostPort(host); err == nil {
		host = parsedHost
	}
	host = strings.TrimPrefix(host, "[")
	host = strings.TrimSuffix(host, "]")
	return strings.TrimSuffix(host, ".")
}

func detectInterfaceIP() string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return ""
	}
	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if !ok || ipNet.IP == nil {
				continue
			}
			ipv4 := ipNet.IP.To4()
			if ipv4 == nil || ipv4.IsLoopback() {
				continue
			}
			return ipv4.String()
		}
	}
	return ""
}

func (h *Handler) resolveDomainRecordConfig(r *http.Request) (string, string, error) {
	recordType := strings.ToUpper(strings.TrimSpace(h.cfg.DomainRecordType))
	recordValue := strings.TrimSpace(h.cfg.DomainRecordValue)
	if recordType == "" {
		recordType = "A"
	}
	if recordType != "CNAME" {
		recordType = "A"
	}

	if recordValue != "" {
		return recordType, recordValue, nil
	}

	host := strings.ToLower(requestHost(r))
	if host == "" {
		return "", "", fmt.Errorf("could not detect server host; set DOMAIN_RECORD_VALUE")
	}

	if host == "localhost" {
		if detected := detectInterfaceIP(); detected != "" {
			return "A", detected, nil
		}
		return "", "", fmt.Errorf("running on localhost; set DOMAIN_RECORD_VALUE to your server public ip")
	}

	if ip := net.ParseIP(host); ip != nil {
		return "A", ip.String(), nil
	}

	if recordType == "CNAME" {
		return "CNAME", host, nil
	}

	ips, err := net.LookupIP(host)
	if err != nil {
		return "", "", fmt.Errorf("could not resolve %s to ip; set DOMAIN_RECORD_VALUE", host)
	}
	for _, ip := range ips {
		if ipv4 := ip.To4(); ipv4 != nil {
			return "A", ipv4.String(), nil
		}
	}
	if len(ips) > 0 {
		return "A", ips[0].String(), nil
	}

	return "", "", fmt.Errorf("no ip found for %s; set DOMAIN_RECORD_VALUE", host)
}

func (h *Handler) customDomainRecords(domain db.CustomDomain) []domainRecord {
	txtName := fmt.Sprintf("%s.%s", strings.TrimSpace(h.cfg.DomainTXTNamePrefix), domain.Hostname)
	return []domainRecord{
		{Type: "TXT", Name: txtName, Value: domain.VerificationToken, TTL: 300},
		{Type: domain.DnsRecordType, Name: domain.DnsRecordName, Value: domain.DnsRecordValue, TTL: 300},
	}
}

func (h *Handler) domainResponseFromRow(row db.CustomDomain) customDomainResponse {
	return customDomainResponse{
		ID:       row.ID,
		Hostname: row.Hostname,
		Status:   row.Status,
		Error:    row.LastError,
		Records:  h.customDomainRecords(row),
	}
}

func (h *Handler) listCustomDomains(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := h.queries.ListUserCustomDomains(r.Context(), userID)
	if err != nil {
		http.Error(w, "failed to list domains", http.StatusInternalServerError)
		return
	}

	resp := make([]customDomainResponse, 0, len(rows))
	for _, row := range rows {
		resp = append(resp, h.domainResponseFromRow(row))
	}

	writeJSON(w, http.StatusOK, listCustomDomainsResponse{Domains: resp})
}

func (h *Handler) createCustomDomain(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req createCustomDomainRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	hostname := normalizeHostname(req.Hostname)
	if !hostnamePattern.MatchString(hostname) {
		http.Error(w, "invalid hostname", http.StatusBadRequest)
		return
	}

	if _, err := h.queries.GetCustomDomainByHostname(r.Context(), hostname); err == nil {
		http.Error(w, "domain is already registered", http.StatusConflict)
		return
	} else if !errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "failed to validate hostname", http.StatusInternalServerError)
		return
	}

	token, err := generateState()
	if err != nil {
		http.Error(w, "failed to create verification token", http.StatusInternalServerError)
		return
	}

	recordType, recordValue, err := h.resolveDomainRecordConfig(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
		return
	}

	row, err := h.queries.CreateCustomDomain(r.Context(), db.CreateCustomDomainParams{
		UserID:            userID,
		Hostname:          hostname,
		VerificationToken: token,
		DnsRecordType:     recordType,
		DnsRecordName:     hostname,
		DnsRecordValue:    recordValue,
	})
	if err != nil {
		http.Error(w, "failed to create domain", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, h.domainResponseFromRow(row))
}

func (h *Handler) verifyCustomDomain(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	id, err := strconv.ParseInt(chi.URLParam(r, "domainID"), 10, 64)
	if err != nil || id <= 0 {
		http.Error(w, "invalid domain id", http.StatusBadRequest)
		return
	}

	row, err := h.queries.GetUserCustomDomainByID(r.Context(), db.GetUserCustomDomainByIDParams{ID: id, UserID: userID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, "domain not found", http.StatusNotFound)
			return
		}
		http.Error(w, "failed to load domain", http.StatusInternalServerError)
		return
	}

	if err := h.validateDomainDNS(row); err != nil {
		msg := err.Error()
		_, _ = h.queries.MarkCustomDomainPendingDNS(r.Context(), db.MarkCustomDomainPendingDNSParams{ID: row.ID, LastError: msg})
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": msg, "domain": h.domainResponseFromRow(row)})
		return
	}

	updated, err := h.queries.MarkCustomDomainActive(r.Context(), row.ID)
	if err != nil {
		http.Error(w, "failed to activate domain", http.StatusInternalServerError)
		return
	}

	if err := h.syncTraefikDynamicDomains(r.Context()); err != nil {
		_, _ = h.queries.MarkCustomDomainError(r.Context(), db.MarkCustomDomainErrorParams{ID: row.ID, LastError: err.Error()})
		http.Error(w, "failed to publish domain config", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, h.domainResponseFromRow(updated))
}

func (h *Handler) deleteCustomDomain(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	id, err := strconv.ParseInt(chi.URLParam(r, "domainID"), 10, 64)
	if err != nil || id <= 0 {
		http.Error(w, "invalid domain id", http.StatusBadRequest)
		return
	}

	removed, err := h.queries.DeleteUserCustomDomain(r.Context(), db.DeleteUserCustomDomainParams{ID: id, UserID: userID})
	if err != nil {
		http.Error(w, "failed to delete domain", http.StatusInternalServerError)
		return
	}
	if removed == 0 {
		http.Error(w, "domain not found", http.StatusNotFound)
		return
	}

	if err := h.syncTraefikDynamicDomains(r.Context()); err != nil {
		http.Error(w, "domain removed but router config update failed", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
}

func (h *Handler) validateDomainDNS(domain db.CustomDomain) error {
	txtName := fmt.Sprintf("%s.%s", strings.TrimSpace(h.cfg.DomainTXTNamePrefix), domain.Hostname)
	txtRecords, err := net.LookupTXT(txtName)
	if err != nil {
		return fmt.Errorf("txt record %s not found yet", txtName)
	}

	foundToken := false
	for _, txt := range txtRecords {
		if strings.TrimSpace(txt) == domain.VerificationToken {
			foundToken = true
			break
		}
	}
	if !foundToken {
		return fmt.Errorf("txt record %s does not contain verification token", txtName)
	}

	expected := strings.TrimSpace(domain.DnsRecordValue)
	if strings.EqualFold(domain.DnsRecordType, "CNAME") {
		actual, err := net.LookupCNAME(domain.Hostname)
		if err != nil {
			return fmt.Errorf("cname record for %s not found", domain.Hostname)
		}
		if !strings.EqualFold(strings.TrimSuffix(actual, "."), strings.TrimSuffix(expected, ".")) {
			return fmt.Errorf("cname for %s points to %s, expected %s", domain.Hostname, strings.TrimSuffix(actual, "."), strings.TrimSuffix(expected, "."))
		}
		return nil
	}

	hosts, err := net.LookupHost(domain.Hostname)
	if err != nil {
		return fmt.Errorf("a record for %s not found", domain.Hostname)
	}
	for _, host := range hosts {
		if strings.TrimSpace(host) == expected {
			return nil
		}
	}
	return fmt.Errorf("a record for %s is %s, expected %s", domain.Hostname, strings.Join(hosts, ","), expected)
}

func (h *Handler) syncTraefikDynamicDomains(ctx context.Context) error {
	if !h.cfg.DomainRouterSyncEnabled {
		return nil
	}

	rows, err := h.queries.ListActiveCustomDomains(ctx)
	if err != nil {
		return err
	}

	path := strings.TrimSpace(h.cfg.TraefikConfigPath)
	if path == "" {
		return fmt.Errorf("missing traefik config path")
	}

	var b strings.Builder
	b.WriteString("http:\n")
	b.WriteString("  middlewares:\n")
	b.WriteString("    tge-api-strip:\n")
	b.WriteString("      stripPrefix:\n")
	b.WriteString("        prefixes:\n")
	b.WriteString("          - /api\n")
	b.WriteString("  services:\n")
	b.WriteString("    tge-web-upstream:\n")
	b.WriteString("      loadBalancer:\n")
	b.WriteString("        servers:\n")
	b.WriteString("          - url: http://web:3000\n")
	b.WriteString("    tge-api-upstream:\n")
	b.WriteString("      loadBalancer:\n")
	b.WriteString("        servers:\n")
	b.WriteString("          - url: http://api:8080\n")
	b.WriteString("  routers:\n")

	if len(rows) == 0 {
		b.WriteString("    tge-placeholder:\n")
		b.WriteString("      rule: \"Host(`invalid.local`)\"\n")
		b.WriteString("      entryPoints:\n")
		b.WriteString("        - websecure\n")
		b.WriteString("      service: tge-web-upstream\n")
		b.WriteString("      tls:\n")
		b.WriteString("        certResolver: le\n")
	} else {
		sort.Slice(rows, func(i, j int) bool {
			return rows[i].Hostname < rows[j].Hostname
		})
		for _, row := range rows {
			key := strings.NewReplacer(".", "-", "_", "-", "*", "wildcard").Replace(row.Hostname)
			b.WriteString(fmt.Sprintf("    tge-%s-api:\n", key))
			b.WriteString(fmt.Sprintf("      rule: \"Host(`%s`) && PathPrefix(`/api`)\"\n", row.Hostname))
			b.WriteString("      entryPoints:\n")
			b.WriteString("        - websecure\n")
			b.WriteString("      service: tge-api-upstream\n")
			b.WriteString("      middlewares:\n")
			b.WriteString("        - tge-api-strip\n")
			b.WriteString("      priority: 100\n")
			b.WriteString("      tls:\n")
			b.WriteString("        certResolver: le\n")

			b.WriteString(fmt.Sprintf("    tge-%s-web:\n", key))
			b.WriteString(fmt.Sprintf("      rule: \"Host(`%s`)\"\n", row.Hostname))
			b.WriteString("      entryPoints:\n")
			b.WriteString("        - websecure\n")
			b.WriteString("      service: tge-web-upstream\n")
			b.WriteString("      priority: 10\n")
			b.WriteString("      tls:\n")
			b.WriteString("        certResolver: le\n")
		}
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}

	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, []byte(b.String()), 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
