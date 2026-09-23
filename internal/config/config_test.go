package config

import (
	"strings"
	"testing"
)

// Muhit o'zgaruvchilarini test uchun tozalab, kerakligini o'rnatadi.
func setEnv(t *testing.T, kv map[string]string) {
	t.Helper()
	for _, k := range []string{
		"APP_ENV", "HTTP_ADDR", "DATABASE_URL", "DATABASE_URL_MIGRATE",
		"ONDEXMAP_READ_KEY", "ONDEXMAP_READ_KEY_PREV",
		"ONDEXMAP_ADMIN_KEY", "ONDEXMAP_ADMIN_KEY_PREV",
		"ALLOWED_ORIGINS", "TRUSTED_PROXIES", "MAPBOX_TOKEN",
		"SUBMIT_DATABASE_URL", "SUBMIT_HINT_SECRET",
		"R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET",
	} {
		t.Setenv(k, "")
	}
	for k, v := range kv {
		t.Setenv(k, v)
	}
}

const (
	okReadKey  = "read-kalit-0123456789abcdef0123456789"
	okAdminKey = "admin-kalit-0123456789abcdef0123456789"
)

// FAIL-CLOSED: faqat ANIQ "development" dev rejimni yoqadi.
//
// Bu ChustApp'da haqiqiy zaiflik bo'lgan: tekshiruv
// `APP_ENV != "production"` edi, ya'ni imlo xatosi yoki bo'sh qiymat
// dev rejimni yoqib yuborardi. Endi noma'lum qiymat production tomonga
// og'adi.
func TestDevModeIsFailClosed(t *testing.T) {
	cases := map[string]bool{
		"development": true,
		"Development": true, // Load() kichik harfga keltiradi
		"DEVELOPMENT": true,
		"production":  false,
		"Production":  false,
		"prod":        false,
		"dev":         false, // qisqartma YETARLI EMAS
		"devlopment":  false, // imlo xatosi
		"":            false, // sozlanmagan
		"  ":          false,
	}

	for env, wantDev := range cases {
		t.Run("APP_ENV="+env, func(t *testing.T) {
			setEnv(t, map[string]string{
				"APP_ENV":            env,
				"DATABASE_URL":       "postgres://x@127.0.0.1:5433/y",
				"ONDEXMAP_READ_KEY":  okReadKey,
				"ONDEXMAP_ADMIN_KEY": okAdminKey,
				"ALLOWED_ORIGINS":    "https://map-ondex.shoxpro.uz",
			})
			cfg, err := Load("yo'q-fayl.env")
			if err != nil {
				t.Fatalf("kutilmagan xato: %v", err)
			}
			if cfg.DevMode != wantDev {
				t.Errorf("APP_ENV=%q: DevMode kutilgan %v, olingan %v", env, wantDev, cfg.DevMode)
			}
		})
	}
}

// Production'da yetishmayotgan sozlama serverni TO'XTATADI.
func TestProductionRequiresSecrets(t *testing.T) {
	full := map[string]string{
		"APP_ENV":            "production",
		"DATABASE_URL":       "postgres://x@127.0.0.1:5433/y",
		"ONDEXMAP_READ_KEY":  okReadKey,
		"ONDEXMAP_ADMIN_KEY": okAdminKey,
		"ALLOWED_ORIGINS":    "https://map-ondex.shoxpro.uz",
	}

	for _, missing := range []string{
		"DATABASE_URL", "ONDEXMAP_READ_KEY", "ONDEXMAP_ADMIN_KEY", "ALLOWED_ORIGINS",
	} {
		t.Run(missing+" yo'q", func(t *testing.T) {
			env := map[string]string{}
			for k, v := range full {
				env[k] = v
			}
			delete(env, missing)
			setEnv(t, env)

			if _, err := Load("yo'q-fayl.env"); err == nil {
				t.Errorf("%s yo'q bo'lsa ham server ishga tushdi — fail-closed buzilgan", missing)
			} else if !strings.Contains(err.Error(), missing) {
				t.Errorf("xato xabarida %s eslatilmagan: %v", missing, err)
			}
		})
	}
}

