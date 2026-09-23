// Package adminapi — ma'lumot kiritish uchun LOKAL admin vositasi.
//
// ⚠️ ARXITEKTURA INVARIANTI
//
// Bu paket YOZISH huquqiga ega va shu sababli ommaviy API'dan
// (`internal/httpapi`) BUTUNLAY AJRATILGAN:
//
//	cmd/api    :8090   internetga qaragan   read-only baza    yozish kodi YO'Q
//	cmd/admin  :8091   faqat 127.0.0.1      yozuvchi baza     admin kalit
//
// Ya'ni ommaviy binar ichida yozish SQL'i umuman mavjud emas. Bu —
// grantlar va rollardan tashqari, UCHINCHI mustaqil himoya qatlami:
// hatto ommaviy API to'liq egallab olinsa ham, undagi kodda ma'lumot
// o'zgartiradigan yo'l yo'q.
package adminapi

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"

	"ondexmap/internal/apikey"
	"ondexmap/internal/config"
	"ondexmap/internal/storage"
)

// maxBodyBytes — so'rov tanasi chegarasi.
//
// Geometriya katta bo'lishi mumkin (murakkab poligon), lekin cheksiz
// emas: chegarasiz `json.Decode` xotirani to'ldirishi mumkin.
const maxBodyBytes = 4 << 20 // 4 MB

type Server struct {
	cfg  *config.Config
	db   *storage.Pool
	keys *apikey.Set
}

// New — admin serveri.
//
// `sessionKeys` — ishlab turgan jarayonning LOKAL sessiya tokeni
// (`internal/localsession`). U admin kaliti bilan BIR XIL huquqqa ega,
// lekin jarayon bilan birga o'ladi; ChustApp paneli uni lokal sessiya
// faylidan o'qiydi — shu sabab panelda kalit so'raydigan oyna umuman yo'q.
// Bo'sh qiymatlar `apikey.New` da tashlab yuboriladi.
func New(cfg *config.Config, db *storage.Pool, sessionKeys ...string) *Server {
	keys := append([]string{cfg.AdminKey, cfg.AdminKeyPrev}, sessionKeys...)
	return &Server{
		cfg:  cfg,
		db:   db,
		keys: apikey.New(keys...),
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	// ┌─ BU SERVERDA HTML SAHIFA YO'Q ─────────────────────────────────────┐
	// Muharrir ham, moderatsiya ham ChustApp admin panelining OnDexMap
	// bo'limida NATIV Flutter ekran (`apps/admin_panel/lib/ondexmap/`).
	// Ilgari muharrir shu serverdan berilgan Mapbox sahifa edi va panel uni
	// WebView ichida ochardi; WebView ham, Mapbox tokeniga bog'liqlik ham
	// olib tashlandi. Bu server endi faqat kalit talab qiladigan JSON API.
	// └────────────────────────────────────────────────────────────────────┘

	// Barcha ma'lumot endpointlari admin kalitini talab qiladi.
	// Lokal bog'lanish (127.0.0.1) — birinchi qatlam, kalit — ikkinchi.
	mux.HandleFunc("GET /api/verify", s.requireKey(s.handleVerify))
	mux.HandleFunc("GET /api/config", s.requireKey(s.handleConfig))
	mux.HandleFunc("GET /api/features", s.requireKey(s.handleFeatures))
	mux.HandleFunc("POST /api/mahalla", s.requireKey(s.handleUpsertMahalla))
	mux.HandleFunc("POST /api/street", s.requireKey(s.handleUpsertStreet))
	mux.HandleFunc("POST /api/alias", s.requireKey(s.handleAlias))
	mux.HandleFunc("POST /api/delete", s.requireKey(s.handleDelete))

	// ── Foydalanuvchi ob'ektlari moderatsiyasi ───────────────────────
	// UI — ChustApp admin panelining OnDexMap bo'limida (nativ ekran); bu
	// yerda faqat kalit talab qiladigan JSON endpointlar. Ommaviy API bularni
	// CHAQIRA OLMAYDI: ular faqat shu lokal binarda va yozuvchi hovuz bilan
	// ishlaydi.
	mux.HandleFunc("GET /api/places/meta", s.requireKey(s.handlePlacesMeta))
	mux.HandleFunc("GET /api/submissions", s.requireKey(s.handleSubmissions))
	mux.HandleFunc("GET /api/submissions/{id}/photos/{n}", s.requireKey(s.handleSubmissionPhoto))
	mux.HandleFunc("POST /api/submissions/approve", s.requireKey(s.handleApprove))
	mux.HandleFunc("POST /api/submissions/reject", s.requireKey(s.handleReject))
	mux.HandleFunc("GET /api/places", s.requireKey(s.handlePlacesList))
	mux.HandleFunc("POST /api/places/delete", s.requireKey(s.handlePlaceDelete))

	return securityHeaders(mux)
}

// requireKey — admin kaliti tekshiruvi.
func (s *Server) requireKey(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.keys.Empty() {
			// Kalit sozlanmagan bo'lsa vosita OCHILMAYDI. Bo'sh kalit
			// bilan ishlashga ruxsat berish — yozish huquqini
			// himoyasiz qoldirish degani.
			fail(w, http.StatusServiceUnavailable, "ONDEXMAP_ADMIN_KEY sozlanmagan (.env)")
			return
		}
		if !s.keys.Matches(r.Header.Get(apikey.Header)) {
			fail(w, http.StatusUnauthorized, "admin kaliti yaroqsiz")
			return
		}
		next(w, r)
	}
}

