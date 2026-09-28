package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// OSRM sozlanmagan bo'lsa — 503, soxta marshrut chizilmaydi.
func TestRouteUnconfiguredReturns503(t *testing.T) {
	h := testServer(t, baseCfg()) // OSRMURL bo'sh
	w := do(h, "GET", "/v1/route?from_lat=41.00&from_lng=71.22&to_lat=41.01&to_lng=71.23", "")
	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("kutilgan 503, olingan %d", w.Code)
	}
}

// Mamlakat tashqarisidagi nuqta OSRM'ga UMUMAN yubormasdan rad
// etilishi kerak (validatsiya tarmoq so'rovidan OLDIN).
func TestRouteRejectsOutsideServiceArea(t *testing.T) {
	cfg := baseCfg()
	cfg.OSRMURL = "http://127.0.0.1:1" // atayin yaroqsiz — chaqirilsa xato beradi
	h := testServer(t, cfg)

	cases := []string{
		// ⚠️ Chegara MAMLAKAT bo'yicha (37.0–45.8° N, 55.5–73.5° E),
		// Chust atrofi bo'yicha emas. Shuning uchun bu yerda
		// haqiqatan tashqaridagi nuqtalar kerak — Toshkent yoki
		// Shimkent EMAS, ular ichkarida.
		//
		// Qozog'iston, Aqto'be tomoni — shimoldan tashqarida.
		"/v1/route?from_lat=47.2000&from_lng=60.0000&to_lat=41.01&to_lng=71.23",
		// Afgʻoniston ichkarisi — janubdan tashqarida.
		"/v1/route?from_lat=34.5000&from_lng=67.1000&to_lat=41.01&to_lng=71.23",
		// Kaspiy dengizi — g'arbdan tashqarida.
		"/v1/route?from_lat=41.0000&from_lng=51.0000&to_lat=41.01&to_lng=71.23",
		"/v1/route?from_lat=abc&from_lng=71.22&to_lat=41.01&to_lng=71.23",
		"/v1/route?from_lat=41.00&from_lng=71.22&to_lat=41.01", // to_lng yo'q
	}
	for _, path := range cases {
		if w := do(h, "GET", path, ""); w.Code != http.StatusBadRequest {
			t.Errorf("%s: kutilgan 400, olingan %d", path, w.Code)
		}
	}
}

// ┌─ MAMLAKAT ICHIDAGI UZOQ MARSHRUT RAD ETILMAYDI ───────────────────┐
// Ilgari marshrut Chust atrofi bilan cheklangan edi va Toshkentdan
// yoki Buxorodan so'rov `400` olardi — OSRM esa o'sha yo'llarni
// bemalol hisoblardi (2026-09-28 da o'lchangan). Bu test o'sha
// sun'iy to'siqning qaytib kelishiga yo'l qo'ymaydi.
//
// OSRM bu yerda yaroqsiz manzilga qaratilgan, ya'ni javob `502`
// bo'ladi — muhimi shuki, u `400` EMAS: koordinatalar qabul
// qilingan va so'rov OSRM'ga yetib borgan.
// └────────────────────────────────────────────────────────────────────┘
func TestRouteAcceptsWholeCountry(t *testing.T) {
	cfg := baseCfg()
	cfg.OSRMURL = "http://127.0.0.1:1"
	h := testServer(t, cfg)

	cases := map[string]string{
		"Toshkent ichida":   "/v1/route?from_lat=41.2995&from_lng=69.2401&to_lat=41.3200&to_lng=69.2800",
		"Chust → Toshkent":  "/v1/route?from_lat=41.0030&from_lng=71.2360&to_lat=41.2995&to_lng=69.2401",
		"Buxoro → Toshkent": "/v1/route?from_lat=39.7700&from_lng=64.4200&to_lat=41.2995&to_lng=69.2401",
		"Nukus → Termiz":    "/v1/route?from_lat=42.4600&from_lng=59.6100&to_lat=37.2200&to_lng=67.2800",
	}
	for nom, path := range cases {
		if w := do(h, "GET", path, ""); w.Code == http.StatusBadRequest {
			t.Errorf("%s: koordinatalar RAD ETILDI (400) — chegara yana torayganmi?", nom)
		}
	}
}

