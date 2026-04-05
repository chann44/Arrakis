package adapters

import (
	"context"
	"encoding/json"
	"log"
	"strings"
	"time"
)

type CentralLogger struct {
	clickhouse *ClickHouse
	source     string
}

func NewCentralLogger(clickhouse *ClickHouse, source string) *CentralLogger {
	return &CentralLogger{clickhouse: clickhouse, source: strings.TrimSpace(source)}
}

func (l *CentralLogger) Log(ctx context.Context, service, level, message string, metadata map[string]any) {
	if l == nil || l.clickhouse == nil {
		return
	}
	payload := "{}"
	if metadata != nil {
		if encoded, err := json.Marshal(metadata); err == nil {
			payload = string(encoded)
		}
	}
	now := time.Now().UTC()
	if err := l.clickhouse.InsertServiceLog(ctx, ClickHouseLogEntry{
		Timestamp: now,
		Cursor:    now.UnixNano(),
		Service:   strings.TrimSpace(service),
		Level:     normalizeLogLevel(level),
		Message:   strings.TrimSpace(message),
		Metadata:  payload,
		Source:    l.source,
	}); err != nil {
		log.Printf("central-logger write failed service=%s source=%s err=%v", strings.TrimSpace(service), l.source, err)
	}
}

func normalizeLogLevel(level string) string {
	switch strings.ToLower(strings.TrimSpace(level)) {
	case "debug", "info", "warn", "error":
		return strings.ToLower(strings.TrimSpace(level))
	default:
		return "info"
	}
}
