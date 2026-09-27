package httpapi

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// ═══════════════════════════════════════════════════════════════════════
// KONTRAKT ↔ HUJJAT SAHIFALARI MOSLIGI
//
// `openapi_test.go` kontraktni KOD bilan bog'laydi. Bu fayl uchinchi
// tomonni qo'shadi: `console/` dagi QO'LDA yozilgan endpoint sahifalari.
//
// Nega kerak: kontrakt to'g'ri tursa ham, matn sahifalari undan jimgina
// ajralib ketishi mumkin. 2026-09-26 da aynan shunday bo'ldi — sahifalarda
// `reverse` javobida `lat`/`lng` bor deb yozilgan edi (aslida yo'q),
// `label` manzil deb tushuntirilgan edi (aslida tur nomi), `near`, `bbox`,
// `score`, `category` esa umuman tilga olinmagandi. Kontrakt hammasini
// to'g'ri ko'rsatib turgan, lekin hech narsa ikkalasini solishtirmagan.
//
// Tekshiruv IKKI TOMONLAMA:
//   - hujjatda bor, kontraktda yo'q  → o'ylab topilgan maydon;
//   - kontraktda bor, hujjatda yo'q  → dasturchi bilmay qoladigan maydon.
//
// YAML kutubxonasi ATAYLAB ishlatilmagan — `openapi_test.go` dagi kabi
// matn ustida regex (go.mod: "bog'liqliklar ataylab kam").
// ═══════════════════════════════════════════════════════════════════════

// docsDir — hujjat sahifalari (Go paketidan nisbiy yo'l).
const docsDir = "../../console/src/app/docs/api"

// tsPage — TypeScript integratsiya sahifasi (`types.ts` shu yerda).
const tsPage = "../../console/src/app/docs/integration/typescript/page.tsx"

// tsTypeForPath — har bir `/v2` endpointi uchun `types.ts` da
// bo'lishi SHART bo'lgan javob tipi.
//
// ┌─ NEGA ─────────────────────────────────────────────────────────────┐
// TypeScript sahifasi «REST API javoblarining tiplari» deb va'da
// beradi. 2026-09-27 da tekshirilganda `/v2/places`, `/v2/places/{id}`
// va `/v2/mahallas` uchun HECH QANDAY tip yo'q edi — ya'ni TS
// dasturchisi ularni `any` bilan ishlatishga majbur bo'lardi va
// sahifaning va'dasi bajarilmasdi.
//
// Yangi endpoint qo'shilganda bu jadval ham to'ldirilishi kerak —
// aks holda quyidagi test «kontraktda bor, jadvalda yo'q» deb
// to'xtatadi va tip yozish unutilmaydi.
// └────────────────────────────────────────────────────────────────────┘
var tsTypeForPath = map[string]string{
	"/v2/geocode":      "GeocodeResponse",
	"/v2/reverse":      "ReverseResponse",
	"/v2/directions":   "DirectionsResponse",
	"/v2/places":       "PlacesResponse",
	"/v2/places/{id}":  "PlaceDetailResponse",
	"/v2/mahallas":     "MahallasResponse",
	"/v2/openapi.yaml": "", // kontraktning o'zi — javob tipi kerak emas
}

// TestTypeScriptCoversEveryEndpoint — har bir `/v2` endpointi uchun
// TypeScript sahifasida javob tipi e'lon qilinganligi.
func TestTypeScriptCoversEveryEndpoint(t *testing.T) {
	spec := readFile(t, "openapi.yaml")
	src := readFile(t, tsPage)

	// `types.ts` yorlig'ining tanasi.
	at := strings.Index(src, `name: "types.ts"`)
	if at < 0 {
		t.Fatal("TypeScript sahifasida `types.ts` yorlig'i yo'q")
	}
	boshi := strings.Index(src[at:], "`")
	if boshi < 0 {
		t.Fatal("`types.ts` kodi topilmadi")
	}
	types := src[at+boshi+1:]
	if end := strings.Index(types, "`,"); end > 0 {
		types = types[:end]
	}

	// Kontraktdagi `/v2/...` yo'llari.
	rePath := regexp.MustCompile(`(?m)^  (/v2/[^:]*):`)
	got := map[string]bool{}
	for _, m := range rePath.FindAllStringSubmatch(spec, -1) {
		got[m[1]] = true
		want, ok := tsTypeForPath[m[1]]
		if !ok {
			t.Errorf("kontraktda `%s` bor, lekin `tsTypeForPath` jadvalida yo'q — TypeScript tipi yozilganmi?", m[1])
			continue
		}
		if want == "" {
			continue
		}
		// ⚠️ `{` SHART: usiz `interface Foo` tekshiruvi `interface FooBar`
		// ga ham mos kelardi va nomi o'zgartirilgan tipni o'tkazib
		// yuborardi (mutatsiya sinovida aynan shunday bo'ldi).
		if !strings.Contains(types, "interface "+want+" {") {
			t.Errorf("`%s` uchun `types.ts` da `%s` interfeysi yo'q", m[1], want)
		}
	}

	// Jadvalda bor, kontraktda yo'q — endpoint olib tashlangan.
	for p := range tsTypeForPath {
		if !got[p] {
			t.Errorf("`tsTypeForPath` da `%s` bor, kontraktda esa yo'q", p)
		}
	}
}