// Bir xil nuqta — OSRM'ga yuborilmaydi, darhol rad etiladi.
func TestRouteRejectsIdenticalPoints(t *testing.T) {
	cfg := baseCfg()
	cfg.OSRMURL = "http://127.0.0.1:1"
	h := testServer(t, cfg)

	w := do(h, "GET", "/v1/route?from_lat=41.00&from_lng=71.22&to_lat=41.00&to_lng=71.22", "")
	if w.Code != http.StatusBadRequest {
		t.Errorf("kutilgan 400, olingan %d", w.Code)
	}
}

// Muvaffaqiyatli marshrut — OSRM'ning XOM javobi emas, faqat bizning
// o'z shaklimiz (distance_m/duration_s/geometry) qaytishi kerak.
func TestRouteProxiesAndReshapesOSRMResponse(t *testing.T) {
	osrm := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"code": "Ok",
			"waypoints": [{"secret_internal_field": "should never leak"}],
			"routes": [{"distance": 1234.5, "duration": 210.7,
				"geometry": {"type":"LineString","coordinates":[[71.22,41.00],[71.23,41.01]]},
				"legs": [{"steps": ["internal osrm detail"]}]}]
		}`))
	}))
	defer osrm.Close()

	cfg := baseCfg()
	cfg.OSRMURL = osrm.URL
	h := testServer(t, cfg)

	w := do(h, "GET", "/v1/route?from_lat=41.00&from_lng=71.22&to_lat=41.01&to_lng=71.23", "")
	if w.Code != http.StatusOK {
		t.Fatalf("kutilgan 200, olingan %d: %s", w.Code, w.Body.String())
	}

	body := w.Body.String()
	if strings.Contains(body, "secret_internal_field") || strings.Contains(body, "waypoints") ||
		strings.Contains(body, "legs") || strings.Contains(body, "internal osrm detail") {
		t.Errorf("OSRM'ning xom javobi mijozga sizib chiqdi: %s", body)
	}

	var got routeResult
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("javob JSON emas: %v", err)
	}
	if got.DistanceM != 1234.5 || got.DurationS != 210.7 {
		t.Errorf("masofa/vaqt noto'g'ri o'qildi: %+v", got)
	}
	if !strings.Contains(string(got.Geometry), "LineString") {
		t.Errorf("geometriya kutilmagan: %s", got.Geometry)
	}
}

// OSRM "NoRoute" desa — 404, ichki xato emas.
func TestRouteNoRouteReturns404(t *testing.T) {
	osrm := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code": "NoRoute", "message": "no route found"}`))
	}))
	defer osrm.Close()

	cfg := baseCfg()
	cfg.OSRMURL = osrm.URL
	h := testServer(t, cfg)

	w := do(h, "GET", "/v1/route?from_lat=41.00&from_lng=71.22&to_lat=41.01&to_lng=71.23", "")
	if w.Code != http.StatusNotFound {
		t.Errorf("kutilgan 404, olingan %d", w.Code)
	}
}

// OSRM manzili va xato matni javobga chiqib ketmasin.
func TestRouteErrorNeverLeaksOSRMAddress(t *testing.T) {
	cfg := baseCfg()
	cfg.OSRMURL = "http://127.0.0.1:1" // ulanib bo'lmaydi
	h := testServer(t, cfg)

	w := do(h, "GET", "/v1/route?from_lat=41.00&from_lng=71.22&to_lat=41.01&to_lng=71.23", "")
	if w.Code != http.StatusBadGateway {
		t.Errorf("kutilgan 502, olingan %d", w.Code)
	}
	if strings.Contains(w.Body.String(), "127.0.0.1") {
		t.Errorf("OSRM manzili javobga sizib chiqdi: %s", w.Body.String())
	}
}

// /v1/route ALOHIDA, qattiqroq rate-limit ostida — umumiy limiter
// bilan aralashmaydi.
func TestRouteHasDedicatedStricterRateLimit(t *testing.T) {
	cfg := baseCfg()
	cfg.OSRMURL = "http://127.0.0.1:1"
	h := testServer(t, cfg)

	blocked := false
	for i := 0; i < routeRateBurst*3; i++ {
		if do(h, "GET", "/v1/route?from_lat=41.00&from_lng=71.22&to_lat=41.01&to_lng=71.23", "").Code == http.StatusTooManyRequests {
			blocked = true
			break
		}
	}
	if !blocked {
		t.Error("/v1/route rate-limit ishlamadi")
	}
}
