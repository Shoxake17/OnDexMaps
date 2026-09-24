// OnDexMap Console API (console.ondex.uz): dasturchi hisobi, API kalitlar, foydalanish, hisob-faktura.
//
// Baza: `ondexmap_console` roli (obuna/ekotizim/pul ustunlariga yozish huquqi YO'Q).
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
	"ondexmap/internal/console"
	"ondexmap/internal/devplatform"
	"ondexmap/internal/storage"
)

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, nil)))

	cfg, err := config.Load(".env")
	if err != nil {
		slog.Error("konsol ishga tushmadi", "err", err)
		os.Exit(1)
	}
	if !cfg.ConsoleEnabled() {
		slog.Error("CONSOLE_DATABASE_URL yo'q — konsol ishga tushmaydi")
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	pool, err := storage.OpenConsole(ctx, cfg.ConsoleDatabaseURL)
	cancel()
	if err != nil {
		slog.Error("bazaga ulanib bo'lmadi", "err", err)
		os.Exit(1)
	}
	defer pool.Close()
	store := console.NewPGStore(pool)

	var mail console.Mailer = console.NewResendMailer(cfg.ResendAPIKey, cfg.MailFrom)
	if cfg.ResendAPIKey == "" {
		if !cfg.DevMode {
			slog.Error("RESEND_API_KEY yo'q (production)")
			os.Exit(1)
		}
		mail = console.LogMailer{}
		slog.Warn("DEV: kirish kodlari emailga emas, logga yoziladi")
	}

	srv := console.New(console.Config{
		Pepper:              []byte(cfg.KeyPepper),
		Origin:              cfg.ConsoleOrigin,
		Secure:              !cfg.DevMode,
		TrustedProxies:      cfg.TrustedProxies,
		BillingInstructions: cfg.BillingInstructions,
		TurnstileSecret:     cfg.TurnstileSecret,
		Plans:               devplatform.DefaultPlans(),
	}, store, mail)

	stopCtx, stop := context.WithCancel(context.Background())
	defer stop()
	go func() { // muddati o'tgan sessiya va kodlarni tozalash
		t := time.NewTicker(time.Hour)
		defer t.Stop()
		for {
			select {
			case <-stopCtx.Done():
				return
			case <-t.C:
				if err := store.PurgeExpired(stopCtx, time.Now()); err != nil {
					slog.Warn("eski yozuvlar tozalanmadi", "err", err)
				}
			}
		}
	}()

	httpSrv := &http.Server{
		Addr:              cfg.ConsoleHTTPAddr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 16,
	}

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	go func() {
		slog.Info("OnDexMap Console tinglayapti", "addr", cfg.ConsoleHTTPAddr)
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server xatosi", "err", err)
			os.Exit(1)
		}
	}()

	<-sig
	slog.Info("to'xtatish signali olindi")
	shutCtx, shutCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutCancel()
	if err := httpSrv.Shutdown(shutCtx); err != nil {
		slog.Error("nazokatli to'xtash muvaffaqiyatsiz", "err", err)
		os.Exit(1)
	}
	slog.Info("to'xtatildi")
}
