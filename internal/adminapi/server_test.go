package adminapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"ondexmap/internal/apikey"
	"ondexmap/internal/config"
)

const (
	adminKey = "admin-kalit-0123456789abcdef0123456789"
	readKey  = "read-kalit-0123456789abcdef0123456789"
	prevKey  = "eski-kalit-0123456789abcdef0123456789"
)

func cfgWith(admin, prev string) *config.Config {
	return &config.Config{
		DevMode:      true,
		AppEnv:       "development",
		AdminKey:     admin,
		AdminKeyPrev: prev,
		ReadKey:      readKey,
		MapboxToken:  "pk.test",
	}
}

func call(h http.Handler, method, path, key string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, path, strings.NewReader("{}"))
	if key != "" {
		r.Header.Set(apikey.Header, key)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

// ENG MUHIM TEST: READ kaliti admin vositasiga KIRA OLMAYDI.
//
// ChustApp ushlab turadigan kalit shu. Agar u bu yerda ishlasa,
// ommaviy ekotizimga berilgan kalit butun geoma'lumotni o'zgartirish
// huquqini bergan bo'lardi.
func TestReadKeyCannotAccessAdmin(t *testing.T) {
	h := New(cfgWith(adminKey, ""), nil).Handler()

	if got := call(h, "GET", "/api/verify", readKey).Code; got != http.StatusUnauthorized {
		t.Fatalf("read kaliti admin vositasiga kirdi (status %d) — huquq ajratmasi buzilgan", got)
	}
	if got := call(h, "GET", "/api/verify", adminKey).Code; got != http.StatusOK {
		t.Errorf("admin kaliti ishlamadi, status %d", got)
	}
}

// Lokal sessiya tokeni admin kaliti kabi ishlaydi — panel ichida
// kirish oynasi bo'lmasligining asosi shu.
//
// MUHIM: read kaliti bu yerda ham o'tmasligi kerak. Sessiya qo'shilishi
// bilan kalitlar to'plami "hammaga ochiq" bo'lib qolmasin.
func TestLocalSessionTokenWorksButReadKeyStillDoesNot(t *testing.T) {
	const session = "sessiya-tokeni-0123456789abcdef0123"
	h := New(cfgWith(adminKey, ""), nil, session).Handler()

	if got := call(h, "GET", "/api/verify", session).Code; got != http.StatusOK {
		t.Errorf("sessiya tokeni ishlamadi, status %d", got)
	}
	if got := call(h, "GET", "/api/verify", adminKey).Code; got != http.StatusOK {
		t.Errorf("admin kaliti ishlamadi, status %d", got)
	}
	for _, key := range []string{"", readKey, "yolg'on"} {
		if got := call(h, "GET", "/api/verify", key).Code; got != http.StatusUnauthorized {
			t.Errorf("kalit=%q: kutilgan 401, olingan %d", key, got)
		}
	}
}

// Bu server HTML sahifa BERMAYDI: muharrir ham, moderatsiya ham ChustApp admin
// panelida NATIV ekran. Eski Mapbox sahifasi (va u orqali kalit so'raydigan
// oyna) qaytib kelmasligini qo'riqlaydi — ikkinchi kirish nuqtasi yo'q.
func TestNoHTMLPagesAreServed(t *testing.T) {
	h := New(cfgWith(adminKey, ""), nil).Handler()
	for _, path := range []string{"/", "/index.html", "/moderation", "/assets/ondexmap.js", "/assets/ondexmap.css"} {
		w := call(h, "GET", path, adminKey)
		if w.Code != http.StatusNotFound {
			t.Errorf("%s: 404 kutilgan, %d (HTML/statik sahifa qaytib kelgan)", path, w.Code)
		}
		if ct := w.Header().Get("Content-Type"); strings.Contains(ct, "html") {
			t.Errorf("%s: HTML qaytdi (%s)", path, ct)
		}
	}
}

// Muharrir xaritasi sozlamasi: SIR tarqalmaydi.
//
// Sun'iy yo'ldosh tile'lari ommaviy API proksisi orqali olinadi; provayderning
// haqiqiy manzili (unda kalit bor) mijozga HECH QACHON berilmaydi. Mapbox tokeni
// ham endi umuman berilmaydi.
func TestConfigDoesNotLeakSecrets(t *testing.T) {
	cfg := cfgWith(adminKey, "")
	cfg.HTTPAddr = ":8090"
	cfg.SatelliteURL = "https://services.example/tile/{z}/{y}/{x}?token=JUDA-SIRLI-KALIT"
	cfg.SatelliteAttribution = "Powered by Esri"
	cfg.SatelliteMaxZoom = "18"
	h := New(cfg, nil).Handler()

	w := call(h, "GET", "/api/config", adminKey)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
	body := w.Body.String()
	for _, secret := range []string{"JUDA-SIRLI-KALIT", "services.example", "pk.test", "mapbox_token", adminKey, readKey} {
		if strings.Contains(body, secret) {
			t.Errorf("/api/config sirni oshkor qildi: %q", secret)
		}
	}
	if !strings.Contains(body, "http://127.0.0.1:8090/tiles/satellite/{z}/{x}/{y}") {
		t.Errorf("proksi manzili yo'q: %s", body)
	}
	if !strings.Contains(body, "Powered by Esri") {
		t.Errorf("kredit (litsenziya talabi) yo'q: %s", body)
	}

	// Manba sozlanmagan bo'lsa — maydon umuman yo'q (panel tugmani ko'rsatmaydi).
	cfg.SatelliteURL = ""
	body = call(New(cfg, nil).Handler(), "GET", "/api/config", adminKey).Body.String()
	if strings.Contains(body, "satellite_url") {
		t.Errorf("manba yo'q, lekin satellite_url berildi: %s", body)
	}
}

func TestApiPort(t *testing.T) {
	for in, want := range map[string]string{":8090": "8090", "0.0.0.0:9000": "9000", "127.0.0.1:8123": "8123", "": "8090", "noto'g'ri": "8090"} {
		if got := apiPort(in); got != want {
			t.Errorf("apiPort(%q) = %q, %q kutilgan", in, got, want)
		}
	}
}

func TestAdminRequiresKey(t *testing.T) {
	h := New(cfgWith(adminKey, ""), nil).Handler()

	cases := []struct {
		name, method, path, key string
		want                    int
	}{
		{"kalitsiz", "GET", "/api/verify", "", http.StatusUnauthorized},
		{"noto'g'ri kalit", "GET", "/api/verify", "yolg'on", http.StatusUnauthorized},
		{"kalit prefiksi", "GET", "/api/verify", adminKey[:12], http.StatusUnauthorized},
		{"bo'sh satr", "GET", "/api/verify", " ", http.StatusUnauthorized},
		{"to'g'ri kalit", "GET", "/api/verify", adminKey, http.StatusOK},
		{"config kalitsiz", "GET", "/api/config", "", http.StatusUnauthorized},
		{"yozish kalitsiz", "POST", "/api/mahalla", "", http.StatusUnauthorized},
		{"o'chirish kalitsiz", "POST", "/api/delete", "", http.StatusUnauthorized},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := call(h, c.method, c.path, c.key).Code; got != c.want {
				t.Errorf("kutilgan %d, olingan %d", c.want, got)
			}
		})
	}
}

