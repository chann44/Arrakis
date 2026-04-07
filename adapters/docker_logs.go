package adapters

import (
	"bufio"
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"
)

type DockerContainer struct {
	ID       string
	Name     string
	Service  string
	State    string
	Status   string
	Networks []string
	Labels   map[string]string
}

type DockerLogEntry struct {
	Cursor    int64
	CreatedAt time.Time
	Service   string
	Container string
	Stream    string
	Level     string
	Message   string
	Source    string
}

type DockerLogs struct {
	socketPath string
	network    string
	includeAll bool
	httpClient *http.Client
}

func NewDockerLogs(socketPath, network string, includeAll bool) *DockerLogs {
	path := strings.TrimSpace(socketPath)
	if path == "" {
		path = "/var/run/docker.sock"
	}

	transport := &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			dialer := &net.Dialer{}
			return dialer.DialContext(ctx, "unix", path)
		},
	}

	return &DockerLogs{
		socketPath: path,
		network:    strings.TrimSpace(network),
		includeAll: includeAll,
		httpClient: &http.Client{
			Transport: transport,
		},
	}
}

func (d *DockerLogs) Ping(ctx context.Context) error {
	if d == nil {
		return fmt.Errorf("docker logs client is not initialized")
	}
	res, err := d.do(ctx, http.MethodGet, "/_ping", nil)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("docker ping failed: status=%d", res.StatusCode)
	}
	return nil
}

func (d *DockerLogs) ListContainers(ctx context.Context, includeStopped bool) ([]DockerContainer, error) {
	if d == nil {
		return nil, fmt.Errorf("docker logs client is not initialized")
	}

	params := url.Values{}
	if includeStopped {
		params.Set("all", "1")
	} else {
		params.Set("all", "0")
	}

	path := "/containers/json"
	if encoded := params.Encode(); encoded != "" {
		path += "?" + encoded
	}

	res, err := d.do(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("docker list containers failed: status=%d", res.StatusCode)
	}

	var rows []struct {
		ID              string            `json:"Id"`
		Names           []string          `json:"Names"`
		State           string            `json:"State"`
		Status          string            `json:"Status"`
		Labels          map[string]string `json:"Labels"`
		NetworkSettings struct {
			Networks map[string]any `json:"Networks"`
		} `json:"NetworkSettings"`
	}
	if err := json.NewDecoder(res.Body).Decode(&rows); err != nil {
		return nil, err
	}

	items := make([]DockerContainer, 0, len(rows))
	for _, row := range rows {
		service := strings.TrimSpace(row.Labels["com.docker.compose.service"])
		name := ""
		if len(row.Names) > 0 {
			name = strings.TrimPrefix(strings.TrimSpace(row.Names[0]), "/")
		}
		if name == "" {
			name = trimContainerID(row.ID)
		}
		if service == "" {
			service = name
		}
		networks := make([]string, 0, len(row.NetworkSettings.Networks))
		for networkName := range row.NetworkSettings.Networks {
			networkName = strings.TrimSpace(networkName)
			if networkName == "" {
				continue
			}
			networks = append(networks, networkName)
		}
		sort.Strings(networks)

		if !d.includeContainer(networks) {
			continue
		}

		items = append(items, DockerContainer{
			ID:       row.ID,
			Name:     name,
			Service:  service,
			State:    strings.TrimSpace(row.State),
			Status:   strings.TrimSpace(row.Status),
			Networks: networks,
			Labels:   row.Labels,
		})
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].Service == items[j].Service {
			return items[i].Name < items[j].Name
		}
		return items[i].Service < items[j].Service
	})

	return items, nil
}

func (d *DockerLogs) RecentLogs(ctx context.Context, containers []DockerContainer, tailPerContainer int) ([]DockerLogEntry, error) {
	if d == nil {
		return nil, fmt.Errorf("docker logs client is not initialized")
	}
	if tailPerContainer <= 0 {
		tailPerContainer = 50
	}

	out := make([]DockerLogEntry, 0)
	for _, container := range containers {
		entries, err := d.containerLogsSnapshot(ctx, container, tailPerContainer)
		if err != nil {
			continue
		}
		out = append(out, entries...)
	}

	sort.Slice(out, func(i, j int) bool {
		return out[i].Cursor > out[j].Cursor
	})
	return out, nil
}

func (d *DockerLogs) StreamLogs(ctx context.Context, containers []DockerContainer, since time.Time, emit func(DockerLogEntry)) error {
	if d == nil {
		return fmt.Errorf("docker logs client is not initialized")
	}
	if emit == nil {
		return fmt.Errorf("emit callback is required")
	}

	entries := make(chan DockerLogEntry, 256)
	errs := make(chan error, len(containers))

	var wg sync.WaitGroup
	for _, container := range containers {
		container := container
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := d.streamContainerLogs(ctx, container, since, entries); err != nil {
				errs <- err
			}
		}()
	}

	go func() {
		wg.Wait()
		close(entries)
		close(errs)
	}()

	for {
		select {
		case <-ctx.Done():
			return nil
		case entry, ok := <-entries:
			if !ok {
				return nil
			}
			emit(entry)
		case err, ok := <-errs:
			if !ok {
				continue
			}
			if err != nil {
				return err
			}
		}
	}
}

func (d *DockerLogs) containerLogsSnapshot(ctx context.Context, container DockerContainer, tail int) ([]DockerLogEntry, error) {
	params := url.Values{}
	params.Set("stdout", "1")
	params.Set("stderr", "1")
	params.Set("timestamps", "1")
	params.Set("tail", fmt.Sprintf("%d", tail))

	res, err := d.do(ctx, http.MethodGet, "/containers/"+url.PathEscape(container.ID)+"/logs?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("docker logs snapshot failed container=%s status=%d", container.Name, res.StatusCode)
	}

	out := make([]DockerLogEntry, 0, tail)
	err = parseDockerLogStream(res.Body, func(stream, line string) {
		entry := dockerLogEntryFromLine(container, stream, line)
		out = append(out, entry)
	})
	if err != nil {
		return nil, err
	}

	return out, nil
}

