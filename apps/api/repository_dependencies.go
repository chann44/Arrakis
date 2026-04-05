package main

import (
	"context"
	"net/http"
	"sort"
	"strconv"
	"strings"

	db "github.com/chann44/TGE/internals/db"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type repositoryDependency struct {
	Name            string                `json:"name"`
	VersionSpec     string                `json:"version_spec"`
	VersionSpecs    []string              `json:"version_specs,omitempty"`
	LatestVersion   string                `json:"latest_version"`
	Manager         string                `json:"manager"`
	Registry        string                `json:"registry"`
	Scope           string                `json:"scope"`
	Scopes          []string              `json:"scopes,omitempty"`
	SourceFile      string                `json:"source_file"`
	UsedInFiles     []string              `json:"used_in_files,omitempty"`
	UsageCount      int                   `json:"usage_count"`
	Creator         string                `json:"creator"`
	Description     string                `json:"description"`
	License         string                `json:"license"`
	Homepage        string                `json:"homepage"`
	RepositoryURL   string                `json:"repository_url"`
	RegistryURL     string                `json:"registry_url"`
	LastUpdated     string                `json:"last_updated"`
	DependencyGraph []dependencyGraphNode `json:"dependency_graph,omitempty"`
}

type dependencyGraphNode struct {
	Name          string `json:"name"`
	VersionSpec   string `json:"version_spec"`
	LatestVersion string `json:"latest_version"`
	Manager       string `json:"manager"`
	Registry      string `json:"registry"`
	Parent        string `json:"parent,omitempty"`
	Depth         int    `json:"depth"`
	Creator       string `json:"creator"`
	Description   string `json:"description"`
	License       string `json:"license"`
	Homepage      string `json:"homepage"`
	RepositoryURL string `json:"repository_url"`
	RegistryURL   string `json:"registry_url"`
	LastUpdated   string `json:"last_updated"`
}

type repositoryDependenciesResponse struct {
	RepositoryID int64                  `json:"repository_id"`
	FullName     string                 `json:"full_name"`
	Page         int                    `json:"page"`
	PageSize     int                    `json:"page_size"`
	Total        int                    `json:"total"`
	TotalPages   int                    `json:"total_pages"`
	Dependencies []repositoryDependency `json:"dependencies"`
	SyncStatus   string                 `json:"sync_status,omitempty"`
	SyncError    string                 `json:"sync_error,omitempty"`
	LastSyncedAt string                 `json:"last_synced_at,omitempty"`
}

func (h *Handler) githubRepositoryDependencies(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	repoIDText := chi.URLParam(r, "repoID")
	repoID, err := strconv.ParseInt(repoIDText, 10, 64)
	if err != nil {
		http.Error(w, "invalid repository id", http.StatusBadRequest)
		return
	}

	repo, ok := connectedRepositoryForUser(r.Context(), h.queries, userID, repoID)
	if !ok {
		http.Error(w, "repository is not connected", http.StatusNotFound)
		return
	}

	rows, err := h.queries.ListRepositoryDependenciesDetailed(r.Context(), repoID)
	if err != nil {
		http.Error(w, "failed to fetch repository dependencies", http.StatusInternalServerError)
		return
	}

	deps := make([]repositoryDependency, 0, len(rows))
	for _, row := range rows {
		dep := repositoryDependency{
			Name:          row.DisplayName,
			VersionSpec:   strings.TrimSpace(row.VersionSpec),
			LatestVersion: textToString(row.ResolvedVersion),
			Manager:       strings.TrimSpace(row.Manager),
			Registry:      strings.TrimSpace(row.Registry),
			Scope:         strings.TrimSpace(row.Scope),
			SourceFile:    strings.TrimSpace(row.SourceFile),
			Creator:       textToString(row.Creator),
			Description:   textToString(row.Description),
			License:       textToString(row.License),
			Homepage:      textToString(row.Homepage),
			RepositoryURL: textToString(row.RepositoryUrl),
			RegistryURL:   textToString(row.RegistryUrl),
			LastUpdated:   timestamptzToString(row.ReleasedAt),
		}

		if row.ResolvedVersionID.Valid {
			dep.DependencyGraph = buildDependencyGraphFromDB(r.Context(), h.queries, row.ResolvedVersionID.Int64, dep.Name)
		}

		deps = append(deps, dep)
	}

	includePeer := strings.TrimSpace(r.URL.Query().Get("include_peer"))
	if strings.EqualFold(includePeer, "false") || includePeer == "0" {
		filtered := make([]repositoryDependency, 0, len(deps))
		for _, dep := range deps {
			if dep.Scope == "peer" {
				continue
			}
			filtered = append(filtered, dep)
		}
		deps = filtered
	}

	managerFilter := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("manager")))
	if managerFilter != "" && managerFilter != "all" {
		filtered := make([]repositoryDependency, 0, len(deps))
		for _, dep := range deps {
			if strings.ToLower(dep.Manager) == managerFilter {
				filtered = append(filtered, dep)
			}
		}
		deps = filtered
	}

	scopeFilter := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("scope")))
	if scopeFilter != "" && scopeFilter != "all" {
		filtered := make([]repositoryDependency, 0, len(deps))
		for _, dep := range deps {
			if strings.ToLower(dep.Scope) == scopeFilter {
				filtered = append(filtered, dep)
			}
		}
		deps = filtered
	}

	q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
	if q != "" {
		filtered := make([]repositoryDependency, 0, len(deps))
		for _, dep := range deps {
			if strings.Contains(strings.ToLower(dep.Name), q) || strings.Contains(strings.ToLower(dep.SourceFile), q) {
				filtered = append(filtered, dep)
			}
		}
		deps = filtered
	}

	deps = groupDependencies(deps)

	sort.Slice(deps, func(i, j int) bool {
		if deps[i].Manager != deps[j].Manager {
			return deps[i].Manager < deps[j].Manager
		}
		return deps[i].Name < deps[j].Name
	})

	page := queryInt(r.URL.Query().Get("page"), 1)
	pageSize := queryInt(r.URL.Query().Get("page_size"), 25)
	if pageSize > 100 {
		pageSize = 100
	}

	total := len(deps)
	totalPages := 0
	if total > 0 {
		totalPages = (total + pageSize - 1) / pageSize
	}
	if totalPages > 0 && page > totalPages {
		page = totalPages
	}
	start := (page - 1) * pageSize
	if start < 0 {
		start = 0
	}
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}

	response := repositoryDependenciesResponse{
		RepositoryID: repoID,
		FullName:     repo.FullName,
		Page:         page,
		PageSize:     pageSize,
		Total:        total,
		TotalPages:   totalPages,
		Dependencies: deps[start:end],
	}

	syncRows, syncErr := h.queries.ListLatestRepositoryDependencySync(r.Context(), repoID)
	if syncErr == nil && len(syncRows) > 0 {
		latest := syncRows[0]
		response.SyncStatus = latest.Status
		response.SyncError = strings.TrimSpace(latest.ErrorMessage)
		if latest.FinishedAt.Valid {
			response.LastSyncedAt = latest.FinishedAt.Time.Format(timeLayoutISO)
		}
	}

	writeJSON(w, http.StatusOK, response)
}

