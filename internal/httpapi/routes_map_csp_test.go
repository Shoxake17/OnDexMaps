package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// `/map` prototip sahifasi O'CHIRILGAN va qaytmasligi kerak.
//
// U ishlab chiqish uchun qo'lda yozilgan HTML edi va yashashi uchun
// CSP'ni yumshatishni (`script-src 'unsafe-inline'`) talab qilardi.
// Ommaviy sayt endi Next.js'da (`web/`), ya'ni sahifa keraksiz.
// Bu test uni kimdir "vaqtincha" qaytarib qo'ymasligini qulflaydi:
// yumshatilgan CSP bilan birga qaytsa, XSS himoyasi ham birga ketadi.
func TestMapPrototypePageIsGone(t *testing.T) {
	dev := baseCfg()
	dev.DevMode = true
	if got := do(testServer(t, dev), "GET", "/map", "").Code; got != http.StatusNotFound {
		t.Errorf("/map o'chirilgan bo'lishi kerak, olingan %d", got)
	}
}

// CSP'da HECH QANDAY tashqi manba yoki yumshatish bo'lmasligi kerak.
//
// Server endi faqat JSON, tile va shrift beradi — HTML emas. Ro'yxatda
// tashqi xost paydo bo'lishi kimdir yana sahifa qo'shganini yoki
// pullik provayderga bog'liqlikni qaytarganini bildiradi.
func TestCSPHasNoExternalHosts(t *testing.T) {
	h := testServer(t, baseCfg())
	for _, path := range []string{"/healthz", "/v1/config", "/tiles/style.json"} {
		csp := do(h, "GET", path, "").Header().Get("Content-Security-Policy")
		if !strings.Contains(csp, "default-src 'none'") {
			t.Errorf("%s uchun qat'iy CSP yo'q: %q", path, csp)
		}
		for _, bad := range []string{"arcgisonline.com", "mapbox.com", "unsafe-inline", "*"} {
			if strings.Contains(csp, bad) {
				t.Errorf("%s CSP'sida ortiqcha ruxsat %q: %s", path, bad, csp)
			}
		}
	}
}

// Xarita boyliklari PRODUCTION'da ham berilishi SHART.
//
// Ilgari ular `/map` sahifasi bilan bir shartning ichida edi
// (`if !DevMode { return }`). Sahifa o'chirilgach shart qolsa, jonli
// serverda uslub va shriftlar 404 bo'lib, ommaviy saytda xarita
// butunlay oq qolardi — va buni lokalda SEZIB BO'LMASDI, chunki
// lokalda `APP_ENV=development` doim yoqiq.
func TestMapAssetsServedInProduction(t *testing.T) {
	prod := baseCfg()
	prod.DevMode = false
	h := testServer(t, prod)

	for _, path := range []string{
		"/tiles/style.json",
		"/tiles/chust.pmtiles",
		"/fonts/Noto%20Sans%20Regular/0-255.pbf",
	} {
		if got := do(h, "GET", path, "").Code; got != http.StatusOK {
			t.Errorf("production'da %s berilmadi (%d) — xarita oq qoladi", path, got)
		}
	}
}

// Bino manbasi sozlanmagan bo'lsa, uslubda UNGA TAYANADIGAN hech
// narsa qolmasligi kerak.
//
// Nega muhim: manzilsiz manba qolsa xarita kutubxonasi xato beradi va
// butun sahifa yuklanmay qolishi mumkin — ya'ni sozlanmagan IXTIYORIY
// qatlam butun xaritani o'ldirardi.
func TestStyleDropsBuildingsWhenUnconfigured(t *testing.T) {
	cfg := baseCfg() // BuildingsURL bo'sh
	h := testServer(t, cfg)

	body := do(h, "GET", "/tiles/style.json", "").Body.String()
	if strings.Contains(body, "__BUILDINGS_URL__") {
		t.Error("uslubda to'ldirilmagan o'rinbosar qoldi")
	}
	if strings.Contains(body, "ondex-buildings") {
		t.Error("sozlanmagan bino manbasi uslubda qoldi")
	}

	// Sozlangan holatda esa BO'LISHI kerak.
	cfg2 := baseCfg()
	cfg2.BuildingsURL = "https://example.test/buildings.pmtiles"
	body2 := do(testServer(t, cfg2), "GET", "/tiles/style.json", "").Body.String()
	if !strings.Contains(body2, "https://example.test/buildings.pmtiles") {
		t.Error("sozlangan bino manzili uslubga tushmadi")
	}
}

// Xarita ma'lumoti Range so'rovlari bilan beriladi — MapLibre'ning
// PMTiles plagini butun faylni emas, faqat kerakli baytlarni so'raydi.
func TestPMTilesServedWithRangeSupport(t *testing.T) {
	h := testServer(t, baseCfg())

	r := mustRequest("GET", "/tiles/chust.pmtiles")
	r.Header.Set("Range", "bytes=0-126")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	if w.Code != 206 {
		t.Fatalf("Range so'roviga kutilgan 206, olingan %d", w.Code)
	}
	if w.Body.Len() != 127 {
		t.Errorf("kutilgan 127 bayt, olingan %d", w.Body.Len())
	}
	// PMTiles v3 sarlavhasi "PMTiles" sehrli so'zi bilan boshlanadi.
	if !strings.HasPrefix(w.Body.String(), "PMTiles") {
		t.Error("javob PMTiles faylining boshi emas")
	}
}
