package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	internal "github.com/chann44/TGE/internals"
	db "github.com/chann44/TGE/internals/db"
	"github.com/jackc/pgx/v5/pgtype"
)

type aiAnalyzeRequest struct {
	ScanRunID       int64               `json:"scanRunId"`
	RepoID          int64               `json:"repoId"`
	Dependencies    []aiDependencyInput `json:"dependencies"`
	MaxDependencies int                 `json:"maxDependencies,omitempty"`
}

type aiDependencyInput struct {
	Name            string `json:"name"`
	Manager         string `json:"manager"`
	Registry        string `json:"registry"`
	VersionSpec     string `json:"versionSpec"`
	ResolvedVersion string `json:"resolvedVersion"`
	SourceFile      string `json:"sourceFile"`
}

type aiAnalyzeResponse struct {
	Findings []aiFinding `json:"findings"`
	Steps    []aiLogStep `json:"steps"`
	Stats    struct {
		DependenciesScanned int `json:"dependenciesScanned"`
		FindingsTotal       int `json:"findingsTotal"`
		SupplyChainFindings int `json:"supplyChainFindings"`
		CodeFindings        int `json:"codeFindings"`
	} `json:"stats"`
}

type aiLogStep struct {
	Stage       string         `json:"stage"`
	Status      string         `json:"status"`
	Message     string         `json:"message"`
	PackageName string         `json:"packageName"`
	CreatedAt   string         `json:"createdAt"`
	Metadata    map[string]any `json:"metadata"`
}

type aiFinding struct {
	Agent           string  `json:"agent"`
	Severity        string  `json:"severity"`
	Confidence      float64 `json:"confidence"`
	AdvisoryID      string  `json:"advisoryId"`
	Title           string  `json:"title"`
	Summary         string  `json:"summary"`
	PackageName     string  `json:"packageName"`
	Manager         string  `json:"manager"`
	Registry        string  `json:"registry"`
	VersionSpec     string  `json:"versionSpec"`
	ResolvedVersion string  `json:"resolvedVersion"`
	ReferenceURL    string  `json:"referenceURL"`
	Evidence        struct {
		Reason      string `json:"reason"`
		Indicator   string `json:"indicator"`
		ScriptName  string `json:"scriptName"`
		ScriptValue string `json:"scriptValue"`
	} `json:"evidence"`
}

func runAIAnalyzer(ctx context.Context, cfg *internal.Config, scanRunID, repoID int64, deps []db.ListRepositoryDependenciesDetailedRow) (*aiAnalyzeResponse, []string, error) {
	request := aiAnalyzeRequest{
		ScanRunID:       scanRunID,
		RepoID:          repoID,
		Dependencies:    make([]aiDependencyInput, 0, len(deps)),
		MaxDependencies: cfg.AIAnalyzerMaxDependencies,
	}

	for _, dep := range deps {
		name := strings.TrimSpace(dep.DisplayName)
		if name == "" {
			continue
		}
		request.Dependencies = append(request.Dependencies, aiDependencyInput{
			Name:            name,
			Manager:         strings.TrimSpace(dep.Manager),
			Registry:        strings.TrimSpace(dep.Registry),
			VersionSpec:     strings.TrimSpace(dep.VersionSpec),
			ResolvedVersion: resolvedVersionForDependency(dep),
			SourceFile:      strings.TrimSpace(dep.SourceFile),
		})
	}

	if len(request.Dependencies) == 0 {
		return &aiAnalyzeResponse{}, nil, nil
	}

	mode := strings.ToLower(strings.TrimSpace(cfg.AIAnalyzerMode))
	if mode == "" {
		mode = "docker"
	}

	switch mode {
	case "http":
		response, stderr, err := runAIAnalyzerHTTP(ctx, cfg, request)
		if err != nil {
			return nil, stderr, err
		}
		return response, stderr, nil
	default:
		response, stderr, err := runAIAnalyzerDocker(ctx, cfg, request)
		if err != nil {
			return nil, stderr, err
		}
		return response, stderr, nil
	}
}

