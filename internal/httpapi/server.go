package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strings"

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
	// routeLimiter — /v1/route uchun ALOHIDA, QATTIQROQ chegara.
	//
	// Marshrutlash (OSRM so'rovi) mahalla ro'yxati yoki qidiruvdan
	// ANCHA qimmat — har so'rov OSRM'da haqiqiy yo'l grafigi bo'ylab
	// hisoblash talab qiladi. Umumiy limiter bilan bir xil chegarada
	// qolsa, bitta skript shu qimmat endpoint'ni boshqa hammadan
	// ustun ravishda charchatib qo'yishi mumkin edi.
	routeLimiter *rateLimiter
	// satelliteLimiter — rastr tile'lari uchun. Chegarasi YUMSHOQROQ:
	// bitta ekran o'nlab tile so'raydi.
	satelliteLimiter *rateLimiter
	// satCache — sun'iy yo'ldosh tile'larining disk keshi.
	//
	// `nil` bo'lishi MUMKIN (sozlanmagan yoki papka ochilmadi) va
	// bu holat normal: metodlari `nil` qabul qiladi, tile'lar
	// keshsiz, to'g'ridan-to'g'ri provayderdan beriladi.
	satCache *tileCache
	// submit — ob'ektlarni KARANTINGA yozuvchi (`WithSubmitter`). `nil` —
	// qabul qilish o'chiq. Tor interfeys: ushlab turgan kod faqat 3 amalni
	// chaqira oladi, o'zboshimchalik bilan SQL emas.
	submit placeSubmitter
	// submitLimiter — POST /v1/places uchun ALOHIDA, qattiq chegara.
	submitLimiter *rateLimiter
}

