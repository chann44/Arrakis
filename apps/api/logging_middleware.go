package main

import (
	"net/http"
	"strings"
	"time"

	"github.com/chann44/TGE/adapters"
	"github.com/go-chi/chi/v5/middleware"
)

func requestAuditMiddleware(logger *adapters.CentralLogger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if logger == nil {
				next.ServeHTTP(w, r)
				return
			}

			start := time.Now()
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			next.ServeHTTP(ww, r)

			path := strings.TrimSpace(r.URL.Path)
			if path == "" {
				path = "/"
			}

			logger.Log(r.Context(), "api", "info", "http request completed", map[string]any{
				"method":      r.Method,
				"path":        path,
				"status_code": ww.Status(),
				"duration_ms": time.Since(start).Milliseconds(),
				"request_id":  middleware.GetReqID(r.Context()),
			})
		})
	}
}
