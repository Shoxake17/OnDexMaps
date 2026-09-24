package config

import (
	"strings"
	"testing"
)

const okPepper = "pepper-0123456789abcdef0123456789abcdef"

func platEnv(extra map[string]string) map[string]string {
	m := prodEnv(map[string]string{
		"KEY_PEPPER":         okPepper,
		"METER_DATABASE_URL": "postgres://meter@db:5433/ondexmap?sslmode=require",
	})
	for k, v := range extra {
		m[k] = v
	}
	return m
}

func loadWith(t *testing.T, kv map[string]string) (*Config, error) {
	t.Helper()
	setEnv(t, kv)
	return Load("nonexistent.env")
}

func TestPlatformDisabledByDefaultNeedsNothing(t *testing.T) {
	c, err := loadWith(t, prodEnv(nil))
	if err != nil {
		t.Fatal(err)
	}
	if c.PlatformEnabled() || c.ConsoleEnabled() || c.V1FirstPartyOnly {
		t.Fatal("platforma standart holatda yoqilgan bo'lmasligi kerak")
	}
}

func TestPlatformRequiresStrongPepper(t *testing.T) {
	for _, pep := range []string{"", "short"} {
		_, err := loadWith(t, platEnv(map[string]string{"KEY_PEPPER": pep}))
		if err == nil || !strings.Contains(err.Error(), "KEY_PEPPER") {
			t.Errorf("pepper %q: kutilgan KEY_PEPPER xatosi, got %v", pep, err)
		}
	}
	if _, err := loadWith(t, platEnv(nil)); err != nil {
		t.Fatal(err)
	}
}

func TestPlatformRolesMustBeDistinct(t *testing.T) {
	same := map[string]map[string]string{
		"meter=app":     {"METER_DATABASE_URL": "postgres://app@db:5433/ondexmap?sslmode=require"},
		"meter=owner":   {"METER_DATABASE_URL": "postgres://owner@db:5433/ondexmap?sslmode=require"},
		"console=meter": {"CONSOLE_DATABASE_URL": "postgres://meter@db:5433/ondexmap?sslmode=require"},
	}
	for name, extra := range same {
		extra["CONSOLE_ORIGIN"] = "https://console.ondex.uz"
		extra["RESEND_API_KEY"], extra["MAIL_FROM"] = "re_x", "a@ondex.uz"
		if _, err := loadWith(t, platEnv(extra)); err == nil || !strings.Contains(err.Error(), "BIR XIL") {
			t.Errorf("%s: kutilgan 'BIR XIL', got %v", name, err)
		}
	}
}

func TestPlatformRejectsUnencryptedInProd(t *testing.T) {
	_, err := loadWith(t, platEnv(map[string]string{
		"METER_DATABASE_URL": "postgres://meter@db:5433/ondexmap?sslmode=disable"}))
	if err == nil || !strings.Contains(err.Error(), "sslmode=disable") {
		t.Fatalf("got %v", err)
	}
}

func TestConsoleProdRequirements(t *testing.T) {
	base := map[string]string{
		"CONSOLE_DATABASE_URL": "postgres://console@db:5433/ondexmap?sslmode=require",
		"CONSOLE_ORIGIN":       "https://console.ondex.uz",
		"RESEND_API_KEY":       "re_x", "MAIL_FROM": "OnDex <no-reply@ondex.uz>",
	}
	if _, err := loadWith(t, platEnv(base)); err != nil {
		t.Fatal(err)
	}
	for name, mod := range map[string]map[string]string{
		"origin yo'q":    {"CONSOLE_ORIGIN": ""},
		"origin http":    {"CONSOLE_ORIGIN": "http://console.ondex.uz"},
		"origin yo'lli":  {"CONSOLE_ORIGIN": "https://console.ondex.uz/x"},
		"resend yo'q":    {"RESEND_API_KEY": ""},
		"mail_from yo'q": {"MAIL_FROM": ""},
		"pepper yo'q":    {"KEY_PEPPER": ""},
	} {
		kv := map[string]string{}
		for k, v := range base {
			kv[k] = v
		}
		for k, v := range mod {
			kv[k] = v
		}
		if _, err := loadWith(t, platEnv(kv)); err == nil {
			t.Errorf("%s: xato kutilgan edi", name)
		}
	}
}

func TestFirstPartyOrigins(t *testing.T) {
	c, err := loadWith(t, platEnv(map[string]string{
		"FIRST_PARTY_ORIGINS": "https://maps.ondex.uz, https://ondex.uz", "V1_FIRST_PARTY_ONLY": "true"}))
	if err != nil || !c.V1FirstPartyOnly || len(c.FirstPartyOrigins) != 2 {
		t.Fatalf("%+v %v", c, err)
	}
	for _, bad := range []string{"https://*.ondex.uz", "http://evil.com", "https://ondex.uz/", "ondex.uz", "https://a.com/x"} {
		if _, err := loadWith(t, platEnv(map[string]string{"FIRST_PARTY_ORIGINS": bad})); err == nil {
			t.Errorf("%q qabul qilindi", bad)
		}
	}
	// bo'sh ro'yxat bilan qat'iy rejim — o'zingizni qulflab qo'yish
	if _, err := loadWith(t, platEnv(map[string]string{"V1_FIRST_PARTY_ONLY": "true"})); err == nil {
		t.Error("V1_FIRST_PARTY_ONLY bo'sh ro'yxat bilan qabul qilindi")
	}
}

func TestPlatformDevModeLenient(t *testing.T) {
	c, err := loadWith(t, map[string]string{
		"APP_ENV": "development", "KEY_PEPPER": okPepper,
		"METER_DATABASE_URL":   "postgres://meter@127.0.0.1:5433/x?sslmode=disable",
		"CONSOLE_DATABASE_URL": "postgres://console@127.0.0.1:5433/x?sslmode=disable",
		"CONSOLE_ORIGIN":       "http://localhost:3200",
	})
	if err != nil || !c.PlatformEnabled() || !c.ConsoleEnabled() {
		t.Fatalf("%v", err)
	}
}
