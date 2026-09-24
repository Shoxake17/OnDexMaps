package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"ondexmap/internal/devplatform"
)

var v2Pepper = []byte("v2-test-pepper-0123456789abcdef0123456789")

// memStore — devplatform.Store'ning testdagi xotiradagi nusxasi.
type memStore struct {
	mu      sync.Mutex
	keys    map[string]*devplatform.KeyRecord
	written []devplatform.UsageRow
}

func (m *memStore) LookupKey(_ context.Context, hash []byte) (*devplatform.KeyRecord, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if r, ok := m.keys[string(hash)]; ok {
		c := *r
		return &c, nil
	}
	return nil, devplatform.ErrNotFound
}
func (m *memStore) MonthUsage(context.Context, string, time.Time) (int64, error) { return 0, nil }
func (m *memStore) WriteUsage(_ context.Context, rows []devplatform.UsageRow) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.written = append(m.written, rows...)
	return nil
}
func (m *memStore) TouchKeys(context.Context, []string, time.Time) error { return nil }

type v2Env struct {
	h               http.Handler
	plat            *devplatform.Platform
	st              *memStore
	serverKey, bKey string
}

func newV2Env(t *testing.T, mod func(*Server)) *v2Env {
	t.Helper()
	st := &memStore{keys: map[string]*devplatform.KeyRecord{}}
	sk, _, _ := devplatform.GenerateKey(devplatform.KindServer)
	bk, _, _ := devplatform.GenerateKey(devplatform.KindBrowser)
	acc := devplatform.AccountState{ID: "a1"}
	st.keys[string(devplatform.HashKey(v2Pepper, sk))] = &devplatform.KeyRecord{ID: "ks", AccountID: "a1",
		Kind: devplatform.KindServer, APIs: devplatform.AllAPIs, Account: acc}
	st.keys[string(devplatform.HashKey(v2Pepper, bk))] = &devplatform.KeyRecord{ID: "kb", AccountID: "a1",
		Kind: devplatform.KindBrowser, APIs: []string{devplatform.APIGeocode},
		Origins: []string{"https://app.example.com"}, Account: acc}
	p := devplatform.New(st, devplatform.Config{Pepper: v2Pepper, Plans: devplatform.DefaultPlans()})
	s := New(baseCfg(), nil).WithPlatform(p)
	if mod != nil {
		mod(s)
	}
	return &v2Env{h: s.Handler(), plat: p, st: st, serverKey: sk, bKey: bk}
}

