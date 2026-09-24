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
	"ondexmap/internal/devplatform"
	"ondexmap/internal/httpapi"
	"ondexmap/internal/r2"
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

	// ── R2 (ixtiyoriy): rasm ombori ───────────────────────────────────
	// Sozlanmagan bo'lsa rasm bilan bog'liq amallar 503 qaytaradi
	// (fail-closed, OSRM/Mapbox kabi).
	var store *r2.Store
	{
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		s, err := r2.FromConfig(ctx, cfg.R2AccountID, cfg.R2AccessKeyID, cfg.R2SecretAccessKey, cfg.R2Bucket)
		cancel()
		if err != nil {
			slog.Error("R2 ulanishi ochilmadi", "err", err)
			os.Exit(1)
		}
		store = s
		if store != nil {
			slog.Info("R2 ombori ulandi", "bucket", cfg.R2Bucket)
		} else {
			slog.Warn("R2 sozlanmagan — rasm bilan bog'liq endpointlar o'chiq")
		}
	}

	// ── Karantinga yozuvchi (ixtiyoriy) ──────────────────────────────
	// Ommaviy API'ning YAGONA yozish yo'li: foydalanuvchi ob'ekti
	// `place_submissions` ga tushadi, xaritaga emas (admin tasdiqlaydi).
	// `ondexmap_submit` roli faqat shu jadvallarga INSERT qila oladi.
	// `SUBMIT_DATABASE_URL` bo'sh bo'lsa qabul qilish O'CHIQ (503).
	api := httpapi.New(cfg, db)
	if store != nil {
		api.WithR2(store)
	}
	if cfg.SubmitDatabaseURL != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		sub, err := storage.OpenSubmitter(ctx, cfg.SubmitDatabaseURL)
		cancel()
		if err != nil {
			slog.Error("yuborish ulanishi ochilmadi", "err", err)
			os.Exit(1)
		}
		defer sub.Close()
		if store != nil {
			sub.WithR2(store)
		}
		api.WithSubmitter(sub)
		slog.Info("ob'ekt qabul qilish yoqilgan (karantinga yozadi)")
		// ⚠️ Proksi ortida TRUSTED_PROXIES bo'lmasa hamma foydalanuvchi bitta IP
		// (proksi IP'si) bo'lib ko'rinadi: rate limit va soatlik chegara ularni
		// BIR odam deb sanaydi va 8 ta taklifdan keyin HAMMA bloklanadi.
		if !cfg.DevMode && len(cfg.TrustedProxies) == 0 {
			slog.Warn("TRUSTED_PROXIES bo'sh — proksi ortida barcha foydalanuvchilar bitta IP bo'lib sanaladi va ob'ekt yuborish chegarasi hammani bloklaydi")
		}
	} else {
		slog.Warn("SUBMIT_DATABASE_URL yo'q — ob'ekt qabul qilish o'chiq")
	}

	// ── Dasturchilar platformasi (/v2) ───────────────────────────────
	// `ondexmap_meter` roli: dasturchi kalitini O'QIYDI va faqat hisoblagichga yozadi.
	// METER_DATABASE_URL bo'sh bo'lsa /v2 O'CHIQ (503), /v1 esa o'zgarishsiz ishlaydi.
	meterCtx, stopMeter := context.WithCancel(context.Background())
	meterDone := make(chan struct{})
	if cfg.PlatformEnabled() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		mp, err := storage.OpenMeter(ctx, cfg.MeterDatabaseURL)
		cancel()
		if err != nil {
			slog.Error("hisoblagich ulanishi ochilmadi", "err", err)
			os.Exit(1)
		}
		defer mp.Close()
		plat := devplatform.New(devplatform.NewPGStore(mp),
			devplatform.Config{Pepper: []byte(cfg.KeyPepper), Plans: devplatform.DefaultPlans()})
		api.WithPlatform(plat)
		go func() {
			defer close(meterDone)
			plat.Meter().Run(meterCtx, 10*time.Second)
		}()
		slog.Info("dasturchi API'si (/v2) yoqilgan", "v1_first_party_only", cfg.V1FirstPartyOnly)
	} else {
		close(meterDone)
		slog.Warn("METER_DATABASE_URL yo'q — dasturchi API'si (/v2) o'chiq")
	}

	srv := &http.Server{
		Addr:    cfg.HTTPAddr,
		Handler: api.Handler(),
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
	// So'rovlar tugadi — endi hisoblagichning OXIRGI yuvilishini kutamiz (hisob yo'qolmasin).
	stopMeter()
	select {
	case <-meterDone:
	case <-time.After(10 * time.Second):
		slog.Error("hisoblagich yuvilishi kutilgan vaqtda tugamadi")
	}
	slog.Info("to'xtatildi")
}
