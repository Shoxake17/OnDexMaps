package httpapi

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

// TestStyleKeepsAttribution — xarita ma'lumotining ATRIBUTI o'chib
// ketmasligi.
//
// Tile'lar OpenStreetMap'dan, bino konturlari Microsoft Global ML
// Building Footprints'dan olinadi. Ikkalasi ham ODbL: atribut
// KO'RSATILISHI SHART. MapLibre uni manbalardagi `attribution`
// maydonidan yig'adi va `AttributionControl` orqali chizadi.
//
// Uslubni tahrirlayotganda bu maydon bexosdan o'chib ketishi oson —
// natija esa litsenziya buzilishi bo'ladi. Shuning uchun test bor.
func TestStyleKeepsAttribution(t *testing.T) {
	cfg := baseCfg()
	cfg.TilesURL = "https://example.test/tiles.pmtiles"
	cfg.BuildingsURL = "https://example.test/buildings.pmtiles"
	s := New(cfg, nil)

	var style struct {
		Sources map[string]struct {
			Attribution string `json:"attribution"`
		} `json:"sources"`
	}
	if err := json.Unmarshal(s.buildStyle(), &style); err != nil {
		t.Fatalf("uslub o'qilmadi: %v", err)
	}

	// Hammasi BITTA satrda — tartib kafolatlangan bo'lishi uchun.
	got := style.Sources["ondex"].Attribution
	for _, must := range []string{
		"OnDexMap", "/copyright", "/brand/ondex.png", // brend + logotip + havola
		"display:block", // brend yozuvi ALOHIDA qatorda (kreditlar ustida)
		"Microsoft",     // bino konturlari (ODbL)
		"OpenStreetMap",
	} {
		if !strings.Contains(got, must) {
			t.Errorf("atributda %q yo'q: %q", must, got)
		}
	}

	// TARTIB: OnDexMap → Microsoft → OpenStreetMap.
	iOndex := strings.Index(got, "OnDexMap")
	iMS := strings.Index(got, "Microsoft")
	iOSM := strings.Index(got, "OpenStreetMap")
	if !(iOndex < iMS && iMS < iOSM) {
		t.Errorf("atribut tartibi noto'g'ri (OnDexMap=%d, Microsoft=%d, OSM=%d): %q",
			iOndex, iMS, iOSM, got)
	}

	// Binolar manbasida alohida atribut BO'LMASLIGI kerak — aks holda
	// MapLibre uni oxiriga qo'shib, tartibni buzadi.
	if a := style.Sources["ondex-buildings"].Attribution; a != "" {
		t.Errorf("binolar manbasida ortiqcha atribut: %q", a)
	}

	// O'rinbosar qolib ketmasin.
	if strings.Contains(got, "__MS__") {
		t.Errorf("`__MS__` almashtirilmagan: %q", got)
	}
}

// TestStyleDropsMicrosoftCreditWithoutBuildings — binolar manbasi
// sozlanmaganda ularning krediti ham chiqmasligi kerak: bo'lmagan
// ma'lumot uchun atribut ko'rsatish noto'g'ri.
func TestStyleDropsMicrosoftCreditWithoutBuildings(t *testing.T) {
	cfg := baseCfg()
	cfg.TilesURL = "https://example.test/tiles.pmtiles"
	cfg.BuildingsURL = "" // sozlanmagan

	var style struct {
		Sources map[string]struct {
			Attribution string `json:"attribution"`
		} `json:"sources"`
	}
	if err := json.Unmarshal(New(cfg, nil).buildStyle(), &style); err != nil {
		t.Fatalf("uslub o'qilmadi: %v", err)
	}

	got := style.Sources["ondex"].Attribution
	if strings.Contains(got, "Microsoft") {
		t.Errorf("binolar yo'q, lekin Microsoft krediti qoldi: %q", got)
	}
	if strings.Contains(got, "__MS__") {
		t.Errorf("`__MS__` almashtirilmagan: %q", got)
	}
	for _, must := range []string{"OnDexMap", "OpenStreetMap"} {
		if !strings.Contains(got, must) {
			t.Errorf("atributda %q yo'q: %q", must, got)
		}
	}
}

