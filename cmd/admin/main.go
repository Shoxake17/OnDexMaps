// OnDexMap admin vositasi — ma'lumot kiritish uchun LOKAL server.
//
// ⚠️ Bu binar YOZISH huquqiga ega va ATAYLAB faqat 127.0.0.1 da
// tinglaydi. U hech qachon internetga chiqarilmaydi, reverse-proxy
// orqasiga qo'yilmaydi va prod'da ishga tushirilmaydi.
//
// Ishga tushirish:
//
//	go run ./cmd/admin
//	# keyin: http://127.0.0.1:8091
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"ondexmap/internal/adminapi"
	"ondexmap/internal/config"
	"ondexmap/internal/localsession"
	"ondexmap/internal/r2"
	"ondexmap/internal/storage"
)

// adminAddr — QAT'IY 127.0.0.1.
//
// `:8091` deb yozilsa Go barcha interfeyslarda (0.0.0.0) tinglaydi va
// vosita Wi-Fi tarmog'idagi har kimga ochiq bo'lardi. Bu manzil
// sozlanmaydi — noto'g'ri sozlash imkoniyatining o'zi bo'lmasin.
const adminAddr = "127.0.0.1:8091"

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, nil)))

	cfg, err := config.Load(".env")
	if err != nil {
		slog.Error("sozlama xatosi", "err", err)
		os.Exit(1)
	}

	if !cfg.DevMode {
		// Fail-closed: admin vositasi production sozlamasi bilan
		// ishga tushmaydi. Uni jonli serverda ochish — yozish
		// huquqini o'sha mashinaga olib kirish degani.
		slog.Error("admin vositasi FAQAT dev rejimda ishlaydi (APP_ENV=development)")
		os.Exit(1)
	}
	if strings.TrimSpace(cfg.AdminKey) == "" {
		slog.Error("ONDEXMAP_ADMIN_KEY yo'q (.env) — yozish huquqi kalitsiz ochilmaydi")
		os.Exit(1)
	}
	if cfg.DatabaseURLMigrate == "" {
		slog.Error("DATABASE_URL_MIGRATE yo'q — admin vositasi yozuvchi ulanishni talab qiladi")
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	pool, err := storage.ReadWrite(ctx, cfg.DatabaseURLMigrate)
	cancel()
	if err != nil {
		slog.Error("bazaga ulanib bo'lmadi", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	// ┌─ LOKAL SESSIYA — ikkinchi kirish oynasi o'rniga ───────────────┐
	// Muharrir ChustApp admin panelining ichida ochiladi va u yerda
	// foydalanuvchi ALLAQACHON kirgan bo'ladi. Shu sabab bu yerda
	// bir martalik token yaratiladi; panel uni fayldan o'qib sahifaga
	// beradi va kalit so'raydigan oyna umuman ko'rinmaydi
	// (`internal/localsession` izohiga qarang).
	//
	// Token YARATILMASA ham server ishlaydi — faqat panel uni topa
	// olmaydi. Bu ataylab fatal EMAS: yozish huquqi kalit bilan
	// baribir himoyalangan.
	// └────────────────────────────────────────────────────────────────┘
	sess, err := localsession.Create("http://" + adminAddr)
	if err != nil {
		slog.Warn("lokal sessiya fayli yozilmadi — panelda kalit so'raladi", "err", err)
		sess = nil
	} else {
		slog.Info("lokal sessiya tayyor", "fayl", sess.Path)
		// Fayl jarayon bilan birga o'ladi: o'lgan serverning tokeniga
		// panel ishonib qolmasin.
		defer sess.Remove()
	}
	var sessionKeys []string
	if sess != nil {
		sessionKeys = append(sessionKeys, sess.Token)
	}

	// ── R2 (ixtiyoriy): karantin rasmlarini ko'rish/tozalash uchun ────
	// `pool.WithR2` — rad etish/o'chirishda R2 obyektini ham tozalaydi.
	// `adminSrv.WithR2` — moderatorga rasmni ko'rsatadi (yuklab oladi).
	adminSrv := adminapi.New(cfg, pool, sessionKeys...)
	{
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		store, err := r2.FromConfig(ctx, cfg.R2AccountID, cfg.R2AccessKeyID, cfg.R2SecretAccessKey, cfg.R2Bucket)
		cancel()
		if err != nil {
			slog.Error("R2 ulanishi ochilmadi", "err", err)
			os.Exit(1)
		}
		if store != nil {
			pool.WithR2(store)
			adminSrv.WithR2(store)
			slog.Info("R2 ombori ulandi", "bucket", cfg.R2Bucket)
		} else {
			slog.Warn("R2 sozlanmagan — karantin rasmlarini ko'rish o'chiq")
		}
	}

	srv := &http.Server{
		Addr:              adminAddr,
		Handler:           adminSrv.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 16,
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		slog.Info("admin vositasi tayyor", "url", "http://"+adminAddr)
		slog.Warn("bu vosita YOZISH huquqiga ega — faqat lokal, internetga chiqarilmaydi")
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server xatosi", "err", err)
			os.Exit(1)
		}
	}()

	<-stop
	shutCtx, shutCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutCancel()
	_ = srv.Shutdown(shutCtx)
	slog.Info("to'xtatildi")
}
