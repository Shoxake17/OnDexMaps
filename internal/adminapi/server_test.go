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

// UI sahifasi kalitsiz ochiladi (u shunchaki HTML), lekin undagi
// har bir ma'lumot chaqiruvi kalit talab qiladi.
func TestUIServedWithoutKeyButAPIIsNot(t *testing.T) {
	h := New(cfgWith(adminKey, ""), nil).Handler()

	if got := call(h, "GET", "/", "").Code; got != http.StatusOK {
		t.Errorf("UI sahifasi ochilmadi, status %d", got)
	}
	if got := call(h, "GET", "/api/features?kind=mahalla", "").Code; got != http.StatusUnauthorized {
		t.Errorf("ma'lumot endpointi kalitsiz ochildi, status %d", got)
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
	w := call(h, "GET", "/", "")
	for k, want := range map[string]string{
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options":        "DENY",
		"Cache-Control":          "no-store",
	} {
		if got := w.Header().Get(k); got != want {
			t.Errorf("%s: kutilgan %q, olingan %q", k, want, got)
		}
	}
}
