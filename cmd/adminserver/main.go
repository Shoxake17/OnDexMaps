// OnDexMap admin serveri — PRODUCTION uchun, Caddy ortida.
//
// ┌─ `cmd/admin`dan FARQI ─────────────────────────────────────────────┐
// `cmd/admin` — operator o'z kompyuterida ishga tushiradigan, FAQAT
// 127.0.0.1'da tinglaydigan, lokal sessiya fayli bilan ishlaydigan
// vosita (o'zgarishsiz qoladi — hali ham shu tarzda ishlaydi).
//
// Bu binar esa xuddi shu `internal/adminapi` handler'ini ATAYLAB
// production konteynerida, tashqi (Caddy orqali proksilanadigan)
// manzilda ishga tushirish uchun mo'ljallangan — masofadan turib
// (masalan boshqa kompyuterdagi ChustApp admin paneli orqali)
// moderatsiya/muharrirlik qilish uchun.
//
// XAVFSIZLIK:
//   - Lokal sessiya fayli YO'Q (masofaviy foydalanuvchi uchun ma'nosiz):
//     yagona autentifikatsiya — `ONDEXMAP_ADMIN_KEY` (`X-API-Key`).
//   - `DevMode` TALAB QILINMAYDI — production `.env` bilan ishlaydi
//     (aks holda `ALLOWED_ORIGINS`/kalitlar kabi boshqa maydonlar ham
//     talab qilinib, ishga tushishga to'sqinlik qilardi).
//   - Baza ulanishi hali ham EGASI (`DATABASE_URL_MIGRATE`) — bu
//     ONGLI RAVISHDA shunday qoldirilgan (kelajakda cheklangan rolga
//     o'tkazish alohida vazifa).
//   - Tashqi portga UMUMAN chiqarilmaydi (`docker-compose.yml`da port
//     mapping yo'q) — faqat Caddy konteyner tarmog'i ichidan yetadi.
//
// Ishga tushirish (production, compose orqali):
//
//	entrypoint: ["/adminserver"]
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
	"ondexmap/internal/storage"
)

// addr — konteyner ICHIDAGI barcha interfeyslarda tinglaydi.
//
// Bu xavfli EMAS: konteyner tashqi portga chiqarilmaydi (compose'da
// port mapping yo'q), faqat bir xil docker tarmog'idagi Caddy uni
// konteyner nomi orqali (`ondexmap-adminserver:8092`) topadi.
const addr = ":8092"

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, nil)))

	cfg, err := config.Load(".env")
	if err != nil {
		slog.Error("sozlama xatosi", "err", err)
		os.Exit(1)
	}
	if strings.TrimSpace(cfg.AdminKey) == "" {
		slog.Error("ONDEXMAP_ADMIN_KEY yo'q — yozish huquqi kalitsiz ochilmaydi")
		os.Exit(1)
	}
	if len(strings.TrimSpace(cfg.AdminKey)) < 32 {
		// `config.validate()` buni production'da TEKSHIRADI, lekin bu
		// binar validate()dan mustaqil (DevMode talab qilmaydi) —
		// shuning uchun bu yerda ham QAYTA tekshiriladi: qisqa kalit
		// internetga chiqqan admin API uchun ayniqsa xavfli.
		slog.Error("ONDEXMAP_ADMIN_KEY juda qisqa (kamida 32 belgi)")
		os.Exit(1)
	}
	if cfg.DatabaseURLMigrate == "" {
		slog.Error("DATABASE_URL_MIGRATE yo'q — admin server yozuvchi ulanishni talab qiladi")
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

	srv := &http.Server{
		Addr:              addr,
		Handler:           adminapi.New(cfg, pool).Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 16,
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		slog.Info("admin server tayyor (production)", "addr", addr)
		slog.Warn("bu server YOZISH huquqiga ega — faqat Caddy orqali, ONDEXMAP_ADMIN_KEY bilan himoyalangan bo'lishi SHART")
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