func (d *DockerLogs) streamContainerLogs(ctx context.Context, container DockerContainer, since time.Time, entries chan<- DockerLogEntry) error {
	params := url.Values{}
	params.Set("stdout", "1")
	params.Set("stderr", "1")
	params.Set("timestamps", "1")
	params.Set("follow", "1")
	params.Set("tail", "0")
	if !since.IsZero() {
		params.Set("since", fmt.Sprintf("%d", since.UTC().Unix()))
	}

	res, err := d.do(ctx, http.MethodGet, "/containers/"+url.PathEscape(container.ID)+"/logs?"+params.Encode(), nil)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("docker logs stream failed container=%s status=%d", container.Name, res.StatusCode)
	}

	return parseDockerLogStream(res.Body, func(stream, line string) {
		entry := dockerLogEntryFromLine(container, stream, line)
		select {
		case <-ctx.Done():
			return
		case entries <- entry:
		}
	})
}

func parseDockerLogStream(r io.Reader, consume func(stream, line string)) error {
	br := bufio.NewReader(r)
	peek, err := br.Peek(1)
	if err != nil {
		if err == io.EOF {
			return nil
		}
		return err
	}

	if len(peek) == 1 && (peek[0] == 1 || peek[0] == 2 || peek[0] == 3) {
		return parseDockerMultiplexed(br, consume)
	}

	for {
		line, readErr := br.ReadString('\n')
		if strings.TrimSpace(line) != "" {
			consume("stdout", strings.TrimRight(line, "\r\n"))
		}
		if readErr != nil {
			if readErr == io.EOF {
				return nil
			}
			return readErr
		}
	}
}

func parseDockerMultiplexed(r io.Reader, consume func(stream, line string)) error {
	buffer := map[string]string{"stdout": "", "stderr": ""}
	header := make([]byte, 8)
	for {
		if _, err := io.ReadFull(r, header); err != nil {
			if err == io.EOF || err == io.ErrUnexpectedEOF {
				for stream, rest := range buffer {
					if strings.TrimSpace(rest) != "" {
						consume(stream, rest)
					}
				}
				return nil
			}
			return err
		}

		size := binary.BigEndian.Uint32(header[4:8])
		if size == 0 {
			continue
		}

		payload := make([]byte, size)
		if _, err := io.ReadFull(r, payload); err != nil {
			if err == io.EOF || err == io.ErrUnexpectedEOF {
				return nil
			}
			return err
		}

		stream := "stdout"
		if header[0] == 2 {
			stream = "stderr"
		}

		chunk := buffer[stream] + string(payload)
		parts := strings.Split(chunk, "\n")
		for i := 0; i < len(parts)-1; i++ {
			line := strings.TrimRight(parts[i], "\r")
			if strings.TrimSpace(line) == "" {
				continue
			}
			consume(stream, line)
		}
		buffer[stream] = parts[len(parts)-1]
	}
}

func dockerLogEntryFromLine(container DockerContainer, stream, line string) DockerLogEntry {
	timestamp := time.Now().UTC()
	message := strings.TrimSpace(line)
	if ts, msg, ok := splitDockerTimestamp(line); ok {
		timestamp = ts
		message = msg
	}
	if message == "" {
		message = "(empty log line)"
	}

	level := detectDockerLogLevel(message, stream)
	cursor := timestamp.UnixNano()
	if cursor <= 0 {
		cursor = time.Now().UTC().UnixNano()
	}

	return DockerLogEntry{
		Cursor:    cursor,
		CreatedAt: timestamp,
		Service:   container.Service,
		Container: container.Name,
		Stream:    stream,
		Level:     level,
		Message:   message,
		Source:    "docker",
	}
}

func splitDockerTimestamp(line string) (time.Time, string, bool) {
	line = strings.TrimSpace(line)
	if line == "" {
		return time.Time{}, "", false
	}
	first, rest, found := strings.Cut(line, " ")
	if !found {
		return time.Time{}, "", false
	}
	ts, err := time.Parse(time.RFC3339Nano, first)
	if err != nil {
		return time.Time{}, "", false
	}
	return ts.UTC(), strings.TrimSpace(rest), true
}

func detectDockerLogLevel(message, stream string) string {
	text := strings.ToLower(strings.TrimSpace(message))
	if strings.Contains(text, "panic") || strings.Contains(text, "fatal") || strings.Contains(text, "error") {
		return "error"
	}
	if strings.Contains(text, "warn") {
		return "warn"
	}
	if strings.Contains(text, "debug") {
		return "debug"
	}
	if strings.EqualFold(stream, "stderr") {
		return "warn"
	}
	return "info"
}

func trimContainerID(id string) string {
	id = strings.TrimSpace(id)
	if len(id) > 12 {
		return id[:12]
	}
	return id
}

func (d *DockerLogs) includeContainer(networks []string) bool {
	if d == nil {
		return false
	}
	if d.includeAll {
		return true
	}
	if strings.TrimSpace(d.network) != "" {
		networkMatch := false
		for _, containerNetwork := range networks {
			if strings.EqualFold(strings.TrimSpace(containerNetwork), d.network) {
				networkMatch = true
				break
			}
		}
		if !networkMatch {
			return false
		}
	}
	return true
}

func (d *DockerLogs) do(ctx context.Context, method, path string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, "http://docker"+path, body)
	if err != nil {
		return nil, err
	}
	return d.httpClient.Do(req)
}
