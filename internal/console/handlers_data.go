package console

import (
	"errors"
	"net/http"
	"sort"
	"strconv"
	"time"
	"unicode/utf8"

	"ondexmap/internal/devplatform"
)

func (s *Server) planOf(a *Account) devplatform.Plan {
	return s.cfg.Plans.For(devplatform.AccountState{
		ID: a.ID, Suspended: a.Suspended, Subscription: a.Subscription, Ecosystem: a.Ecosystem, Overdue: a.Overdue})
}

func (s *Server) meView(a *Account, csrf string) map[string]any {
	p := s.planOf(a)
	var cap any
	if p.MonthlyCap > 0 {
		cap = p.MonthlyCap
	}
	return map[string]any{
		"account": map[string]any{
			"id": a.ID, "email": a.Email, "name": a.Name, "suspended": a.Suspended,
			"subscription": a.Subscription, "ecosystem": a.Ecosystem, "overdue": a.Overdue,
			"created_at": a.CreatedAt,
		},
		"plan": map[string]any{
			"id": p.ID, "rps": p.RPS, "burst": p.Burst, "monthly_cap": cap,
		},
		"csrf": csrf,
	}
}

func (s *Server) handleMe(w http.ResponseWriter, _ *http.Request, rc *reqCtx) {
	writeJSON(w, http.StatusOK, s.meView(rc.acc, rc.sess.CSRF))
}

