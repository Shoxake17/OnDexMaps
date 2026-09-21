package httpapi

import (
	"bytes"
	"embed"
	"encoding/json"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"
)

//go:embed assets/chust.pmtiles
var chustPMTiles []byte

//go:embed assets/style-chust.json
var chustStyle []byte

// Shrift gliflari (PBF). MapLibre yozuvlarni CHIZA OLMAYDI agar bu
// fayllar bo'lmasa — ko'cha va mahalla nomlari umuman ko'rinmay
// qolardi. Ular ham o'z serverimizdan beriladi: tashqi shrift
// xizmatiga bog'lanish yana bir bepul bo'lmagan/yo'qolishi mumkin
// bo'lgan bog'liqlik bo'lardi.
//
//go:embed assets/fonts
var fontFS embed.FS

// rangePattern — MapLibre so'raydigan diapazon nomi (`0-255`).
// Qat'iy shakl: fayl yo'li so'rovdan yig'ilgani uchun bu — yo'ldan
// chiqishga (`../`) qarshi birinchi to'siq.
var rangePattern = regexp.MustCompile(`^[0-9]{1,5}-[0-9]{1,5}$`)

// fontStacks — ruxsat etilgan shriftlar.
//
// So'rovdagi nom shu ro'yxatda bo'lmasa — birinchi (standart) shriftga
// tushadi. Ya'ni noma'lum nom fayl tizimida qidirilmaydi.
var fontStacks = map[string]bool{
	"Noto Sans Regular": true,
	"Noto Sans Bold":    true,
}

const defaultFontStack = "Noto Sans Regular"

// assetVer — shrift va tile manzillariga qo'shiladigan versiya.
//
// NEGA KERAK: bu boyliklar uzoq keshlanadi (`max-age`), ya'ni ularning
// javob SARLAVHASI o'zgarganda (masalan CORS tuzatilganda) brauzer buni
// SEZMAYDI — kesh muddati tugaguncha eski nusxani ishlatadi va nosozlik
// "tuzatilmagandek" ko'rinib turaveradi. Versiyani oshirish manzilni
// o'zgartiradi, demak eski keshga umuman murojaat qilinmaydi.
//
// Sarlavha yoki shrift/tile mazmuni o'zgarganda BIR ga oshiring.
const assetVer = "2"

// pmtilesBuildTime — `http.ServeContent` `Last-Modified`/keshni shundan
// hisoblaydi. Binar qayta qurilganda o'zgaradi, bu yetarli — aniq
// fayl vaqtini kuzatish ortiqcha murakkablik bo'lardi.
var pmtilesBuildTime = time.Now()

// registerMapAssets — xarita BOYLIKLARI: uslub, shriftlar va zaxira
// tile fayli.
//
// ⚠️ HAR DOIM ro'yxatdan o'tadi, dev rejimdan QAT'I NAZAR.
//
// Ilgari bular `/map` prototip sahifasi bilan birga dev shartining
// ichida turardi. O'sha sahifa o'chirildi, shart esa qolganda
// production'da uslub va shriftlar 404 bo'lib, ommaviy sayt (Next.js)
// da xarita butunlay oq qolardi — nosozlik faqat jonli serverda
// ko'rinardi, chunki lokalda `APP_ENV=development` doim yoqiq.
func (s *Server) registerMapAssets(mux *http.ServeMux) {
	// /tiles/chust.pmtiles — o'zimiz generatsiya qilgan xarita
	// ma'lumoti (OpenStreetMap'dan, Planetiler bilan).
	//
	// `http.ServeContent` ATAYLAB ishlatiladi (oddiy `w.Write` emas):
	// u `Range` sarlavhasini o'zi qo'llab-quvvatlaydi (206 Partial
	// Content). MapLibre'dagi PMTiles plagini butun faylni EMAS,
	// faqat kerakli baytlarni so'raydi — ServeContent'siz har bir
	// tile so'rovi butun 693KB faylni yuklab olishga majbur qilardi.
	mux.HandleFunc("GET /tiles/chust.pmtiles", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Cache-Control", "public, max-age=3600")
		http.ServeContent(w, r, "chust.pmtiles", pmtilesBuildTime, bytes.NewReader(chustPMTiles))
	})

	// Xarita uslubi (MapLibre style JSON) — qaysi qatlam qanday
	// chizilishini belgilaydi. Alohida fayl, HTML ichida EMAS:
	// uslubni o'zgartirish uchun sahifaga tegish shart bo'lmasin.
	//
	// Ma'lumot manzili sozlamadan keladi (TILES_URL): kichik Chust
	// fayli binardan, kattaroq hudud esa R2'dan berilishi mumkin —
	// uslub fayliga tegmasdan.
	style := s.buildStyle()
	mux.HandleFunc("GET /tiles/style.json", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		// ⚠️ Shrift manzili MUTLAQ bo'lishi SHART.
		//
		// Uslubdagi nisbiy manzilni (`/fonts/...`) brauzer SAHIFA
		// domeniga nisbatan hisoblaydi, uslub olingan domenga emas.
		// Shu sabab uslub boshqa portdagi frontend (masalan Next.js,
		// :3100) tomonidan yuklanganda shriftlar 404 bo'lib,
		// xaritadagi barcha yozuvlar yo'qolardi. Bu — aynan
		// ro'y bergan nosozlik.
		_, _ = w.Write(bytes.ReplaceAll(style, []byte("__SELF__"), []byte(publicOrigin(r))))
	})

	// Shrift gliflari. MapLibre `{fontstack}/{range}.pbf` shaklida
	// so'raydi va bitta so'rovda vergul bilan bir nechta shrift
	// nomini yuborishi mumkin — birinchisini olamiz.
	mux.HandleFunc("GET /fonts/{stack}/{range}", serveGlyphs)
}