func (e *v2Env) get(path string, hdr map[string]string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(http.MethodGet, path, nil)
	for k, v := range hdr {
		r.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	e.h.ServeHTTP(w, r)
	return w
}

func errCode(t *testing.T, w *httptest.ResponseRecorder) (status, code string) {
	t.Helper()
	var b struct {
		Status string                `json:"status"`
		Error  struct{ Code string } `json:"error"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &b); err != nil {
		t.Fatalf("JSON emas: %q", w.Body.String())
	}
	return b.Status, b.Error.Code
}

func TestV2AllowlistDeniesEverythingElse(t *testing.T) {
	e := newV2Env(t, nil)
	key := map[string]string{apiKeyHeader: e.serverKey}
	for _, tc := range []struct{ method, path string }{
		{"POST", "/v2/places"}, // joy qo'shish — YO'Q
		{"PUT", "/v2/places/x"},
		{"DELETE", "/v2/places/00000000-0000-0000-0000-000000000000"},
		{"POST", "/v2/geocode"},
		{"GET", "/v2/places/00000000-0000-0000-0000-000000000000/photos/1"}, // rasm — YO'Q
		{"GET", "/v2/places/meta"},
		{"GET", "/v2/mahallas"},
		{"GET", "/v2/route"}, // v1 nomi — v2'da yo'q (directions)
		{"GET", "/v2/admin/ping"},
		{"GET", "/v2/"},
		{"GET", "/v2/geocode/extra"},
	} {
		r := httptest.NewRequest(tc.method, tc.path, nil)
		for k, v := range key {
			r.Header.Set(k, v)
		}
		w := httptest.NewRecorder()
		e.h.ServeHTTP(w, r)
		if tc.path == "/v2/places/meta" || tc.path == "/v2/places/x" {
			// {id} andozasi bilan mos: GET /v2/places/meta — id "meta" → 404 (kalit bor, id yaroqsiz)
			if tc.method == "GET" && w.Code != http.StatusNotFound {
				t.Errorf("%s %s: %d", tc.method, tc.path, w.Code)
			}
			if tc.method != "GET" && w.Code != http.StatusForbidden {
				t.Errorf("%s %s: %d", tc.method, tc.path, w.Code)
			}
			continue
		}
		if w.Code != http.StatusForbidden {
			t.Errorf("%s %s: %d (kutilgan 403)", tc.method, tc.path, w.Code)
			continue
		}
		if _, code := errCode(t, w); code != devplatform.CodeAPINotAllowed {
			t.Errorf("%s %s: kod %q", tc.method, tc.path, code)
		}
	}
}

func TestV2RequiresValidKey(t *testing.T) {
	e := newV2Env(t, nil)
	w := e.get("/v2/geocode?q=chust", nil)
	if w.Code != 401 {
		t.Fatalf("kalitsiz: %d", w.Code)
	}
	if st, code := errCode(t, w); st != "REQUEST_DENIED" || code != devplatform.CodeMissingKey {
		t.Fatalf("%s %s", st, code)
	}
	w = e.get("/v2/geocode?q=chust", map[string]string{apiKeyHeader: "omk_s_" + strings.Repeat("a", 52)})
	if w.Code != 401 {
		t.Fatalf("noma'lum kalit: %d", w.Code)
	}
	// v1 read kaliti v2'da YAROQSIZ (boshqa tizim)
	w = e.get("/v2/geocode?q=chust", map[string]string{apiKeyHeader: testReadKey})
	if w.Code != 401 {
		t.Fatalf("v1 kaliti v2'da o'tdi: %d", w.Code)
	}
}

func TestV2ServerKeyValidRequestReachesHandler(t *testing.T) {
	e := newV2Env(t, nil)
	h := map[string]string{apiKeyHeader: e.serverKey}
	// db=nil → 503, lekin kalit o'tdi va handler'ga yetdi
	if w := e.get("/v2/geocode?q=chust", h); w.Code != 503 {
		t.Fatalf("geocode: %d %s", w.Code, w.Body)
	}
	if w := e.get("/v2/geocode?q=c", h); w.Code != 400 {
		t.Fatalf("qisqa q: %d", w.Code)
	}
	if w := e.get("/v2/geocode?q=chust&limit=999", h); w.Code != 400 {
		t.Fatalf("katta limit: %d", w.Code)
	}
	if w := e.get("/v2/reverse?lat=NaN&lng=71", h); w.Code != 400 {
		t.Fatalf("NaN: %d", w.Code)
	}
	if w := e.get("/v2/directions?origin=41,71&destination=41,71", h); w.Code != 400 {
		t.Fatalf("bir xil nuqta: %d", w.Code)
	}
	if w := e.get("/v2/directions?origin=41.0,71.0", h); w.Code != 400 {
		t.Fatalf("destination yo'q: %d", w.Code)
	}
	if w := e.get("/v2/places?bbox=71,41,71.1", h); w.Code != 400 {
		t.Fatalf("bbox: %d", w.Code)
	}
	if w := e.get("/v2/places/not-a-uuid", h); w.Code != 404 {
		t.Fatalf("yaroqsiz id: %d", w.Code)
	}
}

func TestV2ServerKeyRejectedInURLAndWithOrigin(t *testing.T) {
	e := newV2Env(t, nil)
	if w := e.get("/v2/geocode?q=chust&key="+e.serverKey, nil); w.Code != 403 {
		t.Fatalf("URL'dagi server kaliti: %d", w.Code)
	}
	w := e.get("/v2/geocode?q=chust", map[string]string{apiKeyHeader: e.serverKey, "Origin": "https://evil.com"})
	if w.Code != 403 {
		t.Fatalf("Origin bilan server kaliti: %d", w.Code)
	}
}

func TestV2BrowserKeyOriginAndCORS(t *testing.T) {
	e := newV2Env(t, nil)
	path := "/v2/geocode?q=chust&key=" + e.bKey

	w := e.get(path, map[string]string{"Origin": "https://app.example.com"})
	if w.Code != 503 { // kalit o'tdi, db yo'q
		t.Fatalf("to'g'ri origin: %d %s", w.Code, w.Body)
	}
	if w.Header().Get("Access-Control-Allow-Origin") != "https://app.example.com" {
		t.Error("ruxsat etilgan origin uchun ACAO yo'q")
	}
	w = e.get(path, map[string]string{"Origin": "https://evil.com"})
	if w.Code != 403 {
		t.Fatalf("begona origin: %d", w.Code)
	}
	if w = e.get(path, nil); w.Code != 403 { // curl: Origin/Referer yo'q
		t.Fatalf("Origin'siz brauzer kaliti: %d", w.Code)
	}
	// brauzer kaliti boshqa API'ga ishlamaydi
	w = e.get("/v2/reverse?lat=41&lng=71&key="+e.bKey, map[string]string{"Origin": "https://app.example.com"})
	if w.Code != 403 {
		t.Fatalf("yoqilmagan API: %d", w.Code)
	}
	// preflight: kalitsiz, faqat GET
	r := httptest.NewRequest(http.MethodOptions, "/v2/geocode", nil)
	r.Header.Set("Origin", "https://app.example.com")
	pw := httptest.NewRecorder()
	e.h.ServeHTTP(pw, r)
	if pw.Code != 204 || pw.Header().Get("Access-Control-Allow-Methods") != "GET, OPTIONS" {
		t.Fatalf("preflight: %d %v", pw.Code, pw.Header())
	}
	// "null" origin'ga CORS sarlavhasi berilmaydi
	w = e.get(path, map[string]string{"Origin": "null"})
	if w.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Error("'null' origin'ga ACAO berildi")
	}
}

func TestV2MeteringCountsOnlyBillable(t *testing.T) {
	e := newV2Env(t, nil)
	h := map[string]string{apiKeyHeader: e.serverKey}
	e.get("/v2/places/not-a-uuid", h) // 404 — hisoblanadi
	e.get("/v2/geocode?q=c", h)       // 400 — xato
	e.get("/v2/geocode?q=chust", h)   // 503 — xato
	e.get("/v2/geocode?q=chust", nil) // kalitsiz — umuman hisoblanmaydi
	if err := e.plat.Meter().Flush(context.Background()); err != nil {
		t.Fatal(err)
	}
	var req, errs int64
	for _, r := range e.st.written {
		req += r.Requests
		errs += r.Errors
	}
	if req != 1 || errs != 2 {
		t.Fatalf("hisob: requests=%d errors=%d (kutilgan 1 va 2): %+v", req, errs, e.st.written)
	}
}

func TestV2DisabledWithoutPlatform(t *testing.T) {
	h := New(baseCfg(), nil).Handler()
	r := httptest.NewRequest(http.MethodGet, "/v2/geocode?q=chust", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 503 {
		t.Fatalf("platforma yo'q: %d", w.Code)
	}
}

func TestV2ResponsesAreNotCacheable(t *testing.T) {
	e := newV2Env(t, nil)
	w := e.get("/v2/geocode?q=chust", map[string]string{apiKeyHeader: e.serverKey})
	if w.Header().Get("Cache-Control") != "no-store" {
		t.Error("Cache-Control: no-store yo'q")
	}
}

// ── /v1 qo'riqchisi ──

func guardedServer(t *testing.T) http.Handler {
	cfg := baseCfg()
	cfg.V1FirstPartyOnly = true
	cfg.FirstPartyOrigins = []string{"https://maps.ondex.uz"}
	return New(cfg, nil).Handler()
}

func TestV1GuardFirstPartyOnly(t *testing.T) {
	h := guardedServer(t)
	call := func(method, path string, hdr map[string]string) int {
		r := httptest.NewRequest(method, path, nil)
		for k, v := range hdr {
			r.Header.Set(k, v)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w.Code
	}
	allowed := []map[string]string{
		{"Origin": "https://maps.ondex.uz"},
		{"Sec-Fetch-Site": "same-origin"},
		{"Referer": "https://maps.ondex.uz/maps/1"},
		{apiKeyHeader: testReadKey},
		{apiKeyHeader: testAdminKey},
	}
	for i, hdr := range allowed {
		if c := call("GET", "/v1/search?q=chust", hdr); c == http.StatusForbidden {
			t.Errorf("#%d: o'z so'rov bloklandi", i)
		}
	}
	denied := []map[string]string{
		nil,
		{"Origin": "https://evil.com"},
		{"Sec-Fetch-Site": "same-site"},
		{"Sec-Fetch-Site": "cross-site", "Origin": "https://evil.com"},
		{"Referer": "https://evil.com/"},
		{apiKeyHeader: "noto'g'ri"},
	}
	for i, hdr := range denied {
		for _, req := range [][2]string{{"GET", "/v1/search?q=chust"}, {"POST", "/v1/places"}, {"GET", "/v1/route"}} {
			if c := call(req[0], req[1], hdr); c != http.StatusForbidden {
				t.Errorf("#%d %s %s: %d (kutilgan 403)", i, req[0], req[1], c)
			}
		}
	}
	// /healthz va statik boyliklarga tegmaydi
	if c := call("GET", "/healthz", nil); c != 200 {
		t.Errorf("healthz: %d", c)
	}
	// /v2 /v1 qo'riqchisidan o'tmaydi (o'z qoidasi bor)
	if c := call("GET", "/v2/geocode?q=chust", nil); c != http.StatusServiceUnavailable {
		t.Errorf("v2 (platforma yo'q) 503 bo'lishi kerak, /v1 qo'riqchisi aralashmasin: %d", c)
	}
}

func TestV1OpenByDefault(t *testing.T) {
	h := New(baseCfg(), nil).Handler()
	r := httptest.NewRequest(http.MethodGet, "/v1/search?q=chust", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code == http.StatusForbidden {
		t.Fatal("standart holatda /v1 yopilmasligi kerak (mavjud sayt buzilardi)")
	}
}