func (s *Server) handleUpdateMe(w http.ResponseWriter, r *http.Request, rc *reqCtx) {
	var in struct {
		Name string `json:"name"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	name := ""
	if in.Name != "" {
		n, ok := cleanNameLen(in.Name, 100)
		if !ok {
			apiError(w, http.StatusBadRequest, "invalid_request", "ism 1–100 belgi bo'lishi kerak")
			return
		}
		name = n
	}
	if err := s.store.UpdateName(r.Context(), rc.acc.ID, name); err != nil {
		serverError(w, "ismni saqlash", err)
		return
	}
	rc.acc.Name = name
	writeJSON(w, http.StatusOK, s.meView(rc.acc, rc.sess.CSRF))
}

// cleanNameLen — cleanName, lekin boshqa chegara bilan.
func cleanNameLen(raw string, limit int) (string, bool) {
	if len(raw) > 4*limit { // bir belgi eng ko'pi 4 bayt: undan uzun kirish albatta chegaradan oshadi
		return "", false
	}
	n, ok := cleanName(raw)
	if !ok {
		return "", false
	}
	return n, utf8.RuneCountInString(n) <= limit
}

func utcDay(t time.Time) time.Time {
	t = t.UTC()
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

type usageSum struct {
	Requests int64 `json:"requests"`
	Errors   int64 `json:"errors"`
}

// GET /api/usage?days=30 — FAQAT so'rov soni (foydalanuvchi so'ragan: token qancha so'rov ishlatgani).
func (s *Server) handleUsage(w http.ResponseWriter, r *http.Request, rc *reqCtx) {
	days := 30
	if v := r.URL.Query().Get("days"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 93 {
			apiError(w, http.StatusBadRequest, "invalid_request", "days 1–93 orasida bo'lishi kerak")
			return
		}
		days = n
	}
	today := utcDay(s.now())
	from := today.AddDate(0, 0, -(days - 1))
	monthStart := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, time.UTC)

	rows, err := s.store.UsageDaily(r.Context(), rc.acc.ID, from, today)
	if err != nil {
		serverError(w, "foydalanish", err)
		return
	}
	monthRows := rows
	if monthStart.Before(from) {
		if monthRows, err = s.store.UsageDaily(r.Context(), rc.acc.ID, monthStart, today); err != nil {
			serverError(w, "oylik foydalanish", err)
			return
		}
	}
	keys, err := s.store.ListKeys(r.Context(), rc.acc.ID)
	if err != nil {
		serverError(w, "kalitlar", err)
		return
	}

	var month usageSum
	for _, u := range monthRows {
		if !u.Day.Before(monthStart) {
			month.Requests += u.Requests
			month.Errors += u.Errors
		}
	}
	p := s.planOf(rc.acc)
	var cap any
	if p.MonthlyCap > 0 {
		cap = p.MonthlyCap
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"range":  map[string]string{"from": from.Format("2006-01-02"), "to": today.Format("2006-01-02")},
		"month":  map[string]any{"start": monthStart.Format("2006-01-02"), "requests": month.Requests, "errors": month.Errors, "cap": cap, "plan": p.ID},
		"daily":  aggregateDaily(rows, from, today),
		"by_api": aggregateBy(rows, func(u UsageDay) string { return u.API }, "api"),
		"by_key": aggregateByKey(rows, keys),
	})
}

// aggregateDaily — bo'sh kunlar 0 bilan to'ldiriladi (grafik uzluksiz bo'lsin).
func aggregateDaily(rows []UsageDay, from, to time.Time) []map[string]any {
	byDay := map[string]*usageSum{}
	for _, u := range rows {
		k := u.Day.UTC().Format("2006-01-02")
		if byDay[k] == nil {
			byDay[k] = &usageSum{}
		}
		byDay[k].Requests += u.Requests
		byDay[k].Errors += u.Errors
	}
	out := []map[string]any{}
	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		k := d.Format("2006-01-02")
		v := byDay[k]
		if v == nil {
			v = &usageSum{}
		}
		out = append(out, map[string]any{"day": k, "requests": v.Requests, "errors": v.Errors})
	}
	return out
}

func aggregateBy(rows []UsageDay, key func(UsageDay) string, field string) []map[string]any {
	sums := map[string]*usageSum{}
	for _, u := range rows {
		k := key(u)
		if sums[k] == nil {
			sums[k] = &usageSum{}
		}
		sums[k].Requests += u.Requests
		sums[k].Errors += u.Errors
	}
	names := make([]string, 0, len(sums))
	for k := range sums {
		names = append(names, k)
	}
	sort.Strings(names)
	out := make([]map[string]any, 0, len(names))
	for _, k := range names {
		out = append(out, map[string]any{field: k, "requests": sums[k].Requests, "errors": sums[k].Errors})
	}
	return out
}

func aggregateByKey(rows []UsageDay, keys []Key) []map[string]any {
	sums := map[string]*usageSum{}
	for _, u := range rows {
		if sums[u.KeyID] == nil {
			sums[u.KeyID] = &usageSum{}
		}
		sums[u.KeyID].Requests += u.Requests
		sums[u.KeyID].Errors += u.Errors
	}
	out := make([]map[string]any, 0, len(keys))
	for _, k := range keys {
		v := sums[k.ID]
		if v == nil {
			v = &usageSum{}
		}
		out = append(out, map[string]any{"key_id": k.ID, "name": k.Name, "prefix": k.Prefix, "status": k.Status,
			"requests": v.Requests, "errors": v.Errors})
	}
	return out
}

// GET /api/billing
func (s *Server) handleBilling(w http.ResponseWriter, r *http.Request, rc *reqCtx) {
	inv, err := s.store.Invoices(r.Context(), rc.acc.ID)
	if err != nil {
		serverError(w, "hisob-fakturalar", err)
		return
	}
	pending, err := s.store.HasOpenSubscriptionRequest(r.Context(), rc.acc.ID)
	if err != nil {
		serverError(w, "obuna so'rovi", err)
		return
	}
	p := s.planOf(rc.acc)
	writeJSON(w, http.StatusOK, map[string]any{
		"plan":                      p.ID,
		"subscription":              rc.acc.Subscription,
		"ecosystem":                 rc.acc.Ecosystem,
		"overdue":                   rc.acc.Overdue,
		"price_uzs":                 devplatform.SubscriptionPriceUZS,
		"subscription_request_open": pending,
		"instructions":              s.cfg.BillingInstructions,
		"invoices":                  invoicesJSON(inv),
	})
}

func invoicesJSON(inv []Invoice) []map[string]any {
	out := make([]map[string]any, len(inv))
	for i, v := range inv {
		out[i] = map[string]any{
			"id": v.ID, "number": v.Number, "period_start": v.PeriodStart.Format("2006-01-02"),
			"period_end": v.PeriodEnd.Format("2006-01-02"), "amount_uzs": v.AmountUZS, "status": v.Status,
			"issued_at": v.IssuedAt, "due_at": v.DueAt, "paid_at": v.PaidAt,
		}
	}
	return out
}

// POST /api/billing/subscribe-request — obunani YOQMAYDI: staff ko'rib chiqib flagni belgilaydi.
func (s *Server) handleSubscribeRequest(w http.ResponseWriter, r *http.Request, rc *reqCtx) {
	var in struct {
		Note string `json:"note"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	if len([]rune(in.Note)) > 500 {
		apiError(w, http.StatusBadRequest, "invalid_request", "izoh 500 belgidan oshmasin")
		return
	}
	if rc.acc.Subscription || rc.acc.Ecosystem {
		apiError(w, http.StatusConflict, "already_subscribed", "hisobda obuna allaqachon yoqilgan")
		return
	}
	open, err := s.store.HasOpenSubscriptionRequest(r.Context(), rc.acc.ID)
	if err != nil {
		serverError(w, "obuna so'rovi", err)
		return
	}
	if open {
		apiError(w, http.StatusConflict, "already_requested", "so'rov yuborilgan, javobni kuting")
		return
	}
	if err := s.store.CreateSubscriptionRequest(r.Context(), rc.acc.ID, in.Note); err != nil {
		if errors.Is(err, ErrConflict) {
			apiError(w, http.StatusConflict, "already_requested", "so'rov yuborilgan, javobni kuting")
			return
		}
		serverError(w, "obuna so'rovini saqlash", err)
		return
	}
	s.audit(r.Context(), rc, "subscription.request", "", nil)
	writeJSON(w, http.StatusAccepted, map[string]string{"status": "requested"})
}
