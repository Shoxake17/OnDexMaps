package httpapi

import (
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"sort"
	"strings"
	"testing"

	"ondexmap/internal/devplatform"
)

// ═══════════════════════════════════════════════════════════════════════
// KONTRAKT ↔ KOD MOSLIGI
//
// OpenAPI hujjatining eng katta xavfi — u kod bilan JIMGINA ajralib ketadi:
// endpoint o'zgaradi, hujjat eski qolaveradi va dasturchi ishonmay qo'yadi.
// Quyidagi testlar shu xavfni yopadi.
//
// YAML kutubxonasi ATAYLAB ishlatilmagan (`go.mod`: "bog'liqliklar ataylab
// kam") — matn ustida regex, xuddi `TestAPIsMatchMigration` da `.sql` fayl
// bilan qilinganidek.
// ═══════════════════════════════════════════════════════════════════════

func readFile(t *testing.T, path string) string {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return string(raw)
}

// specPaths — `openapi.yaml` dagi yo'llar (ikki probel bilan boshlanadigan
// va `:` bilan tugaydigan yuqori darajadagi kalitlar).
func specPaths(t *testing.T) []string {
	t.Helper()
	spec := readFile(t, "openapi.yaml")
	re := regexp.MustCompile(`(?m)^  (/v2/[^:\s]*):`)
	var out []string
	for _, m := range re.FindAllStringSubmatch(spec, -1) {
		out = append(out, m[1])
	}
	sort.Strings(out)
	return out
}

// codePaths — `routes_v2.go` da RO'YXATDAN O'TGAN GET yo'llari.
func codePaths(t *testing.T) []string {
	t.Helper()
	src := readFile(t, "routes_v2.go")
	re := regexp.MustCompile(`mux\.HandleFunc\("GET (/v2/[^"]*)"`)
	var out []string
	for _, m := range re.FindAllStringSubmatch(src, -1) {
		out = append(out, m[1])
	}
	sort.Strings(out)
	return out
}

// Kontraktdagi yo'llar va koddagi marshrutlar AYNAN bir xil bo'lishi shart.
func TestOpenAPIPathsMatchRoutes(t *testing.T) {
	spec, code := specPaths(t), codePaths(t)

	if len(code) == 0 || len(spec) == 0 {
		t.Fatalf("yo'llar topilmadi: kod=%v spec=%v", code, spec)
	}
	if strings.Join(spec, ",") != strings.Join(code, ",") {
		t.Errorf("kontrakt va kod mos emas:\n  kod:  %v\n  spec: %v\n"+
			"Yangi endpoint qo'shdingizmi? `openapi.yaml` ni ham yangilang.", code, spec)
	}
}

// Har bir API nomi (kalitdagi `apis` ro'yxati) kontraktda tilga olinishi kerak —
// aks holda dasturchi kalitida qaysi bandni yoqishini bilmaydi.
func TestOpenAPIMentionsEveryAPIName(t *testing.T) {
	spec := readFile(t, "openapi.yaml")
	for _, api := range devplatform.AllAPIs {
		if !strings.Contains(spec, "/v2/"+api) {
			t.Errorf("`%s` API'si kontraktda yo'q", api)
		}
	}
}

// Rad etish kodlari — kontraktdagi `enum` koddagi konstantalar bilan bir xil.
// Bu ro'yxat mijoz kodida `switch` bo'lib yoziladi: bittasi yetishmasa,
// mijoz kutilmagan holatga tushadi.
func TestOpenAPIListsEveryErrorCode(t *testing.T) {
	spec := readFile(t, "openapi.yaml")

	codes := []string{
		devplatform.CodeMissingKey,
		devplatform.CodeInvalidKey,
		devplatform.CodeKeyRestricted,
		devplatform.CodeAccountSuspended,
		devplatform.CodeAPINotAllowed,
		devplatform.CodeRateLimited,
		devplatform.CodeQuotaExceeded,
		devplatform.CodeAuthBlocked,
		devplatform.CodeUnavailable,
		// HTTP qatlamining o'z kodlari (routes_v2.go).
		"invalid_request",
		"not_found",
		"upstream_error",
	}
	for _, c := range codes {
		if !regexp.MustCompile(`(?m)^\s+- ` + regexp.QuoteMeta(c) + `$`).MatchString(spec) {
			t.Errorf("`%s` xato kodi kontrakt enum'ida yo'q", c)
		}
	}

	// Teskari yo'nalish: enum'da koddagi konstantalarga MOS KELMAYDIGAN
	// qiymat qolib ketmasin (endpoint olib tashlansa hujjat ham tozalansin).
	enum := regexp.MustCompile(`(?s)code:\n\s+type: string\n\s+enum:\n(.*?)\n\s{12}message:`).FindStringSubmatch(spec)
	if enum == nil {
		t.Fatal("kontraktdagi xato kodlari enum'i topilmadi")
	}
	for _, line := range strings.Split(enum[1], "\n") {
		got := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(line), "- "))
		if got == "" {
			continue
		}
		found := false
		for _, c := range codes {
			if c == got {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("kontraktdagi `%s` kodi kodda mavjud emas", got)
		}
	}
}

