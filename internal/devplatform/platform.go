package devplatform

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/netip"
	"strconv"
	"time"
)

// Rad etish kodlari (mijozga qaytadi; barqaror kontrakt — o'zgartirmang).
const (
	CodeMissingKey       = "missing_key"
	CodeInvalidKey       = "invalid_key"
	CodeKeyRestricted    = "key_restricted"
	CodeAccountSuspended = "account_suspended"
	CodeAPINotAllowed    = "api_not_allowed"
	CodeRateLimited      = "rate_limited"
	CodeQuotaExceeded    = "quota_exceeded"
	CodeAuthBlocked      = "auth_blocked"
	CodeUnavailable      = "service_unavailable"
)

// Denial — so'rov rad etilishining sababi (HTTP holati bilan).
type Denial struct {
	Status     int
	Code       string
	Message    string
	RetryAfter time.Duration
}

func (d *Denial) Error() string { return d.Code }

// AuthInput — HTTP qatlami so'rovdan ajratib beradigan kirish.
type AuthInput struct {
	Secret          string // yuborilgan kalit ("" — yo'q)
	SecretFromQuery bool   // kalit URL'dagi ?key= orqali keldimi
	API             string // so'ralayotgan API (APIGeocode ...)
	Origin          string // Origin sarlavhasi ("" — yo'q)
	Referer         string // Referer sarlavhasi ("" — yo'q)
	ClientIP        netip.Addr
}

// Grant — ruxsat berilgan so'rov haqida ma'lumot (javob sarlavhalari va hisoblash uchun).
type Grant struct {
	Key       *Key
	Plan      Plan
	MonthUsed int64 // faqat MonthlyCap > 0 bo'lgan rejalarda to'ldiriladi
}

// Platform — kalit tekshiruvi + hisoblash.
type Platform struct {
	resolver  *Resolver
	meter     *Meter
	limiter   *Limiter
	failGuard *AuthFailGuard
	plans     Plans
	now       func() time.Time
}

// Config — Platform sozlamalari.
type Config struct {
	Pepper []byte
	Plans  Plans
}

// New — store (meter roli) bilan. Meter.Run(ctx, ...) ni alohida ishga tushiring.
func New(store Store, cfg Config) *Platform {
	return &Platform{
		resolver:  NewResolver(store, cfg.Pepper, cfg.Plans),
		meter:     NewMeter(store),
		limiter:   NewLimiter(),
		failGuard: NewAuthFailGuard(20, 20.0/60.0), // 20 ta xato, so'ng daqiqasiga 20 ta tiklanadi
		plans:     cfg.Plans,
		now:       time.Now,
	}
}

// Meter — fon yuvish sikli uchun.
func (p *Platform) Meter() *Meter { return p.meter }

func deny(status int, code, msg string) *Denial {
	return &Denial{Status: status, Code: code, Message: msg}
}