// TestAttributionExampleMatchesStyle — hujjatdagi kredit NAMUNASI
// uslubdagi HAQIQIY atribut bilan bir xil bo'lishi.
//
// ┌─ NEGA ─────────────────────────────────────────────────────────────┐
// `/docs/js/general#atribut` integratorga «xaritada aynan shu yozuv
// chiqadi» deb namuna ko'rsatadi. Uslubdagi atribut esa mustaqil
// fayl (`assets/style-chust.json`) — ular bog'lanmagan. Kredit
// tartibi yoki matni o'zgarsa hujjat JIMGINA eskirardi.
//
// Atribut talabi shartnoma darajasida ishlagani uchun (buzilsa kalit
// bekor qilinadi) namuna noto'g'ri bo'lishi ayniqsa yomon.
// └────────────────────────────────────────────────────────────────────┘
func TestAttributionExampleMatchesStyle(t *testing.T) {
	cfg := baseCfg()
	cfg.TilesURL = "https://example.test/tiles.pmtiles"
	cfg.BuildingsURL = "https://example.test/buildings.pmtiles"

	var style struct {
		Sources map[string]struct {
			Attribution string `json:"attribution"`
		} `json:"sources"`
	}
	if err := json.Unmarshal(New(cfg, nil).buildStyle(), &style); err != nil {
		t.Fatalf("uslub o'qilmadi: %v", err)
	}

	// HTML teglarini olib tashlab faqat matnni qoldiramiz. Brend yozuvi
	// (birinchi `<a>`) kredit qatoridan TASHQARIDA turadi, shuning uchun
	// hisobga olinmaydi: birinchi `©` dan boshlaymiz.
	plain := regexp.MustCompile(`<[^>]*>`).ReplaceAllString(style.Sources["ondex"].Attribution, "")
	if i := strings.Index(plain, "©"); i > 0 {
		plain = plain[i:]
	}
	plain = strings.Join(strings.Fields(plain), " ")

	src := readFile(t, "../../console/src/app/docs/js/general/page.tsx")

	// ⚠️ Sahifada bir nechta `terminal` bloki bor (birinchisi — kutubxona
	// versiyalari). Atribut BO'LIMIDAN boshlab qidiramiz, aks holda test
	// butunlay boshqa blokni tekshirardi.
	sec := strings.Index(src, `<H2 id="atribut">`)
	if sec < 0 {
		t.Fatal("hujjatda `id=\"atribut\"` bo'limi topilmadi")
	}
	const marker = "<Code lang=\"terminal\">{`"
	at := strings.Index(src[sec:], marker)
	if at < 0 {
		t.Fatal("atribut bo'limida kredit namunasi topilmadi")
	}
	rest := src[sec+at+len(marker):]
	end := strings.Index(rest, "`")
	if end < 0 {
		t.Fatal("kredit namunasi yopilmagan")
	}
	doc := strings.Join(strings.Fields(rest[:end]), " ")

	if doc != plain {
		t.Errorf("hujjatdagi kredit namunasi uslubdagi atributdan farq qiladi:\n  hujjat: %q\n  uslub:  %q", doc, plain)
	}
}

// reSchemaStart — `components: schemas:` ichidagi keyingi sxema sarlavhasi.
var reSchemaStart = regexp.MustCompile(`(?m)^    [A-Za-z][A-Za-z0-9]*:$`)

