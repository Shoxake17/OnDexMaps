package httpapi

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"errors"
	"log/slog"
	"math"
	"net/http"
	"net/netip"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"ondexmap/internal/devplatform"
	"ondexmap/internal/storage"
)

// ═══════════════════════════════════════════════════════════════════════
// /v2 — DASTURCHILAR API'si (console.ondex.uz da kalit olinadi).
//
// Bu yerda FAQAT O'QISH funksiyalari bor (Google Maps Platform kabi):
//
//	GET /v2/geocode     — nom bo'yicha joy qidirish
//	GET /v2/reverse     — koordinata → manzil
//	GET /v2/directions  — A → B yo'l chizig'i
//	GET /v2/places      — to'rtburchak ichidagi ob'ektlar
//	GET /v2/places/{id} — bitta ob'ekt
//
// Yozish YO'Q: joy qo'shish, rasm, moderatsiya, mahalla — hech biri bu yerda yo'q.
// "/v2/" ostidagi boshqa HAMMA narsa (har qanday metod) `api_not_allowed`.
// Bu ro'yxat — allowlist: yangi marshrut shu yerga QO'SHILMAGUNCHA v2'da mavjud emas.
//
// Kalit tekshiruvi, tezlik/oylik chegara va hisoblash — devplatform.Platform (server'siz
// unit-testlanadi); bu fayl faqat HTTP qatlami. Shartnoma: docs/developer-platform.md
// ═══════════════════════════════════════════════════════════════════════

// v2MaxConcurrentRoutes — bir vaqtdagi /v2/directions (OSRM) soni. Dasturchi kalitlari
// birgalikda OSRM'ni to'ldirib, o'z saytimiz marshrutini to'sib qo'ymasin.
const v2MaxConcurrentRoutes = 16

// WithPlatform — /v2 ni yoqadi. `nil` bo'lsa /v2 endpointlari 503 qaytaradi (fail-closed).
func (s *Server) WithPlatform(p *devplatform.Platform) *Server {
	s.platform = p
	return s
}

// openAPISpec — rasmiy kontrakt (`api/openapi.yaml`).
//
// ⚠️ Fayl SERVER TOMONDA TAHLIL QILINMAYDI — baytlari shundayligicha uzatiladi.
// Shu sabab YAML kutubxonasi KERAK EMAS: `go.mod` dagi "bog'liqliklar ataylab kam"
// qoidasi buzilmaydi. Kontraktning kod bilan mosligini `openapi_test.go` tekshiradi.
//
//go:embed openapi.yaml
var openAPISpec []byte

func (s *Server) registerV2Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /v2/geocode", s.v2(devplatform.APIGeocode, s.v2Geocode))
	mux.HandleFunc("GET /v2/reverse", s.v2(devplatform.APIReverse, s.v2Reverse))
	mux.HandleFunc("GET /v2/directions", s.v2(devplatform.APIDirections, s.v2Directions))
	mux.HandleFunc("GET /v2/places", s.v2(devplatform.APIPlaces, s.v2Places))
	mux.HandleFunc("GET /v2/places/{id}", s.v2(devplatform.APIPlaces, s.v2Place))

	// Kontrakt — ATAYLAB kalitsiz va hisoblanmaydi: dasturchi kalit olishdan
	// OLDIN API nima qila olishini ko'ra olishi kerak. Sir emas.
	mux.HandleFunc("GET /v2/openapi.yaml", func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("Content-Type", "application/yaml; charset=utf-8")
		h.Set("Cache-Control", "public, max-age=300")
		// Hujjat generatorlari (Scalar, Redoc, Swagger UI) boshqa domendan
		// yuklaydi — kontrakt ochiq bo'lgani uchun bu xavfsiz.
		h.Set("Access-Control-Allow-Origin", "*")
		http.ServeContent(w, r, "openapi.yaml", specModTime, bytes.NewReader(openAPISpec))
	})

	// Qolgani — allowlist tashqarisi. Kalit talab qilinmaydi: javob hamma uchun bir xil.
	mux.HandleFunc("/v2/", func(w http.ResponseWriter, r *http.Request) {
		v2Fail(w, http.StatusForbidden, devplatform.CodeAPINotAllowed,
			"bu endpoint dasturchi API'sida mavjud emas (faqat geocode, reverse, directions, places — GET)")
	})
}

