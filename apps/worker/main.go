package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/chann44/TGE/adapters"
	internal "github.com/chann44/TGE/internals"
	db "github.com/chann44/TGE/internals/db"
	"github.com/chann44/TGE/internals/jobs"
	"github.com/chann44/TGE/services"
	"github.com/hibiken/asynq"
)

func writeWorkerLog(ctx context.Context, logger *adapters.CentralLogger, level, message string, metadata map[string]any) {
	if logger == nil {
		return
	}
	logger.Log(ctx, "worker", level, message, metadata)
}

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg := internal.GetConfig()

	postgresPool, err := adapters.NewPostgres(ctx, cfg)
	if err != nil {
		log.Fatalf("worker: failed to initialize postgres: %v", err)
	}
	defer postgresPool.Close()

	queries := db.New(postgresPool)
	redisAddr := fmt.Sprintf("%s:%s", cfg.RedisHost, cfg.RedisPort)
	redisClient, err := adapters.NewRedis(redisAddr, "", 0)
	if err != nil {
		log.Fatalf("worker: failed to initialize redis: %v", err)
	}
	defer func() {
		if closeErr := redisClient.Close(); closeErr != nil {
			log.Printf("worker: failed to close redis client: %v", closeErr)
		}
	}()

	clickhouseClient, err := adapters.NewClickHouse(ctx, cfg)
	if err != nil {
		log.Printf("worker: clickhouse unavailable, live logs disabled: %v", err)
	}
	centralLogger := adapters.NewCentralLogger(clickhouseClient, "worker")
	centralLogger.Log(ctx, "worker", "info", "worker process started", map[string]any{"queue": "dependencies"})

	srv := asynq.NewServer(
		asynq.RedisClientOpt{Addr: redisAddr},
		asynq.Config{
			Concurrency: 4,
			Queues: map[string]int{
				"dependencies": 10,
			},
		},
	)

	mux := asynq.NewServeMux()
	mux.HandleFunc(jobs.TypeDependencySync, func(ctx context.Context, task *asynq.Task) error {
		payload, err := jobs.ParseDependencySyncPayload(task)
		if err != nil {
			return fmt.Errorf("parse payload: %w", asynq.SkipRetry)
		}

		lockKey := fmt.Sprintf("deps:repo-lock:%d", payload.RepoID)
		lockValue := fmt.Sprintf("sync:%d:%d", payload.SyncID, time.Now().UnixNano())
		acquired, err := redisClient.SetNX(ctx, lockKey, lockValue, 45*time.Minute)
		if err != nil {
			return fmt.Errorf("acquire repo lock: %w", err)
		}
		if !acquired {
			if payload.SyncID != 0 {
				_ = queries.MarkRepositoryDependencySyncFailed(ctx, db.MarkRepositoryDependencySyncFailedParams{
					ID:           payload.SyncID,
					ErrorMessage: "sync already running for repository",
				})
			}
			log.Printf("worker skip dependency sync repo_id=%d sync_id=%d reason=locked", payload.RepoID, payload.SyncID)
			writeWorkerLog(ctx, centralLogger, "warn", "dependency sync skipped because repository lock is held", map[string]any{
				"repo_id": payload.RepoID,
				"sync_id": payload.SyncID,
			})
			return nil
		}
		defer func() {
			_ = redisClient.CompareAndDelete(ctx, lockKey, lockValue)
		}()

		started := time.Now()
		log.Printf("worker start dependency sync repo_id=%d sync_id=%d trigger=%s", payload.RepoID, payload.SyncID, payload.Trigger)
		writeWorkerLog(ctx, centralLogger, "info", "dependency sync started", map[string]any{
			"repo_id": payload.RepoID,
			"sync_id": payload.SyncID,
			"trigger": payload.Trigger,
		})
		if err := services.SyncRepositoryDependencies(ctx, queries, cfg, payload.UserID, payload.RepoID, payload.SyncID, payload.Trigger, payload.Force); err != nil {
			log.Printf("worker dependency sync failed repo_id=%d sync_id=%d err=%v", payload.RepoID, payload.SyncID, err)
			writeWorkerLog(ctx, centralLogger, "error", "dependency sync failed", map[string]any{
				"repo_id": payload.RepoID,
				"sync_id": payload.SyncID,
				"error":   err.Error(),
			})
			return err
		}
		log.Printf("worker dependency sync complete repo_id=%d sync_id=%d duration=%s", payload.RepoID, payload.SyncID, time.Since(started).String())
		writeWorkerLog(ctx, centralLogger, "info", "dependency sync completed", map[string]any{
			"repo_id":      payload.RepoID,
			"sync_id":      payload.SyncID,
			"duration":     time.Since(started).String(),
			"trigger":      payload.Trigger,
			"requested_by": payload.UserID,
		})
		return nil
	})

	errCh := make(chan error, 1)
	go func() {
		log.Printf("worker listening on queue dependencies")
		if runErr := srv.Run(mux); runErr != nil {
			errCh <- runErr
		}
	}()

	select {
	case <-ctx.Done():
		log.Println("worker: shutdown signal received")
		srv.Shutdown()
	case runErr := <-errCh:
		log.Fatalf("worker: server error: %v", runErr)
	}
}