// schemaProps — `components: schemas:` ichidagi BITTA sxemaning bevosita
// xossalari. Sxema 4 probel bilan, `properties:` 6 probel, xossalar esa
// 8 probel bilan yoziladi.
func schemaProps(t *testing.T, spec, schema string) []string {
	t.Helper()

	start := strings.Index(spec, "\n    "+schema+":\n")
	if start < 0 {
		t.Fatalf("kontraktda %q sxemasi topilmadi", schema)
	}
	body := spec[start+1:]

	// Keyingi sxemagacha (yana 4 probel + nom + ':') kesamiz.
	if end := reSchemaStart.FindStringIndex(body[1:]); end != nil {
		body = body[:end[0]+1]
	}

	propsAt := strings.Index(body, "\n      properties:\n")
	if propsAt < 0 {
		t.Fatalf("%q sxemasida `properties:` yo'q", schema)
	}

	var out []string
	re := regexp.MustCompile(`(?m)^        ([a-z_]+):`)
	for _, m := range re.FindAllStringSubmatch(body[propsAt:], -1) {
		out = append(out, m[1])
	}
	if len(out) == 0 {
		t.Fatalf("%q sxemasidan xossa chiqmadi", schema)
	}
	sort.Strings(out)
	return out
}

// featureProps — GeoJSON javob sxemasi ichidagi Feature'ning
// `properties` bloki. U chuqur joylashgan, shuning uchun alohida olinadi.
func featureProps(t *testing.T, spec, schema string) []string {
	t.Helper()

	at := strings.Index(spec, "\n    "+schema+":\n")
	if at < 0 {
		t.Fatalf("kontraktda %q yo'q", schema)
	}
	body := spec[at+1:]
	if loc := reSchemaStart.FindStringIndex(body[1:]); loc != nil {
		body = body[:loc[0]+1]
	}

	// Feature ichidagi ikkinchi `properties:` — 18 probel bilan.
	inner := regexp.MustCompile(`(?m)^                  properties:\n                    type: object\n                    properties:\n`)
	loc := inner.FindStringIndex(body)
	if loc == nil {
		t.Fatalf("%s ichida Feature `properties` bloki topilmadi", schema)
	}

	var out []string
	re := regexp.MustCompile(`(?m)^                      ([a-z_]+):`)
	for _, m := range re.FindAllStringSubmatch(body[loc[1]:], -1) {
		out = append(out, m[1])
	}
	if len(out) == 0 {
		t.Fatalf("%s: Feature `properties` bo'sh chiqdi", schema)
	}
	sort.Strings(out)
	return out
}

