package adminapi

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"ondexmap/internal/config"
)

const staffTestKey = "admin-kalit-0123456789abcdef0123456789"
const uuid1 = "00000000-0000-4000-8000-000000000001"

type fakeStaff struct {
	calls  []string
	err    error
	issued int
}

func (f *fakeStaff) rec(s string) error { f.calls = append(f.calls, s); return f.err }

func (f *fakeStaff) ListAccounts(context.Context, string, int) ([]StaffAccount, error) {
	return []StaffAccount{}, f.rec("list")
}
func (f *fakeStaff) SetSubscription(_ context.Context, id string, on bool, _ time.Time) error {
	if on {
		return f.rec("sub:on:" + id)
	}
	return f.rec("sub:off:" + id)
}
func (f *fakeStaff) SetEcosystem(_ context.Context, id string, on bool) error {
	if on {
		return f.rec("eco:on:" + id)
	}
	return f.rec("eco:off:" + id)
}
func (f *fakeStaff) SetSuspended(_ context.Context, id string, v bool) error {
	if v {
		return f.rec("susp:on:" + id)
	}
	return f.rec("susp:off:" + id)
}
func (f *fakeStaff) OpenRequests(context.Context) ([]StaffRequest, error) {
	return []StaffRequest{}, f.rec("reqs")
}
func (f *fakeStaff) HandleRequest(context.Context, int64, time.Time) error { return f.rec("handle") }
func (f *fakeStaff) ListInvoices(context.Context, string, int) ([]StaffInvoice, error) {
	return []StaffInvoice{}, f.rec("invoices")
}
func (f *fakeStaff) MarkPaid(_ context.Context, id, _ string, _ time.Time) error {
	return f.rec("paid:" + id)
}
func (f *fakeStaff) VoidInvoice(_ context.Context, id, _ string) error { return f.rec("void:" + id) }
func (f *fakeStaff) RevokeKey(_ context.Context, id string, _ time.Time) error {
	return f.rec("revoke:" + id)
}
func (f *fakeStaff) IssueDueInvoices(context.Context, time.Time) (int, error) {
	return f.issued, f.rec("issue")
}
func (f *fakeStaff) Audit(_ context.Context, action, _ string, _ map[string]any) {
	f.calls = append(f.calls, "audit:"+action)
}

func staffServer(f *fakeStaff) http.Handler {
	cfg := &config.Config{DevMode: true, AdminKey: staffTestKey, HTTPAddr: ":8090"}
	return New(cfg, nil).WithDevStaff(f).Handler()
}

