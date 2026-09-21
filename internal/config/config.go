// Package config — muhit o'zgaruvchilarini o'qiydi va TEKSHIRADI.
//
// Asosiy tamoyil: FAIL-CLOSED. Sozlama noto'g'ri yoki yetishmayotgan
// bo'lsa, server ishga tushmaydi — jimgina zaif rejimda ishlashdan
// ko'ra yiqilgan ma'qul.
package config

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
)

// devEnvValue — dev rejimni yoqadigan YAGONA qiymat.
//
// XAVFSIZLIK (ChustApp'dan olingan dars): tekshiruv ATAYLAB aniq
// tenglik (`==`), teskarisi (`!= "production"`) EMAS. ChustApp'da avval
// teskari yozilgan edi va oqibati og'ir bo'lgan: bo'sh qiymat,
// `"Production"` (katta harf bilan), `"prod"` yoki oddiy imlo xatosi
// ham dev rejimni YOQIB YUBORARDI — ya'ni sozlash xatosi tizimni
// himoyasiz tomonga og'dirardi.
//
// Endi teskarisi: noma'lum qiymat = production = qat'iy rejim.
const devEnvValue = "development"

// Config — serverning butun sozlamasi. Faqat Load() orqali quriladi.
type Config struct {
	// DevMode — FAQAT `APP_ENV=development` bo'lganda true.
	DevMode bool
	// AppEnv — xom qiymat (loglash uchun).
	AppEnv string

	HTTPAddr string

	// DatabaseURL — HTTP API ishlatadigan ulanish. `ondexmap_app` roli,
	// FAQAT SELECT huquqi bilan.
	//
	// XAVFSIZLIK: API — internetga qaragan yagona jarayon. U baza EGASI
	// sifatida ulansa, bitta SQL inyeksiya `DROP TABLE` qila olardi.
	// Eng kam imtiyozli rol bilan esa API'ni to'liq egallab olgan
	// hujumchi ham ma'lumotni o'zgartira olmaydi.
	DatabaseURL string

	// SubmitDatabaseURL — foydalanuvchi ob'ekt yuborishi uchun ALOHIDA ulanish
	// (`ondexmap_submit` roli): faqat karantin jadvallariga INSERT.
	//
	// Bo'sh bo'lsa ob'ekt qabul qilish O'CHIQ (`POST /v1/places` → 503) —
	// fail-closed: yozish yo'li faqat ongli ravishda yoqiladi. `DATABASE_URL`
	// (faqat o'qish) bu yerda ATAYLAB ishlatilmaydi: o'qish hovuzi read-only
	// va yozuvni umuman qabul qilmaydi.
	SubmitDatabaseURL string

	// SubmitHintSecret — yuboruvchi IP'sini HMAC qilish siri. Xom IP bazaga
	// yozilmaydi; bu sir bo'lmasa hujumchi IP'larni oldindan hisoblab (rainbow)
	// xeshdan IP'ni tiklay olardi.
	SubmitHintSecret string

	// DatabaseURLMigrate — migratsiya va import uchun (baza egasi).
	// Bu ulanish HTTP serverida UMUMAN ishlatilmaydi — faqat lokal
	// vositalarda (`cmd/migrate`, `cmd/geoimport`).
	DatabaseURLMigrate string

	// ReadKey/AdminKey — API kalitlari.
	//
	// *Prev — rotatsiya sloti: yangi kalit joriy qilinganda eskisi shu
	// yerga ko'chiriladi va bir muddat ikkalasi ham qabul qilinadi.
	// Shu tufayli almashtirish paytida bitta ham so'rov rad etilmaydi.
	ReadKey      string
	ReadKeyPrev  string
	AdminKey     string
	AdminKeyPrev string

	AllowedOrigins []string
	TrustedProxies []string

	// MapboxToken — brauzerga `/v1/config` orqali beriladi.
	//
	// Bu SIR EMAS (Mapbox GL uni brauzerda talab qiladi), lekin u
	// frontend build'iga YOZILMAYDI. Sabab: build'dagi qiymatni
	// almashtirish uchun qayta deploy kerak, `.env` dagini esa
	// darhol — token fosh bo'lsa bu farq muhim.
	MapboxToken string

	// PlacesURL — joylar (restoran/kafe) ro'yxati manbasi.
	//
	// ┌─ BU URL'GA SERVER MUROJAAT QILMAYDI ──────────────────────────┐
	// Qiymat faqat `/v1/config` orqali BRAUZERGA beriladi va so'rovni
	// sahifaning o'zi yuboradi. "OnDexMap hech qachon ChustApp'ni
	// chaqirmaydi" invarianti (README §4.1) shu sababli buzilmaydi:
	// bog'lanish klient tomonda va faqat o'qish uchun.
	//
	// Nega joylar OnDexMap bazasida saqlanmaydi: README §2 —
	// restoran/kafe obyektlari ChustApp'ning `catalog` modulida
	// qoladi, OnDexMap ular bilan `place_id` orqali bog'lanadi,
	// NUSXA saqlamaydi. Nusxa saqlansa ikkita haqiqat manbasi
	// paydo bo'lardi.
	//
	// Bo'sh bo'lsa — sahifadagi joylar bo'limi ko'rsatilmaydi
	// (soxta ma'lumot chizilmaydi).
	// └───────────────────────────────────────────────────────────────┘
	PlacesURL string

	// WeatherURL — ob-havo manbasi (xarita sarlavhasidagi harorat).
	//
	// PlacesURL bilan bir xil qoida: so'rovni BRAUZER yuboradi, server
	// emas. Bo'sh bo'lsa harorat ko'rsatilmaydi — o'ylab chiqarilgan
	// yoki qotib qolgan raqam chizilmaydi.
	//
	// Standart manba Open-Meteo: kalit talab qilmaydi, shuning uchun
	// `.env` da sir saqlanmaydi.
	WeatherURL string

	// SatelliteURL — sun'iy yo'ldosh qatlami uchun raster tile manzili
	// (`{z}/{x}/{y}` shablonli).
	//
	// PlacesURL/WeatherURL bilan bir xil qoida: tile'ni BRAUZER
	// so'raydi. Bo'sh bo'lsa — tugma umuman ko'rsatilmaydi (fail
	// closed), sabab: ishlamaydigan tugma soxta imkoniyat va'da qiladi.
	//
	// ⚠️ LITSENZIYA — bu yerda ehtiyot bo'ling. Standart qiymat
	// (EOX Sentinel-2 cloudless) CC BY 4.0, ya'ni tijoratda ham bepul,
	// lekin aniqligi ~10 m: shahar ko'chasi ko'rinadi, alohida bino
	// ko'rinmaydi. Ko'chа darajasidagi tasvir (Esri, Bing, Maxar)
	// PULLIK litsenziya talab qiladi — uni sotiladigan mahsulotga
	// litsenziyasiz ulash huquqiy muammo tug'diradi.
	SatelliteURL string

	// SatelliteAttribution — sun'iy yo'ldosh manbasining krediti.
	// Manba almashsa shu ham almashishi SHART (litsenziya talabi).
	SatelliteAttribution string

	// SatelliteMaxZoom — provayderda HAQIQIY tasvir bor bo'lgan eng
	// katta zoom.
	//
	// ⚠️ BUNI TO'G'RI BERISH MUHIM. Provayder undan yuqori zoomda ham
	// javob berishi mumkin, lekin bo'sh rasm bilan: EOX s2cloudless
	// z12 da 22 KB, z16 da atigi 671 bayt (deyarli oq) qaytaradi.
	// Chegara berilsa, xarita kutubxonasi mavjud tile'ni CHO'ZADI —
	// xiralashadi, lekin bo'sh qolmaydi.
	SatelliteMaxZoom string

	// SatelliteCacheDir — olingan tile'lar saqlanadigan papka.
	//
	// Bo'sh bo'lsa kesh O'CHIQ va har so'rov provayderga chiqadi. Bu
	// ishlaydi, lekin bepul chegarani tez yeydi — jonli serverda
	// TO'LDIRILISHI kerak.
	//
	// ⚠️ TIZIM DISKIDA BO'LMASIN. Kesh vaqt o'tib gigabaytlarga
	// o'sadi; C: to'lib qolsa oqibati xaritadan ancha kengroq bo'ladi
	// (ChustApp'da C: to'lib WSL diski yo'qolgan tajribasi bor).
	// Alohida, keng diskda papka bering.
	SatelliteCacheDir string

	// SatelliteCacheMaxMB — keshning yuqori chegarasi (MB).
	//
	// Chegara oshsa eng ESKI fayllar o'chiriladi. Chegarasiz kesh —
	// diskni jimgina to'ldiradigan mina: hech kim uni kuzatmaydi va
	// nosozlik butunlay boshqa joyda (masalan baza yozolmay qolishi
	// bilan) ko'rinadi.
	SatelliteCacheMaxMB int

	// OSRMURL — o'z-o'zimiz ko'targan marshrutlash dvigateli (OSRM)
	// manzili, masalan `http://osrm:5000` (docker tarmog'i ichida) yoki
	// `http://127.0.0.1:5000` (lokal).
	//
	// ┌─ BU — TASHQI ODAM UCHUN EMAS ──────────────────────────────────┐
	// PlacesURL/WeatherURL'dan FARQLI O'LAROQ, bu manzilga SERVERNING
	// O'ZI murojaat qiladi (brauzer emas) — `/v1/config` orqali hech
	// qachon oshkor qilinmaydi. OSRM konteyneri hech qanday tashqi
	// portga chiqarilmasligi kerak: faqat shu server unga yeta olsin.
	// └───────────────────────────────────────────────────────────────┘
	//
	// Bo'sh bo'lsa — `/v1/route` 503 qaytaradi (soxta marshrut
	// chizilmaydi, xuddi kalitsiz Mapbox/ob-havo kabi).
	OSRMURL string

	// TilesURL — xarita ma'lumoti (`.pmtiles`) manzili.
	//
	// Bo'sh bo'lsa binarga kiritilgan Chust fayli ishlatiladi
	// (`/tiles/chust.pmtiles`). Kattaroq hudud (viloyat, butun
	// mamlakat) uchun fayl o'nlab/yuzlab MB bo'ladi va binarga
	// kiritilmaydi — o'shanda bu yerga R2 (yoki boshqa statik
	// hosting) manzili yoziladi, masalan:
	//   TILES_URL=https://tiles.ondex.uz/uzbekistan.pmtiles
	//
	// Talab: manba HTTP Range so'rovlarini qo'llab-quvvatlashi SHART
	// (R2 qo'llab-quvvatlaydi) — aks holda brauzer har tile uchun
	// butun faylni yuklab olishga urinadi.
	//
	// ⚠️ Bu manzilni BRAUZER chaqiradi, shuning uchun u CSP
	// `connect-src` ro'yxatiga ham qo'shiladi (routes_map.go).
	TilesURL string

	// BuildingsURL — bino konturlari (Microsoft GlobalMLBuildingFootprints,
	// ODbL bilan mos) uchun alohida `.pmtiles`.
	//
	// NEGA ALOHIDA MANBA: OSM'da O'zbekiston binolari deyarli
	// chizilmagan (butun Chust bo'yicha ~55 ta). Microsoft'ning
	// sun'iy yo'ldan ajratilgan ma'lumoti o'sha hududda 34 mingdan
	// ortiq bino beradi. Uni asosiy tile'ga qo'shib yuborish o'rniga
	// alohida fayl qilingan: asosiy xarita qayta qurilganda binolarni
	// qayta ishlash shart emas va aksincha.
	//
	// Bo'sh bo'lsa — bino qatlami uslubdan BUTUNLAY olib tashlanadi
	// (manzilsiz manba qolsa, xarita kutubxonasi xato beradi).
	BuildingsURL string
}

