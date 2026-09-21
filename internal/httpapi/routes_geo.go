package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"ondexmap/internal/storage"
)

// Kiruvchi ma'lumot chegaralari.
//
// Validatsiya BAZAGA BORISHDAN OLDIN bajariladi: yaroqsiz so'rov
// hovuzdan ulanish olmaydi va `statement_timeout` ni ishlatmaydi.
// Bu — arzon himoya qatlami.
const (
	minQueryLen = 2
	maxQueryLen = 100

	// Chust atrofidagi qo'pol chegara. Bundan tashqaridagi koordinata
	// bizning bazamizda BO'LISHI MUMKIN EMAS, shuning uchun so'rov
	// umuman yuborilmaydi.
	minLat, maxLat = 40.5, 41.6
	minLng, maxLng = 70.5, 72.0
)

func (s *Server) registerGeoRoutes(mux *http.ServeMux) {
	// Ikkalasi ham ScopePublic: xarita sayti anonim ishlaydi.
	// Himoya — rate limit va kiruvchi ma'lumot validatsiyasi.
	mux.HandleFunc("GET /v1/search", s.rateLimit(s.requireScope(ScopePublic, s.handleSearch)))
	mux.HandleFunc("GET /v1/resolve", s.rateLimit(s.requireScope(ScopePublic, s.handleResolve)))
	mux.HandleFunc("GET /v1/mahallas", s.rateLimit(s.requireScope(ScopePublic, s.handleMahallas)))
}

// handleMahallas — xarita qatlami uchun poligonlar (GeoJSON).
func (s *Server) handleMahallas(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		httpError(w, http.StatusServiceUnavailable, "baza ulanmagan")
		return
	}
	body, err := s.db.MahallasGeoJSON(r.Context())
	if err != nil {
		slog.Error("mahallalar so'rovi xatosi", "err", err)
		httpError(w, http.StatusBadGateway, "so'rov bajarilmadi")
		return
	}
	// Baza tayyor JSON qaytardi — qayta kodlamaymiz.
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}

// TARTIB MUHIM: avval VALIDATSIYA, keyin mavjudlik tekshiruvi.
//
// Yaroqsiz kirish baza holatidan QAT'I NAZAR yaroqsiz — u har doim
// 400 olishi kerak, ba'zan 400 ba'zan 503 emas. Bundan tashqari
// validatsiya — eng arzon to'siq: axlat so'rov chuqurroq qatlamlarga
// umuman yetib bormaydi.
func (s *Server) handleSearch(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	// Uzunlik RUNA bo'yicha o'lchanadi, bayt bo'yicha emas — kirillcha
	// harf 2 bayt egallaydi va bayt bo'yicha o'lchash o'zbek
	// foydalanuvchisini ikki barobar erta to'sib qo'yardi.
	n := utf8.RuneCountInString(q)
	if n < minQueryLen || n > maxQueryLen {
		httpError(w, http.StatusBadRequest,
			"qidiruv matni "+strconv.Itoa(minQueryLen)+"–"+strconv.Itoa(maxQueryLen)+" belgi bo'lishi kerak")
		return
	}

	limit := 10
	if v := r.URL.Query().Get("limit"); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil || parsed < 1 {
			httpError(w, http.StatusBadRequest, "limit noto'g'ri")
			return
		}
		limit = parsed // yuqori chegara storage qatlamida qo'yiladi
	}

	// Xarita markazi (ixtiyoriy): teng natijalardan yaqini oldinda chiqadi.
	// Ikkalasi BIRGA berilishi kerak; yaroqsiz qiymat jimgina tashlanmaydi —
	// mijoz xatosi darrov ko'rinishi uchun 400. Chegara — butun O'ZBEKISTON
	// (`resolve` dagi tor xizmat hududi emas): qidiruv butun mamlakat bo'yicha.
	var bias *storage.Point
	rawLat, rawLng := r.URL.Query().Get("lat"), r.URL.Query().Get("lng")
	if rawLat != "" || rawLng != "" {
		lat, okLat := parseCoord(rawLat, uzMinLat, uzMaxLat)
		lng, okLng := parseCoord(rawLng, uzMinLng, uzMaxLng)
		if !okLat || !okLng {
			httpError(w, http.StatusBadRequest, "lat/lng noto'g'ri yoki O'zbekiston tashqarisida")
			return
		}
		bias = &storage.Point{Lat: lat, Lng: lng}
	}

	if s.db == nil {
		httpError(w, http.StatusServiceUnavailable, "baza ulanmagan")
		return
	}

	matches, err := s.db.Search(r.Context(), q, limit, bias)
	if err != nil {
		// Haqiqiy sabab FAQAT logga; javobga umumiy xabar ketadi.
		slog.Error("qidiruv xatosi", "err", err)
		httpError(w, http.StatusBadGateway, "qidiruv bajarilmadi")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"results": matches})
}

func (s *Server) handleResolve(w http.ResponseWriter, r *http.Request) {
	lat, okLat := parseCoord(r.URL.Query().Get("lat"), minLat, maxLat)
	lng, okLng := parseCoord(r.URL.Query().Get("lng"), minLng, maxLng)
	if !okLat || !okLng {
		httpError(w, http.StatusBadRequest, "lat/lng noto'g'ri yoki xizmat hududidan tashqarida")
		return
	}

	if s.db == nil {
		httpError(w, http.StatusServiceUnavailable, "baza ulanmagan")
		return
	}

	place, err := s.db.Resolve(r.Context(), lat, lng)
	if err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			// 404 — "bu nuqta bizda yo'q". ChustApp shu javobni ko'rib
			// o'zining Google → Yandex → 2GIS zanjiriga o'tadi.
			httpError(w, http.StatusNotFound, "bu nuqta uchun ma'lumot yo'q")
			return
		}
		slog.Error("resolve xatosi", "err", err)
		httpError(w, http.StatusBadGateway, "so'rov bajarilmadi")
		return
	}
	writeJSON(w, http.StatusOK, place)
}

// parseCoord — koordinatani o'qiydi va chegaraga solishtiradi.
//
// `NaN` va `Inf` ni ham rad etadi: `ParseFloat` ularni muvaffaqiyatli
// o'qiydi, lekin solishtirish operatorlari ular uchun har doim `false`
// qaytaradi — ya'ni oddiy `< >` tekshiruvi ularni o'tkazib yuborardi
// va PostGIS'ga yaroqsiz nuqta borardi.
func parseCoord(raw string, min, max float64) (float64, bool) {
	v, err := strconv.ParseFloat(strings.TrimSpace(raw), 64)
	if err != nil {
		return 0, false
	}
	if !(v >= min && v <= max) { // NaN bu yerda `false` beradi — to'g'ri
		return 0, false
	}
	return v, true
}