func buildDependencyGraphFromDB(ctx context.Context, queries *db.Queries, rootVersionID int64, rootName string) []dependencyGraphNode {
	const (
		maxGraphNodes = 400
		maxGraphDepth = 6
	)

	type queueItem struct {
		versionID int64
		parent    string
		depth     int
	}

	queue := []queueItem{{versionID: rootVersionID, parent: rootName, depth: 1}}
	visited := make(map[int64]struct{})
	nodes := make([]dependencyGraphNode, 0)

	for len(queue) > 0 && len(nodes) < maxGraphNodes {
		item := queue[0]
		queue = queue[1:]

		if item.depth > maxGraphDepth {
			continue
		}
		if _, ok := visited[item.versionID]; ok {
			continue
		}
		visited[item.versionID] = struct{}{}

		edges, err := queries.ListDependencyEdgesByFromVersion(ctx, item.versionID)
		if err != nil {
			continue
		}

		for _, edge := range edges {
			node := dependencyGraphNode{
				Name:          strings.TrimSpace(edge.ChildName),
				VersionSpec:   strings.TrimSpace(edge.VersionSpec),
				LatestVersion: strings.TrimSpace(edge.ChildVersion),
				Manager:       strings.TrimSpace(edge.ChildManager),
				Registry:      strings.TrimSpace(edge.ChildRegistry),
				Parent:        item.parent,
				Depth:         item.depth,
				Creator:       strings.TrimSpace(edge.ChildCreator),
				Description:   strings.TrimSpace(edge.ChildDescription),
				License:       strings.TrimSpace(edge.ChildLicense),
				Homepage:      strings.TrimSpace(edge.ChildHomepage),
				RepositoryURL: strings.TrimSpace(edge.ChildRepositoryUrl),
				RegistryURL:   strings.TrimSpace(edge.ChildRegistryUrl),
				LastUpdated:   timestamptzToString(edge.ChildReleasedAt),
			}
			nodes = append(nodes, node)
			queue = append(queue, queueItem{versionID: edge.ToVersionID, parent: edge.ChildName, depth: item.depth + 1})
			if len(nodes) >= maxGraphNodes {
				break
			}
		}
	}

	sort.Slice(nodes, func(i, j int) bool {
		if nodes[i].Depth != nodes[j].Depth {
			return nodes[i].Depth < nodes[j].Depth
		}
		if nodes[i].Manager != nodes[j].Manager {
			return nodes[i].Manager < nodes[j].Manager
		}
		return nodes[i].Name < nodes[j].Name
	})

	return nodes
}