func New(cfg *config.Config, db *storage.Pool) *Server {
	return &Server{
		cfg:          cfg,
		auth:         newAuthenticator(cfg.ReadKey, cfg.ReadKeyPrev, cfg.AdminKey, cfg.AdminKeyPrev),
		db:           db,
		limiter:      newRateLimiter(),
		routeLimiter: newRateLimiterWith(routeRateBurst, routeRatePerSec),
		satelliteLimiter: newRateLimiterWith(
			satelliteRateBurst, satelliteRatePerSec),
		satCache:      newTileCache(cfg.SatelliteCacheDir, cfg.SatelliteCacheMaxMB),
		submitLimiter: newRateLimiterWith(submitRateBurst, submitRatePerSec),
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
			// ⚠️ Ilgari bu yerda MAPBOX_TOKEN bo'lmasa 503 qaytarilardi.
			// Endi xarita Mapbox'siz ishlaydi (o'z PMTiles + MapLibre),
			// va o'sha shart butun sozlamani — joylar, ob-havo, sun'iy
			// yo'ldosh manzillarini ham — bloklab qo'yardi. Token faqat
			// admin muharriri uchun kerak va u O'Z endpointidan oladi
			// (`adminapi`), shuning uchun bog'liqlik uzildi.
			// Bo'sh qiymat UMUMAN yuborilmaydi: mijozda "sozlanmagan"
			// va "bo'sh satr" farqi yo'qolmasin — sun'iy yo'ldosh
			// tugmasi aynan shu farqqa qarab ko'rsatiladi.
			// ⚠️ Mijozga YUQORI OQIM manzili EMAS, o'z proksimiz
			// beriladi: manzilda API kalit bo'lishi mumkin va
			// `/v1/config` javobini istalgan odam o'qiy oladi.
			satURL := ""
			if s.cfg.SatelliteURL != "" {
				satURL = satelliteProxyPath(r)
			}

			body := map[string]string{}
			for k, v := range map[string]string{
				"mapbox_token":          s.cfg.MapboxToken,
				"places_url":            s.cfg.PlacesURL,
				"weather_url":           s.cfg.WeatherURL,
				"satellite_url":         satURL,
				"satellite_attribution": s.cfg.SatelliteAttribution,
				"satellite_maxzoom":     s.cfg.SatelliteMaxZoom,
				// Xizmat hududi — `minLng,minLat,maxLng,maxLat`.
				//
				// NEGA MIJOZGA BERILADI: sahifa hudud tashqarisidagi
				// bosishda `/v1/resolve` ga BEKORGA so'rov yubormasin.
				// Server baribir 400 qaytaradi, lekin bu konsolni xato
				// bilan to'ldiradi va foydalanuvchi kutib turadi.
				// Chegara SHU YERDA — ikki joyda yozilsa, ular
				// ertami-kechmi bir-biridan farq qilib qolardi.
				"service_bounds": fmt.Sprintf("%g,%g,%g,%g",
					minLng, minLat, maxLng, maxLat),
			} {
				if v != "" {
					body[k] = v
				}
			}
			writeJSON(w, http.StatusOK, body)
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
	s.registerPlacesRoutes(mux)
	s.registerRouteRoutes(mux)
	s.registerSatelliteRoute(mux) // sozlanmagan bo'lsa ro'yxatdan o'tmaydi
	s.registerMapAssets(mux)      // uslub, shriftlar, zaxira tile fayli
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

// cachedPublicAsset — uzoq keshlanadigan, HAMMA uchun bir xil bo'lgan
// va hech qanday sirga bog'liq bo'lmagan statik xarita boyliklari.
//
// Faqat shu ikkitasi: shrift gliflari va o'zimizning PMTiles faylimiz.
// `style.json` bu ro'yxatda EMAS — u sozlanganda tashqi (R2) manzilni
// o'z ichiga olishi mumkin va `no-store` bilan beriladi, ya'ni umuman
// keshlanmaydi.
func cachedPublicAsset(p string) bool {
	return strings.HasPrefix(p, "/fonts/") ||
		strings.HasPrefix(p, "/tiles/satellite/") ||
		p == "/tiles/chust.pmtiles"
}

// cors — ALLOWED_ORIGINS ro'yxati bo'yicha.
//
// Ro'yxat bo'sh bo'lsa hech qanday CORS sarlavhasi yuborilmaydi va
// brauzer so'rovni o'zi bloklaydi. Bu fail-closed: sozlanmagan holat
// "hammaga ruxsat" degani EMAS.
//
// ┌─ NEGA STATIK BOYLIKLAR UCHUN `*` ──────────────────────────────────
// Shrift va tile — hamma uchun BIR XIL baytlar, kalitga ham, sessiyaga
// ham bog'liq emas; ularni origin bo'yicha cheklash bir tiyin xavfsizlik
// bermaydi (istalgan odam `curl` bilan oladi), lekin brauzer keshini
// BUZADI: 8090 dagi sahifa ularni Origin'siz so'raydi, javobda CORS
// sarlavhasi bo'lmaydi va o'sha javob keshga tushadi. Keyin 3100 xuddi
// shu manzilni so'raganda brauzer keshdagi (CORS'siz) nusxani oladi va
// so'rovni o'zi rad etadi. Aynan shu nosozlik ro'y berdi: 8090 siliq
// ishlab turib, 3100 da hamma tile va yozuv yo'qolgan edi.
// └──────────────────────────────────────────────────────────────────
func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		if cachedPublicAsset(r.URL.Path) {
			h.Set("Access-Control-Allow-Origin", "*")
			h.Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		} else {
			// `Vary` SHARTSIZ qo'yiladi — origin ro'yxatga TUSHMAGAN
			// holatda ham. Javob Origin'ga qarab o'zgaradi, va buni
			// keshga aytmaslik yuqoridagi nosozlikning aynan o'zini
			// `/v1/...` javoblarida takrorlagan bo'lardi.
			h.Add("Vary", "Origin")
			origin := r.Header.Get("Origin")
			if origin != "" && slices.Contains(s.cfg.AllowedOrigins, origin) {
				h.Set("Access-Control-Allow-Origin", origin)
				h.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
				h.Set("Access-Control-Allow-Headers", "Content-Type, "+apiKeyHeader)
				h.Set("Access-Control-Max-Age", "600")
			}
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
