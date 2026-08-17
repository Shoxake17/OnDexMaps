package httpapi

import (
	"strings"
	"testing"
)

// CSP'da FAQAT haqiqatan ishlatiladigan tashqi manba bo'lishi kerak.
//
// Bir muddat bu yerda Esri (`server.arcgisonline.com`) ham bor edi —
// ikkinchi sputnik tasviri uchun. Tasvir foyda bermagach qatlam olib
// tashlandi; bu test CSP ham tozalanganini qulflaydi.
//
// Nega muhim: ishlatilmaydigan `connect-src`/`img-src` ruxsati
// jimgina qolib ketadi va uni hech kim sezmaydi. Vaqt o'tib bunday
// "unutilgan" ruxsatlar to'planib, CSP'ning ma'nosi qolmaydi.
func TestMapCSPHasNoUnusedExternalHosts(t *testing.T) {
	h := testServer(t, baseCfg())
	csp := do(h, "GET", "/map", "").Header().Get("Content-Security-Policy")

	for _, host := range []string{"arcgisonline.com", "googleapis.com", "*"} {
		if strings.Contains(csp, host) {
			t.Errorf("CSP'da ishlatilmaydigan manba qolgan: %q\n  %s", host, csp)
		}
	}

	// Mapbox esa BO'LISHI kerak — usiz xarita umuman yuklanmaydi.
	if !strings.Contains(csp, "https://api.mapbox.com") {
		t.Errorf("CSP'da api.mapbox.com yo'q — xarita yuklanmaydi:\n  %s", csp)
	}
}
