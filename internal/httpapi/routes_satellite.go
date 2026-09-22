package httpapi

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Sun'iy yo'ldosh tile'lari — SERVER ORQALI, to'g'ridan-to'g'ri emas.
//
// ┌─ NEGA PROKSI ──────────────────────────────────────────────────────
// Yuqori aniqlikdagi tasvir provayderlari (Esri, Bing, MapTiler) API
// KALIT talab qiladi. Agar manzil brauzerga berilsa, kalit ham u bilan
// birga ketadi: `/v1/config` javobini istalgan odam o'qiy oladi va
// kalitni o'z saytida ishlatib, bizning kvotamizni yoqib yuboradi.
//
// Shu sababli brauzer FAQAT o'z serverimizni ko'radi
// (`/tiles/satellite/...`), kalit esa `.env` da, server ichida qoladi.
// Qo'shimcha foyda: CSP'ga tashqi domen qo'shish shart emas, va
// kelajakda provayderni almashtirish mijozga umuman sezilmaydi.
// └──────────────────────────────────────────────────────────────────

const (
	satelliteTimeout    = 8 * time.Second
	satelliteMaxBytes   = 4 << 20 // 4 MB — eng katta tile ham bundan kichik
	satelliteMaxZ       = 22
	satelliteRateBurst  = 240 // tile'lar to'p-to'p keladi (bir ekran ~20 ta)
	satelliteRatePerSec = 60
)

// O'zbekiston chegarasi — xizmat ko'rsatiladigan butun hudud.
//
// ┌─ NEGA PROKSI HUDUD BILAN CHEKLANADI ───────────────────────────────
// Bizning `/tiles/satellite/...` manzilimiz ochiq: unga hech qanday
// kalit kerak emas (kalit serverda). Ya'ni begona sayt uni O'Z
// xaritasiga ulab, butun dunyo tasvirini BIZNING hisobimizdan
// ko'rsatishi mumkin edi — oyiga 2 mln tile'lik bepul chegara bir
// necha kunda tugardi va buni sezish qiyin bo'lardi.
//
// Hudud cheklovi buni to'xtatadi: chegaradan tashqaridagi tile umuman
// so'ralmaydi. Chegara `routes_geo.go` dagi `minLat/minLng` DAN
// FARQLI — u Namangan atrofi (qidiruv va marshrut uchun), bu esa
// butun mamlakat: xarita ma'lumotimiz (`uzbekistan.pmtiles`) ham
// shunchalik hududni qamraydi va sun'iy yo'ldosh undan tor bo'lsa,
// foydalanuvchi mamlakatning qolgan qismida bo'sh ekran ko'rardi.
// └──────────────────────────────────────────────────────────────────
const (
	uzMinLng, uzMinLat = 55.5, 37.0
	uzMaxLng, uzMaxLat = 73.5, 45.8
)

var (
	errSatelliteUpstream = errors.New("sun'iy yo'ldosh manbasi javob bermadi")
	errSatelliteBadURL   = errors.New("sun'iy yo'ldosh manzili noto'g'ri")
	// errSatelliteNotFound — provayder BU tile uchun rasm SAQLAMAGAN
	// (masalan, Esri World Imagery ba'zi hududlarda MAXZOOM'dan pastroq
	// darajada ham to'liq keshlanmagan — bu XATO emas, tabiiy holat).
	// `errSatelliteUpstream`dan farqli: bu haqiqiy javob (404), tarmoq
	// yoki server nosozligi emas — shuning uchun mijozga 502 emas, 404
	// qaytariladi.
	errSatelliteNotFound = errors.New("bu tile uchun sun'iy yo'ldosh tasviri yo'q")
)

// redactURLError — tarmoq xatosidan MANZILNI olib tashlaydi.
//
// ┌─ ⚠️ KALIT LOGGA YOZILARDI ─────────────────────────────────────────
// `http.Client.Do` xatosi `*url.Error` bo'lib, uning `Error()` matni
// to'liq so'rov manzilini o'z ichiga oladi: `Get "https://…?token=KEY":
// context canceled`. Manzilda esa API kalit bor. Shu xato `slog.Warn` bilan
// logga yozilgani uchun kalit log fayliga tushib qolgan (aniqlangan) — log
// esa odatda kalitdan ko'ra kamroq himoyalangan joyda turadi va tashqi
// tizimlarga (log yig'uvchi, hisobot) ham ketadi.
//
// Faqat ASOSIY sabab (`ue.Err`: «context canceled», «connection refused»,
// DNS xatosi) qoldiriladi; manzil tashlanadi.
// └──────────────────────────────────────────────────────────────────
func redactURLError(err error) error {
	var ue *url.Error
	if errors.As(err, &ue) && ue.Err != nil {
		return fmt.Errorf("so'rov bajarilmadi (%s): %w", ue.Op, ue.Err)
	}
	return errSatelliteUpstream
}