// Load — `.env` faylini (bo'lsa) o'qiydi, so'ng muhitdan sozlamani
// yig'adi va tekshiradi.
//
// Qaytgan xato — ishga tushishga to'sqinlik qiluvchi xato. Chaqiruvchi
// uni yutib yubormasligi, balki jarayonni to'xtatishi kerak.
func Load(envPath string) (*Config, error) {
	// `.env` MAVJUD muhit o'zgaruvchilarini BOSIB O'TMAYDI — shu tufayli
	// Docker/CI da berilgan qiymat har doim ustun turadi va lokal
	// `.env` tasodifan prod sozlamasini almashtirib qo'ymaydi.
	if err := loadDotEnv(envPath); err != nil {
		return nil, err
	}

	c := &Config{
		AppEnv:             strings.TrimSpace(strings.ToLower(os.Getenv("APP_ENV"))),
		HTTPAddr:           envOr("HTTP_ADDR", ":8090"),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		DatabaseURLMigrate: os.Getenv("DATABASE_URL_MIGRATE"),
		SubmitDatabaseURL:  os.Getenv("SUBMIT_DATABASE_URL"),
		SubmitHintSecret:   os.Getenv("SUBMIT_HINT_SECRET"),
		ReadKey:            os.Getenv("ONDEXMAP_READ_KEY"),
		ReadKeyPrev:        os.Getenv("ONDEXMAP_READ_KEY_PREV"),
		AdminKey:           os.Getenv("ONDEXMAP_ADMIN_KEY"),
		AdminKeyPrev:       os.Getenv("ONDEXMAP_ADMIN_KEY_PREV"),
		AllowedOrigins:     splitList(os.Getenv("ALLOWED_ORIGINS")),
		TrustedProxies:     splitList(os.Getenv("TRUSTED_PROXIES")),
		MapboxToken:        strings.TrimSpace(os.Getenv("MAPBOX_TOKEN")),
		PlacesURL:          strings.TrimSpace(os.Getenv("PLACES_URL")),
		WeatherURL:         strings.TrimSpace(os.Getenv("WEATHER_URL")),
		SatelliteURL:       strings.TrimSpace(os.Getenv("SATELLITE_URL")),
		SatelliteAttribution: strings.TrimSpace(
			os.Getenv("SATELLITE_ATTRIBUTION")),
		SatelliteMaxZoom: strings.TrimSpace(os.Getenv("SATELLITE_MAXZOOM")),
		SatelliteCacheDir: strings.TrimSpace(
			os.Getenv("SATELLITE_CACHE_DIR")),
		SatelliteCacheMaxMB: intOr("SATELLITE_CACHE_MAX_MB",
			defaultSatelliteCacheMB),
		OSRMURL:      strings.TrimSpace(os.Getenv("OSRM_URL")),
		TilesURL:     strings.TrimSpace(os.Getenv("TILES_URL")),
		BuildingsURL: strings.TrimSpace(os.Getenv("TILES_BUILDINGS_URL")),
	}
	c.DevMode = c.AppEnv == devEnvValue

	if err := c.validate(); err != nil {
		return nil, err
	}
	return c, nil
}