func runAIAnalyzerHTTP(ctx context.Context, cfg *internal.Config, payload aiAnalyzeRequest) (*aiAnalyzeResponse, []string, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, nil, fmt.Errorf("marshal ai payload: %w", err)
	}

	baseURL := strings.TrimSpace(cfg.AIAnalyzerURL)
	if baseURL == "" {
		return nil, nil, fmt.Errorf("ai analyzer url is required in http mode")
	}
	endpoint := strings.TrimSuffix(baseURL, "/") + "/v1/analyze/repository"

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, nil, fmt.Errorf("create ai analyzer request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if strings.TrimSpace(cfg.AIAnalyzerToken) != "" {
		req.Header.Set("x-ai-analyzer-token", strings.TrimSpace(cfg.AIAnalyzerToken))
	}

	client := &http.Client{Timeout: time.Duration(cfg.AISandboxTimeoutSeconds) * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, nil, fmt.Errorf("call ai analyzer: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, fmt.Errorf("read ai analyzer response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, nil, fmt.Errorf("ai analyzer returned status %d: %s", resp.StatusCode, truncateForDB(string(respBody), 1000))
	}

	var parsed aiAnalyzeResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, nil, fmt.Errorf("decode ai analyzer response: %w", err)
	}

	return &parsed, nil, nil
}

func runAIAnalyzerDocker(ctx context.Context, cfg *internal.Config, payload aiAnalyzeRequest) (*aiAnalyzeResponse, []string, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, nil, fmt.Errorf("marshal ai payload: %w", err)
	}

	image := strings.TrimSpace(cfg.AIAnalyzerDockerImage)
	if image == "" {
		image = "arrakis-ai-analyzer:local"
	}
	network := strings.TrimSpace(cfg.AISandboxNetwork)
	if network == "" {
		network = "bridge"
	}
	timeoutSeconds := cfg.AISandboxTimeoutSeconds
	if timeoutSeconds <= 0 {
		timeoutSeconds = 180
	}

	runCtx, cancel := context.WithTimeout(ctx, time.Duration(timeoutSeconds)*time.Second)
	defer cancel()

	args := []string{
		"run",
		"--rm",
		"-i",
		"--read-only",
		"--tmpfs", "/tmp:rw,nosuid,nodev,size=32m",
		"--memory", "512m",
		"--cpus", "1.0",
		"--pids-limit", "256",
		"--security-opt", "no-new-privileges",
		"--cap-drop", "ALL",
		"--network", network,
	}

	if strings.TrimSpace(cfg.OpenAIAPIKey) != "" {
		args = append(args, "-e", "OPENAI_API_KEY="+strings.TrimSpace(cfg.OpenAIAPIKey))
	}
	if strings.TrimSpace(cfg.OpenRouterAPIKey) != "" {
		args = append(args, "-e", "OPENROUTER_API_KEY="+strings.TrimSpace(cfg.OpenRouterAPIKey))
	}
	if strings.TrimSpace(cfg.OpenRouterBaseURL) != "" {
		args = append(args, "-e", "OPENROUTER_BASE_URL="+strings.TrimSpace(cfg.OpenRouterBaseURL))
	}
	if strings.TrimSpace(cfg.OpenRouterSiteURL) != "" {
		args = append(args, "-e", "OPENROUTER_SITE_URL="+strings.TrimSpace(cfg.OpenRouterSiteURL))
	}
	if strings.TrimSpace(cfg.OpenRouterAppName) != "" {
		args = append(args, "-e", "OPENROUTER_APP_NAME="+strings.TrimSpace(cfg.OpenRouterAppName))
	}
	if strings.TrimSpace(cfg.AIAnalyzerModel) != "" {
		args = append(args, "-e", "AI_ANALYZER_MODEL="+strings.TrimSpace(cfg.AIAnalyzerModel))
	}

	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if databaseURL == "" {
		dbHost := strings.TrimSpace(cfg.DBHost)
		dbPort := strings.TrimSpace(cfg.DBPort)
		dbUser := strings.TrimSpace(cfg.DBUser)
		dbPassword := strings.TrimSpace(cfg.DBPassword)
		dbName := strings.TrimSpace(cfg.DBName)
		if dbHost != "" && dbPort != "" && dbUser != "" && dbName != "" {
			databaseURL = fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable", dbUser, dbPassword, dbHost, dbPort, dbName)
		}
	}
	if databaseURL != "" {
		databaseURL = rewriteDatabaseURLForDocker(databaseURL)
		args = append(args, "-e", "DATABASE_URL="+databaseURL)
		args = append(args, "-e", "AI_ANALYZER_DATABASE_URL="+databaseURL)
	}

	args = append(args, image, "bun", "src/job.ts")

	cmd := exec.CommandContext(runCtx, "docker", args...)
	cmd.Stdin = bytes.NewReader(body)

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err = cmd.Run()
	stderrLines := linesFromOutput(stderr.String())
	if err != nil {
		return nil, stderrLines, fmt.Errorf("docker ai sandbox failed: %w (%s)", err, truncateForDB(stderr.String(), 1200))
	}

	var parsed aiAnalyzeResponse
	if err := json.Unmarshal(bytes.TrimSpace(stdout.Bytes()), &parsed); err != nil {
		return nil, stderrLines, fmt.Errorf("decode docker ai sandbox output: %w", err)
	}

	return &parsed, stderrLines, nil
}