func staffDo(h http.Handler, method, path, key, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	if key != "" {
		r.Header.Set("X-API-Key", key)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

// Barcha staff endpointlari kalitsiz YOPIQ.
func TestDevStaffRequiresAdminKey(t *testing.T) {
	f := &fakeStaff{}
	h := staffServer(f)
	for _, ep := range [][2]string{
		{"GET", "/api/dev/accounts"}, {"POST", "/api/dev/accounts/subscription"},
		{"POST", "/api/dev/accounts/ecosystem"}, {"POST", "/api/dev/accounts/suspend"},
		{"GET", "/api/dev/requests"}, {"POST", "/api/dev/requests/handle"},
		{"GET", "/api/dev/invoices"}, {"POST", "/api/dev/invoices/paid"},
		{"POST", "/api/dev/invoices/void"}, {"POST", "/api/dev/keys/revoke"}, {"POST", "/api/dev/invoices/issue"},
	} {
		for _, key := range []string{"", "yolg'on", "read-kalit-0123456789abcdef0123456789"} {
			if w := staffDo(h, ep[0], ep[1], key, `{"account_id":"`+uuid1+`","enabled":true}`); w.Code != http.StatusUnauthorized {
				t.Errorf("%s %s (key=%q): %d", ep[0], ep[1], key, w.Code)
			}
		}
	}
	if len(f.calls) != 0 {
		t.Fatalf("kalitsiz so'rov amalga yetdi: %v", f.calls)
	}
}

func TestDevStaffSubscriptionFlag(t *testing.T) {
	f := &fakeStaff{}
	h := staffServer(f)
	if w := staffDo(h, "POST", "/api/dev/accounts/subscription", staffTestKey,
		`{"account_id":"`+uuid1+`","enabled":true}`); w.Code != 200 {
		t.Fatalf("%d %s", w.Code, w.Body)
	}
	if w := staffDo(h, "POST", "/api/dev/accounts/subscription", staffTestKey,
		`{"account_id":"`+uuid1+`","enabled":false}`); w.Code != 200 {
		t.Fatalf("%d", w.Code)
	}
	want := []string{"sub:on:" + uuid1, "audit:subscription.set", "sub:off:" + uuid1, "audit:subscription.set"}
	if len(f.calls) != len(want) {
		t.Fatalf("%v", f.calls)
	}
	for i := range want {
		if f.calls[i] != want[i] {
			t.Fatalf("%v", f.calls)
		}
	}
}

func TestDevStaffInputValidation(t *testing.T) {
	f := &fakeStaff{}
	h := staffServer(f)
	bad := []struct{ path, body string }{
		{"/api/dev/accounts/subscription", `{}`},
		{"/api/dev/accounts/subscription", `{"account_id":"x","enabled":true}`},
		{"/api/dev/accounts/subscription", `{"account_id":"` + uuid1 + `"}`}, // bayroq yo'q — jimgina false bo'lmasin
		{"/api/dev/accounts/subscription", `{"account_id":"` + uuid1 + `","enabled":"yes"}`},
		{"/api/dev/accounts/subscription", `{"account_id":"` + uuid1 + `","enabled":true,"x":1}`}, // noma'lum maydon
		{"/api/dev/accounts/suspend", `{"account_id":"` + uuid1 + `","enabled":true}`},            // suspend `suspended` talab qiladi
		{"/api/dev/invoices/paid", `{"invoice_id":"1 OR 1=1"}`},
		{"/api/dev/invoices/void", `{"invoice_id":"'; DROP TABLE x;--"}`},
		{"/api/dev/keys/revoke", `{"key_id":""}`},
		{"/api/dev/requests/handle", `{"id":0}`},
	}
	for _, b := range bad {
		if w := staffDo(h, "POST", b.path, staffTestKey, b.body); w.Code != http.StatusBadRequest {
			t.Errorf("%s %s: %d", b.path, b.body, w.Code)
		}
	}
	if len(f.calls) != 0 {
		t.Fatalf("yaroqsiz kirish amalga yetdi: %v", f.calls)
	}
	if w := staffDo(h, "GET", "/api/dev/invoices?status=hack", staffTestKey, ""); w.Code != 400 {
		t.Errorf("status: %d", w.Code)
	}
	if w := staffDo(h, "GET", "/api/dev/accounts?limit=99999", staffTestKey, ""); w.Code != 400 {
		t.Errorf("limit: %d", w.Code)
	}
}

func TestDevStaffNotFoundAndInternalErrorsDontLeak(t *testing.T) {
	f := &fakeStaff{err: ErrStaffNotFound}
	h := staffServer(f)
	if w := staffDo(h, "POST", "/api/dev/invoices/paid", staffTestKey, `{"invoice_id":"`+uuid1+`"}`); w.Code != 404 {
		t.Fatalf("%d", w.Code)
	}
	f2 := &fakeStaff{err: context.DeadlineExceeded}
	w := staffDo(staffServer(f2), "GET", "/api/dev/accounts", staffTestKey, "")
	if w.Code != 502 || bytes.Contains(w.Body.Bytes(), []byte("deadline")) {
		t.Fatalf("ichki xato sizdi: %d %s", w.Code, w.Body)
	}
}

func TestDevStaffIssue(t *testing.T) {
	f := &fakeStaff{issued: 3}
	w := staffDo(staffServer(f), "POST", "/api/dev/invoices/issue", staffTestKey, "")
	if w.Code != 200 || !bytes.Contains(w.Body.Bytes(), []byte(`"issued":3`)) {
		t.Fatalf("%d %s", w.Code, w.Body)
	}
}