// minKeyLen — API kaliti uchun eng kam uzunlik.
//
// 32 belgi ≈ 24 bayt tasodifiylik. Bundan qisqasi qo'lda o'ylab
// topilgan ("test123") bo'lish ehtimoli yuqori va brute-force'ga
// ochiq. Bu chegara PRODUCTION'da majburiy.
const minKeyLen = 32

func (c *Config) validate() error {
	var problems []string

	// ── Har doim majburiy ────────────────────────────────────────────
	if !strings.HasPrefix(c.HTTPAddr, ":") && !strings.Contains(c.HTTPAddr, ":") {
		problems = append(problems, "HTTP_ADDR noto'g'ri (masalan: :8090)")
	}

	// ── Kalitlar bir-biriga TENG BO'LMASLIGI kerak ───────────────────
	// Read va admin kaliti bir xil bo'lsa, huquq ajratmasi mavjud
	// bo'lsa-da AMALDA yo'q: ChustApp'ga berilgan kalit yozish huquqini
	// ham beradi. Bu jimgina yuz beradigan va kech aniqlanadigan xato.
	if c.ReadKey != "" && c.ReadKey == c.AdminKey {
		problems = append(problems,
			"ONDEXMAP_READ_KEY va ONDEXMAP_ADMIN_KEY BIR XIL — read kaliti yozish huquqini ham berib qo'yadi")
	}

	// ── Yuborish ulanishi: MUSTAQIL rol bo'lishi shart ───────────────────
	// Egaviy yoki o'qish ulanishi bilan bir xil bo'lsa, "faqat karantinga
	// yozadi" kafolati yo'qoladi (0007_places.sql). Bu dev'da ham tekshiriladi:
	// noto'g'ri sozlash hech qaerda jimgina o'tib ketmasin.
	if c.SubmitDatabaseURL != "" {
		if c.SubmitDatabaseURL == c.DatabaseURLMigrate {
			problems = append(problems,
				"SUBMIT_DATABASE_URL va DATABASE_URL_MIGRATE BIR XIL — ommaviy yozish yo'li baza egasi huquqiga ega bo'lib qoladi")
		}
		if c.SubmitDatabaseURL == c.DatabaseURL {
			problems = append(problems,
				"SUBMIT_DATABASE_URL va DATABASE_URL BIR XIL — o'qish roli yozishga ishlatilmaydi")
		}
	}

	if c.DevMode {
		// Dev'da kalitlar ixtiyoriy, lekin berilgan bo'lsa jiddiy bo'lsin.
		if err := errorsFrom(problems); err != nil {
			return err
		}
		return nil
	}

	// ── FAQAT PRODUCTION uchun ───────────────────────────────────────
	if c.DatabaseURL == "" {
		problems = append(problems, "DATABASE_URL yo'q")
	} else if strings.Contains(c.DatabaseURL, "sslmode=disable") {
		// Prod'da baza bilan aloqa shifrlanmasa, tarmoqni tinglayotgan
		// odam so'rovlarni ham, parolni ham o'qiy oladi. Lokal
		// `127.0.0.1` da bu muhim emas, prod'da esa halokatli.
		problems = append(problems,
			"DATABASE_URL da sslmode=disable — production'da baza aloqasi shifrlanishi SHART")
	}
	// API baza EGASI sifatida ulanmasligi kerak: bu eng kam imtiyoz
	// tamoyilini bekor qiladi (0002_least_privilege.sql ga qarang).
	if c.DatabaseURL != "" && c.DatabaseURL == c.DatabaseURLMigrate {
		problems = append(problems,
			"DATABASE_URL va DATABASE_URL_MIGRATE BIR XIL — API baza egasi sifatida ulanadi va SQL inyeksiya DROP TABLE qila oladi")
	}
	if c.SubmitDatabaseURL != "" {
		if strings.Contains(c.SubmitDatabaseURL, "sslmode=disable") {
			problems = append(problems,
				"SUBMIT_DATABASE_URL da sslmode=disable — production'da baza aloqasi shifrlanishi SHART")
		}
		if len(c.SubmitHintSecret) < minKeyLen {
			problems = append(problems, fmt.Sprintf(
				"SUBMIT_HINT_SECRET yo'q yoki juda qisqa (kamida %d belgi): usiz IP xeshini tiklash oson", minKeyLen))
		}
	}
	if len(c.AllowedOrigins) == 0 {
		problems = append(problems,
			"ALLOWED_ORIGINS yo'q — bo'sh ro'yxat har qanday saytga so'rov yuborish imkonini berardi")
	}
	for _, k := range []struct {
		name, val string
	}{
		{"ONDEXMAP_READ_KEY", c.ReadKey},
		{"ONDEXMAP_ADMIN_KEY", c.AdminKey},
	} {
		switch {
		case k.val == "":
			problems = append(problems, k.name+" yo'q")
		case len(k.val) < minKeyLen:
			problems = append(problems,
				fmt.Sprintf("%s juda qisqa (%d belgi, kamida %d kerak)", k.name, len(k.val), minKeyLen))
		}
	}

	return errorsFrom(problems)
}

