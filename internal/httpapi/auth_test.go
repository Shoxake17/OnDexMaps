package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"ondexmap/internal/config"
)

const (
	testReadKey  = "read-kalit-0123456789abcdef0123456789"
	testAdminKey = "admin-kalit-0123456789abcdef0123456789"
	testPrevKey  = "eski-kalit-0123456789abcdef0123456789"
)

func testServer(t *testing.T, cfg *config.Config) http.Handler {
	t.Helper()
	return New(cfg).Handler()
}

func baseCfg() *config.Config {
	return &config.Config{
		DevMode:        true,
		AppEnv:         "development",
		HTTPAddr:       ":8090",
		ReadKey:        testReadKey,
		AdminKey:       testAdminKey,
		AllowedOrigins: []string{"http://localhost:3100"},
		MapboxToken:    "pk.test",
	}
}

func do(h http.Handler, method, path, key string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, path, nil)
	if key != "" {
		r.Header.Set(apiKeyHeader, key)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

// Huquq matritsasi — kim qayerga kira oladi.
func TestScopeMatrix(t *testing.T) {
	h := testServer(t, baseCfg())

	cases := []struct {
		name   string
		method string
		path   string
		key    string
		want   int
	}{
		{"ommaviy endpoint kalitsiz ochiq", "GET", "/v1/config", "", http.StatusOK},
		{"healthz kalitsiz ochiq", "GET", "/healthz", "", http.StatusOK},

		{"read kaliti read endpointga o'tadi", "GET", "/v1/whoami", testReadKey, http.StatusOK},
		{"admin kaliti read endpointga HAM o'tadi", "GET", "/v1/whoami", testAdminKey, http.StatusOK},

		{"admin kaliti admin endpointga o'tadi", "POST", "/v1/admin/ping", testAdminKey, http.StatusOK},

		// ENG MUHIM tekshiruv: huquqni oshirish mumkin emas.
		{"read kaliti admin endpointga O'TMAYDI", "POST", "/v1/admin/ping", testReadKey, http.StatusUnauthorized},

		{"kalitsiz read endpoint rad etiladi", "GET", "/v1/whoami", "", http.StatusUnauthorized},
		{"noto'g'ri kalit rad etiladi", "GET", "/v1/whoami", "yolg'on-kalit", http.StatusUnauthorized},
		{"kalitning prefiksi ham rad etiladi", "GET", "/v1/whoami", testReadKey[:10], http.StatusUnauthorized},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := do(h, c.method, c.path, c.key).Code; got != c.want {
				t.Errorf("%s %s: kutilgan %d, olingan %d", c.method, c.path, c.want, got)
			}
		})
	}
}

// Sozlanmagan kalit — OCHIQ ESHIK EMAS.
//
// Bu regressiya testi eng jiddiy potentsial zaiflikni qo'riqlaydi:
// agar bo'sh kalit ham ruxsat ro'yxatiga tushsa, `X-API-Key:` ni bo'sh
// yuborgan HAR KIM autentifikatsiyadan o'tardi.
func TestEmptyConfiguredKeyGrantsNothing(t *testing.T) {
	cfg := baseCfg()
	cfg.ReadKey = ""
	cfg.ReadKeyPrev = ""
	cfg.AdminKey = ""
	cfg.AdminKeyPrev = ""
	h := testServer(t, cfg)

	for _, key := range []string{"", " ", "istalgan"} {
		if got := do(h, "GET", "/v1/whoami", key).Code; got != http.StatusUnauthorized {
			t.Errorf("kalit=%q: kutilgan 401, olingan %d — sozlanmagan slot ochiq qolgan", key, got)
		}
		if got := do(h, "POST", "/v1/admin/ping", key).Code; got != http.StatusUnauthorized {
			t.Errorf("kalit=%q: admin uchun kutilgan 401, olingan %d", key, got)
		}
	}
}

