package httpapi

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Ommaviy endpoint'lar kalitsiz ochiq — himoya faqat shu yerda.
// Chegaralarsiz bitta skript butun geoma'lumotni bir necha daqiqada
// yuklab olardi va baza hovuzini band qilardi.
const (
	rateBurst  = 30 // qisqa portlashga ruxsat
	ratePerSec = 5  // barqaror tezlik
	rateTTL    = 10 * time.Minute
	// maxTrackedIPs — xotira chegarasi.
	//
	// Usiz hujumchi soxta IP bilan (proksi orqali) cheksiz yozuv
	// yaratib serverning xotirasini tugatardi — ya'ni rate limiter
	// ning O'ZI hujum vositasiga aylanardi.
	maxTrackedIPs = 20000

	// /v1/route — OSRM so'rovi qimmat, shuning uchun ANCHA qattiqroq.
	routeRateBurst  = 10
	routeRatePerSec = 1
)

type bucket struct {
	tokens float64
	last   time.Time
}

type rateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	burst   float64
	perSec  float64
}

func newRateLimiter() *rateLimiter {
	return newRateLimiterWith(rateBurst, ratePerSec)
}

func newRateLimiterWith(burst, perSec float64) *rateLimiter {
	rl := &rateLimiter{buckets: make(map[string]*bucket), burst: burst, perSec: perSec}
	go rl.janitor()
	return rl
}

func (rl *rateLimiter) allow(key string) bool {
	now := time.Now()
	rl.mu.Lock()
	defer rl.mu.Unlock()

	b, ok := rl.buckets[key]
	if !ok {
		// Xotira to'lgan bo'lsa YANGI kalit qabul qilinmaydi, lekin
		// so'rov RAD ETILMAYDI — mavjud foydalanuvchilar zarar
		// ko'rmasin. Tozalovchi bo'shatgach normal holat qaytadi.
		if len(rl.buckets) >= maxTrackedIPs {
			return true
		}
		rl.buckets[key] = &bucket{tokens: rl.burst - 1, last: now}
		return true
	}

	b.tokens += now.Sub(b.last).Seconds() * rl.perSec
	if b.tokens > rl.burst {
		b.tokens = rl.burst
	}
	b.last = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

func (rl *rateLimiter) janitor() {
	for range time.Tick(rateTTL) {
		cutoff := time.Now().Add(-rateTTL)
		rl.mu.Lock()
		for k, b := range rl.buckets {
			if b.last.Before(cutoff) {
				delete(rl.buckets, k)
			}
		}
		rl.mu.Unlock()
	}
}

// rateLimit — middleware.
func (s *Server) rateLimit(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.limiter.allow(s.clientIP(r)) {
			w.Header().Set("Retry-After", "1")
			httpError(w, http.StatusTooManyRequests, "so'rovlar juda tez-tez yuborilmoqda")
			return
		}
		next(w, r)
	}
}

// routeLimit — /v1/route uchun alohida, qattiqroq chegara bilan.
func (s *Server) routeLimit(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.routeLimiter.allow(s.clientIP(r)) {
			w.Header().Set("Retry-After", "2")
			httpError(w, http.StatusTooManyRequests, "marshrut so'rovlari juda tez-tez yuborilmoqda")
			return
		}
		next(w, r)
	}
}

// clientIP — rate limit uchun kalit.
//
// XAVFSIZLIK: `X-Forwarded-For` ga FAQAT TRUSTED_PROXIES da sanalgan
// manbadan kelganda ishoniladi. Aks holda istalgan odam bu sarlavhani
// o'zi yozib har so'rovda yangi "IP" ko'rsatardi va rate limit
// butunlay ma'nosiz bo'lardi.
//
// TRUSTED_PROXIES bo'sh bo'lsa — sarlavhaga UMUMAN ishonilmaydi.
// Bu to'g'ri standart: sozlanmagan holat "hammaga ishonaman" degani emas.
func (s *Server) clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	if len(s.cfg.TrustedProxies) == 0 {
		return host
	}
	trusted := false
	for _, p := range s.cfg.TrustedProxies {
		if p == host {
			trusted = true
			break
		}
	}
	if !trusted {
		return host
	}
	// Eng O'NGDAGI qiymat — ishonchli proksi o'zi qo'shgan, ya'ni
	// klient uni soxtalashtira olmaydi. Chapdagilarni klient yozgan
	// bo'lishi mumkin.
	fwd := r.Header.Get("X-Forwarded-For")
	if fwd == "" {
		return host
	}
	parts := strings.Split(fwd, ",")
	return strings.TrimSpace(parts[len(parts)-1])
}
