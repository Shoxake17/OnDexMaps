package httpapi

import (
	"net/http"
	"strings"
	"testing"
)

// Xarita sahifasi PRODUCTION'da mavjud bo'lmasligi SHART.
//
// Unda yumshatilgan CSP (`'unsafe-inline'`) bor — u jonli serverga
// chiqmasligi kerak.
func TestMapPageIsDevOnly(t *testing.T) {
	dev := baseCfg()
	dev.DevMode = true
	if got := do(testServer(t, dev), "GET", "/map", "").Code; got != http.StatusOK {
		t.Errorf("dev rejimda /map ochiq bo'lishi kerak, olingan %d", got)
	}

	prod := baseCfg()
	prod.DevMode = false
	if got := do(testServer(t, prod), "GET", "/map", "").Code; got != http.StatusNotFound {
		t.Errorf("production'da /map 404 bo'lishi kerak, olingan %d — yumshatilgan CSP jonli serverga chiqib ketgan", got)
	}
}

// Yumshatilgan CSP FAQAT /map ga tegishli — boshqa marshrutlar
// qat'iy siyosatda qoladi.
func TestRelaxedCSPDoesNotLeakToOtherRoutes(t *testing.T) {
	h := testServer(t, baseCfg())

	mapCSP := do(h, "GET", "/map", "").Header().Get("Content-Security-Policy")
	if !strings.Contains(mapCSP, "unsafe-inline") {
		t.Error("/map uchun CSP yumshatilmagan — sahifa jimgina ishlamaydi")
	}

	for _, path := range []string{"/healthz", "/v1/config", "/v1/whoami"} {
		csp := do(h, "GET", path, "").Header().Get("Content-Security-Policy")
		if strings.Contains(csp, "unsafe-inline") {
			t.Errorf("%s uchun CSP yumshatilgan: %q", path, csp)
		}
		if !strings.Contains(csp, "default-src 'none'") {
			t.Errorf("%s uchun qat'iy CSP yo'q: %q", path, csp)
		}
	}
}