// TestBrandLogoIsServed — atributdagi `<img>` manzili haqiqatan ishlashi.
func TestBrandLogoIsServed(t *testing.T) {
	res := do(testServer(t, baseCfg()), "GET", "/brand/ondex.png", "")

	if res.Code != 200 {
		t.Fatalf("/brand/ondex.png holati %d", res.Code)
	}
	if ct := res.Header().Get("Content-Type"); ct != "image/png" {
		t.Errorf("Content-Type %q, image/png kutilgandi", ct)
	}
	if b := res.Body.Bytes(); len(b) < 8 || string(b[1:4]) != "PNG" {
		t.Error("javob PNG emas")
	}
	// Har xarita yuklanishida so'raladi — keshlanishi shart.
	if cc := res.Header().Get("Cache-Control"); !strings.Contains(cc, "max-age") {
		t.Errorf("Cache-Control keshlashga ruxsat bermayapti: %q", cc)
	}
}

// TestCopyrightPageIsOpen — mualliflik sahifasi kalitsiz ochilishi.
//
// Uslubdagi atribut yozuvi shu sahifaga ishora qiladi. Agar u yopiq
// bo'lsa yoki yo'qolsa, yozuv "o'lik havola"ga aylanadi va atribut
// talabi ma'nosini yo'qotadi.
func TestCopyrightPageIsOpen(t *testing.T) {
	h := testServer(t, baseCfg())
	res := do(h, "GET", "/copyright", "")

	if res.Code != 200 {
		t.Fatalf("/copyright holati %d, 200 kutilgandi", res.Code)
	}
	if ct := res.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/html") {
		t.Errorf("Content-Type %q, text/html kutilgandi", ct)
	}

	// Umumiy `default-src 'none'` sahifaning uslubini bloklaydi —
	// sahifa uchun alohida siyosat qo'yilgan bo'lishi kerak.
	csp := res.Header().Get("Content-Security-Policy")
	if !strings.Contains(csp, "style-src") {
		t.Errorf("CSP'da `style-src` yo'q — sahifa bezaksiz chiqadi: %q", csp)
	}

	body := res.Body.String()
	for _, must := range []string{"OpenStreetMap", "ODbL", "Microsoft", "attributionControl"} {
		if !strings.Contains(body, must) {
			t.Errorf("mualliflik sahifasida %q yo'q", must)
		}
	}
}

// Xarita uslubi buzilsa, MapLibre uni BUTUNLAY rad etadi va xarita
// umuman chizilmaydi — oq ekran qoladi. Brauzer konsolidan tashqari
// hech qanday belgi bo'lmaydi, shuning uchun bu testlar mavjud.
//
// Bu yerdagi tekshiruvlar — bir marta HAQIQATAN yuz bergan
// nosozliklarning takrorlanmasligi uchun.

// `zoom` ifodasi FAQAT eng tashqi `interpolate`/`step` ning kirishi
// bo'la oladi.
//
// Bir marta `text-opacity` ga `["case", ..., ["interpolate", ...zoom...], 1]`
// yozilgan va MapLibre butun uslubni rad etgan: xarita oq ekranga
// aylangan, sabab esa darhol ko'rinmagan. Qoidani test qulflaydi.
func TestStyleZoomOnlyAsTopLevelInput(t *testing.T) {
	cfg := baseCfg()
	cfg.TilesURL = "https://example.test/tiles.pmtiles"
	cfg.BuildingsURL = "https://example.test/buildings.pmtiles"
	s := New(cfg, nil)

	var style struct {
		Layers []map[string]any `json:"layers"`
	}
	if err := json.Unmarshal(s.buildStyle(), &style); err != nil {
		t.Fatalf("uslub o'qilmadi: %v", err)
	}
	if len(style.Layers) == 0 {
		t.Fatal("uslubda qatlam yo'q")
	}

	for _, layer := range style.Layers {
		id, _ := layer["id"].(string)
		for _, section := range []string{"paint", "layout"} {
			props, _ := layer[section].(map[string]any)
			for prop, val := range props {
				if bad := findLooseZoom(val, true); bad != "" {
					t.Errorf("%s.%s.%s: `zoom` noto'g'ri joyda (%s).\n"+
						"  MapLibre bunday uslubni BUTUNLAY rad etadi — xarita oq qoladi.\n"+
						"  To'g'risi: `interpolate` eng tashqarida, shartlar uning natijasi ichida.",
						id, section, prop, bad)
				}
			}
		}
	}
}

