package config

import (
	"strings"
	"testing"
)

// Muhit o'zgaruvchilarini test uchun tozalab, kerakligini o'rnatadi.
func setEnv(t *testing.T, kv map[string]string) {
	t.Helper()
	for _, k := range []string{
		"APP_ENV", "HTTP_ADDR", "DATABASE_URL",
		"ONDEXMAP_READ_KEY", "ONDEXMAP_READ_KEY_PREV",
		"ONDEXMAP_ADMIN_KEY", "ONDEXMAP_ADMIN_KEY_PREV",
		"ALLOWED_ORIGINS", "TRUSTED_PROXIES", "MAPBOX_TOKEN",
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
}
