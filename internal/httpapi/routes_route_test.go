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

// Xizmat hududidan tashqaridagi nuqta OSRM'ga UMUMAN yubormasdan
// rad etilishi kerak (validatsiya tarmoq so'rovidan OLDIN).
func TestRouteRejectsOutsideServiceArea(t *testing.T) {
	cfg := baseCfg()
	cfg.OSRMURL = "http://127.0.0.1:1" // atayin yaroqsiz — chaqirilsa xato beradi
	h := testServer(t, cfg)

	cases := []string{
		"/v1/route?from_lat=41.2995&from_lng=69.2401&to_lat=41.01&to_lng=71.23", // Toshkent
		"/v1/route?from_lat=abc&from_lng=71.22&to_lat=41.01&to_lng=71.23",
		"/v1/route?from_lat=41.00&from_lng=71.22&to_lat=41.01",                  // to_lng yo'q
	}
	for _, path := range cases {
		if w := do(h, "GET", path, ""); w.Code != http.StatusBadRequest {
			t.Errorf("%s: kutilgan 400, olingan %d", path, w.Code)
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
