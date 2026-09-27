package httpapi

import (
	"regexp"
	"strconv"
	"strings"
	"testing"

	"ondexmap/internal/devplatform"
)

// ═══════════════════════════════════════════════════════════════════════
// SDK HUJJAT SAHIFALARI ↔ SERVER
//
// `sdk_sync_test.go` SDK KODINI serverga bog'laydi. Bu fayl to'rtinchi
// sirtni qo'shadi: `console/src/app/docs/sdk/` dagi qo'lda yozilgan
// sahifalar.
//
// Nega alohida kerak: SDK kodi to'g'ri bo'lsa ham, hujjatdagi jadval
// eskirishi mumkin. Integrator esa avval hujjatni o'qiydi va unga
// qarab arxitektura tanlaydi — masalan «bepul rejada 0.25°» ni ko'rib
// ekran o'lchamini rejalashtiradi. Bu son noto'g'ri bo'lsa, xato
// ishlash vaqtida emas, LOYIHALASH bosqichida yuzaga keladi.
//
// Bu yerda tekshiriladigan sonlar — sahifada AYNAN ko'rsatilganlari.
// ═══════════════════════════════════════════════════════════════════════

const (
	sdkRestPage   = "../../console/src/app/docs/sdk/rest/page.tsx"
	sdkMapPage    = "../../console/src/app/docs/sdk/xarita/page.tsx"
	sdkIndexPage  = "../../console/src/app/docs/sdk/page.tsx"
	sdkErrorsPage = "../../console/src/app/docs/sdk/xatolar/page.tsx"
)

// TestSDKDocsBBoxTableMatchesPlans — REST sahifasidagi tarif jadvali
// `devplatform.DefaultPlans()` bilan bir xilmi.
func TestSDKDocsBBoxTableMatchesPlans(t *testing.T) {
	src := readFile(t, sdkRestPage)
	p := devplatform.DefaultPlans()

	for _, c := range []struct {
		tarif string
		span  float64
	}{
		{"free", p.Free.MaxBBoxSpan},
		{"paid", p.Paid.MaxBBoxSpan},
		{"ecosystem", p.Ecosystem.MaxBBoxSpan},
	} {
		// Jadval qatori: `<C key="f">free</C>, <>0.25°</>`
		re := regexp.MustCompile(
			`>` + regexp.QuoteMeta(c.tarif) + `</C>[^\n]*?<>([0-9.]+)°`)
		m := re.FindStringSubmatch(src)
		if m == nil {
			t.Fatalf("SDK hujjatida `%s` tarifi uchun chegara topilmadi", c.tarif)
		}
		got, err := strconv.ParseFloat(m[1], 64)
		if err != nil {
			t.Fatalf("`%s` chegarasi son emas: %q", c.tarif, m[1])
		}
		if got != c.span {
			t.Errorf("SDK hujjatida %s = %v°, serverda %v°", c.tarif, got, c.span)
		}
	}
}

// TestSDKDocsGeocodeLimitMatchesServer — hujjatdagi geocode limiti
// server tekshiruvidagi son bilan bir xilmi.
func TestSDKDocsGeocodeLimitMatchesServer(t *testing.T) {
	src := readFile(t, sdkRestPage)

	// «serverning yuqori chegarasiga (25) avtomatik qirqiladi».
	// `\s+` kerak: JSX matni qatorlarga bo'linadi va son keyingi
	// qatorga tushib qolishi mumkin.
	re := regexp.MustCompile(`yuqori chegarasiga\s+\((\d+)\)`)
	m := re.FindStringSubmatch(src)
	if m == nil {
		t.Fatal("SDK hujjatida geocode limiti tilga olinmagan")
	}
	got, _ := strconv.Atoi(m[1])
	if got != v2GeocodeMaxLimit {
		t.Errorf("SDK hujjatida limit = %d, serverda %d", got, v2GeocodeMaxLimit)
	}
}

// TestSDKDocsReverseAreaMatchesServer — hujjatdagi reverse hududi
// `routes_geo.go` dagi qiymatlar bilan bir xilmi.
//
// Bu eng ko'p adashtiradigan raqam: `reverse` butun mamlakatni
// qamramaydi, va hujjat noto'g'ri hudud ko'rsatsa integrator
// Toshkentda ishlaydi deb o'ylab qoladi (ishlamaydi).
func TestSDKDocsReverseAreaMatchesServer(t *testing.T) {
	src := readFile(t, sdkRestPage)

	// «faqat 40.5–41.6° N, 70.5–72.0° E ichida»
	re := regexp.MustCompile(`([0-9.]+)–([0-9.]+)° N, ([0-9.]+)–([0-9.]+)° E`)
	m := re.FindStringSubmatch(src)
	if m == nil {
		t.Fatal("SDK hujjatida reverse hududi ko'rsatilmagan")
	}

	son := func(s string) float64 {
		v, err := strconv.ParseFloat(s, 64)
		if err != nil {
			t.Fatalf("hudud soni o'qilmadi: %q", s)
		}
		return v
	}

	for _, c := range []struct {
		nom  string
		got  float64
		want float64
	}{
		{"min kenglik", son(m[1]), minLat},
		{"max kenglik", son(m[2]), maxLat},
		{"min uzunlik", son(m[3]), minLng},
		{"max uzunlik", son(m[4]), maxLng},
	} {
		if c.got != c.want {
			t.Errorf("SDK hujjatida reverse %s = %v, serverda %v", c.nom, c.got, c.want)
		}
	}
}