func rewriteDatabaseURLForDocker(raw string) string {
	v, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return raw
	}

	host := strings.TrimSpace(v.Hostname())
	if !isLoopbackHost(host) {
		return raw
	}

	port := v.Port()
	if port == "" {
		return raw
	}

	v.Host = net.JoinHostPort("host.docker.internal", port)
	return v.String()
}

func isLoopbackHost(host string) bool {
	if host == "" {
		return false
	}
	if strings.EqualFold(host, "localhost") {
		return true
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	return ip.IsLoopback()
}

func linesFromOutput(value string) []string {
	v := strings.TrimSpace(value)
	if v == "" {
		return []string{}
	}
	parts := strings.Split(v, "\n")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		line := strings.TrimSpace(part)
		if line == "" {
			continue
		}
		items = append(items, truncateForDB(line, 1000))
	}
	return items
}

func mergeAIFindingsIntoMap(response *aiAnalyzeResponse, findingMap map[string]*normalizedFinding) {
	if response == nil {
		return
	}
	for _, finding := range response.Findings {
		packageName := strings.TrimSpace(finding.PackageName)
		advisoryID := strings.TrimSpace(finding.AdvisoryID)
		if packageName == "" || advisoryID == "" {
			continue
		}

		summary := strings.TrimSpace(finding.Summary)
		evidenceReason := strings.TrimSpace(finding.Evidence.Reason)
		if evidenceReason != "" {
			summary = strings.TrimSpace(summary + "\n\nAI evidence: " + evidenceReason)
		}
		if finding.Confidence > 0 {
			summary = strings.TrimSpace(summary + "\nConfidence: " + strconv.FormatFloat(finding.Confidence, 'f', 2, 64))
		}

		key := strings.ToLower(packageName + "|" + advisoryID)
		if existing, ok := findingMap[key]; ok {
			existing.Severity = mergeSeverity(existing.Severity, mapSeverityValue(finding.Severity))
			existing.Sources = dedupeStrings(append(existing.Sources, "custom"))
			if strings.TrimSpace(existing.Summary) == "" {
				existing.Summary = summary
			}
			continue
		}

		findingMap[key] = &normalizedFinding{
			PackageID:       pgtype.Int8{},
			PackageName:     packageName,
			Manager:         strings.TrimSpace(finding.Manager),
			Registry:        strings.TrimSpace(finding.Registry),
			VersionSpec:     strings.TrimSpace(finding.VersionSpec),
			ResolvedVersion: strings.TrimSpace(finding.ResolvedVersion),
			AdvisoryID:      advisoryID,
			Aliases:         []string{},
			Title:           firstNonEmpty(strings.TrimSpace(finding.Title), advisoryID),
			Summary:         summary,
			Severity:        mapSeverityValue(finding.Severity),
			FixedVersion:    "",
			ReferenceURL:    strings.TrimSpace(finding.ReferenceURL),
			Sources:         []string{"custom"},
		}
	}
}