// Authorize — so'rovga ruxsat berish qarori.
//
// TARTIB MUHIM (arzon → qimmat, va ma'lumot sizdirmaslik):
//  1. bloklangan IP → 429 (kalitga qarashdan OLDIN)
//  2. kalit yo'q / yaroqsiz → 401 (sabab ajratilmaydi)
//  3. hisob to'xtatilgan → 403
//  4. kalit turi qoidalari (Origin/IP/URL) → 403
//  5. API ruxsat ro'yxati → 403
//  6. tezlik chegarasi → 429
//  7. oylik chegara (faqat bepul reja) → 429
func (p *Platform) Authorize(ctx context.Context, in AuthInput) (*Grant, *Denial) {
	ipKey := in.ClientIP.String()
	if p.failGuard.Blocked(ipKey) {
		d := deny(http.StatusTooManyRequests, CodeAuthBlocked, "juda ko'p noto'g'ri kalit urinishi; birozdan keyin qayta urinib ko'ring")
		d.RetryAfter = 30 * time.Second
		return nil, d
	}
	if in.Secret == "" {
		return nil, deny(http.StatusUnauthorized, CodeMissingKey, "API kalit yuborilmagan (X-API-Key sarlavhasi yoki ?key=)")
	}

	key, err := p.resolver.Resolve(ctx, in.Secret)
	if errors.Is(err, ErrInvalidKey) {
		p.failGuard.Fail(ipKey)
		return nil, deny(http.StatusUnauthorized, CodeInvalidKey, "API kalit yaroqsiz")
	}
	if err != nil {
		slog.Error("kalitni tekshirib bo'lmadi", "err", err)
		return nil, deny(http.StatusServiceUnavailable, CodeUnavailable, "xizmat vaqtincha mavjud emas")
	}

	if key.Account.Suspended {
		return nil, deny(http.StatusForbidden, CodeAccountSuspended, "hisob to'xtatilgan")
	}
	if d := checkKindRules(key, in); d != nil {
		return nil, d
	}
	if !containsStr(key.APIs, in.API) {
		return nil, deny(http.StatusForbidden, CodeAPINotAllowed, "bu kalit uchun `"+in.API+"` API'si yoqilmagan")
	}

	plan := key.Plan
	if ok, wait := p.limiter.Allow(key.ID, plan.RPS, plan.Burst); !ok {
		d := deny(http.StatusTooManyRequests, CodeRateLimited, "so'rovlar tezligi chegarasi oshdi ("+strconv.Itoa(int(plan.RPS))+" so'rov/s)")
		d.RetryAfter = wait
		return nil, d
	}

	g := &Grant{Key: key, Plan: plan}
	if plan.MonthlyCap > 0 {
		used, err := p.meter.MonthUsed(ctx, key.AccountID)
		if err != nil {
			slog.Error("oylik hisobni o'qib bo'lmadi", "err", err)
			return nil, deny(http.StatusServiceUnavailable, CodeUnavailable, "xizmat vaqtincha mavjud emas")
		}
		if used >= plan.MonthlyCap {
			d := deny(http.StatusTooManyRequests, CodeQuotaExceeded,
				"bepul oylik chegara ("+strconv.FormatInt(plan.MonthlyCap, 10)+" so'rov) tugadi. Obuna (50 000 so'm/oy) chegarasiz")
			d.RetryAfter = time.Until(monthStart(p.now()).AddDate(0, 1, 0))
			return nil, d
		}
		g.MonthUsed = used
	}
	return g, nil
}

// checkKindRules — kalit turiga xos qoidalar.
func checkKindRules(key *Key, in AuthInput) *Denial {
	switch key.Kind {
	case KindServer:
		// Server kaliti URL'da YUBORILMAYDI: URL loglarga, brauzer tarixiga, Referer'ga tushadi.
		if in.SecretFromQuery {
			return deny(http.StatusForbidden, CodeKeyRestricted, "server kaliti faqat X-API-Key sarlavhasida yuboriladi (URL'da emas)")
		}
		// Origin bor = so'rov BRAUZERDAN kelmoqda = server kaliti front-end'da ochilib qolgan.
		if in.Origin != "" {
			return deny(http.StatusForbidden, CodeKeyRestricted, "server kaliti brauzerdan ishlatilmaydi; brauzer uchun `browser` turidagi kalit yarating")
		}
		if !IPAllowed(key.IPs, in.ClientIP) {
			return deny(http.StatusForbidden, CodeKeyRestricted, "bu IP manzil kalit uchun ruxsat etilmagan")
		}
	case KindBrowser:
		origin := in.Origin
		if origin == "" {
			origin = OriginFromReferer(in.Referer)
		}
		if origin == "" || !OriginAllowed(key.Origins, origin) {
			return deny(http.StatusForbidden, CodeKeyRestricted, "bu domen (Origin) kalit uchun ruxsat etilmagan")
		}
	default:
		return deny(http.StatusForbidden, CodeKeyRestricted, "kalit turi noma'lum") // fail-closed
	}
	return nil
}

// Record — yakunlangan so'rovni hisoblaydi.
func (p *Platform) Record(g *Grant, api string, status int) {
	if g == nil {
		return
	}
	p.meter.Record(g.Key, api, status)
}

func containsStr(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}
