package devplatform

import (
	"sync"
	"time"
)

const (
	limiterTTL        = 10 * time.Minute
	limiterMaxEntries = 50_000
)

type bucket struct {
	tokens float64
	last   time.Time
}

// Limiter — kalit bo'yicha token bucket. Chegaralar (RPS/Burst) har chaqiruvda beriladi,
// chunki reja o'zgarishi mumkin (obuna yoqildi/o'chdi) — kalit xotirada eski chegarani "eslab" qolmaydi.
type Limiter struct {
	now func() time.Time
	mu  sync.Mutex
	b   map[string]*bucket
}

// NewLimiter — fon tozalovchi bilan.
func NewLimiter() *Limiter {
	l := &Limiter{now: time.Now, b: map[string]*bucket{}}
	go func() {
		for range time.Tick(limiterTTL) {
			l.gc()
		}
	}()
	return l
}

func (l *Limiter) gc() {
	cutoff := l.now().Add(-limiterTTL)
	l.mu.Lock()
	defer l.mu.Unlock()
	for k, v := range l.b {
		if v.last.Before(cutoff) {
			delete(l.b, k)
		}
	}
}

// Allow — so'rovga ruxsatmi. Rad etilsa, qancha kutish kerakligini qaytaradi.
//
// Xotira to'lsa YANGI kalit uchun ruxsat beriladi (fail-open): to'lgan limiter'ning o'zi
// to'lov qilayotgan mijozlarni to'sib qo'ymasin; tozalovchi bo'shatgach normal holat qaytadi.
func (l *Limiter) Allow(id string, rps, burst float64) (ok bool, retryAfter time.Duration) {
	if rps <= 0 {
		return false, time.Second
	}
	now := l.now()
	l.mu.Lock()
	defer l.mu.Unlock()
	b, exists := l.b[id]
	if !exists {
		if len(l.b) >= limiterMaxEntries {
			return true, 0
		}
		l.b[id] = &bucket{tokens: burst - 1, last: now}
		return true, 0
	}
	b.tokens += now.Sub(b.last).Seconds() * rps
	if b.tokens > burst {
		b.tokens = burst
	}
	b.last = now
	if b.tokens < 1 {
		wait := time.Duration((1 - b.tokens) / rps * float64(time.Second))
		if wait < time.Second {
			wait = time.Second // Retry-After butun soniya
		}
		return false, wait
	}
	b.tokens--
	return true, 0
}

// AuthFailGuard — noto'g'ri kalit yuborayotgan IP'ni to'sadi (kalit taxmin qilish/brute-force).
// Faqat MUVAFFAQIYATSIZ urinishlar hisoblanadi: to'g'ri kalit bilan ishlayotgan mijozga ta'sir qilmaydi.
type AuthFailGuard struct {
	burst, perSec float64
	now           func() time.Time
	mu            sync.Mutex
	b             map[string]*bucket
}

// NewAuthFailGuard — burst ta xatodan keyin bloklanadi; perSec tezlikda tiklanadi.
func NewAuthFailGuard(burst, perSec float64) *AuthFailGuard {
	g := &AuthFailGuard{burst: burst, perSec: perSec, now: time.Now, b: map[string]*bucket{}}
	go func() {
		for range time.Tick(limiterTTL) {
			g.gc()
		}
	}()
	return g
}

func (g *AuthFailGuard) gc() {
	cutoff := g.now().Add(-limiterTTL)
	g.mu.Lock()
	defer g.mu.Unlock()
	for k, v := range g.b {
		if v.last.Before(cutoff) {
			delete(g.b, k)
		}
	}
}

func (g *AuthFailGuard) refill(b *bucket, now time.Time) {
	b.tokens += now.Sub(b.last).Seconds() * g.perSec
	if b.tokens > g.burst {
		b.tokens = g.burst
	}
	b.last = now
}

// Blocked — IP hozir bloklanganmi (tokenlari tugaganmi).
func (g *AuthFailGuard) Blocked(ip string) bool {
	now := g.now()
	g.mu.Lock()
	defer g.mu.Unlock()
	b, ok := g.b[ip]
	if !ok {
		return false
	}
	g.refill(b, now)
	return b.tokens < 1
}

// Fail — bitta muvaffaqiyatsiz urinishni qayd etadi.
func (g *AuthFailGuard) Fail(ip string) {
	now := g.now()
	g.mu.Lock()
	defer g.mu.Unlock()
	b, ok := g.b[ip]
	if !ok {
		if len(g.b) >= limiterMaxEntries {
			return
		}
		g.b[ip] = &bucket{tokens: g.burst - 1, last: now}
		return
	}
	g.refill(b, now)
	if b.tokens >= 1 {
		b.tokens--
	} else {
		b.tokens = 0
	}
}