// Foydalanuvchi ob'ektlari moderatsiyasi: HAR BIR endpoint admin kalitini talab
// qiladi (tasdiqlash, rad etish, o'chirish — yozish huquqi). READ kaliti ham,
// kalitsiz so'rov ham o'tmaydi. Brauzer sahifasi (`/moderation`) endi YO'Q:
// UI ChustApp admin panelida.
func TestModerationEndpointsRequireAdminKey(t *testing.T) {
	h := New(cfgWith(adminKey, ""), nil).Handler()

	endpoints := []struct{ method, path string }{
		{"GET", "/api/places/meta"},
		{"GET", "/api/submissions"},
		{"GET", "/api/submissions/11111111-1111-4111-8111-111111111111/photos/0"},
		{"POST", "/api/submissions/approve"},
		{"POST", "/api/submissions/reject"},
		{"GET", "/api/places"},
		{"POST", "/api/places/delete"},
	}
	for _, e := range endpoints {
		for name, key := range map[string]string{"kalitsiz": "", "read kaliti": readKey, "noto'g'ri": "yolg'on"} {
			if got := call(h, e.method, e.path, key).Code; got != http.StatusUnauthorized {
				t.Errorf("%s %s (%s): 401 kutilgan, %d — moderatsiya himoyasiz", e.method, e.path, name, got)
			}
		}
	}

	if got := call(h, "GET", "/moderation", adminKey).Code; got != http.StatusNotFound {
		t.Errorf("/moderation sahifasi hamon bor (%d): ortiqcha kirish yuzasi", got)
	}
}

// Kalit sozlanmagan bo'lsa vosita OCHILMAYDI (fail-closed).
//
// Bo'sh kalitni qabul qilish yozish huquqini himoyasiz qoldirardi.
func TestNoAdminKeyConfiguredLocksEverything(t *testing.T) {
	h := New(cfgWith("", ""), nil).Handler()
	for _, key := range []string{"", "istalgan", adminKey} {
		if got := call(h, "GET", "/api/verify", key).Code; got != http.StatusServiceUnavailable {
			t.Errorf("kalit=%q: kutilgan 503, olingan %d — sozlanmagan vosita ochiq qolgan", key, got)
		}
	}
}

// Rotatsiya sloti admin kaliti uchun ham ishlaydi.
func TestAdminKeyRotation(t *testing.T) {
	h := New(cfgWith(adminKey, prevKey), nil).Handler()
	for _, key := range []string{adminKey, prevKey} {
		if got := call(h, "GET", "/api/verify", key).Code; got != http.StatusOK {
			t.Errorf("kalit %q ishlashi kerak edi, olingan %d", key, got)
		}
	}
}

// Ma'lumot endpointlari kalitsiz ochilmaydi.
func TestDataEndpointsRequireKey(t *testing.T) {
	h := New(cfgWith(adminKey, ""), nil).Handler()
	for _, path := range []string{"/api/features?kind=mahalla", "/api/config"} {
		if got := call(h, "GET", path, "").Code; got != http.StatusUnauthorized {
			t.Errorf("%s kalitsiz ochildi, status %d", path, got)
		}
	}
}

// Noma'lum yo'l 404 bo'lishi kerak — `GET /` shabloni hamma narsaga
// mos kelib qolmasin.
func TestUnknownPathIsNotFound(t *testing.T) {
	h := New(cfgWith(adminKey, ""), nil).Handler()
	if got := call(h, "GET", "/tasodifiy/yol", "").Code; got != http.StatusNotFound {
		t.Errorf("kutilgan 404, olingan %d", got)
	}
}

func TestSecurityHeadersPresent(t *testing.T) {
	h := New(cfgWith(adminKey, ""), nil).Handler()
	w := call(h, "GET", "/api/verify", adminKey)
	for k, want := range map[string]string{
		"X-Content-Type-Options":  "nosniff",
		"X-Frame-Options":         "DENY",
		"Cache-Control":           "no-store",
		"Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
	} {
		if got := w.Header().Get(k); got != want {
			t.Errorf("%s: kutilgan %q, olingan %q", k, want, got)
		}
	}
}
