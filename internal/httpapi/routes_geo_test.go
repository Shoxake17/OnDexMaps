package httpapi

import (
	"math"
	"net/http"
	"strings"
	"testing"
)

// Koordinata validatsiyasi — bazaga borishdan OLDINGI to'siq.
func TestParseCoordRejectsBadInput(t *testing.T) {
	bad := []string{
		"", "  ", "abc", "41,0", // vergul — o'nlik ajratgich emas
		"NaN", "nan", "Inf", "+Inf", "-Inf", // ParseFloat bularni O'QIYDI
		"90", "-90", "0", // chegaradan tashqarida (Chust ≈ 41.0)
		"41.0.1", "1e400", // haddan tashqari katta
	}
	for _, in := range bad {
		if _, ok := parseCoord(in, minLat, maxLat); ok {
			t.Errorf("parseCoord(%q) qabul qildi — rad etilishi kerak edi", in)
		}
	}

	good := []string{"41.0", "41", "40.9994", " 41.0047 ", "+41.0"}
	for _, in := range good {
		if _, ok := parseCoord(in, minLat, maxLat); !ok {
			t.Errorf("parseCoord(%q) rad etildi — qabul qilinishi kerak edi", in)
		}
	}
}

// NaN alohida tekshiriladi: oddiy `v < min || v > max` sharti uni
// O'TKAZIB YUBORARDI, chunki NaN bilan har qanday solishtirish `false`.
func TestParseCoordRejectsNaNExplicitly(t *testing.T) {
	if !math.IsNaN(math.NaN()) {
		t.Skip()
	}
	if _, ok := parseCoord("NaN", minLat, maxLat); ok {
		t.Fatal("NaN qabul qilindi — PostGIS'ga yaroqsiz nuqta borardi")
	}
}

// Xizmat hududidan tashqaridagi koordinata bazaga bormaydi.
func TestResolveRejectsOutsideServiceArea(t *testing.T) {
	h := testServer(t, baseCfg())
	// Toshkent — bizning bazamizda bo'lishi mumkin emas.
	w := do(h, "GET", "/v1/resolve?lat=41.2995&lng=69.2401", "")
	if w.Code != http.StatusBadRequest {
		t.Errorf("kutilgan 400, olingan %d", w.Code)
	}
}

// Qidiruv matni uzunligi RUNA bo'yicha o'lchanadi.
//
// Bayt bo'yicha o'lchansa kirillcha so'rov ikki barobar erta
// to'silardi: "Навоий" = 6 runa, lekin 12 bayt.
func TestSearchLengthCountedInRunes(t *testing.T) {
	h := testServer(t, baseCfg())

	// 100 runa (chegarada) — uzunlik tekshiruvidan o'tishi kerak.
	// Baza yo'q (db=nil), shuning uchun 503 kutamiz, 400 EMAS.
	long := strings.Repeat("ў", maxQueryLen)
	if w := do(h, "GET", "/v1/search?q="+long, ""); w.Code == http.StatusBadRequest {
		t.Errorf("100 runali kirillcha so'rov uzunlik bo'yicha rad etildi (bayt hisoblanyaptimi?)")
	}

	// 101 runa — rad etilishi kerak.
	tooLong := strings.Repeat("ў", maxQueryLen+1)
	if w := do(h, "GET", "/v1/search?q="+tooLong, ""); w.Code != http.StatusBadRequest {
		t.Errorf("101 runali so'rov uchun kutilgan 400, olingan %d", w.Code)
	}

	// Juda qisqa.
	if w := do(h, "GET", "/v1/search?q=a", ""); w.Code != http.StatusBadRequest {
		t.Errorf("1 belgili so'rov uchun kutilgan 400, olingan %d", w.Code)
	}
}

func TestSearchRejectsBadLimit(t *testing.T) {
	h := testServer(t, baseCfg())
	for _, v := range []string{"0", "-5", "abc", "1e5"} {
		if w := do(h, "GET", "/v1/search?q=navoiy&limit="+v, ""); w.Code != http.StatusBadRequest {
			t.Errorf("limit=%q uchun kutilgan 400, olingan %d", v, w.Code)
		}
	}
}

