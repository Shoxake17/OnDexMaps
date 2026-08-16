// OnDexMap API serveri.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"ondexmap/internal/config"
	"ondexmap/internal/httpapi"
	"ondexmap/internal/storage"
)

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, nil)))

	cfg, err := config.Load(".env")
	if err != nil {
		// Sozlama xatosi = ishga tushmaslik. Jimgina zaif rejimda
		// ishlashdan ko'ra yiqilgan ma'qul.
		slog.Error("server ishga tushmadi", "err", err)
		os.Exit(1)
	}

	if cfg.DevMode {
		slog.Warn("DEV REJIM (APP_ENV=development) — kalit va CORS talablari yumshatilgan")
	} else {
		slog.Info("production rejim", "app_env", cfg.AppEnv)
	}

	// ── Baza: FAQAT O'QISH ───────────────────────────────────────────
	// API `ondexmap_app` roli bilan ulanadi — unda yozish huquqi
	// umuman yo'q (migrations/0002_least_privilege.sql).
	//
	// DIQQAT: bu yerda `DATABASE_URL_MIGRATE` ATAYLAB ISHLATILMAYDI.
	// Baza egasi bilan ulanish HTTP serverida hech qachon ochilmaydi.
	var db *storage.Pool
	if cfg.DatabaseURL != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		pool, err := storage.ReadOnly(ctx, cfg.DatabaseURL)
		cancel()
		if err != nil {
			slog.Error("bazaga ulanib bo'lmadi", "err", err)
			os.Exit(1)
		}
		defer pool.Close()
		db = pool
		slog.Info("bazaga ulandi (faqat o'qish)")
	} else {
		slog.Warn("DATABASE_URL yo'q — geo endpointlar ishlamaydi")
	}

	srv := &http.Server{
		Addr:    cfg.HTTPAddr,
		Handler: httpapi.New(cfg, db).Handler(),
		// ANIQ timeout'lar — nol qiymatli `http.Server` ularsiz keladi,
		// ya'ni sekin klient ulanishni CHEKSIZ ushlab tura oladi va
		// ochiq ulanishlar to'planib serverni bo'g'adi (slowloris).
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 16, // 64 KB
	}

	// ── Nazokatli to'xtash ───────────────────────────────────────────
	// Deploy paytida boshlangan so'rovlar yarmida uzilib qolmasin.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		slog.Info("OnDexMap API tinglayapti", "addr", cfg.HTTPAddr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server xatosi", "err", err)
			os.Exit(1)
		}
	}()

	<-stop
	slog.Info("to'xtatish signali olindi, joriy so'rovlar yakunlanmoqda")

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("nazokatli to'xtash muvaffaqiyatsiz", "err", err)
		os.Exit(1)
	}
	slog.Info("to'xtatildi")
}
