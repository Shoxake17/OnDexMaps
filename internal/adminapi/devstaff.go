package adminapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"ondexmap/internal/storage"
)

// ═══════════════════════════════════════════════════════════════════════
// Dasturchilar platformasi — STAFF amallari (console.ondex.uz orqasidagi "pul va huquq" qismi).
//
// Nega bu yerda, konsolda emas: obuna flagi, ekotizim belgisi, hisob holati va hisob-faktura
// to'lovi — faqat baza egasi yozadi (`ondexmap_console` roli bu ustunlarga yozolmaydi,
// migrations/0012). Konsol to'liq buzilsa ham hujumchi o'ziga "obuna" yoki "bepul ekotizim"
// bera olmaydi. Bu endpointlar admin kalitini talab qiladi (requireKey).
// ═══════════════════════════════════════════════════════════════════════

// StaffAccount — staff ro'yxatidagi hisob.
type StaffAccount struct {
	ID                string     `json:"id"`
	Email             string     `json:"email"`
	Name              string     `json:"name"`
	Status            string     `json:"status"`
	Subscription      bool       `json:"subscription"`
	SubscriptionSince *time.Time `json:"subscription_since"`
	Ecosystem         bool       `json:"ecosystem"`
	CreatedAt         time.Time  `json:"created_at"`
	LastLoginAt       *time.Time `json:"last_login_at"`
	ActiveKeys        int        `json:"active_keys"`
	MonthRequests     int64      `json:"month_requests"`
}

// StaffInvoice — staff ko'radigan hisob-faktura.
type StaffInvoice struct {
	ID          string     `json:"id"`
	Number      string     `json:"number"`
	AccountID   string     `json:"account_id"`
	Email       string     `json:"email"`
	PeriodStart string     `json:"period_start"`
	PeriodEnd   string     `json:"period_end"`
	AmountUZS   int64      `json:"amount_uzs"`
	Status      string     `json:"status"`
	DueAt       time.Time  `json:"due_at"`
	PaidAt      *time.Time `json:"paid_at"`
	PaymentRef  string     `json:"payment_ref"`
}

// StaffRequest — obunaga so'rov.
type StaffRequest struct {
	ID        int64     `json:"id"`
	AccountID string    `json:"account_id"`
	Email     string    `json:"email"`
	Note      string    `json:"note"`
	CreatedAt time.Time `json:"created_at"`
}

// ErrStaffNotFound — yozuv topilmadi (yoki holati mos emas).
var ErrStaffNotFound = errors.New("topilmadi")

// DevStaffStore — staff amallari (testlarda almashtiriladi).
type DevStaffStore interface {
	ListAccounts(ctx context.Context, q string, limit int) ([]StaffAccount, error)
	SetSubscription(ctx context.Context, accountID string, on bool, now time.Time) error
	SetEcosystem(ctx context.Context, accountID string, on bool) error
	SetSuspended(ctx context.Context, accountID string, suspended bool) error
	OpenRequests(ctx context.Context) ([]StaffRequest, error)
	HandleRequest(ctx context.Context, id int64, now time.Time) error
	ListInvoices(ctx context.Context, status string, limit int) ([]StaffInvoice, error)
	MarkPaid(ctx context.Context, invoiceID, ref string, now time.Time) error
	VoidInvoice(ctx context.Context, invoiceID, note string) error
	RevokeKey(ctx context.Context, keyID string, now time.Time) error
	// IssueDueInvoices — muddati kelgan obunalar uchun hisob-faktura (idempotent). Nechta yaratilgani qaytadi.
	IssueDueInvoices(ctx context.Context, now time.Time) (int, error)
	Audit(ctx context.Context, action, target string, detail map[string]any)
}

// WithDevStaff — testlar uchun almashtirish.
func (s *Server) WithDevStaff(st DevStaffStore) *Server {
	s.staff = st
	return s
}

