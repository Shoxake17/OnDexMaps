package devplatform

import (
	"context"
	"log/slog"
	"sync"
	"time"
)

// Hisoblash qoidasi (docs/developer-platform.md):
//   - HISOBLANADI:  2xx, 3xx va 404 (to'g'ri so'rov, "topilmadi" ham javob)
//   - errors:       boshqa 4xx va 5xx (hisoblanmaydi, faqat ko'rinish uchun)
//   - hisoblanmaydi: 429 (limit) — mijoz limitga urilgani uchun ikki marta "jazolanmasin"
func classify(status int) (counted, isErr bool) {
	switch {
	case status == 429:
		return false, false
	case status >= 200 && status < 400, status == 404:
		return true, false
	default:
		return false, true
	}
}

type usageKey struct {
	keyID string
	day   time.Time
	api   string
}

type usageCounts struct{ requests, errors int64 }

// monthCounter — hisobning joriy oydagi hisoblangan so'rovlari. Qiymat = jarayon ochilganda bazadan
// o'qilgan yig'indi + shundan keyingi mahalliy ortirma (yuvilgan yoki yuvilmagan — ahamiyatsiz:
// qayta o'qilmaydi, shuning uchun ikki marta hisoblanmaydi).
type monthCounter struct {
	mu    sync.Mutex
	month time.Time
	value int64
	ready bool
}

// Meter — so'rovlarni xotirada sanaydi va vaqti-vaqti bilan bazaga paketli yozadi.
//
// ⚠️ Bitta cmd/api nusxasi uchun. Ko'p nusxada har biri o'z oy hisobini yuritadi (kam hisoblaydi);
// shunda markaziy hisoblagich (Redis) kerak. Bu — hujjatlashtirilgan cheklov.
type Meter struct {
	store Store
	now   func() time.Time

	mu      sync.Mutex
	pending map[usageKey]*usageCounts
	touched map[string]struct{}

	cmu     sync.Mutex
	counter map[string]*monthCounter
}

// NewMeter — Start() bilan fon yuvish siklini ishga tushiring.
func NewMeter(store Store) *Meter {
	return &Meter{
		store: store, now: time.Now,
		pending: map[usageKey]*usageCounts{}, touched: map[string]struct{}{},
		counter: map[string]*monthCounter{},
	}
}

func monthStart(t time.Time) time.Time {
	t = t.UTC()
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
}

func dayOf(t time.Time) time.Time {
	t = t.UTC()
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

// MonthUsed — hisobning shu oydagi hisoblangan so'rovlari. Birinchi chaqiruvda bazadan o'qiladi.
func (m *Meter) MonthUsed(ctx context.Context, accountID string) (int64, error) {
	ms := monthStart(m.now())
	m.cmu.Lock()
	c, ok := m.counter[accountID]
	if !ok {
		c = &monthCounter{}
		m.counter[accountID] = c
	}
	m.cmu.Unlock()

	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.ready || !c.month.Equal(ms) {
		v, err := m.store.MonthUsage(ctx, accountID, ms)
		if err != nil {
			return 0, err
		}
		c.month, c.value, c.ready = ms, v, true
	}
	return c.value, nil
}

// Record — bitta yakunlangan so'rovni qayd etadi (tez: faqat xotira).
func (m *Meter) Record(key *Key, api string, status int) {
	counted, isErr := classify(status)
	if !counted && !isErr {
		return
	}
	now := m.now()
	uk := usageKey{keyID: key.ID, day: dayOf(now), api: api}

	m.mu.Lock()
	u := m.pending[uk]
	if u == nil {
		u = &usageCounts{}
		m.pending[uk] = u
	}
	if counted {
		u.requests++
	} else {
		u.errors++
	}
	m.touched[key.ID] = struct{}{}
	m.mu.Unlock()

	if counted {
		m.cmu.Lock()
		c := m.counter[key.AccountID]
		m.cmu.Unlock()
		if c != nil {
			c.mu.Lock()
			if c.ready && c.month.Equal(monthStart(now)) {
				c.value++
			}
			c.mu.Unlock()
		}
	}
}

// Flush — to'plangan ortirmalarni bazaga yozadi. Xato bo'lsa ortirmalar QAYTARILADI (keyingi urinishda
// yoziladi): hisob yo'qolmaydi.
func (m *Meter) Flush(ctx context.Context) error {
	m.mu.Lock()
	batch := m.pending
	touched := m.touched
	m.pending = map[usageKey]*usageCounts{}
	m.touched = map[string]struct{}{}
	m.mu.Unlock()

	if len(batch) == 0 {
		return nil
	}
	rows := make([]UsageRow, 0, len(batch))
	for k, v := range batch {
		rows = append(rows, UsageRow{KeyID: k.keyID, Day: k.day, API: k.api, Requests: v.requests, Errors: v.errors})
	}
	if err := m.store.WriteUsage(ctx, rows); err != nil {
		m.mu.Lock()
		for k, v := range batch {
			u := m.pending[k]
			if u == nil {
				u = &usageCounts{}
				m.pending[k] = u
			}
			u.requests += v.requests
			u.errors += v.errors
		}
		for id := range touched {
			m.touched[id] = struct{}{}
		}
		m.mu.Unlock()
		return err
	}
	ids := make([]string, 0, len(touched))
	for id := range touched {
		ids = append(ids, id)
	}
	if err := m.store.TouchKeys(ctx, ids, m.now()); err != nil {
		slog.Warn("kalit last_used_at yangilanmadi", "err", err) // hisobga ta'sir qilmaydi
	}
	return nil
}

// Run — har `every` da yuvadi; ctx bekor bo'lganda OXIRGI marta yuvib qaytadi (graceful shutdown).
func (m *Meter) Run(ctx context.Context, every time.Duration) {
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			fctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
			if err := m.Flush(fctx); err != nil {
				slog.Error("oxirgi hisob yuvilmadi (yo'qolishi mumkin)", "err", err)
			}
			cancel()
			return
		case <-t.C:
			fctx, cancel := context.WithTimeout(ctx, 8*time.Second)
			if err := m.Flush(fctx); err != nil {
				slog.Error("hisob yuvish xatosi (keyingi urinishda qayta)", "err", err)
			}
			cancel()
		}
	}
}