// Bir xil read/admin kaliti — huquq ajratmasini bekor qiladi.
func TestSameKeyForReadAndAdminRejected(t *testing.T) {
	setEnv(t, map[string]string{
		"APP_ENV":            "production",
		"DATABASE_URL":       "postgres://x@127.0.0.1:5433/y",
		"ONDEXMAP_READ_KEY":  okReadKey,
		"ONDEXMAP_ADMIN_KEY": okReadKey, // AYNAN bir xil
		"ALLOWED_ORIGINS":    "https://map-ondex.shoxpro.uz",
	})
	_, err := Load("yo'q-fayl.env")
	if err == nil {
		t.Fatal("bir xil kalit qabul qilindi — ChustApp'ga berilgan read kaliti yozish huquqini ham berardi")
	}
	if !strings.Contains(err.Error(), "BIR XIL") {
		t.Errorf("xato sababi tushunarsiz: %v", err)
	}
}

// Production'da shifrlanmagan baza ulanishi rad etiladi.
func TestProductionRejectsUnencryptedDatabase(t *testing.T) {
	setEnv(t, map[string]string{
		"APP_ENV":            "production",
		"DATABASE_URL":       "postgres://app@db:5433/ondexmap?sslmode=disable",
		"ONDEXMAP_READ_KEY":  okReadKey,
		"ONDEXMAP_ADMIN_KEY": okAdminKey,
		"ALLOWED_ORIGINS":    "https://map-ondex.shoxpro.uz",
	})
	_, err := Load("yo'q-fayl.env")
	if err == nil {
		t.Fatal("sslmode=disable production'da qabul qilindi")
	}
	if !strings.Contains(err.Error(), "sslmode") {
		t.Errorf("xato sababi tushunarsiz: %v", err)
	}
}

// API baza EGASI sifatida ulanmasligi kerak — eng kam imtiyoz.
func TestProductionRejectsOwnerConnectionForAPI(t *testing.T) {
	const ownerURL = "postgres://ondexmap@db:5433/ondexmap?sslmode=require"
	setEnv(t, map[string]string{
		"APP_ENV":              "production",
		"DATABASE_URL":         ownerURL,
		"DATABASE_URL_MIGRATE": ownerURL, // AYNAN bir xil
		"ONDEXMAP_READ_KEY":    okReadKey,
		"ONDEXMAP_ADMIN_KEY":   okAdminKey,
		"ALLOWED_ORIGINS":      "https://map-ondex.shoxpro.uz",
	})
	_, err := Load("yo'q-fayl.env")
	if err == nil {
		t.Fatal("API baza egasi sifatida ulanishi qabul qilindi — SQL inyeksiya DROP TABLE qila olardi")
	}
	if !strings.Contains(err.Error(), "BIR XIL") {
		t.Errorf("xato sababi tushunarsiz: %v", err)
	}
}

// Qisqa kalit production'da rad etiladi.
func TestShortKeyRejectedInProduction(t *testing.T) {
	setEnv(t, map[string]string{
		"APP_ENV":            "production",
		"DATABASE_URL":       "postgres://x@127.0.0.1:5433/y",
		"ONDEXMAP_READ_KEY":  "qisqa",
		"ONDEXMAP_ADMIN_KEY": okAdminKey,
		"ALLOWED_ORIGINS":    "https://map-ondex.shoxpro.uz",
	})
	if _, err := Load("yo'q-fayl.env"); err == nil {
		t.Error("5 belgilik kalit production'da qabul qilindi")
	}
}

