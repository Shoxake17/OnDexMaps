package httpapi

import (
	"encoding/json"
	"net/http"
	"slices"

	"ondexmap/internal/config"
	"ondexmap/internal/storage"
)

// Server — HTTP qatlami. Barcha marshrutlar shu yerda ro'yxatdan o'tadi.
type Server struct {
	cfg  *config.Config
	auth *authenticator
	// db — FAQAT O'QISH huquqiga ega hovuz (`ondexmap_app` roli).
	// `nil` bo'lishi mumkin: baza ulanmagan holatda ham server
	// ko'tariladi va `/healthz` javob beradi.
	db      *storage.Pool
	limiter *rateLimiter
}

func New(cfg *config.Config, db *storage.Pool) *Server {
	return &Server{
		cfg:     cfg,
		auth:    newAuthenticator(cfg.ReadKey, cfg.ReadKeyPrev, cfg.AdminKey, cfg.AdminKeyPrev),
		db:      db,
		limiter: newRateLimiter(),
	}
}

// Handler — to'liq middleware zanjiri bilan o'ralgan marshrutlovchi.
//
// Tartib MUHIM: xavfsizlik sarlavhalari eng tashqarida — ular XATO
// javoblarga ham qo'shilishi kerak. Ichkarida esa CORS, so'ng
// marshrutlar (ular o'z ichida requireScope bilan himoyalangan).
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	s.registerRoutes(mux)
	return s.securityHeaders(s.cors(mux))
}

func (s *Server) registerRoutes(mux *http.ServeMux) {
	// /healthz — ATAYLAB ommaviy va ATAYLAB hech narsa oshkor qilmaydi.
	//
	// Versiya, baza holati yoki build vaqti QAYTARILMAYDI: sog'liq
	// tekshiruvi konteyner orkestratori uchun, razvedka qilayotgan
	// odam uchun emas. Ichki diagnostika keyin admin darajasida
	// alohida endpoint bo'ladi.
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// /v1/config — brauzerga Mapbox tokenini beradi.
	//
	// Token frontend build'iga yozilmaydi (ChustApp'dagi `/config/maps`
	// naqshi). Sabab: build'dagi qiymatni almashtirish uchun qayta
	// deploy kerak, `.env` dagini esa darhol.
	mux.HandleFunc("GET /v1/config", s.requireScope(ScopePublic,
		func(w http.ResponseWriter, r *http.Request) {
			if s.cfg.MapboxToken == "" {
				httpError(w, http.StatusServiceUnavailable, "xarita tokeni sozlanmagan (.env: MAPBOX_TOKEN)")
				return
			}
			writeJSON(w, http.StatusOK, map[string]string{"mapbox_token": s.cfg.MapboxToken})
		}))

	// ── Namuna marshrutlar (2-bosqichda haqiqiy mantiq ulanadi) ──────
	// Hozir ular faqat huquq darajasi to'g'ri ishlashini ko'rsatadi.
	mux.HandleFunc("GET /v1/whoami", s.requireScope(ScopeRead,
		func(w http.ResponseWriter, r *http.Request) {
			writeJSON(w, http.StatusOK, map[string]string{"scope": "read"})
		}))
	mux.HandleFunc("POST /v1/admin/ping", s.requireScope(ScopeAdmin,
		func(w http.ResponseWriter, r *http.Request) {
			writeJSON(w, http.StatusOK, map[string]string{"scope": "admin"})
		}))

	s.registerGeoRoutes(mux)
	s.registerMapRoute(mux) // faqat dev rejimda ro'yxatdan o'tadi
}

// securityHeaders — barcha javoblarga qo'llanadi.
func (s *Server) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")

		// DIQQAT (ChustApp'dan dars): `default-src 'none'` JSON API
		// uchun to'g'ri, lekin bu server KELAJAKDA HTML sahifa bera
		// boshlasa — bu qator sahifadagi inline skriptni bloklaydi va
		// sahifa JIMGINA qotadi, diagnostika ham ishlamaydi. ChustApp'da
		// aynan shu yuz bergan va nonce bilan yechilgan. HTML qo'shsangiz
		// bu qatorni ham qayta ko'ring.
		h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")

		if !s.cfg.DevMode {
			h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		next.ServeHTTP(w, r)
	})
}

// cors — ALLOWED_ORIGINS ro'yxati bo'yicha.
//
// Ro'yxat bo'sh bo'lsa hech qanday CORS sarlavhasi yuborilmaydi va
// brauzer so'rovni o'zi bloklaydi. Bu fail-closed: sozlanmagan holat
// "hammaga ruxsat" degani EMAS.
func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && slices.Contains(s.cfg.AllowedOrigins, origin) {
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			// Origin javobga ta'sir qiladi — keshlar buni bilishi shart,
			// aks holda bir sayt uchun berilgan javob boshqasiga
			// ulashilishi mumkin.
			h.Add("Vary", "Origin")
			h.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			h.Set("Access-Control-Allow-Headers", "Content-Type, "+apiKeyHeader)
			h.Set("Access-Control-Max-Age", "600")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// httpError — xato javobi.
//
// `msg` — ATAYLAB oldindan yozilgan matn, `error` qiymati emas: ichki
// xatolar (SQL matni, fayl yo'li, kalit) tashqariga chiqib ketmasin.
func httpError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
