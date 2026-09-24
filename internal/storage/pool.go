// Package storage — PostGIS bilan ishlash qatlami.
//
// XAVFSIZLIK TAMOYILLARI (butun paket bo'ylab):
//
//  1. Barcha so'rovlar PARAMETRLI ($1, $2). SQL satriga foydalanuvchi
//     kiritgan qiymat HECH QACHON qo'shilmaydi.
//  2. Har bir so'rovda kontekst muddati bor — sekin so'rov serverni
//     ushlab tura olmaydi.
//  3. Natija soni CHEKLANGAN — chaqiruvchi million qator so'rab
//     xotirani to'ldira olmaydi.
//  4. SQL xatolari tashqariga chiqmaydi (jadval nomi, ustun nomi,
//     so'rov matni — hujumchi uchun xarita).
package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Pool — pgx ulanish hovuzi ustidagi ingichka qobiq.
type Pool struct {
	*pgxpool.Pool
	r2 photoStore
}

// photoStore — R2 rasm ombori interfeysi.
//
// `storage` paketi AWS SDK'ga BEVOSITA bog'lanmaydi — faqat shu tor
// interfeysga tayanadi (`internal/r2.Store` uni qanoatlantiradi).
// `nil` bo'lsa (WithR2 chaqirilmagan) — rasm o'chirish/yuklash amallari
// jimgina o'tkazib yuboriladi (fail-open EMAS: bu faqat R2'dagi
// obyektni tozalash, DB tranzaksiyasi allaqachon muvaffaqiyatli
// yakunlangan bo'ladi).
type photoStore interface {
	Upload(ctx context.Context, key string, data []byte, contentType string) error
	Delete(ctx context.Context, key string) error
	DeleteMany(ctx context.Context, keys []string) error
}

// WithR2 — R2 do'konini ulaydi (moderatsiya rad etilgan/o'chirilgan
// rasmlarni tozalashi uchun). Ixtiyoriy: chaqirilmasa, R2 obyektlari
// tozalanmaydi (baza qatori baribir o'chadi/o'zgaradi — faqat orfan
// obyekt qoladi, xavfsizlik buzilmaydi).
func (p *Pool) WithR2(store photoStore) *Pool {
	p.r2 = store
	return p
}

// ReadOnly — API uchun hovuz.
//
// `default_transaction_read_only=on` — HIMOYANING IKKINCHI QATLAMI.
// Birinchi qatlam bazadagi rol grantlari (`0002_least_privilege.sql`):
// `ondexmap_app` da yozish huquqi umuman yo'q. Bu sozlama esa
// kod darajasida ham qulflaydi — kimdir kelajakda rolga tasodifan
// INSERT huquqi bersa, ulanish baribir yozishga ruxsat bermaydi.
//
// Ikkalasi mustaqil ishlaydi: bittasi buzilsa ikkinchisi ushlab qoladi.
func ReadOnly(ctx context.Context, dsn string) (*Pool, error) {
	return newPool(ctx, dsn, true)
}

// ReadWrite — FAQAT lokal vositalar uchun (migratsiya, import).
// HTTP serverida ishlatilmaydi.
func ReadWrite(ctx context.Context, dsn string) (*Pool, error) {
	return newPool(ctx, dsn, false)
}

// OpenMeter — `ondexmap_meter` roli (cmd/api): dasturchi kalitini O'QIYDI va faqat hisoblagichga
// (api_usage_daily) yozadi. Hovuz kichik: hisoblash yo'li asosiy o'qish hovuzini band qilmasin.
func OpenMeter(ctx context.Context, dsn string) (*Pool, error) {
	return newPoolOpts(ctx, dsn, false, 4, "ondexmap-api-meter")
}

// OpenConsole — `ondexmap_console` roli (cmd/console): hisob/kalit/sessiya boshqaruvi.
// Obuna flagi, ekotizim belgisi va pul ustunlariga grantlar YO'Q (migrations/0012).
func OpenConsole(ctx context.Context, dsn string) (*Pool, error) {
	return newPoolOpts(ctx, dsn, false, 8, "ondexmap-console")
}

func newPool(ctx context.Context, dsn string, readOnly bool) (*Pool, error) {
	return newPoolOpts(ctx, dsn, readOnly, 10, "")
}

// newPoolOpts — `newPool` ning sozlanadigan varianti. `appName` bo'sh bo'lsa
// standart nom qo'yiladi; `maxConns` — hovuz chegarasi (yuboruvchi hovuzi
// kichik: u ommaviy yozish yo'li va bazani band qilib qo'ymasligi kerak).
func newPoolOpts(ctx context.Context, dsn string, readOnly bool, maxConns int32, appName string) (*Pool, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		// DIQQAT: `err` da ulanish satri (parol bilan) bo'lishi mumkin —
		// shuning uchun u O'RALMAYDI va tashqariga uzatilmaydi.
		return nil, fmt.Errorf("DATABASE_URL noto'g'ri formatda")
	}

	// ── Hovuz chegaralari ────────────────────────────────────────────
	// Chegarasiz hovuz sekin so'rovlar oqimida bazadagi barcha
	// ulanishlarni yeb qo'yadi (Postgres standarti — 100 ta) va
	// ADMIN ham ulana olmay qoladi.
	cfg.MaxConns = maxConns
	cfg.MinConns = 1
	cfg.MaxConnLifetime = 30 * time.Minute
	cfg.MaxConnIdleTime = 5 * time.Minute
	cfg.HealthCheckPeriod = 30 * time.Second
	cfg.ConnConfig.ConnectTimeout = 5 * time.Second

	// ── Har bir ulanish uchun sessiya sozlamalari ────────────────────
	params := cfg.ConnConfig.RuntimeParams
	// Sekin so'rov himoyasi: 10 soniyadan uzun so'rov BAZA tomonidan
	// uziladi. Go tomondagi kontekst muddatiga qo'shimcha — klient
	// uzilib ketsa ham so'rov serverda osilib qolmaydi.
	params["statement_timeout"] = "10000"
	// Bo'sh tranzaksiya ochiq qolmasin.
	params["idle_in_transaction_session_timeout"] = "30000"
	params["application_name"] = "ondexmap-api"
	if readOnly {
		params["default_transaction_read_only"] = "on"
		params["application_name"] = "ondexmap-api-ro"
	}
	if appName != "" {
		params["application_name"] = appName
	}

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("bazaga ulanib bo'lmadi")
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("baza javob bermayapti (docker compose up -d qilinganmi?)")
	}
	return &Pool{Pool: pool}, nil
}