// Dev'da kalitsiz ishga tushish MUMKIN — lokal ishlash uchun.
func TestDevModeAllowsMissingSecrets(t *testing.T) {
	setEnv(t, map[string]string{"APP_ENV": "development"})
	cfg, err := Load("yo'q-fayl.env")
	if err != nil {
		t.Fatalf("dev rejimda kalitsiz ishga tushishi kerak edi: %v", err)
	}
	if !cfg.DevMode {
		t.Error("DevMode yoqilmagan")
	}
	if cfg.HTTPAddr != ":8090" {
		t.Errorf("standart port kutilgan :8090, olingan %q", cfg.HTTPAddr)
	}
	// Yuborish ulanishi berilmagan — ob'ekt qabul qilish O'CHIQ (fail-closed).
	if cfg.SubmitDatabaseURL != "" {
		t.Error("SUBMIT_DATABASE_URL o'zi to'ldirilib qolgan")
	}
}

// ── Foydalanuvchi ob'ektlari: yozish yo'li MUSTAQIL rol bo'lishi shart ─────

func prodEnv(extra map[string]string) map[string]string {
	m := map[string]string{
		"APP_ENV":              "production",
		"DATABASE_URL":         "postgres://app@db:5433/ondexmap?sslmode=require",
		"DATABASE_URL_MIGRATE": "postgres://owner@db:5433/ondexmap?sslmode=require",
		"ONDEXMAP_READ_KEY":    okReadKey,
		"ONDEXMAP_ADMIN_KEY":   okAdminKey,
		"ALLOWED_ORIGINS":      "https://map-ondex.shoxpro.uz",
	}
	for k, v := range extra {
		m[k] = v
	}
	return m
}

func TestSubmitURLMustNotBeOwnerOrReadRole(t *testing.T) {
	for name, kv := range map[string]map[string]string{
		"egasi bilan bir xil": {"SUBMIT_DATABASE_URL": "postgres://owner@db:5433/ondexmap?sslmode=require"},
		"o'qish roli bilan":   {"SUBMIT_DATABASE_URL": "postgres://app@db:5433/ondexmap?sslmode=require"},
	} {
		kv["SUBMIT_HINT_SECRET"] = strings.Repeat("s", 40)
		setEnv(t, prodEnv(kv))
		_, err := Load("yo'q-fayl.env")
		if err == nil {
			t.Errorf("%s: qabul qilindi — ommaviy yozish yo'li kerakli darajadan ortiq huquq oladi", name)
		} else if !strings.Contains(err.Error(), "BIR XIL") {
			t.Errorf("%s: xato sababi tushunarsiz: %v", name, err)
		}
	}
}

// Dev'da ham tekshiriladi: noto'g'ri sozlash hech qaerda jimgina o'tib ketmasin.
func TestSubmitURLSameAsOwnerRejectedEvenInDev(t *testing.T) {
	const owner = "postgres://owner@127.0.0.1:5433/ondexmap"
	setEnv(t, map[string]string{
		"APP_ENV":              "development",
		"DATABASE_URL_MIGRATE": owner,
		"SUBMIT_DATABASE_URL":  owner,
	})
	if _, err := Load("yo'q-fayl.env"); err == nil {
		t.Fatal("dev'da ham SUBMIT_DATABASE_URL == egasi rad etilishi kerak edi")
	}
}

