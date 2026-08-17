package httpapi

import (
	"strings"
	"testing"
)

// Esri tasviri (Sputnik 2) ishlashi uchun CSP'da domen IKKI joyda
// bo'lishi shart.
//
// Mapbox GL raster tayllarni `fetch` orqali oladi va rasm sifatida
// chizadi. Faqat `img-src` berilsa so'rovning o'zi bloklanadi, faqat
// `connect-src` berilsa chizish bloklanadi — ikkala holatda ham
// tasvir JIMGINA ko'rinmaydi va brauzer konsolidan boshqa hech qayerda
// xato chiqmaydi.
func TestMapCSPAllowsSecondImagerySource(t *testing.T) {
	h := testServer(t, baseCfg())
	csp := do(h, "GET", "/map", "").Header().Get("Content-Security-Policy")

	const esri = "https://server.arcgisonline.com"
	for _, directive := range []string{"connect-src", "img-src"} {
		section := sectionOf(csp, directive)
		if section == "" {
			t.Fatalf("CSP'da %s yo'q: %q", directive, csp)
		}
		if !strings.Contains(section, esri) {
			t.Errorf("%s da %s yo'q — Sputnik 2 tasviri jimgina bloklanadi.\n  %s",
				directive, esri, section)
		}
	}
}

// CSP'dan bitta direktivani ajratib oladi.
func sectionOf(csp, directive string) string {
	for _, part := range strings.Split(csp, ";") {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, directive+" ") {
			return part
		}
	}
	return ""
}