func groupDependencies(deps []repositoryDependency) []repositoryDependency {
	if len(deps) == 0 {
		return deps
	}

	groupedByKey := make(map[string]*repositoryDependency)
	order := make([]string, 0, len(deps))

	for _, dep := range deps {
		key := strings.ToLower(dep.Manager + "|" + dep.Registry + "|" + dep.Name)
		group, exists := groupedByKey[key]
		if !exists {
			clone := dep
			clone.VersionSpecs = nil
			clone.Scopes = nil
			clone.UsedInFiles = nil
			clone.UsageCount = 0
			groupedByKey[key] = &clone
			group = &clone
			order = append(order, key)
		}

		group.UsageCount++
		group.VersionSpecs = appendUnique(group.VersionSpecs, dep.VersionSpec)
		group.Scopes = appendUnique(group.Scopes, dep.Scope)
		group.UsedInFiles = appendUnique(group.UsedInFiles, dep.SourceFile)

		if group.VersionSpec == "" && dep.VersionSpec != "" {
			group.VersionSpec = dep.VersionSpec
		}
		if group.Scope == "" && dep.Scope != "" {
			group.Scope = dep.Scope
		}
		if group.SourceFile == "" && dep.SourceFile != "" {
			group.SourceFile = dep.SourceFile
		}
		if group.LatestVersion == "" {
			group.LatestVersion = dep.LatestVersion
		}
		if group.Creator == "" {
			group.Creator = dep.Creator
		}
		if group.Description == "" {
			group.Description = dep.Description
		}
		if group.License == "" {
			group.License = dep.License
		}
		if group.Homepage == "" {
			group.Homepage = dep.Homepage
		}
		if group.RepositoryURL == "" {
			group.RepositoryURL = dep.RepositoryURL
		}
		if group.RegistryURL == "" {
			group.RegistryURL = dep.RegistryURL
		}
		if group.LastUpdated == "" {
			group.LastUpdated = dep.LastUpdated
		}
		if len(group.DependencyGraph) == 0 && len(dep.DependencyGraph) > 0 {
			group.DependencyGraph = dep.DependencyGraph
		}
	}

	grouped := make([]repositoryDependency, 0, len(order))
	for _, key := range order {
		grouped = append(grouped, *groupedByKey[key])
	}

	return grouped
}

func appendUnique(items []string, value string) []string {
	v := strings.TrimSpace(value)
	if v == "" {
		return items
	}
	for _, item := range items {
		if item == v {
			return items
		}
	}
	return append(items, v)
}

const timeLayoutISO = "2006-01-02T15:04:05Z07:00"

func timestamptzToString(value pgtype.Timestamptz) string {
	if !value.Valid {
		return ""
	}
	return value.Time.Format(timeLayoutISO)
}

func textToString(value pgtype.Text) string {
	if !value.Valid {
		return ""
	}
	return strings.TrimSpace(value.String)
}

func connectedRepositoryForUser(ctx context.Context, queries *db.Queries, userID, repoID int64) (db.Repository, bool) {
	repos, err := queries.ListUserRepositories(ctx, userID)
	if err != nil {
		return db.Repository{}, false
	}
	for _, repo := range repos {
		if repo.GithubRepoID == repoID {
			return repo, true
		}
	}
	return db.Repository{}, false
}
