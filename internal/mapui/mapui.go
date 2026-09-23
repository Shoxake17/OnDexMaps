// Package mapui — ikkala xarita sahifasi UMUMIY ishlatadigan
// statik resurslar (JS va CSS).
//
// NEGA ALOHIDA PAKET: ommaviy ko'rinish (`internal/httpapi`) va admin
// muharriri (`internal/adminapi`) — ikki alohida binar, lekin xarita
// mantiqи ikkalasida bir xil. Nusxa ko'chirilsa ular vaqt o'tib
// bir-biridan uzoqlashadi va bir sahifada tuzatilgan xato
// ikkinchisida qolib ketadi.
//
// Fayllar `go:embed` bilan binarga kiritiladi — ya'ni ular
// o'zgarganda serverni QAYTA ISHGA TUSHIRISH shart.
package mapui

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed assets/ondexmap.js assets/ondexmap.css assets/ondex-pin.png assets/icons.js assets/maplibre-gl.js assets/maplibre-gl.css assets/pmtiles.js
var assets embed.FS

// allowed — beriladigan fayllar RO'YXATI.
//
// Fayl nomi so'rovdan olinadi, shuning uchun ro'yxat majburiy:
// aks holda `embed.FS` ichidagi istalgan yo'lni so'rash mumkin
// bo'lardi. `embed.FS` yo'ldan chiqishga (`../`) yo'l qo'ymaydi,
// lekin ruxsat ro'yxati niyatni ANIQ qiladi va kelajakda paketga
// boshqa fayl qo'shilsa u avtomatik ochilib qolmaydi.
var allowed = map[string]string{
	"ondexmap.js":  "text/javascript; charset=utf-8",
	"ondexmap.css": "text/css; charset=utf-8",
	// OnDex joylashuv belgisi (pin). `image/ondex-map.png` dan
	// 96px kenglikka kichraytirilgan nusxa: asl fayl 682×981 va
	// 355 KB — xaritada o'nlab belgi chizilganda bu bekorga
	// yuklanardi. 96px — eng katta ishlatilish (40px belgi) uchun
	// 2× zichlik, ya'ni retina ekranda ham aniq chiqadi.
	"ondex-pin.png": "image/png",
	// Interfeys ikonalari (Lucide + Font Awesome) — o'z serverimizdan.
	// CDN ATAYLAB ishlatilmaydi; sababi faylning o'z izohida.
	"icons.js": "text/javascript; charset=utf-8",
	// MapLibre GL — Mapbox GL'ning tokensiz, ochiq kodli forki.
	// O'ZIMIZ joylagan PMTiles bilan ishlatiladi (`/v1/tiles/chust`),
	// Mapbox'ga bog'liqlikni butunlay yo'q qilish uchun. CDN emas —
	// xuddi icons.js kabi sabab: CSP va uzilmas ishlash.
	"maplibre-gl.js":  "text/javascript; charset=utf-8",
	"maplibre-gl.css": "text/css; charset=utf-8",
	// PMTiles brauzer plagini — `.pmtiles` faylini HTTP Range
	// so'rovlari bilan to'g'ridan-to'g'ri o'qiydi, alohida tile-server
	// jarayoni shart emas.
	"pmtiles.js": "text/javascript; charset=utf-8",
}

// Register — `GET /assets/{file}` marshrutini qo'shadi.
//
// Ikkala server ham shu funksiyani chaqiradi.
func Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /assets/{file}", serve)
}

func serve(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("file")
	ctype, ok := allowed[name]
	if !ok {
		http.NotFound(w, r)
		return
	}

	body, err := fs.ReadFile(assets, "assets/"+name)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", ctype)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	// `no-store` — resurs binarga kiritilgani uchun uni yangilash
	// serverni qayta ishga tushirishni talab qiladi. Keshlansa
	// ishlab chiqishda eski nusxa qolib, "nega o'zgarmadi?" degan
	// chalkashlik kelib chiqardi.
	w.Header().Set("Cache-Control", "no-store")
	//nolint:gosec // G705: `body` — build vaqtida `go:embed` qilingan
	// sobit fayl (`allowed` ro'yxatidagi nomlardan biri), foydalanuvchi
	// kiritgan matn EMAS.
	_, _ = w.Write(body)
}

// FileNames — ruxsat etilgan fayllar (testlar uchun).
func FileNames() []string {
	out := make([]string, 0, len(allowed))
	for k := range allowed {
		out = append(out, k)
	}
	return out
}