// TestSDKDocsUseRealFieldNames — hujjatdagi javob maydonlari
// kontraktda haqiqatan bormi.
//
// ┌─ NEGA ─────────────────────────────────────────────────────────────┐
// Aynan shu xato bugun SDK'ning README'sida topildi: misolda
// `yol.distance` yozilgan edi, kontraktda esa `distance_m`. Nusxalab
// olgan odam `undefined` olardi va sababini topolmasdi.
//
// Bu yerda hujjatning O'ZI tekshiriladi: misollarda ishlatilgan maydon
// nomi kontraktdagi sxemada yo'q bo'lsa test yiqiladi.
// └────────────────────────────────────────────────────────────────────┘
func TestSDKDocsUseRealFieldNames(t *testing.T) {
	spec := string(openAPISpec)
	src := readFile(t, sdkRestPage)

	// Misollarda `obyekt.maydon` ko'rinishida ishlatilgan maydonlar.
	// Prefikslar — SDK javob obyektlarining nomlari.
	for _, c := range []struct{ ifoda, sxema string }{
		{"m.name", "name"},
		{"m.label", "label"},
		{"m.lat", "lat"},
		{"m.lng", "lng"},
		{"m.score", "score"},
		{"manzil.result.text", "text"},
		{"yol.distance_m", "distance_m"},
		{"yol.duration_s", "duration_s"},
		{"yol.geometry", "geometry"},
		{"obyektlar.result.features", "features"},
	} {
		if !strings.Contains(src, c.ifoda) {
			t.Errorf("SDK hujjatida `%s` misoli yo'qolgan — test eskirganmi?", c.ifoda)
			continue
		}
		// Kontraktda maydon `nom:` yoki `nom: {` ko'rinishida e'lon qilinadi.
		if !regexp.MustCompile(`(?m)^\s+` + regexp.QuoteMeta(c.sxema) + `:`).MatchString(spec) {
			t.Errorf("hujjatdagi `%s` maydoni kontraktda yo'q", c.sxema)
		}
	}
}

// TestSDKDocsKeepAttributionMandatory — xarita sahifasi atributni
// o'chirib bo'lmasligini AYTADIMI.
//
// SDK atributni kod bilan majburlaydi, lekin hujjat buning aksini
// yozib qo'ysa (masalan eski `attributionControl: false` maslahati),
// integrator SDK'ni chetlab o'tishga urinardi.
func TestSDKDocsKeepAttributionMandatory(t *testing.T) {
	src := readFile(t, sdkMapPage)

	if !strings.Contains(src, "compact: false") {
		t.Error("xarita sahifasida `compact: false` tilga olinmagan")
	}
	if !strings.Contains(src, "o&apos;chirib") && !strings.Contains(src, "o'chirib") {
		t.Error("xarita sahifasi atributni o'chirib bo'lmasligini aytmaydi")
	}
	// `customAttribution` xavfi haqidagi ogohlantirish.
	if !strings.Contains(src, "sanitizatsiya") {
		t.Error("xarita sahifasida customAttribution xavfi ogohlantirilmagan")
	}
}

// TestSDKDocsPagesExist — nav'da e'lon qilingan sahifalar
// haqiqatan bormi.
//
// Next.js'da yo'q sahifa 404 beradi, build esa o'tadi: menyuda
// ko'ringan, bosilganda yo'q havola CI'da ushlanmasdi.
func TestSDKDocsPagesExist(t *testing.T) {
	nav := readFile(t, "../../console/src/components/docs/nav.ts")

	for _, p := range []struct{ href, fayl string }{
		{"/docs/sdk", sdkIndexPage},
		{"/docs/sdk/xarita", sdkMapPage},
		{"/docs/sdk/rest", sdkRestPage},
		{"/docs/sdk/xatolar", sdkErrorsPage},
	} {
		if !strings.Contains(nav, `"`+p.href+`"`) {
			t.Errorf("menyuda `%s` yo'q", p.href)
		}
		if readFile(t, p.fayl) == "" {
			t.Errorf("`%s` sahifasi bo'sh yoki yo'q", p.href)
		}
	}
}
