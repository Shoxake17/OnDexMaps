package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// ═══════════════════════════════════════════════════════════════════════
// TASHQI DASTURCHI YO'LI
//
// Hujjatlardagi «Tezkor start» ni nusxalagan odam BOSHQA domenda o'tiradi.
// Brauzer uchun bu — cross-origin so'rov: CORS sarlavhasi bo'lmasa javob
// 200 bo'lsa ham BLOKLANADI va xarita jimgina oq qoladi.
//
// Aynan shu nosozlik bo'lgan: `style.json` CORS'siz berilardi (2026-09-26).
// Quyidagi testlar hujjatlarda va'da qilingan har bir manzilni tekshiradi.
// ═══════════════════════════════════════════════════════════════════════

const thirdPartyOrigin = "https://junior-sayt.uz"

func requestFrom(t *testing.T, h http.Handler, path, origin string) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(http.MethodGet, path, nil)
	if origin != "" {
		r.Header.Set("Origin", origin)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

// Xarita boyliklari HAR QANDAY saytdan yuklanishi kerak.
func TestThirdPartyCanLoadMapAssets(t *testing.T) {
	h := New(baseCfg(), nil).Handler()

	for _, path := range []string{
		"/tiles/style.json",                      // uslub — JS API shundan boshlanadi
		"/fonts/Noto%20Sans%20Regular/0-255.pbf", // yozuvlar
		"/tiles/chust.pmtiles",                   // zaxira xarita ma'lumoti
	} {
		w := requestFrom(t, h, path, thirdPartyOrigin)
		if got := w.Header().Get("Access-Control-Allow-Origin"); got != "*" {
			t.Errorf("%s: ACAO=%q (kutilgan `*`) — tashqi saytda xarita ishlamaydi", path, got)
		}
	}
}

// `/v2` javoblari ham tashqi saytga ochiq bo'lishi kerak (brauzer kaliti
// bilan chaqiriladi). Kalit tekshiruvi ALOHIDA qatlam — CORS uni almashtirmaydi.
func TestThirdPartyGetsCORSOnV2(t *testing.T) {
	// Platforma sozlangan server (aks holda /v2 butunlay o'chiq — 503).
	h := newV2Env(t, nil).h

	w := requestFrom(t, h, "/v2/geocode?q=chust", thirdPartyOrigin)
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != thirdPartyOrigin {
		t.Errorf("ACAO=%q (kutilgan %q)", got, thirdPartyOrigin)
	}
	// Kalitsiz — baribir rad etiladi (CORS ruxsat BERMAYDI, faqat javobni
	// o'qishga yo'l ochadi).
	if w.Code != http.StatusUnauthorized {
		t.Errorf("kalitsiz so'rov: %d (kutilgan 401)", w.Code)
	}
}

// Kontrakt ham tashqi vositalardan (Swagger UI, Postman, kod generatorlari)
// yuklanadi.
func TestThirdPartyCanLoadOpenAPISpec(t *testing.T) {
	h := New(baseCfg(), nil).Handler()
	w := requestFrom(t, h, "/v2/openapi.yaml", thirdPartyOrigin)

	if w.Code != http.StatusOK {
		t.Fatalf("kontrakt: %d", w.Code)
	}
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("kontrakt ACAO=%q (kutilgan `*`)", got)
	}
}

// Himoyalangan yo'llar tashqi saytga OCHILIB KETMASLIGI kerak: CORS
// kengaytmasi faqat ommaviy boyliklarga tegishli.
func TestThirdPartyStillBlockedOnPrivatePaths(t *testing.T) {
	h := New(baseCfg(), nil).Handler()

	for _, path := range []string{"/v1/search?q=chust", "/v1/places/meta", "/healthz"} {
		w := requestFrom(t, h, path, thirdPartyOrigin)
		if got := w.Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Errorf("%s: begona saytga ACAO=%q berildi", path, got)
		}
	}
}