// findLooseZoom — ifoda daraxtida qoidabuzar `zoom` ni qidiradi.
//
// `zoomOK` — shu tugun `interpolate`/`step` ning KIRISH slotimi.
// Bo'sh satr qaytsa — muammo yo'q.
func findLooseZoom(v any, zoomOK bool) string {
	expr, ok := v.([]any)
	if !ok || len(expr) == 0 {
		return ""
	}

	op, _ := expr[0].(string)
	if op == "zoom" {
		if zoomOK {
			return ""
		}
		return "ichki ifoda ichida"
	}

	// Qaysi bola kirish slotida ekani operatorga bog'liq:
	//   ["interpolate", <tur>, <kirish>, ...]
	//   ["step", <kirish>, ...]
	inputIdx := -1
	switch op {
	case "interpolate", "interpolate-hcl", "interpolate-lab":
		inputIdx = 2
	case "step":
		inputIdx = 1
	}

	for i := 1; i < len(expr); i++ {
		// Kirish sloti faqat ifodaning O'ZI eng tashqarida bo'lsa
		// `zoom` ga ruxsat beradi.
		childOK := zoomOK && i == inputIdx
		if bad := findLooseZoom(expr[i], childOK); bad != "" {
			return fmt.Sprintf("%s → %s", op, bad)
		}
	}
	return ""
}

// Tekshiruvchining O'ZI ishlayotganini isbotlaydi.
//
// Usiz yuqoridagi test bekorga o'tishi mumkin edi: agar `findLooseZoom`
// hech qachon hech narsa topmasa, u ham "PASS" beraveradi va biz
// himoyalanganmiz deb o'ylab yuraverardik.
func TestLooseZoomDetectorCatchesTheRealBug(t *testing.T) {
	// Xaritani oq ekranga aylantirgan AYNAN o'sha ifoda.
	broken := []any{
		"case",
		[]any{"in", []any{"get", "class"}, []any{"literal", []any{"city", "town"}}},
		[]any{"interpolate", []any{"linear"}, []any{"zoom"}, 13.0, 1.0, 15.0, 0.0},
		1.0,
	}
	if findLooseZoom(broken, true) == "" {
		t.Fatal("tekshiruvchi haqiqiy nosozlikni TOPMADI — test bekorga o'tayotgan ekan")
	}

	// To'g'ri shakl esa o'tishi kerak.
	fixed := []any{
		"interpolate", []any{"linear"}, []any{"zoom"},
		13.0, 1.0,
		15.0, []any{"case", []any{"in", []any{"get", "class"}, []any{"literal", []any{"city"}}}, 0.0, 1.0},
	}
	if bad := findLooseZoom(fixed, true); bad != "" {
		t.Errorf("to'g'ri ifoda xato deb belgilandi: %s", bad)
	}
}

// Har bir qatlam mavjud manbaga tayanishi kerak. Yo'q manbaga
// murojaat qilgan qatlam ham butun uslubni yiqitadi.
func TestStyleLayersReferenceExistingSources(t *testing.T) {
	cfg := baseCfg()
	cfg.TilesURL = "https://example.test/tiles.pmtiles"
	cfg.BuildingsURL = "https://example.test/buildings.pmtiles"
	s := New(cfg, nil)

	var style struct {
		Sources map[string]any   `json:"sources"`
		Layers  []map[string]any `json:"layers"`
	}
	if err := json.Unmarshal(s.buildStyle(), &style); err != nil {
		t.Fatalf("uslub o'qilmadi: %v", err)
	}

	for _, layer := range style.Layers {
		id, _ := layer["id"].(string)
		src, has := layer["source"].(string)
		if !has {
			continue // `background` qatlamida manba bo'lmaydi
		}
		if _, ok := style.Sources[src]; !ok {
			t.Errorf("%s: mavjud bo'lmagan manbaga tayanadi (%q)", id, src)
		}
		// Vektor manbadan o'qiydigan qatlamda `source-layer` SHART.
		if _, ok := layer["source-layer"].(string); !ok {
			t.Errorf("%s: `source-layer` yo'q", id)
		}
	}
}
