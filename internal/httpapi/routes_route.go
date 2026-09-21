package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// Marshrutlash — o'z-o'zimiz ko'targan OSRM'ga proksi.
//
// ┌─ NEGA ALOHIDA FAYL VA ALOHIDA HIMOYA QATLAMI ──────────────────────┐
// Bu — /v1/search, /v1/resolve, /v1/mahallas'dan TUBDAN farq qiladigan
// endpoint: bazaga emas, TASHQI (garchi bizniki bo'lsa ham) jarayonga
// tarmoq so'rovi yuboradi. Bu degani — yangi xato turlari (tarmoq
// uzilishi, sekin javob, noto'g'ri format) va yangi suiste'mol yo'li
// (qimmat hisoblashni takror so'rash). Shu sabab:
//   - alohida, qattiqroq rate-limit (`routeLimiter`, ratelimit.go)
//   - qat'iy vaqt chegarasi (`routeHTTPTimeout`)
//   - javob hajmi chegarasi (`io.LimitReader`)
//   - OSRM'ning xom javobi HECH QACHON mijozga forward qilinmaydi —
//     faqat kerakli maydonlar o'qib olinib, o'z shaklimizda qaytariladi
//
// └──────────────────────────────────────────────────────────────────┘
const (
	// routeHTTPTimeout — OSRM chindan sekinlashsa ham goroutine
	// abadiy osilib qolmasin.
	routeHTTPTimeout = 5 * time.Second

	// routeMaxResponseBytes — OSRM (yoki uni almashtirgan har qanday
	// buzuq/soxta javob) xotirani tugatmasin.
	routeMaxResponseBytes = 2 << 20 // 2 MiB — bitta kichik shahar marshruti uchun ortiqcha
)

var routeHTTPClient = &http.Client{Timeout: routeHTTPTimeout}

func (s *Server) registerRouteRoutes(mux *http.ServeMux) {
	// ScopePublic: sayt anonim ishlaydi, xuddi boshqa geo
	// endpoint'lar kabi. Himoya — ALOHIDA qattiqroq rate-limit
	// (routeLimit), umumiy limiter emas.
	mux.HandleFunc("GET /v1/route", s.routeLimit(s.requireScope(ScopePublic, s.handleRoute)))
}

// osrmResponse — OSRM /route javobidan FAQAT bizga kerakli qism.
//
// Qolgan maydonlar (waypoints, alternative routes, legs ichidagi
// step-bosqichlar va h.k.) ATAYLAB o'qilmaydi: ular ishlatilmaydi va
// strukturaga qo'shilsa, kelajakda OSRM javobidagi har qanday
// o'zgarish bizning kontraktimizga tasodifan sizib kirishi mumkin edi.
type osrmResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Routes  []struct {
		DistanceM float64         `json:"distance"`
		DurationS float64         `json:"duration"`
		Geometry  json.RawMessage `json:"geometry"`
	} `json:"routes"`
}

// handleRoute — ikki nuqta orasidagi HAQIQIY yo'l bo'ylab marshrut.
//
// TARTIB: avval validatsiya (arzon), keyin xizmat mavjudligi, keyin
// tarmoq so'rovi (qimmat) — xuddi handleResolve'dagi kabi.
func (s *Server) handleRoute(w http.ResponseWriter, r *http.Request) {
	fromLat, okFromLat := parseCoord(r.URL.Query().Get("from_lat"), minLat, maxLat)
	fromLng, okFromLng := parseCoord(r.URL.Query().Get("from_lng"), minLng, maxLng)
	toLat, okToLat := parseCoord(r.URL.Query().Get("to_lat"), minLat, maxLat)
	toLng, okToLng := parseCoord(r.URL.Query().Get("to_lng"), minLng, maxLng)
	if !okFromLat || !okFromLng || !okToLat || !okToLng {
		httpError(w, http.StatusBadRequest, "from_lat/from_lng/to_lat/to_lng noto'g'ri yoki xizmat hududidan tashqarida")
		return
	}
	// Bir xil nuqta — mazmunsiz so'rov, OSRM'ga yuborishga arzimaydi.
	if fromLat == toLat && fromLng == toLng {
		httpError(w, http.StatusBadRequest, "boshlanish va tugash nuqtasi bir xil")
		return
	}

	if s.cfg.OSRMURL == "" {
		httpError(w, http.StatusServiceUnavailable, "marshrutlash xizmati sozlanmagan")
		return
	}

	route, err := s.fetchRoute(r.Context(), fromLat, fromLng, toLat, toLng)
	if err != nil {
		if errors.Is(err, errNoRoute) {
			httpError(w, http.StatusNotFound, "bu ikki nuqta orasida yo'l topilmadi")
			return
		}
		// Haqiqiy sabab (tarmoq xatosi, OSRM manzili, timeout) FAQAT
		// logga — mijozga OSRM qayerda joylashganini bilish shart emas.
		slog.Error("marshrutlash xatosi", "err", err)
		httpError(w, http.StatusBadGateway, "marshrut hisoblanmadi")
		return
	}

	writeJSON(w, http.StatusOK, route)
}

var errNoRoute = errors.New("marshrut topilmadi")

// routeResult — mijozga qaytadigan, o'zimiz belgilagan shakl.
type routeResult struct {
	DistanceM float64         `json:"distance_m"`
	DurationS float64         `json:"duration_s"`
	Geometry  json.RawMessage `json:"geometry"`
}

func (s *Server) fetchRoute(ctx context.Context, fromLat, fromLng, toLat, toLng float64) (*routeResult, error) {
	// Koordinatalar QAT'IY sonli qiymatlardan (parseCoord orqali
	// tekshirilgan) hosil bo'ladi — URL'ga foydalanuvchi matni
	// TO'G'RIDAN-TO'G'RI hech qachon qo'shilmaydi.
	coords := strconv.FormatFloat(fromLng, 'f', 6, 64) + "," + strconv.FormatFloat(fromLat, 'f', 6, 64) +
		";" + strconv.FormatFloat(toLng, 'f', 6, 64) + "," + strconv.FormatFloat(toLat, 'f', 6, 64)

	u := s.cfg.OSRMURL + "/route/v1/driving/" + coords + "?" + url.Values{
		"overview":     {"full"},
		"geometries":   {"geojson"},
		"alternatives": {"false"},
		"steps":        {"false"},
	}.Encode()

	ctx, cancel := context.WithTimeout(ctx, routeHTTPTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "OnDexMap/1.0 (+internal routing proxy)")

	resp, err := routeHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(io.LimitReader(resp.Body, routeMaxResponseBytes))
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("osrm status " + strconv.Itoa(resp.StatusCode) + ": " + string(body))
	}

	var parsed osrmResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}
	if parsed.Code == "NoRoute" || parsed.Code == "NoSegment" {
		return nil, errNoRoute
	}
	if parsed.Code != "Ok" || len(parsed.Routes) == 0 {
		return nil, errors.New("osrm kutilmagan javob: code=" + parsed.Code + " msg=" + parsed.Message)
	}

	best := parsed.Routes[0]
	return &routeResult{
		DistanceM: best.DistanceM,
		DurationS: best.DurationS,
		Geometry:  best.Geometry,
	}, nil
}