func (s *Server) registerSatelliteRoute(mux *http.ServeMux) {
	// Sozlanmagan bo'lsa marshrut UMUMAN ro'yxatdan o'tmaydi — mavjud,
	// lekin doim xato qaytaradigan endpoint bo'lgandan yaxshiroq.
	if s.cfg.SatelliteURL == "" {
		return
	}
	mux.HandleFunc("GET /tiles/satellite/{z}/{x}/{y}",
		s.satelliteLimit(s.handleSatelliteTile))
}

// handleSatelliteTile — {z}/{x}/{y} ni tekshiradi va yuqori oqimdan
// olib beradi.
//
// XAVFSIZLIK: yo'l bo'laklari SO'ROVDAN keladi, shuning uchun ular
// FAQAT son sifatida talqin qilinadi va diapazoni tekshiriladi. Shu
// tufayli shablonga `../` yoki boshqa matn tushib, biz kutmagan
// manzilga so'rov ketishi mumkin emas.
func (s *Server) handleSatelliteTile(w http.ResponseWriter, r *http.Request) {
	z, okZ := parseTileCoord(r.PathValue("z"), satelliteMaxZ)
	if !okZ {
		http.NotFound(w, r)
		return
	}
	// Bitta o'qdagi kataklar soni — 2^z.
	limit := 1 << uint(z)
	x, okX := parseTileCoord(r.PathValue("x"), limit-1)
	// `.jpg`/`.png` qo'shimchasi bo'lishi mumkin — u faqat bezak.
	rawY := r.PathValue("y")
	if i := strings.IndexByte(rawY, '.'); i >= 0 {
		rawY = rawY[:i]
	}
	y, okY := parseTileCoord(rawY, limit-1)
	if !okX || !okY {
		http.NotFound(w, r)
		return
	}
	if !tileInUzbekistan(z, x, y) {
		// 404, 403 EMAS: "bu yerda tasvir yo'q" degani bizning
		// chegaramiz qayerdaligini oshkor qilmaydi va xarita
		// kutubxonasi uni odatdagi bo'sh katak sifatida qabul qiladi.
		http.NotFound(w, r)
		return
	}

	// Kesh — provayderga chiqishdan OLDIN. Tile o'zgarmaydigan
	// ma'lumot (sun'iy yo'ldosh qatlami yiliga bir marta yangilanadi),
	// shuning uchun muddat tekshirilmaydi: bor bo'lsa — shuniki.
	if body, ct, ok := s.satCache.get(z, x, y); ok {
		writeTile(w, body, ct, "HIT")
		return
	}

	upstream := tileURL(s.cfg.SatelliteURL, z, x, y)

	body, contentType, err := s.fetchSatelliteTile(r, upstream)
	if err != nil {
		if errors.Is(err, errSatelliteNotFound) {
			// Bu joyda bu darajada tasvir yo'q — kutilgan holat, 404.
			// `symbol`/MapLibre buni oddiy "bo'sh katak" deb qabul
			// qiladi va konsolni 502-oqimi bilan to'ldirmaydi.
			http.NotFound(w, r)
			return
		}
		// Haqiqiy sabab FAQAT logga: yuqori oqim manzili (va undagi
		// kalit) mijozga hech qachon ko'rinmasligi kerak.
		slog.Warn("sun'iy yo'ldosh tile olinmadi", "z", z, "err", err)
		http.Error(w, "tasvir olinmadi", http.StatusBadGateway)
		return
	}

	// Diskka yozish javobni KUTTIRMASLIGI kerak.
	go s.satCache.put(z, x, y, body)

	writeTile(w, body, contentType, "MISS")
}

func writeTile(w http.ResponseWriter, body []byte, contentType, cacheState string) {
	h := w.Header()
	h.Set("Content-Type", contentType)
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Cache-Control", "public, max-age=86400")
	// Diagnostika uchun: kesh ishlayotganini brauzer tarmoq
	// panelidan ko'rish mumkin bo'lsin. Hech qanday sir ochmaydi.
	h.Set("X-Tile-Cache", cacheState)
	_, _ = w.Write(body)
}

