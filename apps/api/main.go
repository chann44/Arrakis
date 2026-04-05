package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/chann44/TGE/adapters"
	internal "github.com/chann44/TGE/internals"
	db "github.com/chann44/TGE/internals/db"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/hibiken/asynq"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	port := "8080"
	shutdownTimeout := time.Second * 5
	cfg := internal.GetConfig()

	postgresPool, err := adapters.NewPostgres(ctx, cfg)
	if err != nil {
		log.Fatalf("api: failed to initialize postgres: %v", err)
	}
	defer postgresPool.Close()
	queries := db.New(postgresPool)

	redisAddr := fmt.Sprintf("%s:%s", cfg.RedisHost, cfg.RedisPort)
	redisClient, err := adapters.NewRedis(redisAddr, "", 0)
	if err != nil {
		log.Fatalf("api: failed to initialize redis: %v", err)
	}
	defer func() {
		if err := redisClient.Close(); err != nil {
			log.Printf("api: failed to close redis client: %v", err)
		}
	}()

	clickhouseClient, err := adapters.NewClickHouse(ctx, cfg)
	if err != nil {
		log.Printf("api: clickhouse unavailable, logs API degraded: %v", err)
	}
	centralLogger := adapters.NewCentralLogger(clickhouseClient, "api")
	centralLogger.Log(ctx, "api", "info", "api process started", map[string]any{"port": port})

	asynqClient := asynq.NewClient(asynq.RedisClientOpt{Addr: redisAddr})
	defer func() {
		if err := asynqClient.Close(); err != nil {
			log.Printf("api: failed to close asynq client: %v", err)
		}
	}()

	handler := NewHandler(cfg, redisClient, clickhouseClient, centralLogger, postgresPool, queries, asynqClient)

	r := chi.NewRouter()
	r.Use(
		middleware.RequestID,
		middleware.RealIP,
		middleware.Logger,
		middleware.Recoverer,
		requestAuditMiddleware(centralLogger),
	)
	registerRoutes(r, handler)

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Printf("api listening on :%s", port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	select {
	case <-ctx.Done():
		log.Println("api: shutdown signal received")
	case err := <-errCh:
		log.Printf("api: server error: %v", err)
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("api: graceful shutdown failed: %v", err)
	}
	log.Println("api: stopped")

}