// specModTime — `If-Modified-Since` uchun. Jarayon ishga tushgan vaqt:
// spec binar ichida, ya'ni har deploy'da yangi jarayon = yangi vaqt.
var specModTime = time.Now()

// statusRecorder — hisoblash uchun yakuniy holat kodini ushlaydi.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (w *statusRecorder) WriteHeader(code int) {
	if w.status == 0 {
		w.status = code
	}
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusRecorder) Write(b []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	return w.ResponseWriter.Write(b)
}

// v2 — kalit tekshiruvi + hisoblash o'rami.
func (s *Server) v2(api string, h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		if s.platform == nil {
			v2Fail(w, http.StatusServiceUnavailable, devplatform.CodeUnavailable, "dasturchi API'si yoqilmagan")
			return
		}

		secret, fromQuery := v2Secret(r)
		addr, _ := netip.ParseAddr(s.clientIP(r))
		grant, d := s.platform.Authorize(r.Context(), devplatform.AuthInput{
			Secret: secret, SecretFromQuery: fromQuery, API: api,
			Origin: r.Header.Get("Origin"), Referer: r.Header.Get("Referer"),
			ClientIP: addr.Unmap(),
		})
		if d != nil {
			if d.RetryAfter > 0 {
				w.Header().Set("Retry-After", strconv.Itoa(int(math.Ceil(d.RetryAfter.Seconds()))))
			}
			v2Fail(w, d.Status, d.Code, d.Message)
			return
		}

		hd := w.Header()
		hd.Set("X-Plan", string(grant.Plan.ID))
		if grant.Plan.MonthlyCap > 0 {
			hd.Set("X-Quota-Limit", strconv.FormatInt(grant.Plan.MonthlyCap, 10))
			hd.Set("X-Quota-Used", strconv.FormatInt(grant.MonthUsed, 10))
		}

		rec := &statusRecorder{ResponseWriter: w}
		defer func() {
			st := rec.status
			if st == 0 {
				st = http.StatusInternalServerError // handler hech narsa yozmadi (panic)
			}
			s.platform.Record(grant, api, st)
		}()
		h(rec, r)
	}
}

// v2Secret — kalit: X-API-Key sarlavhasi (afzal) yoki ?key=. Qaysi biridan kelgani
// qaytariladi: server kalitlari URL'da qabul qilinmaydi.
func v2Secret(r *http.Request) (secret string, fromQuery bool) {
	if v := strings.TrimSpace(r.Header.Get(apiKeyHeader)); v != "" {
		return v, false
	}
	if v := strings.TrimSpace(r.URL.Query().Get("key")); v != "" {
		return v, true
	}
	return "", false
}

// v2Status — Google uslubidagi status matni.
func v2Status(code int) string {
	switch code {
	case http.StatusBadRequest:
		return "INVALID_REQUEST"
	case http.StatusNotFound:
		return "NOT_FOUND"
	case http.StatusUnauthorized, http.StatusForbidden:
		return "REQUEST_DENIED"
	case http.StatusTooManyRequests:
		return "OVER_QUERY_LIMIT"
	default:
		return "UNKNOWN_ERROR"
	}
}

// v2Fail — xato javobi. `message` — oldindan yozilgan matn (ichki xato sizmaydi).
func v2Fail(w http.ResponseWriter, code int, errCode, msg string) {
	writeJSON(w, code, map[string]any{
		"status": v2Status(code),
		"error":  map[string]string{"code": errCode, "message": msg},
	})
}

func v2Invalid(w http.ResponseWriter, msg string) {
	v2Fail(w, http.StatusBadRequest, "invalid_request", msg)
}

// isV2Path — CORS/qo'riqchi uchun.
func isV2Path(p string) bool { return strings.HasPrefix(p, "/v2/") }