// Rotatsiya sloti: eski kalit ham, yangisi ham bir vaqtda ishlaydi.
func TestKeyRotationSlot(t *testing.T) {
	cfg := baseCfg()
	cfg.ReadKeyPrev = testPrevKey
	h := testServer(t, cfg)

	for _, key := range []string{testReadKey, testPrevKey} {
		if got := do(h, "GET", "/v1/whoami", key).Code; got != http.StatusOK {
			t.Errorf("kalit %q ishlashi kerak edi, olingan %d", key, got)
		}
	}
	// Rotatsiya tugagach eski slot bo'shatiladi — o'shanda rad etilsin.
	cfg.ReadKeyPrev = ""
	h2 := testServer(t, cfg)
	if got := do(h2, "GET", "/v1/whoami", testPrevKey).Code; got != http.StatusUnauthorized {
		t.Errorf("slot bo'shatilgach eski kalit rad etilishi kerak, olingan %d", got)
	}
}

// Kalit javobga hech qachon tushmaydi.
func TestKeyNeverLeaksIntoResponse(t *testing.T) {
	h := testServer(t, baseCfg())
	for _, w := range []*httptest.ResponseRecorder{
		do(h, "GET", "/v1/whoami", "yolg'on-kalit"),
		do(h, "GET", "/v1/whoami", testReadKey),
		do(h, "POST", "/v1/admin/ping", testReadKey),
	} {
		body := w.Body.String()
		for _, secret := range []string{testReadKey, testAdminKey, "yolg'on-kalit"} {
			if strings.Contains(body, secret) {
				t.Errorf("kalit javob tanasiga tushib ketdi: %s", body)
			}
		}
	}
}

// Rad etish sababi oshkor qilinmaydi — noto'g'ri kalit va huquqi
// yetmagan kalit AYNAN bir xil javob olishi kerak.
func TestDenialIsIndistinguishable(t *testing.T) {
	h := testServer(t, baseCfg())
	wrong := do(h, "POST", "/v1/admin/ping", "yolg'on-kalit")
	insufficient := do(h, "POST", "/v1/admin/ping", testReadKey)

	if wrong.Code != insufficient.Code {
		t.Errorf("status farq qilyapti: %d va %d", wrong.Code, insufficient.Code)
	}
	if wrong.Body.String() != insufficient.Body.String() {
		t.Errorf("javob tanasi farq qilyapti:\n  %s\n  %s", wrong.Body.String(), insufficient.Body.String())
	}
}

// CORS fail-closed: ro'yxatda yo'q origin sarlavha olmaydi.
func TestCORSAllowlist(t *testing.T) {
	h := testServer(t, baseCfg())

	req := httptest.NewRequest("GET", "/healthz", nil)
	req.Header.Set("Origin", "https://yolgon-sayt.uz")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("ruxsatsiz origin CORS sarlavhasini oldi: %q", got)
	}

	req2 := httptest.NewRequest("GET", "/healthz", nil)
	req2.Header.Set("Origin", "http://localhost:3100")
	w2 := httptest.NewRecorder()
	h.ServeHTTP(w2, req2)
	if got := w2.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3100" {
		t.Errorf("ruxsat etilgan origin sarlavha olmadi: %q", got)
	}
	if !strings.Contains(w2.Header().Get("Vary"), "Origin") {
		t.Error("Vary: Origin yo'q — kesh javoblarni chalkashtirib yuborishi mumkin")
	}
}

func TestSecurityHeadersOnErrorResponses(t *testing.T) {
	h := testServer(t, baseCfg())
	// Xato javobida HAM sarlavhalar bo'lishi kerak.
	w := do(h, "GET", "/v1/whoami", "yolg'on")
	for k, want := range map[string]string{
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options":        "DENY",
		"Referrer-Policy":        "no-referrer",
	} {
		if got := w.Header().Get(k); got != want {
			t.Errorf("%s: kutilgan %q, olingan %q", k, want, got)
		}
	}
}