// docFields — endpoint sahifasidagi `fields:` ro'yxatining kalitlari.
//
// Sahifada ular `["results[].near", <>…</>],` ko'rinishida yoziladi.
// Bitta qatorda bir nechta maydon bo'lishi mumkin (`"result.lat, lng"`) —
// bunda prefiks birinchisidan olinadi.
func docFields(t *testing.T, page string) []string {
	t.Helper()

	src := readFile(t, docsDir+"/"+page+"/page.tsx")

	at := strings.Index(src, "\n        fields: [")
	if at < 0 {
		t.Fatalf("%s sahifasida `fields: [` topilmadi", page)
	}
	body := src[at:]
	if end := strings.Index(body, "\n        ],"); end >= 0 {
		body = body[:end]
	}

	// Yozuv bir qatorli (`["status", <>…</>],`) ham, ko'p qatorli ham
	// bo'lishi mumkin. Shuning uchun blok 10 probelli `[` bo'yicha
	// bo'linadi va har bo'lakdan BIRINCHI tirnoqli satr olinadi — u
	// har doim maydon nomi, keyingilari esa tavsif bo'lishi mumkin.
	first := regexp.MustCompile(`"([^"]+)"`)

	var out []string
	for _, chunk := range strings.Split(body, "\n          [")[1:] {
		m := first.FindStringSubmatch(chunk)
		if m == nil {
			continue
		}
		parts := strings.Split(m[1], ",")
		prefix := ""
		if dot := strings.LastIndex(parts[0], "."); dot >= 0 {
			prefix = parts[0][:dot+1]
		}
		for i, p := range parts {
			p = strings.TrimSpace(p)
			if p == "" {
				continue
			}
			if i > 0 && !strings.Contains(p, ".") {
				p = prefix + p
			}
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		t.Fatalf("%s sahifasidan maydon chiqmadi", page)
	}
	sort.Strings(out)
	return out
}

// prefixed — sxema xossalariga hujjatdagi yo'l prefiksini qo'shadi.
func prefixed(prefix string, props []string) []string {
	out := make([]string, 0, len(props))
	for _, p := range props {
		out = append(out, prefix+p)
	}
	return out
}

// diff — `a` da bor, `b` da yo'q elementlar.
func diff(a, b []string) []string {
	in := make(map[string]bool, len(b))
	for _, x := range b {
		in[x] = true
	}
	var out []string
	for _, x := range a {
		if !in[x] {
			out = append(out, x)
		}
	}
	return out
}

// TestDocPagesMatchSpecFields — har bir endpoint sahifasi kontraktdagi
// maydonlarning AYNAN o'zini tushuntiradi: kam ham emas, ko'p ham emas.
func TestDocPagesMatchSpecFields(t *testing.T) {
	spec := readFile(t, "openapi.yaml")

	cases := []struct {
		page   string
		expect []string
	}{
		{
			page: "geocode",
			expect: append([]string{"status"},
				prefixed("results[].", schemaProps(t, spec, "Match"))...),
		},
		{
			// DIQQAT: reverse javobining sxemasi `Place` deb ataladi
			// (ob'ekt tafsiloti esa `PlaceDetail`).
			page: "reverse",
			expect: append([]string{"status"},
				prefixed("result.", schemaProps(t, spec, "Place"))...),
		},
		{
			page: "directions",
			expect: append([]string{"status"},
				prefixed("routes[].", schemaProps(t, spec, "Route"))...),
		},
		{
			page: "places",
			expect: append([]string{"status", "result", "features[].geometry", "features[].properties.id"},
				prefixed("features[].properties.", featureProps(t, spec, "PlacesResponse"))...),
		},
		{
			page: "places-by-id",
			expect: append([]string{"status"},
				prefixed("result.", schemaProps(t, spec, "PlaceDetail"))...),
		},
		{
			page: "mahallas",
			expect: append([]string{"status", "result", "features[].geometry"},
				prefixed("features[].properties.", featureProps(t, spec, "MahallasResponse"))...),
		},
	}

	for _, c := range cases {
		t.Run(c.page, func(t *testing.T) {
			got := docFields(t, c.page)
			want := dedupe(c.expect)

			if extra := diff(got, want); len(extra) > 0 {
				t.Errorf("hujjatda bor, kontraktda YO'Q (o'ylab topilgan maydon): %v\n"+
					"  → `openapi.yaml` ga qo'shing yoki sahifadan olib tashlang", extra)
			}
			if missing := diff(want, got); len(missing) > 0 {
				t.Errorf("kontraktda bor, hujjatda YO'Q (dasturchi bilmay qoladi): %v\n"+
					"  → %s sahifasining `fields` ro'yxatiga qo'shing", missing, c.page)
			}
		})
	}
}

// TestDocResponseExamplesUseRealFields — sahifadagi JSON misol faqat
// kontraktda mavjud kalitlarni ishlatadi.
//
// Maydon ro'yxati to'g'ri bo'lsa-yu, yonidagi misol eski qolsa dasturchi
// aynan misolni nusxalaydi — shuning uchun u ham tekshiriladi.
func TestDocResponseExamplesUseRealFields(t *testing.T) {
	spec := readFile(t, "openapi.yaml")

	legal := map[string]bool{"status": true, "result": true, "results": true, "routes": true,
		"features": true, "type": true, "geometry": true, "properties": true, "coordinates": true}
	for _, s := range []string{"Match", "Place", "Route", "PlaceDetail", "Named"} {
		for _, p := range schemaProps(t, spec, s) {
			legal[p] = true
		}
	}
	for _, s := range []string{"PlacesResponse", "MahallasResponse"} {
		for _, p := range featureProps(t, spec, s) {
			legal[p] = true
		}
	}

	key := regexp.MustCompile(`"([a-z_]+)":`)
	for _, page := range []string{"geocode", "reverse", "directions", "places", "places-by-id", "mahallas"} {
		t.Run(page, func(t *testing.T) {
			src := readFile(t, docsDir+"/"+page+"/page.tsx")
			at := strings.Index(src, "\n        response: `")
			if at < 0 {
				t.Fatalf("%s sahifasida `response:` misoli yo'q", page)
			}
			body := src[at+len("\n        response: `"):]
			if end := strings.Index(body, "`,"); end >= 0 {
				body = body[:end]
			}

			var bad []string
			for _, m := range key.FindAllStringSubmatch(body, -1) {
				if !legal[m[1]] {
					bad = append(bad, m[1])
				}
			}
			if len(bad) > 0 {
				t.Errorf("javob misolida kontraktda yo'q kalitlar: %v", dedupe(bad))
			}
		})
	}
}

// dedupe — takrorlarni olib tashlaydi va saralaydi.
func dedupe(in []string) []string {
	seen := make(map[string]bool, len(in))
	out := make([]string, 0, len(in))
	for _, x := range in {
		if !seen[x] {
			seen[x] = true
			out = append(out, x)
		}
	}
	sort.Strings(out)
	return out
}

var _ = fmt.Sprintf