func errorsFrom(problems []string) error {
	if len(problems) == 0 {
		return nil
	}
	return errors.New("sozlama xatosi:\n  - " + strings.Join(problems, "\n  - "))
}

// loadDotEnv — `.env` ni qatorma-qator o'qiydi.
//
// ATAYLAB sodda: `KEY=VALUE`, `#` bilan boshlangan qator — izoh.
// Ko'p qatorli qiymat QO'LLAB-QUVVATLANMAYDI (ChustApp'da bu bilan
// bir marta yiqilingan: ko'p qatorli JSON kalit `.env` ga
// yopishtirilganda parser buzilgan — shuning uchun bunday qiymatlar
// alohida faylda saqlanadi).
//
// Fayl bo'lmasa — bu xato EMAS (Docker/CI da o'zgaruvchilar to'g'ridan
// muhitdan keladi).
func loadDotEnv(path string) error {
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	defer f.Close()

	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, val, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		val = strings.TrimSpace(val)
		// Qo'shtirnoqni olib tashlaymiz: KEY="qiymat" → qiymat
		if len(val) >= 2 {
			if (val[0] == '"' && val[len(val)-1] == '"') ||
				(val[0] == '\'' && val[len(val)-1] == '\'') {
				val = val[1 : len(val)-1]
			}
		}
		// MAVJUD qiymat ustun — pastdagi izohga qarang.
		if _, exists := os.LookupEnv(key); !exists {
			if err := os.Setenv(key, val); err != nil {
				return err
			}
		}
	}
	return sc.Err()
}

func envOr(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

// defaultSatelliteCacheMB — kesh chegarasi ko'rsatilmaganda.
//
// 4 GB ≈ 200 000 tile (o'rtacha 20 KB). Bu bitta shahar uchun ortig'i
// bilan yetadi va bir nechta shahar faol ishlatilsa ham disk bosimi
// nazorat ostida qoladi.
const defaultSatelliteCacheMB = 4096

// intOr — musbat butun son, aks holda standart qiymat.
//
// Noto'g'ri yozilgan qiymat (`"ko'p"`, `-1`, `0`) JIMGINA standartga
// tushadi, xato bermaydi: kesh chegarasi — ishga tushishga to'sqinlik
// qiladigan darajada muhim sozlama emas, lekin `0` bo'lib qolsa kesh
// butunlay o'chib qolardi va buni hech kim sezmasdi.
func intOr(key string, def int) int {
	v, err := strconv.Atoi(strings.TrimSpace(os.Getenv(key)))
	if err != nil || v <= 0 {
		return def
	}
	return v
}

func splitList(s string) []string {
	var out []string
	for _, part := range strings.Split(s, ",") {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	return out
}
