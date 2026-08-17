package mapui

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func handler() http.Handler {
	mux := http.NewServeMux()
	Register(mux)
	return mux
}

func get(h http.Handler, path string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
	return w
}

func TestAssetsAreServed(t *testing.T) {
	h := handler()
	cases := map[string]string{
		"/assets/ondexmap.js":  "text/javascript",
		"/assets/ondexmap.css": "text/css",
	}
	for path, wantType := range cases {
		w := get(h, path)
		if w.Code != http.StatusOK {
			t.Errorf("%s: kutilgan 200, olingan %d", path, w.Code)
			continue
		}
		if ct := w.Header().Get("Content-Type"); !strings.Contains(ct, wantType) {
			t.Errorf("%s: Content-Type %q, %q kutilgan", path, ct, wantType)
		}
		if w.Body.Len() == 0 {
			t.Errorf("%s: bo'sh javob", path)
		}
		if w.Header().Get("X-Content-Type-Options") != "nosniff" {
			t.Errorf("%s: nosniff yo'q", path)
		}
	}
}

// Ruxsat ro'yxatida yo'q fayl berilmaydi.
func TestUnknownAssetIsNotFound(t *testing.T) {
	h := handler()
	for _, path := range []string{
		"/assets/mapui.go",
		"/assets/",
		"/assets/secret.txt",
		"/assets/..%2Fmapui.go",
	} {
		if got := get(h, path).Code; got != http.StatusNotFound {
			t.Errorf("%s: kutilgan 404, olingan %d", path, got)
		}
	}
}

// Umumiy modul ikkala sahifa uchun zarur funksiyalarni berishi kerak.
// Bu test dublikat qaytib kelib qolmasligini qo'riqlaydi: agar kimdir
// modulni chetlab o'tib sahifada o'z nusxasini yozsa, bu yerdagi
// kutilgan nomlar modulda yo'qolib, test yiqiladi.
func TestSharedModuleExposesRequiredAPI(t *testing.T) {
	body := get(handler(), "/assets/ondexmap.js").Body.String()
	for _, needed := range []string{
		"OndexMap",
		"setBasemap",  // Xarita / Sputnik almashtirish
		"satellite",   // sputnik uslubi
		"beforeLayer", // qatlam tartibi (binolardan past)
		"fitTo",
		"esc",
		"style.load",       // uslub almashtirilganda qatlamlarni qayta qo'shish
		"arcgisonline.com", // ikkinchi tasvir manbasi (Sputnik 2)
		"_applyImagery",    // tasvir almashtirish
	} {
		if !strings.Contains(body, needed) {
			t.Errorf("umumiy modulda %q yo'q", needed)
		}
	}
}

// Brend yashirish UMUMIY faylda bo'lishi kerak — sahifalarda emas.
func TestBrandHidingLivesInSharedCSS(t *testing.T) {
	body := get(handler(), "/assets/ondexmap.css").Body.String()
	if !strings.Contains(body, "mapboxgl-ctrl-logo") {
		t.Error("umumiy CSS'da logotip yashirish qoidasi yo'q")
	}
}
