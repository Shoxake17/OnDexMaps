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

	HTTPAddr    string
	DatabaseURL string

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
		AppEnv:         strings.TrimSpace(strings.ToLower(os.Getenv("APP_ENV"))),
		HTTPAddr:       envOr("HTTP_ADDR", ":8090"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		ReadKey:        os.Getenv("ONDEXMAP_READ_KEY"),
		ReadKeyPrev:    os.Getenv("ONDEXMAP_READ_KEY_PREV"),
		AdminKey:       os.Getenv("ONDEXMAP_ADMIN_KEY"),
		AdminKeyPrev:   os.Getenv("ONDEXMAP_ADMIN_KEY_PREV"),
		AllowedOrigins: splitList(os.Getenv("ALLOWED_ORIGINS")),
		TrustedProxies: splitList(os.Getenv("TRUSTED_PROXIES")),
		MapboxToken:    strings.TrimSpace(os.Getenv("MAPBOX_TOKEN")),
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

func splitList(s string) []string {
	var out []string
	for _, part := range strings.Split(s, ",") {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	return out
}