// tileInUzbekistan — tile kvadratchasi mamlakat to'rtburchagi bilan
// kesishadimi.
//
// KESISHISH tekshiriladi, ichiga tushishi emas: chegaradagi tile
// yarmi tashqarida bo'ladi va "ichida emas" desak, xarita chetida
// bo'sh chiziq paydo bo'lardi. Past zoomlarda (z0–z5) bitta tile
// mamlakatdan kattaroq — ular ham o'tadi, va bu to'g'ri: uzoqdan
// qaralganda butun mintaqa ko'rinishi kerak.
func tileInUzbekistan(z, x, y int) bool {
	n := math.Ldexp(1, z) // 2^z

	west := float64(x)/n*360 - 180
	east := float64(x+1)/n*360 - 180
	north := tileLat(float64(y), n)
	south := tileLat(float64(y+1), n)

	return west <= uzMaxLng && east >= uzMinLng &&
		south <= uzMaxLat && north >= uzMinLat
}

// tileLat — Web Mercator qatori uchun kenglik (gradus).
func tileLat(y, n float64) float64 {
	return math.Atan(math.Sinh(math.Pi*(1-2*y/n))) * 180 / math.Pi
}

func (s *Server) fetchSatelliteTile(
	r *http.Request, upstream string,
) ([]byte, string, error) {
	ctx, cancel := context.WithTimeout(r.Context(), satelliteTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, upstream, nil)
	if err != nil {
		// ⚠️ Bu xato ham to'liq manzilni (kalit bilan) matnga yozadi.
		return nil, "", errSatelliteBadURL
	}
	// Ayrim provayderlar User-Agent'siz so'rovni rad etadi.
	req.Header.Set("User-Agent", "OnDexMap/1.0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, "", redactURLError(err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusNotFound {
		return nil, "", errSatelliteNotFound
	}
	if resp.StatusCode != http.StatusOK {
		return nil, "", errSatelliteUpstream
	}

	ct := resp.Header.Get("Content-Type")
	// ⚠️ FAQAT rasm o'tkaziladi. Provayder xato holatida HTML yoki XML
	// qaytarishi mumkin va uni "tasvir" deb uzatsak, brauzer konsolida
	// tushunarsiz "could not be decoded" xatosi chiqardi.
	if !strings.HasPrefix(ct, "image/") {
		return nil, "", errSatelliteUpstream
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, satelliteMaxBytes))
	if err != nil {
		return nil, "", err
	}
	return body, ct, nil
}

// tileURL — shablondagi {z}/{x}/{y} ni to'ldiradi.
//
// Qiymatlar allaqachon son sifatida tekshirilgan, shuning uchun bu
// yerda qo'shimcha ekranlash shart emas.
func tileURL(tmpl string, z, x, y int) string {
	r := strings.NewReplacer(
		"{z}", strconv.Itoa(z),
		"{x}", strconv.Itoa(x),
		"{y}", strconv.Itoa(y),
	)
	return r.Replace(tmpl)
}

// parseTileCoord — manfiy bo'lmagan butun son, `max` dan oshmaydigan.
func parseTileCoord(raw string, max int) (int, bool) {
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || n < 0 || n > max {
		return 0, false
	}
	return n, true
}

// satelliteProxyPath — mijozga beriladigan manzil shabloni.
//
// Mutlaq qilib beriladi (`publicOrigin`), chunki sahifa boshqa portda
// turishi mumkin — nisbiy manzil o'shanda SAHIFA domeniga nisbatan
// hisoblanib, 404 bo'lardi (shriftlar bilan aynan shu bo'lgan).
func satelliteProxyPath(r *http.Request) string {
	return publicOrigin(r) + "/tiles/satellite/{z}/{x}/{y}"
}

// satelliteLimit — tile so'rovlari uchun alohida chegara.
//
// Umumiy chegara (5/s) bu yerda YARAMAYDI: bitta ekran ~20 ta tile
// so'raydi va oddiy foydalanuvchi darhol bloklanib qolardi. Ayni
// paytda chegara umuman bo'lmasa, bizning proksimiz orqali begona
// sayt provayderdagi kvotamizni yoqib yuborishi mumkin.
func (s *Server) satelliteLimit(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.satelliteLimiter.allow(s.clientIP(r)) {
			w.Header().Set("Retry-After", "1")
			http.Error(w, "tile so'rovlari juda tez-tez", http.StatusTooManyRequests)
			return
		}
		next(w, r)
	}
}