func (s *Server) registerDevStaffRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/dev/accounts", s.requireKey(s.handleDevAccounts))
	mux.HandleFunc("POST /api/dev/accounts/subscription", s.requireKey(s.handleDevSubscription))
	mux.HandleFunc("POST /api/dev/accounts/ecosystem", s.requireKey(s.handleDevEcosystem))
	mux.HandleFunc("POST /api/dev/accounts/suspend", s.requireKey(s.handleDevSuspend))
	mux.HandleFunc("GET /api/dev/requests", s.requireKey(s.handleDevRequests))
	mux.HandleFunc("POST /api/dev/requests/handle", s.requireKey(s.handleDevRequestHandled))
	mux.HandleFunc("GET /api/dev/invoices", s.requireKey(s.handleDevInvoices))
	mux.HandleFunc("POST /api/dev/invoices/paid", s.requireKey(s.handleDevInvoicePaid))
	mux.HandleFunc("POST /api/dev/invoices/void", s.requireKey(s.handleDevInvoiceVoid))
	mux.HandleFunc("POST /api/dev/keys/revoke", s.requireKey(s.handleDevKeyRevoke))
	mux.HandleFunc("POST /api/dev/invoices/issue", s.requireKey(s.handleDevIssue))
}

func staffFail(w http.ResponseWriter, err error) {
	if errors.Is(err, ErrStaffNotFound) {
		fail(w, http.StatusNotFound, "topilmadi yoki holati mos emas")
		return
	}
	slog.Error("staff amali xatosi", "err", err)
	fail(w, http.StatusBadGateway, "so'rov bajarilmadi")
}

func (s *Server) handleDevAccounts(w http.ResponseWriter, r *http.Request) {
	limit := 100
	if v := r.URL.Query().Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 500 {
			fail(w, http.StatusBadRequest, "limit 1–500")
			return
		}
		limit = n
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(q) > 100 {
		fail(w, http.StatusBadRequest, "q juda uzun")
		return
	}
	rows, err := s.staff.ListAccounts(r.Context(), q, limit)
	if err != nil {
		staffFail(w, err)
		return
	}
	ok(w, map[string]any{"accounts": rows})
}

// idFlag — {account_id, enabled} shaklidagi so'rovlar uchun umumiy ajratish.
func idFlag(w http.ResponseWriter, r *http.Request, idField string) (id string, flag bool, good bool) {
	var in struct {
		AccountID string `json:"account_id"`
		Enabled   *bool  `json:"enabled"`
		Suspended *bool  `json:"suspended"`
	}
	if !decode(w, r, &in) {
		return "", false, false
	}
	f := in.Enabled
	if idField == "suspend" {
		f = in.Suspended
	}
	if !storage.ValidID(in.AccountID) || f == nil {
		fail(w, http.StatusBadRequest, "account_id va bayroq majburiy")
		return "", false, false
	}
	return in.AccountID, *f, true
}

// POST /api/dev/accounts/subscription {account_id, enabled} — OBUNA FLAGI.
func (s *Server) handleDevSubscription(w http.ResponseWriter, r *http.Request) {
	id, on, good := idFlag(w, r, "enabled")
	if !good {
		return
	}
	now := time.Now()
	if err := s.staff.SetSubscription(r.Context(), id, on, now); err != nil {
		staffFail(w, err)
		return
	}
	s.staff.Audit(r.Context(), "subscription.set", id, map[string]any{"enabled": on})
	ok(w, map[string]bool{"ok": true})
}

func (s *Server) handleDevEcosystem(w http.ResponseWriter, r *http.Request) {
	id, on, good := idFlag(w, r, "enabled")
	if !good {
		return
	}
	if err := s.staff.SetEcosystem(r.Context(), id, on); err != nil {
		staffFail(w, err)
		return
	}
	s.staff.Audit(r.Context(), "ecosystem.set", id, map[string]any{"enabled": on})
	ok(w, map[string]bool{"ok": true})
}

func (s *Server) handleDevSuspend(w http.ResponseWriter, r *http.Request) {
	id, v, good := idFlag(w, r, "suspend")
	if !good {
		return
	}
	if err := s.staff.SetSuspended(r.Context(), id, v); err != nil {
		staffFail(w, err)
		return
	}
	s.staff.Audit(r.Context(), "account.suspend", id, map[string]any{"suspended": v})
	ok(w, map[string]bool{"ok": true})
}

func (s *Server) handleDevRequests(w http.ResponseWriter, r *http.Request) {
	rows, err := s.staff.OpenRequests(r.Context())
	if err != nil {
		staffFail(w, err)
		return
	}
	ok(w, map[string]any{"requests": rows})
}