func (s *Server) handleVerify(w http.ResponseWriter, r *http.Request) {
	ok(w, map[string]bool{"ok": true})
}

// handleConfig — nativ muharrir uchun xarita sozlamasi.
//
// ⚠️ Sir BERILMAYDI (Mapbox tokeni endi umuman kerak emas). Sun'iy yo'ldosh
// tile'lari OMMAVIY API'ning o'z PROKSISI orqali olinadi
// (`/tiles/satellite/{z}/{x}/{y}`): provayder kaliti server ichida qoladi va
// mijozga (panelga) hech qachon yetmaydi. Manba sozlanmagan bo'lsa maydon
// umuman yuborilmaydi — panel sun'iy yo'ldosh tugmasini ko'rsatmaydi.
func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	body := map[string]string{}
	if s.cfg.SatelliteURL != "" {
		body["satellite_url"] = "http://127.0.0.1:" + apiPort(s.cfg.HTTPAddr) +
			"/tiles/satellite/{z}/{x}/{y}"
		if s.cfg.SatelliteAttribution != "" {
			body["satellite_attribution"] = s.cfg.SatelliteAttribution
		}
		if s.cfg.SatelliteMaxZoom != "" {
			body["satellite_maxzoom"] = s.cfg.SatelliteMaxZoom
		}
	}
	ok(w, body)
}

// apiPort — ommaviy API porti (`HTTP_ADDR`: ":8090" yoki "host:8090").
// Tushunib bo'lmasa standart 8090.
func apiPort(addr string) string {
	if _, port, err := net.SplitHostPort(addr); err == nil && port != "" {
		return port
	}
	return "8090"
}

func (s *Server) handleFeatures(w http.ResponseWriter, r *http.Request) {
	body, err := s.db.ListAll(r.Context(), r.URL.Query().Get("kind"))
	if err != nil {
		fail(w, http.StatusBadRequest, "kind noto'g'ri (mahalla | street)")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	//nolint:gosec // G705: `body` — bazadan olingan JSON (Content-Type
	// shu deb qo'yilgan), HTML EMAS. Bu server faqat operatorning o'z
	// kompyuterida, 127.0.0.1'da ishlaydi (cmd/admin).
	_, _ = w.Write(body)
}

func (s *Server) handleUpsertMahalla(w http.ResponseWriter, r *http.Request) {
	var in storage.MahallaInput
	if !decode(w, r, &in) {
		return
	}
	id, err := s.db.UpsertMahalla(r.Context(), in)
	if err != nil {
		writeSaveErr(w, err)
		return
	}
	ok(w, map[string]string{"id": id})
}

func (s *Server) handleUpsertStreet(w http.ResponseWriter, r *http.Request) {
	var in storage.StreetInput
	if !decode(w, r, &in) {
		return
	}
	id, err := s.db.UpsertStreet(r.Context(), in)
	if err != nil {
		writeSaveErr(w, err)
		return
	}
	ok(w, map[string]string{"id": id})
}

func (s *Server) handleAlias(w http.ResponseWriter, r *http.Request) {
	var in struct {
		StreetID string `json:"street_id"`
		Alias    string `json:"alias"`
		Kind     string `json:"kind"`
		Source   string `json:"source"`
	}
	if !decode(w, r, &in) {
		return
	}
	if err := s.db.AddAlias(r.Context(), in.StreetID, in.Alias, in.Kind, in.Source); err != nil {
		fail(w, http.StatusBadRequest, err.Error())
		return
	}
	ok(w, map[string]bool{"ok": true})
}

func (s *Server) handleDelete(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Kind string `json:"kind"`
		ID   string `json:"id"`
	}
	if !decode(w, r, &in) {
		return
	}
	if err := s.db.Delete(r.Context(), in.Kind, in.ID); err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			fail(w, http.StatusNotFound, "topilmadi")
			return
		}
		fail(w, http.StatusBadRequest, "o'chirib bo'lmadi")
		return
	}
	ok(w, map[string]bool{"ok": true})
}

// ── Yordamchilar ─────────────────────────────────────────────────────

func decode(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	// Noma'lum maydonni RAD ETADI — noto'g'ri yozilgan maydon
	// (masalan `nam` o'rniga `name`) jimgina e'tiborsiz qolmasin.
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		fail(w, http.StatusBadRequest, "so'rov tanasi yaroqsiz")
		return false
	}
	return true
}

func writeSaveErr(w http.ResponseWriter, err error) {
	if errors.Is(err, storage.ErrOutsideServiceArea) {
		fail(w, http.StatusBadRequest,
			"geometriya xizmat hududidan (Chust atrofi) tashqarida")
		return
	}
	// Validatsiya xatolari foydalanuvchiga ko'rsatiladi — ular bizning
	// o'z matnimiz, baza ichki tafsiloti emas.
	fail(w, http.StatusBadRequest, err.Error())
}

func ok(w http.ResponseWriter, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(body)
}

func fail(w http.ResponseWriter, status int, msg string) {
	slog.Debug("admin so'rovi rad etildi", "status", status)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Cache-Control", "no-store")
		// Bu server endi HTML bermaydi (faqat JSON va rasm baytlari), shuning uchun
		// eng qat'iy siyosat: hech qanday resurs, skript yoki ramka ruxsat etilmaydi.
		// Ilgari bu yerda Mapbox uchun ruxsatlar bor edi; ishlatilmaydigan ruxsat
		// ochiq qolmasin.
		h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		next.ServeHTTP(w, r)
	})
}
