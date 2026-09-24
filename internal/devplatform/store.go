package devplatform

import (
	"context"
	"errors"
	"net/netip"
	"time"
)

// ErrNotFound — kalit/yozuv topilmadi.
var ErrNotFound = errors.New("topilmadi")

// KeyRecord — bazadagi kalit + uning hisobining holati (bitta so'rovda o'qiladi).
type KeyRecord struct {
	ID        string
	AccountID string
	Kind      string
	Prefix    string
	APIs      []string
	Origins   []string
	IPs       []netip.Prefix
	ExpiresAt *time.Time
	Revoked   bool
	Account   AccountState
}

// UsageRow — bitta (kalit, kun, API) uchun ORTIRMA (delta). Bazaga `+=` bilan qo'shiladi.
type UsageRow struct {
	KeyID    string
	Day      time.Time // UTC, faqat sana
	API      string
	Requests int64
	Errors   int64
}

// Store — cmd/api (meter roli) ishlatadigan tor interfeys. Testlarda almashtiriladi.
type Store interface {
	// LookupKey — kalit xeshi bo'yicha. Topilmasa ErrNotFound.
	LookupKey(ctx context.Context, hash []byte) (*KeyRecord, error)
	// MonthUsage — hisobning oy boshidan beri HISOBLANGAN so'rovlari (barcha kalitlar yig'indisi).
	MonthUsage(ctx context.Context, accountID string, monthStart time.Time) (int64, error)
	// WriteUsage — ortirmalarni bazaga qo'shadi (atomik, idempotent EMAS: bir marta chaqiring).
	WriteUsage(ctx context.Context, rows []UsageRow) error
	// TouchKeys — kalitlarning oxirgi ishlatilgan vaqtini yangilaydi.
	TouchKeys(ctx context.Context, ids []string, at time.Time) error
}
