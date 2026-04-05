package adapters

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	internal "github.com/chann44/TGE/internals"
)

type ClickHouseLogEntry struct {
	Timestamp time.Time
	Cursor    int64
	Service   string
	Level     string
	Message   string
	Metadata  string
	RequestID string
	Source    string
}

type ClickHouse struct {
	conn clickhouse.Conn
}

func NewClickHouse(ctx context.Context, cfg *internal.Config) (*ClickHouse, error) {
	conn, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{fmt.Sprintf("%s:%s", cfg.ClickHouseHost, cfg.ClickHousePort)},
		Auth: clickhouse.Auth{
			Database: cfg.ClickHouseDatabase,
			Username: cfg.ClickHouseUser,
			Password: cfg.ClickHousePassword,
		},
		DialTimeout: 5 * time.Second,
	})
	if err != nil {
		return nil, fmt.Errorf("create clickhouse connection: %w", err)
	}

	if err := conn.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping clickhouse: %w", err)
	}

	client := &ClickHouse{conn: conn}
	if err := client.EnsureLogSchema(ctx, 30); err != nil {
		return nil, err
	}

	return client, nil
}

func (c *ClickHouse) EnsureLogSchema(ctx context.Context, retentionDays int) error {
	if c == nil || c.conn == nil {
		return fmt.Errorf("clickhouse client is not initialized")
	}
	if retentionDays <= 0 {
		retentionDays = 30
	}

	createTable := fmt.Sprintf(`
		CREATE TABLE IF NOT EXISTS service_logs (
			created_at DateTime64(3, 'UTC'),
			cursor Int64,
			service LowCardinality(String),
			level LowCardinality(String),
			message String,
			metadata String,
			request_id String,
			source LowCardinality(String)
		)
		ENGINE = MergeTree
		PARTITION BY toYYYYMM(created_at)
		ORDER BY (service, created_at, cursor)
		TTL toDateTime(created_at) + toIntervalDay(%d)
		SETTINGS index_granularity = 8192
	`, retentionDays)

	if err := c.conn.Exec(ctx, createTable); err != nil {
		return fmt.Errorf("create clickhouse logs table: %w", err)
	}
	return nil
}

func (c *ClickHouse) InsertServiceLog(ctx context.Context, entry ClickHouseLogEntry) error {
	if c == nil || c.conn == nil {
		return fmt.Errorf("clickhouse client is not initialized")
	}
	if entry.Timestamp.IsZero() {
		entry.Timestamp = time.Now().UTC()
	}
	if entry.Cursor == 0 {
		entry.Cursor = entry.Timestamp.UnixNano()
	}

	entry.Service = strings.TrimSpace(entry.Service)
	entry.Level = strings.TrimSpace(entry.Level)
	entry.Message = strings.TrimSpace(entry.Message)
	if entry.Metadata == "" {
		entry.Metadata = "{}"
	}

	return c.conn.Exec(ctx, `
		INSERT INTO service_logs (
			created_at, cursor, service, level, message, metadata, request_id, source
		) VALUES (
			?, ?, ?, ?, ?, ?, ?, ?
		)
	`,
		entry.Timestamp,
		entry.Cursor,
		entry.Service,
		entry.Level,
		entry.Message,
		entry.Metadata,
		entry.RequestID,
		entry.Source,
	)
}

func (c *ClickHouse) ListServiceLogs(ctx context.Context, service, level string, beforeCursor int64, limit int) ([]ClickHouseLogEntry, error) {
	if c == nil || c.conn == nil {
		return nil, fmt.Errorf("clickhouse client is not initialized")
	}
	if limit <= 0 {
		limit = 50
	}

	rows, err := c.conn.Query(ctx, `
		SELECT created_at, cursor, service, level, message, metadata, request_id, source
		FROM service_logs
		WHERE (? = '' OR service = ?)
		  AND (? = '' OR level = ?)
		  AND (? = 0 OR cursor < ?)
		ORDER BY cursor DESC
		LIMIT ?
	`,
		service,
		service,
		level,
		level,
		beforeCursor,
		beforeCursor,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]ClickHouseLogEntry, 0)
	for rows.Next() {
		item := ClickHouseLogEntry{}
		if err := rows.Scan(
			&item.Timestamp,
			&item.Cursor,
			&item.Service,
			&item.Level,
			&item.Message,
			&item.Metadata,
			&item.RequestID,
			&item.Source,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, nil
}

func (c *ClickHouse) ListServiceLogsAfter(ctx context.Context, service, level string, afterCursor int64, limit int) ([]ClickHouseLogEntry, error) {
	if c == nil || c.conn == nil {
		return nil, fmt.Errorf("clickhouse client is not initialized")
	}
	if limit <= 0 {
		limit = 100
	}

	rows, err := c.conn.Query(ctx, `
		SELECT created_at, cursor, service, level, message, metadata, request_id, source
		FROM service_logs
		WHERE (? = '' OR service = ?)
		  AND (? = '' OR level = ?)
		  AND cursor > ?
		ORDER BY cursor ASC
		LIMIT ?
	`,
		service,
		service,
		level,
		level,
		afterCursor,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]ClickHouseLogEntry, 0)
	for rows.Next() {
		item := ClickHouseLogEntry{}
		if err := rows.Scan(
			&item.Timestamp,
			&item.Cursor,
			&item.Service,
			&item.Level,
			&item.Message,
			&item.Metadata,
			&item.RequestID,
			&item.Source,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, nil
}

func (c *ClickHouse) ListDistinctLogServices(ctx context.Context) ([]string, error) {
	if c == nil || c.conn == nil {
		return nil, fmt.Errorf("clickhouse client is not initialized")
	}

	rows, err := c.conn.Query(ctx, `
		SELECT DISTINCT service
		FROM service_logs
		ORDER BY service
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	services := make([]string, 0)
	for rows.Next() {
		var service string
		if err := rows.Scan(&service); err != nil {
			return nil, err
		}
		services = append(services, service)
	}
	return services, nil
}