// Xizmat hududi chegaralari kontraktda koddagi qiymatlar bilan bir xil.
// Bu raqamlar mijoz tomonda validatsiya uchun ishlatiladi — farq qilsa,
// mijoz server rad etadigan so'rovni yuboraveradi.
func TestOpenAPIBoundsMatchCode(t *testing.T) {
	spec := readFile(t, "openapi.yaml")
	for name, want := range map[string]string{
		"xizmat hududi min kenglik": "minimum: 40.5",
		"xizmat hududi max kenglik": "maximum: 41.6",
		"xizmat hududi min uzunlik": "minimum: 70.5",
		"xizmat hududi max uzunlik": "maximum: 72.0",
		"O'zbekiston min kenglik":   "minimum: 37.0",
		"O'zbekiston max uzunlik":   "maximum: 73.5",
	} {
		if !strings.Contains(spec, want) {
			t.Errorf("%s (`%s`) kontraktda yo'q yoki boshqacha", name, want)
		}
	}
	// Kod bilan solishtirish (konstantalar shu paketda).
	if minLat != 40.5 || maxLat != 41.6 || minLng != 70.5 || maxLng != 72.0 {
		t.Errorf("koddagi xizmat hududi o'zgargan (%v–%v, %v–%v) — kontraktni yangilang",
			minLat, maxLat, minLng, maxLng)
	}
	if uzMinLat != 37.0 || uzMaxLng != 73.5 {
		t.Errorf("koddagi O'zbekiston chegarasi o'zgargan — kontraktni yangilang")
	}
}

// Kontrakt KALITSIZ ochiq bo'lishi kerak: dasturchi kalit olishdan oldin
// API nima qila olishini ko'ra olsin.
func TestOpenAPIServedWithoutKey(t *testing.T) {
	h := New(baseCfg(), nil).Handler()
	r := httptest.NewRequest(http.MethodGet, "/v2/openapi.yaml", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("kalitsiz kontrakt: %d (kutilgan 200)", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/yaml") {
		t.Errorf("Content-Type: %q", ct)
	}
	body := w.Body.String()
	if !strings.HasPrefix(body, "openapi: 3.1.0") {
		t.Errorf("javob OpenAPI hujjati emas: %.40q", body)
	}
	if len(body) != len(openAPISpec) {
		t.Errorf("berilgan hujjat embed qilingandan farq qiladi: %d vs %d", len(body), len(openAPISpec))
	}
	// Hujjat generatorlari boshqa domendan yuklaydi.
	if w.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Error("kontrakt CORS'siz berilmoqda — tashqi hujjat vositalari yuklay olmaydi")
	}
}

// `/v2/openapi.yaml` hisoblanmaydi va kalit so'ramaydi, lekin QOLGAN barcha
// `/v2/...` yo'llari himoyalangan bo'lishi SHART (allowlist buzilmasin).
func TestOpenAPIEndpointDoesNotOpenOtherPaths(t *testing.T) {
	h := New(baseCfg(), nil).Handler()
	for _, p := range []string{"/v2/openapi.json", "/v2/openapi", "/v2/spec.yaml"} {
		r := httptest.NewRequest(http.MethodGet, p, nil)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != http.StatusForbidden {
			t.Errorf("%s -> %d (kutilgan 403: allowlist tashqarisi)", p, w.Code)
		}
	}
}