// v2CORS — /v2 uchun CORS. Origin AKS-SADO qilinadi (kalit bilan tekshirish Authorize'da:
// brauzer kaliti faqat ruxsat etilgan domenlardan ishlaydi). Cookie/credentials YO'Q,
// shuning uchun bu ma'lumot sizishiga olib kelmaydi; xato javoblarini ham dasturchi ko'ra oladi.
func v2CORS(w http.ResponseWriter, r *http.Request) {
	h := w.Header()
	h.Add("Vary", "Origin")
	origin := r.Header.Get("Origin")
	if origin == "" {
		return
	}
	if n, err := devplatform.NormalizeOrigin(origin); err != nil || n != origin || strings.Contains(origin, "*") {
		return // "null", yo'lli va boshqa g'alati qiymatlarga sarlavha berilmaydi
	}
	h.Set("Access-Control-Allow-Origin", origin)
	h.Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	h.Set("Access-Control-Allow-Headers", apiKeyHeader)
	h.Set("Access-Control-Expose-Headers", "Retry-After, X-Plan, X-Quota-Limit, X-Quota-Used")
	h.Set("Access-Control-Max-Age", "600")
}

// ── handlerlar ───────────────────────────────────────────────────────

func (s *Server) v2Geocode(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if n := utf8.RuneCountInString(q); n < minQueryLen || n > maxQueryLen {
		v2Invalid(w, "q "+strconv.Itoa(minQueryLen)+"–"+strconv.Itoa(maxQueryLen)+" belgi bo'lishi kerak")
		return
	}
	limit := 10
	if v := r.URL.Query().Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 25 {
			v2Invalid(w, "limit 1–25 orasida bo'lishi kerak")
			return
		}
		limit = n
	}
	var bias *storage.Point
	rawLat, rawLng := r.URL.Query().Get("lat"), r.URL.Query().Get("lng")
	if rawLat != "" || rawLng != "" {
		lat, okLat := parseCoord(rawLat, uzMinLat, uzMaxLat)
		lng, okLng := parseCoord(rawLng, uzMinLng, uzMaxLng)
		if !okLat || !okLng {
			v2Invalid(w, "lat/lng noto'g'ri yoki O'zbekiston tashqarisida")
			return
		}
		bias = &storage.Point{Lat: lat, Lng: lng}
	}
	if s.db == nil {
		v2Fail(w, http.StatusServiceUnavailable, devplatform.CodeUnavailable, "baza ulanmagan")
		return
	}
	matches, err := s.db.Search(r.Context(), q, limit, bias)
	if err != nil {
		slog.Error("v2 geocode xatosi", "err", err)
		v2Fail(w, http.StatusBadGateway, "upstream_error", "so'rov bajarilmadi")
		return
	}
	status := "OK"
	if len(matches) == 0 {
		status = "ZERO_RESULTS"
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": status, "results": matches})
}

func (s *Server) v2Reverse(w http.ResponseWriter, r *http.Request) {
	lat, okLat := parseCoord(r.URL.Query().Get("lat"), minLat, maxLat)
	lng, okLng := parseCoord(r.URL.Query().Get("lng"), minLng, maxLng)
	if !okLat || !okLng {
		v2Invalid(w, "lat/lng noto'g'ri yoki xizmat hududidan tashqarida")
		return
	}
	if s.db == nil {
		v2Fail(w, http.StatusServiceUnavailable, devplatform.CodeUnavailable, "baza ulanmagan")
		return
	}
	place, err := s.db.Resolve(r.Context(), lat, lng)
	if errors.Is(err, storage.ErrNotFound) {
		writeJSON(w, http.StatusOK, map[string]any{"status": "ZERO_RESULTS", "result": nil})
		return
	}
	if err != nil {
		slog.Error("v2 reverse xatosi", "err", err)
		v2Fail(w, http.StatusBadGateway, "upstream_error", "so'rov bajarilmadi")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "OK", "result": place})
}

