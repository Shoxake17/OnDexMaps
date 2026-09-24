package devplatform

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

func TestGenerateKeyFormatAndUniqueness(t *testing.T) {
	seen := map[string]bool{}
	for _, kind := range []string{KindServer, KindBrowser} {
		for i := 0; i < 200; i++ {
			secret, prefix, err := GenerateKey(kind)
			if err != nil {
				t.Fatal(err)
			}
			got, ok := KindOf(secret)
			if !ok || got != kind {
				t.Fatalf("KindOf(%q) = %q,%v; kutilgan %q", secret, got, ok, kind)
			}
			if !strings.HasPrefix(secret, prefix) || len(prefix) != len("omk_s_")+8 {
				t.Fatalf("prefiks noto'g'ri: %q / %q", prefix, secret)
			}
			if seen[secret] {
				t.Fatal("kalit takrorlandi (tasodifiylik buzuq)")
			}
			seen[secret] = true
		}
	}
	if _, _, err := GenerateKey("boshqa"); err == nil {
		t.Error("noma'lum tur qabul qilindi")
	}
}

func TestKindOfRejectsMalformed(t *testing.T) {
	good := mustKey(KindServer)
	bad := []string{
		"", "omk_", "omk_s_", "omk_x_" + good[6:], good + "a", good[:len(good)-1],
		strings.ToUpper(good), "OMK_s_" + good[6:], " " + good, good + "\n",
		"omk_s_" + strings.Repeat("1", 52), // '1' base32 alifbosida yo'q
	}
	for _, s := range bad {
		if _, ok := KindOf(s); ok {
			t.Errorf("KindOf(%q) qabul qildi", s)
		}
	}
}

func TestHashKeyDependsOnPepperAndIsStable(t *testing.T) {
	k := mustKey(KindServer)
	a, b := HashKey(testPepper, k), HashKey(testPepper, k)
	if string(a) != string(b) || len(a) != 32 {
		t.Fatal("xesh barqaror emas yoki uzunligi 32 emas")
	}
	if string(a) == string(HashKey([]byte("boshqa-pepper-0123456789abcdef012345"), k)) {
		t.Fatal("pepper xeshga ta'sir qilmayapti")
	}
	if strings.Contains(string(a), k) {
		t.Fatal("xeshda kalit ochiq")
	}
}

// AllAPIs migrations/0012 dagi CHECK ro'yxati bilan BIR XIL bo'lishi shart.
func TestAPIsMatchMigration(t *testing.T) {
	raw, err := os.ReadFile("../../migrations/0012_developer_platform.sql")
	if err != nil {
		t.Fatal(err)
	}
	re := regexp.MustCompile(`apis <@ ARRAY\[([^\]]+)\]`)
	m := re.FindSubmatch(raw)
	if m == nil {
		t.Fatal("migratsiyada apis CHECK ro'yxati topilmadi")
	}
	var fromSQL []string
	for _, p := range strings.Split(string(m[1]), ",") {
		fromSQL = append(fromSQL, strings.Trim(strings.TrimSpace(p), "'"))
	}
	if len(fromSQL) != len(AllAPIs) {
		t.Fatalf("SQL: %v, kod: %v", fromSQL, AllAPIs)
	}
	for _, a := range AllAPIs {
		found := false
		for _, s := range fromSQL {
			if s == a {
				found = true
			}
		}
		if !found || !IsAPI(a) {
			t.Errorf("%q migratsiyada yo'q", a)
		}
	}
	// usage jadvali ro'yxati ham shu bo'lishi kerak
	re2 := regexp.MustCompile(`api IN \(([^)]+)\)`)
	m2 := re2.FindSubmatch(raw)
	if m2 == nil {
		t.Fatal("api_usage_daily CHECK topilmadi")
	}
	for _, a := range AllAPIs {
		if !strings.Contains(string(m2[1]), "'"+a+"'") {
			t.Errorf("%q api_usage_daily CHECK'ida yo'q", a)
		}
	}
	if IsAPI("photos") || IsAPI("") || IsAPI("submit") {
		t.Error("IsAPI ruxsat etilmagan nomni qabul qildi")
	}
}