func (s *Server) handleDevRequestHandled(w http.ResponseWriter, r *http.Request) {
	var in struct {
		ID int64 `json:"id"`
	}
	if !decode(w, r, &in) {
		return
	}
	if in.ID < 1 {
		fail(w, http.StatusBadRequest, "id majburiy")
		return
	}
	if err := s.staff.HandleRequest(r.Context(), in.ID, time.Now()); err != nil {
		staffFail(w, err)
		return
	}
	ok(w, map[string]bool{"ok": true})
}

func (s *Server) handleDevInvoices(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	switch status {
	case "", "open", "paid", "void":
	default:
		fail(w, http.StatusBadRequest, "status: open | paid | void")
		return
	}
	rows, err := s.staff.ListInvoices(r.Context(), status, 200)
	if err != nil {
		staffFail(w, err)
		return
	}
	ok(w, map[string]any{"invoices": rows})
}

// POST /api/dev/invoices/paid {invoice_id, payment_ref} — qo'lda to'lov tasdig'i.
func (s *Server) handleDevInvoicePaid(w http.ResponseWriter, r *http.Request) {
	var in struct {
		InvoiceID  string `json:"invoice_id"`
		PaymentRef string `json:"payment_ref"`
	}
	if !decode(w, r, &in) {
		return
	}
	if !storage.ValidID(in.InvoiceID) || len(in.PaymentRef) > 120 {
		fail(w, http.StatusBadRequest, "invoice_id noto'g'ri yoki payment_ref 120 belgidan uzun")
		return
	}
	if err := s.staff.MarkPaid(r.Context(), in.InvoiceID, in.PaymentRef, time.Now()); err != nil {
		staffFail(w, err)
		return
	}
	s.staff.Audit(r.Context(), "invoice.paid", in.InvoiceID, map[string]any{"ref": in.PaymentRef})
	ok(w, map[string]bool{"ok": true})
}

func (s *Server) handleDevInvoiceVoid(w http.ResponseWriter, r *http.Request) {
	var in struct {
		InvoiceID string `json:"invoice_id"`
		Note      string `json:"note"`
	}
	if !decode(w, r, &in) {
		return
	}
	if !storage.ValidID(in.InvoiceID) || len(in.Note) > 500 {
		fail(w, http.StatusBadRequest, "invoice_id noto'g'ri yoki note 500 belgidan uzun")
		return
	}
	if err := s.staff.VoidInvoice(r.Context(), in.InvoiceID, in.Note); err != nil {
		staffFail(w, err)
		return
	}
	s.staff.Audit(r.Context(), "invoice.void", in.InvoiceID, nil)
	ok(w, map[string]bool{"ok": true})
}

func (s *Server) handleDevKeyRevoke(w http.ResponseWriter, r *http.Request) {
	var in struct {
		KeyID string `json:"key_id"`
	}
	if !decode(w, r, &in) {
		return
	}
	if !storage.ValidID(in.KeyID) {
		fail(w, http.StatusBadRequest, "key_id noto'g'ri")
		return
	}
	if err := s.staff.RevokeKey(r.Context(), in.KeyID, time.Now()); err != nil {
		staffFail(w, err)
		return
	}
	s.staff.Audit(r.Context(), "key.revoke", in.KeyID, nil)
	ok(w, map[string]bool{"ok": true})
}

// POST /api/dev/invoices/issue — hisob-fakturalarni HOZIR yaratish (soatlik ish bilan bir xil, idempotent).
func (s *Server) handleDevIssue(w http.ResponseWriter, r *http.Request) {
	n, err := s.staff.IssueDueInvoices(r.Context(), time.Now())
	if err != nil {
		staffFail(w, err)
		return
	}
	ok(w, map[string]int{"issued": n})
}

// RunBilling — soatlik hisob-faktura ishi (cmd/adminserver). ctx bekor bo'lguncha ishlaydi.
func (s *Server) RunBilling(ctx context.Context, every time.Duration) {
	run := func() {
		c, cancel := context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
		n, err := s.staff.IssueDueInvoices(c, time.Now())
		if err != nil {
			slog.Error("hisob-faktura ishi xatosi", "err", err)
			return
		}
		if n > 0 {
			slog.Info("hisob-fakturalar yaratildi", "count", n)
		}
	}
	run()
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			run()
		}
	}
}