// parseLatLng — "lat,lng" (Google uslubi), xizmat hududi ichida.
func parseLatLng(raw string) (lat, lng float64, ok bool) {
	parts := strings.Split(raw, ",")
	if len(parts) != 2 {
		return 0, 0, false
	}
	lat, okLat := parseCoord(parts[0], minLat, maxLat)
	lng, okLng := parseCoord(parts[1], minLng, maxLng)
	return lat, lng, okLat && okLng
}

func (s *Server) v2Directions(w http.ResponseWriter, r *http.Request) {
	fromLat, fromLng, ok1 := parseLatLng(r.URL.Query().Get("origin"))
	toLat, toLng, ok2 := parseLatLng(r.URL.Query().Get("destination"))
	if !ok1 || !ok2 {
		v2Invalid(w, "origin va destination `lat,lng` ko'rinishida va xizmat hududi ichida bo'lishi kerak")
		return
	}
	if fromLat == toLat && fromLng == toLng {
		v2Invalid(w, "origin va destination bir xil")
		return
	}
	if s.cfg.OSRMURL == "" {
		v2Fail(w, http.StatusServiceUnavailable, devplatform.CodeUnavailable, "marshrutlash xizmati sozlanmagan")
		return
	}
	select {
	case s.v2RouteSem <- struct{}{}:
		defer func() { <-s.v2RouteSem }()
	default:
		w.Header().Set("Retry-After", "1")
		v2Fail(w, http.StatusTooManyRequests, devplatform.CodeRateLimited, "marshrutlash band, birozdan keyin urinib ko'ring")
		return
	}
	route, err := s.fetchRoute(r.Context(), fromLat, fromLng, toLat, toLng)
	if errors.Is(err, errNoRoute) {
		writeJSON(w, http.StatusOK, map[string]any{"status": "ZERO_RESULTS", "routes": []any{}})
		return
	}
	if err != nil {
		slog.Error("v2 directions xatosi", "err", err)
		v2Fail(w, http.StatusBadGateway, "upstream_error", "marshrut hisoblanmadi")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "OK", "routes": []*routeResult{route}})
}

func (s *Server) v2Places(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Query().Get("bbox"), ",")
	if len(parts) != 4 {
		v2Invalid(w, "bbox noto'g'ri (g'arb,janub,sharq,shimol)")
		return
	}
	var v [4]float64
	for i, p := range parts {
		lo, hi := uzMinLng, uzMaxLng
		if i%2 == 1 {
			lo, hi = uzMinLat, uzMaxLat
		}
		f, ok := parseCoord(p, lo, hi)
		if !ok {
			v2Invalid(w, "bbox noto'g'ri yoki O'zbekiston tashqarisida")
			return
		}
		v[i] = f
	}
	west, south, east, north := v[0], v[1], v[2], v[3]
	if west >= east || south >= north || east-west > maxBBoxSpan || north-south > maxBBoxSpan {
		v2Invalid(w, "bbox hajmi noto'g'ri yoki juda katta")
		return
	}
	if s.db == nil {
		v2Fail(w, http.StatusServiceUnavailable, devplatform.CodeUnavailable, "baza ulanmagan")
		return
	}
	body, err := s.db.PlacesGeoJSON(r.Context(), west, south, east, north, storage.MaxPlacesPerView)
	if err != nil {
		slog.Error("v2 places xatosi", "err", err)
		v2Fail(w, http.StatusBadGateway, "upstream_error", "so'rov bajarilmadi")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "OK", "result": json.RawMessage(body)})
}

func (s *Server) v2Place(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !storage.ValidID(id) {
		v2Fail(w, http.StatusNotFound, "not_found", "ob'ekt topilmadi")
		return
	}
	if s.db == nil {
		v2Fail(w, http.StatusServiceUnavailable, devplatform.CodeUnavailable, "baza ulanmagan")
		return
	}
	d, err := s.db.PlaceByID(r.Context(), id)
	if errors.Is(err, storage.ErrNotFound) {
		v2Fail(w, http.StatusNotFound, "not_found", "ob'ekt topilmadi")
		return
	}
	if err != nil {
		slog.Error("v2 place xatosi", "err", err)
		v2Fail(w, http.StatusBadGateway, "upstream_error", "so'rov bajarilmadi")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "OK", "result": d})
}
