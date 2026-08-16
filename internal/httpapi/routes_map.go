package httpapi

import (
	_ "embed"
	"net/http"
)

//go:embed assets/map.html
var mapHTML []byte

// registerMapRoute — ishlab chiqish uchun xarita sahifasi.
//
// ⚠️ FAQAT DEV REJIMDA. Production'da bu marshrut UMUMAN ro'yxatdan
// o'tmaydi.
//
// NEGA: ommaviy xarita sayti alohida loyiha bo'ladi (Next.js yoki
// statik hosting, `map-ondex.shoxpro.uz`). Bu sahifa — faqat
// backend'ni ko'z bilan tekshirish vositasi. Uni prod'da qoldirish
// ikkita muammo tug'diradi: pastdagi yumshatilgan CSP jonli serverga
// chiqadi, va texnik sahifa foydalanuvchiga ko'rinib qoladi.
func (s *Server) registerMapRoute(mux *http.ServeMux) {
	if !s.cfg.DevMode {
		return
	}
	mux.HandleFunc("GET /map", func(w http.ResponseWriter, r *http.Request) {
		// ── CSP shu marshrut uchun ALMASHTIRILADI ────────────────────
		//
		// Global siyosat `default-src 'none'` — JSON API uchun to'g'ri,
		// lekin HTML sahifani JIMGINA o'ldiradi: skript bloklanadi,
		// sahifa oq qoladi va konsolda nima bo'lganini tushunish qiyin.
		// ChustApp'da aynan shu yuz bergan.
		//
		// Shuning uchun bu yerda ANIQ, tor ro'yxat beriladi — Mapbox
		// ishlashi uchun zarur bo'lgan minimum:
		//   worker-src/child-src blob: — Mapbox GL WebWorker ishlatadi
		//   connect-src *.mapbox.com   — tile va style so'rovlari
		//   img-src data: blob:        — tile'lar shu ko'rinishda keladi
		//
		// `'unsafe-inline'` skript uchun ATAYLAB berilgan va bu — bu
		// marshrut nega faqat dev'da qolishining asosiy sababi.
		w.Header().Set("Content-Security-Policy",
			"default-src 'none'; "+
				"script-src 'self' 'unsafe-inline' https://api.mapbox.com; "+
				"style-src 'self' 'unsafe-inline' https://api.mapbox.com; "+
				"connect-src 'self' https://api.mapbox.com https://events.mapbox.com; "+
				"img-src 'self' data: blob:; "+
				"worker-src blob:; child-src blob:; "+
				"font-src 'self' data:; "+
				"frame-ancestors 'none'")
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write(mapHTML)
	})
}