// Rate limit ommaviy endpointni himoya qiladi.
func TestRateLimitBlocksFlood(t *testing.T) {
	h := testServer(t, baseCfg())
	blocked := false
	// rateBurst dan ancha ko'p so'rov — biror joyda 429 chiqishi shart.
	for i := 0; i < rateBurst*3; i++ {
		if do(h, "GET", "/v1/search?q=navoiy", "").Code == http.StatusTooManyRequests {
			blocked = true
			break
		}
	}
	if !blocked {
		t.Error("rate limit ishlamadi — ommaviy endpoint cheklovsiz qolgan")
	}
}

// Ishonchsiz manbadan kelgan X-Forwarded-For rate limitni chetlab
// o'ta olmaydi.
func TestForwardedHeaderIgnoredWhenNoTrustedProxy(t *testing.T) {
	cfg := baseCfg()
	cfg.TrustedProxies = nil // sozlanmagan
	s := New(cfg, nil)

	r1 := mustRequest("GET", "/v1/search?q=navoiy")
	r1.RemoteAddr = "203.0.113.7:1234"
	r1.Header.Set("X-Forwarded-For", "1.2.3.4")

	r2 := mustRequest("GET", "/v1/search?q=navoiy")
	r2.RemoteAddr = "203.0.113.7:1234"
	r2.Header.Set("X-Forwarded-For", "5.6.7.8") // boshqa "IP"

	// Sarlavhaga ishonilmagani uchun ikkalasi ham BIR XIL kalitga
	// tushishi kerak — aks holda hujumchi har so'rovda yangi IP
	// yozib cheklovni butunlay chetlab o'tardi.
	if s.clientIP(r1) != s.clientIP(r2) {
		t.Error("X-Forwarded-For ishonchsiz manbadan qabul qilindi — rate limit chetlab o'tiladi")
	}
	if s.clientIP(r1) != "203.0.113.7" {
		t.Errorf("kutilgan RemoteAddr IP'si, olingan %q", s.clientIP(r1))
	}
}

// Xarita markazi (`lat`/`lng`) ixtiyoriy, lekin berilsa TO'LIQ va O'ZBEKISTON
// ichida bo'lishi shart. Yaroqsiz qiymat jimgina tashlanmaydi: mijoz xatosi
// darrov ko'rinishi uchun 400.
func TestSearchBiasValidation(t *testing.T) {
	h := testServer(t, baseCfg())

	bad := []string{
		"&lat=41.0",           // faqat kenglik
		"&lng=71.6",           // faqat uzunlik
		"&lat=abc&lng=71.6",   // son emas
		"&lat=NaN&lng=71.6",   // NaN
		"&lat=41.0&lng=Inf",   // cheksiz
		"&lat=0&lng=0",        // O'zbekiston tashqarisida
		"&lat=41.0&lng=100.0", // uzunlik chegaradan tashqarida
		"&lat=60.0&lng=71.6",  // kenglik chegaradan tashqarida
	}
	for _, q := range bad {
		if w := do(h, "GET", "/v1/search?q=toshkent"+q, ""); w.Code != http.StatusBadRequest {
			t.Errorf("%q uchun kutilgan 400, olingan %d", q, w.Code)
		}
	}

	// Yaroqli: validatsiyadan o'tadi (baza yo'q — 503, 400 EMAS).
	// Toshkent (69.3, 41.2) — qidiruv butun mamlakat bo'yicha, `resolve` dagi
	// tor xizmat hududi bilan chegaralanmaydi.
	for _, q := range []string{"", "&lat=41.2995&lng=69.2401", "&lat=41.0&lng=71.6"} {
		if w := do(h, "GET", "/v1/search?q=toshkent"+q, ""); w.Code == http.StatusBadRequest {
			t.Errorf("%q yaroqli, lekin 400 olindi", q)
		}
	}
}