// buildStyle — uslub faylidagi manzil o'rinbosarlarini haqiqiy
// qiymatlarga almashtiradi.
//
// Bino manbasi sozlanmagan bo'lsa (`TILES_BUILDINGS_URL` bo'sh), u
// manba VA unga tayanadigan qatlamlar uslubdan BUTUNLAY olib
// tashlanadi. Bo'sh manzilli manbani qoldirish xarita kutubxonasida
// xatoga olib keladi va butun sahifa yuklanmay qolishi mumkin —
// fail-closed tamoyili: sozlanmagan narsa yo'q deb hisoblanadi.
func (s *Server) buildStyle() []byte {
	out := bytes.ReplaceAll(chustStyle, []byte("__TILES_URL__"), []byte(s.tilesURL()))

	if s.cfg.BuildingsURL != "" {
		return bytes.ReplaceAll(out, []byte("__BUILDINGS_URL__"), []byte(s.cfg.BuildingsURL))
	}

	const src = "ondex-buildings"
	var doc struct {
		Sources map[string]json.RawMessage `json:"sources"`
		Layers  []map[string]any           `json:"layers"`
		Rest    map[string]json.RawMessage `json:"-"`
	}
	var full map[string]json.RawMessage
	if err := json.Unmarshal(out, &full); err != nil {
		slog.Error("uslub fayli o'qilmadi", "err", err)
		return out
	}
	if err := json.Unmarshal(out, &doc); err != nil {
		slog.Error("uslub fayli o'qilmadi", "err", err)
		return out
	}

	delete(doc.Sources, src)
	kept := doc.Layers[:0]
	for _, l := range doc.Layers {
		if v, _ := l["source"].(string); v == src {
			continue
		}
		kept = append(kept, l)
	}

	srcJSON, err1 := json.Marshal(doc.Sources)
	layersJSON, err2 := json.Marshal(kept)
	if err1 != nil || err2 != nil {
		return out
	}
	full["sources"] = srcJSON
	full["layers"] = layersJSON

	res, err := json.Marshal(full)
	if err != nil {
		return out
	}
	return res
}

// publicOrigin — serverning tashqaridan ko'rinadigan manzili.
//
// Uslub fayliga shrift manzilini MUTLAQ qilib yozish uchun kerak.
// So'rovning o'zidan olinadi, shuning uchun lokal (`localhost:8090`),
// LAN va prod domenda ham to'g'ri ishlaydi — qo'shimcha sozlama
// talab qilmaydi.
//
// `X-Forwarded-Proto` ga ATAYLAB ishonilmaydi: uni istalgan klient
// yozib yuborishi mumkin. Proksi ortida ishlaganda sxemani
// `PUBLIC_BASE_URL` orqali aniq berish kerak.
func publicOrigin(r *http.Request) string {
	if v := strings.TrimSpace(os.Getenv("PUBLIC_BASE_URL")); v != "" {
		return strings.TrimRight(v, "/")
	}
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	return scheme + "://" + r.Host
}

// tilesURL — xarita ma'lumoti qayerdan olinishi.
//
// Sozlanmagan bo'lsa binardagi Chust fayli. Sozlangan bo'lsa (R2 yoki
// boshqa statik hosting) — o'sha manzil, va u CSP `connect-src` ga ham
// qo'shiladi, aks holda brauzer so'rovni bloklaydi va xarita JIMGINA
// bo'sh qolardi.
func (s *Server) tilesURL() string {
	if s.cfg.TilesURL != "" {
		// Tashqi manzilga TEGILMAYDI: u imzolangan bo'lishi mumkin va
		// qo'shimcha parametr imzoni buzadi.
		return s.cfg.TilesURL
	}
	return "/tiles/chust.pmtiles?v=" + assetVer
}

// serveGlyphs — shrift diapazonini beradi.
//
// XAVFSIZLIK: fayl yo'li SO'ROVDAN yig'iladi, shuning uchun ikkala
// bo'lak ham qat'iy tekshiriladi:
//   - shrift nomi ruxsat ro'yxatidan (aks holda standartga tushadi)
//   - diapazon `0-255` shaklida (regexp), ya'ni `../` yoki boshqa
//     yo'l belgilari umuman o'tmaydi
//
// Mavjud bo'lmagan, lekin SHAKLI TO'G'RI diapazonga bo'sh javob
// qaytariladi (404 emas): bo'sh PBF — yaroqli "gliflar yo'q" xabari.
// Aks holda brauzer konsoli har bir noma'lum belgi uchun xato
// ko'rsatardi va haqiqiy nosozlik shu shovqinda ko'rinmay ketardi.
func serveGlyphs(w http.ResponseWriter, r *http.Request) {
	rng := r.PathValue("range")
	rng = strings.TrimSuffix(rng, ".pbf")
	if !rangePattern.MatchString(rng) {
		http.NotFound(w, r)
		return
	}

	// MapLibre bir nechta shriftni vergul bilan so'rashi mumkin.
	stack := r.PathValue("stack")
	if i := strings.IndexByte(stack, ','); i >= 0 {
		stack = stack[:i]
	}
	stack = strings.TrimSpace(stack)
	if !fontStacks[stack] {
		stack = defaultFontStack
	}

	body, err := fs.ReadFile(fontFS, "assets/fonts/"+stack+"/"+rng+".pbf")
	if err != nil {
		// Shakli to'g'ri, lekin bizda yo'q — bo'sh (yaroqli) javob.
		body = nil
	}

	w.Header().Set("Content-Type", "application/x-protobuf")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	_, _ = w.Write(body)
}