func TestProductionSubmitRequiresTLSAndStrongSecret(t *testing.T) {
	good := "postgres://submit@db:5433/ondexmap?sslmode=require"
	secret := strings.Repeat("s", 40)

	setEnv(t, prodEnv(map[string]string{"SUBMIT_DATABASE_URL": good, "SUBMIT_HINT_SECRET": secret}))
	if _, err := Load("yo'q-fayl.env"); err != nil {
		t.Fatalf("to'g'ri sozlama rad etildi: %v", err)
	}

	setEnv(t, prodEnv(map[string]string{
		"SUBMIT_DATABASE_URL": "postgres://submit@db:5433/ondexmap?sslmode=disable", "SUBMIT_HINT_SECRET": secret}))
	if _, err := Load("yo'q-fayl.env"); err == nil {
		t.Error("sslmode=disable prod'da qabul qilindi")
	}

	setEnv(t, prodEnv(map[string]string{"SUBMIT_DATABASE_URL": good}))
	if _, err := Load("yo'q-fayl.env"); err == nil {
		t.Error("SUBMIT_HINT_SECRET'siz prod'da qabul qilindi (IP xeshini tiklash oson bo'lardi)")
	}

	setEnv(t, prodEnv(map[string]string{"SUBMIT_DATABASE_URL": good, "SUBMIT_HINT_SECRET": "qisqa"}))
	if _, err := Load("yo'q-fayl.env"); err == nil {
		t.Error("qisqa SUBMIT_HINT_SECRET qabul qilindi")
	}
}

// Yuborish ulanishi berilmasa — hech qanday qo'shimcha talab yo'q (qabul qilish o'chiq).
func TestProductionWithoutSubmitNeedsNoSubmitSettings(t *testing.T) {
	setEnv(t, prodEnv(nil))
	if _, err := Load("yo'q-fayl.env"); err != nil {
		t.Fatalf("yuborishsiz prod sozlamasi rad etildi: %v", err)
	}
}

// ── R2: hammasi yoki hech qaysi biri ────────────────────────────────────

func TestR2AllOrNothing(t *testing.T) {
	full := map[string]string{
		"R2_ACCOUNT_ID":        "acc",
		"R2_ACCESS_KEY_ID":     "key",
		"R2_SECRET_ACCESS_KEY": "secret",
		"R2_BUCKET":            "ondexmaps",
	}
	// To'liq sozlama — qabul qilinadi.
	setEnv(t, prodEnv(full))
	cfg, err := Load("yo'q-fayl.env")
	if err != nil {
		t.Fatalf("to'liq R2 sozlamasi rad etildi: %v", err)
	}
	if !cfg.R2Configured() {
		t.Error("R2Configured() false qaytardi, to'liq sozlama berilgan edi")
	}

	// Hech biri berilmagan — qabul qilinadi (R2 shunchaki o'chiq).
	setEnv(t, prodEnv(nil))
	cfg, err = Load("yo'q-fayl.env")
	if err != nil {
		t.Fatalf("R2'siz sozlama rad etildi: %v", err)
	}
	if cfg.R2Configured() {
		t.Error("R2Configured() true qaytardi, hech narsa berilmagan edi")
	}

	// Yarim to'ldirilgan — HAR BIR yetishmayotgan maydon uchun rad etiladi.
	for missing := range full {
		t.Run(missing+" yo'q", func(t *testing.T) {
			env := map[string]string{}
			for k, v := range full {
				env[k] = v
			}
			delete(env, missing)
			setEnv(t, prodEnv(env))
			if _, err := Load("yo'q-fayl.env"); err == nil {
				t.Errorf("%s yo'q bo'lsa ham R2 sozlamasi qabul qilindi — yarim to'ldirilgan holat", missing)
			} else if !strings.Contains(err.Error(), "R2") {
				t.Errorf("xato xabarida R2 eslatilmagan: %v", err)
			}
		})
	}
}

// Dev'da ham tekshiriladi (SUBMIT_DATABASE_URL bilan bir xil mantiq).
func TestR2AllOrNothingCheckedInDevToo(t *testing.T) {
	setEnv(t, map[string]string{
		"APP_ENV":       "development",
		"R2_ACCOUNT_ID": "acc",
		"R2_BUCKET":     "ondexmaps",
		// R2_ACCESS_KEY_ID va R2_SECRET_ACCESS_KEY YETISHMAYDI.
	})
	if _, err := Load("yo'q-fayl.env"); err == nil {
		t.Fatal("dev'da ham yarim to'ldirilgan R2 rad etilishi kerak edi")
	}
}
