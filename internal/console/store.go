// Package console — console.ondex.uz ning server qismi: dasturchi hisobi, API kalit boshqaruvi,
// foydalanish statistikasi, hisob-faktura ko'rinishi.
//
// Baza roli: `ondexmap_console` (migrations/0012). U obuna flagi, ekotizim belgisi, hisob holati
// va pul ustunlariga YOZA OLMAYDI — konsol to'liq buzilsa ham hujumchi o'ziga obuna bera olmaydi.
// Shartnoma: docs/developer-platform.md
package console

import (
	"context"
	"errors"
	"time"
)

// Store xatolari.
var (
	ErrNotFound = errors.New("topilmadi")
	ErrConflict = errors.New("ziddiyat")
)

// Account — dasturchi hisobi.
type Account struct {
	ID                string
	Email             string
	Name              string
	Suspended         bool
	Subscription      bool
	Ecosystem         bool
	SubscriptionSince *time.Time
	CreatedAt         time.Time
	// Overdue — muddati o'tgan (OverdueGrace dan ortiq) to'lanmagan hisob-faktura bor.
	Overdue bool
}

// Session — kirilgan sessiya.
type Session struct {
	AccountID string
	CSRF      string
	CreatedAt time.Time
	ExpiresAt time.Time
	LastSeen  time.Time
}

// OTP — bir martalik kod yozuvi.
type OTP struct {
	ID        int64
	CodeHash  []byte
	ExpiresAt time.Time
	Attempts  int
	Consumed  bool
	CreatedAt time.Time
}

// Key — API kalit (sirsiz).
type Key struct {
	ID         string
	Name       string
	Kind       string
	Prefix     string
	APIs       []string
	Origins    []string
	IPs        []string
	Status     string
	ExpiresAt  *time.Time
	CreatedAt  time.Time
	LastUsedAt *time.Time
}

// NewKey — yaratiladigan kalit (xesh bilan).
type NewKey struct {
	AccountID string
	Name      string
	Kind      string
	Prefix    string
	Hash      []byte
	APIs      []string
	Origins   []string
	IPs       []string
	ExpiresAt *time.Time
}

// KeyEdit — o'zgartiriladigan maydonlar.
type KeyEdit struct {
	Name    string
	APIs    []string
	Origins []string
	IPs     []string
}

// UsageDay — (kun, kalit, API) bo'yicha qator.
type UsageDay struct {
	Day      time.Time
	KeyID    string
	API      string
	Requests int64
	Errors   int64
}

// Invoice — hisob-faktura.
type Invoice struct {
	ID          string
	Number      string
	PeriodStart time.Time
	PeriodEnd   time.Time
	AmountUZS   int64
	Status      string
	IssuedAt    time.Time
	DueAt       time.Time
	PaidAt      *time.Time
}

// Store — konsolning baza qatlami (testlarda almashtiriladi).
type Store interface {
	// Hisob
	AccountByEmail(ctx context.Context, email string) (*Account, error)
	CreateAccount(ctx context.Context, email string) (*Account, error) // mavjud bo'lsa mavjudini qaytaradi
	AccountByID(ctx context.Context, id string) (*Account, error)
	UpdateName(ctx context.Context, id, name string) error
	TouchLogin(ctx context.Context, id string, at time.Time) error

	// Bir martalik kodlar
	CreateOTP(ctx context.Context, email string, hash []byte, expires time.Time) error
	LatestOTP(ctx context.Context, email string) (*OTP, error)
	CountOTPsSince(ctx context.Context, email string, since time.Time) (int, error)
	BumpOTPAttempts(ctx context.Context, id int64) error
	// ConsumeOTP — atomik: faqat hali ishlatilmagan bo'lsa true.
	ConsumeOTP(ctx context.Context, id int64, at time.Time) (bool, error)

	// Sessiyalar (token xeshi bo'yicha)
	CreateSession(ctx context.Context, tokenHash []byte, accountID, csrf string, expires time.Time, ipHash, ua string) error
	SessionByHash(ctx context.Context, tokenHash []byte) (*Session, error)
	TouchSession(ctx context.Context, tokenHash []byte, at time.Time) error
	DeleteSession(ctx context.Context, tokenHash []byte) error

	// Kalitlar
	CountActiveKeys(ctx context.Context, accountID string) (int, error)
	ListKeys(ctx context.Context, accountID string) ([]Key, error)
	KeyByID(ctx context.Context, accountID, id string) (*Key, error)
	CreateKey(ctx context.Context, k NewKey) (*Key, error)
	UpdateKey(ctx context.Context, accountID, id string, e KeyEdit) error
	RevokeKey(ctx context.Context, accountID, id string, at time.Time) error
	// RotateKey — bitta tranzaksiyada: yangi kalit yaratadi, eskisining muddatini `oldExpires` ga qisqartiradi.
	RotateKey(ctx context.Context, accountID, oldID string, k NewKey, oldExpires time.Time) (*Key, error)

	// Foydalanish va hisob-faktura
	UsageDaily(ctx context.Context, accountID string, from, to time.Time) ([]UsageDay, error)
	Invoices(ctx context.Context, accountID string) ([]Invoice, error)
	HasOpenSubscriptionRequest(ctx context.Context, accountID string) (bool, error)
	CreateSubscriptionRequest(ctx context.Context, accountID, note string) error

	// Audit va tozalash
	Audit(ctx context.Context, actor, action, target, ipHash string, detail map[string]any) error
	PurgeExpired(ctx context.Context, now time.Time) error
}
