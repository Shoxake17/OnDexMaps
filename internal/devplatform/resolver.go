package devplatform

import (
	"context"
	"encoding/hex"
	"errors"
	"sync"
	"time"
)

// ErrInvalidKey — kalit noma'lum, noto'g'ri shaklda, bekor qilingan yoki muddati tugagan.
// Sabab ATAYLAB ajratilmaydi: har biri hujumchiga alohida ma'lumot berardi.
var ErrInvalidKey = errors.New("kalit yaroqsiz")

// Key — tekshirilgan kalit + uning hozirgi tarifi.
type Key struct {
	KeyRecord
	Plan Plan
}

// Resolver — kalitni bazadan topadi va KESHLAYDI.
//
// Kesh nega kerak: har so'rovda bazaga bormaslik uchun. Bedavo emas — bekor qilingan kalit
// posTTL (standart 15 s) gacha ishlashda davom etishi mumkin: bu ongli kelishuv, hujjatlashtirilgan.
// Manfiy kesh (noma'lum kalit) — kalit taxmin qilish hujumi bazani bo'g'masin.
type Resolver struct {
	store  Store
	pepper []byte
	plans  Plans
	now    func() time.Time

	posTTL, negTTL time.Duration
	maxEntries     int

	mu  sync.Mutex
	pos map[string]posEntry
	neg map[string]time.Time
}

type posEntry struct {
	rec *KeyRecord
	at  time.Time
}

// NewResolver — pepper kamida 32 bayt bo'lishi shart (chaqiruvchi konfiguratsiyada tekshiradi).
func NewResolver(store Store, pepper []byte, plans Plans) *Resolver {
	return &Resolver{
		store: store, pepper: pepper, plans: plans, now: time.Now,
		posTTL: 15 * time.Second, negTTL: 30 * time.Second, maxEntries: 20000,
		pos: map[string]posEntry{}, neg: map[string]time.Time{},
	}
}

// Resolve — `secret` (mijoz yuborgan kalit) bo'yicha tekshirilgan Key yoki ErrInvalidKey.
func (r *Resolver) Resolve(ctx context.Context, secret string) (*Key, error) {
	if _, ok := KindOf(secret); !ok {
		return nil, ErrInvalidKey // format noto'g'ri: bazaga/HMAC'ga ham bormaymiz
	}
	hash := HashKey(r.pepper, secret)
	ck := hex.EncodeToString(hash)
	now := r.now()

	r.mu.Lock()
	if until, ok := r.neg[ck]; ok {
		if now.Before(until) {
			r.mu.Unlock()
			return nil, ErrInvalidKey
		}
		delete(r.neg, ck)
	}
	e, hit := r.pos[ck]
	if hit && now.Sub(e.at) > r.posTTL {
		delete(r.pos, ck)
		hit = false
	}
	r.mu.Unlock()

	rec := e.rec
	if !hit {
		var err error
		rec, err = r.store.LookupKey(ctx, hash)
		if errors.Is(err, ErrNotFound) {
			r.mu.Lock()
			r.evictIfFull()
			r.neg[ck] = now.Add(r.negTTL)
			r.mu.Unlock()
			return nil, ErrInvalidKey
		}
		if err != nil {
			return nil, err // baza xatosi: chaqiruvchi 5xx qaytaradi, kalitni "yaroqsiz" DEMAYDI
		}
		r.mu.Lock()
		r.evictIfFull()
		r.pos[ck] = posEntry{rec: rec, at: now}
		r.mu.Unlock()
	}

	// Bekor qilingan / muddati tugagan — har chaqiruvda tekshiriladi (keshdan qat'i nazar).
	if rec.Revoked || (rec.ExpiresAt != nil && !now.Before(*rec.ExpiresAt)) {
		return nil, ErrInvalidKey
	}
	return &Key{KeyRecord: *rec, Plan: r.plans.For(rec.Account)}, nil
}

// evictIfFull — xotira chegarasi (mu ushlab turilgan holda chaqiriladi). To'lsa hammasi tozalanadi:
// oddiy va xavfsiz (kesh — faqat tezlashtirish, haqiqat manbai baza).
func (r *Resolver) evictIfFull() {
	if len(r.pos)+len(r.neg) >= r.maxEntries {
		r.pos = map[string]posEntry{}
		r.neg = map[string]time.Time{}
	}
}
