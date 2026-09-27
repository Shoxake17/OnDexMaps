package httpapi

import (
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"ondexmap/internal/devplatform"
)

// ═══════════════════════════════════════════════════════════════════════
// SDK ↔ SERVER QULFI
//
// `sdk/js/src/limits.ts` da server chegaralari NUSXALANGAN: xizmat hududi,
// reverse hududi, tarif bo'yicha bbox tomoni va geocode limiti. Nusxa
// ataylab: SDK brauzerda ishlaydi va serverga bormasdan turib "bu so'rov
// baribir 400 bo'ladi" deb ayta olishi kerak — shunda kvota ham, kutish
// vaqti ham behuda ketmaydi.
//
// Lekin nusxa — xavf. Server chegarasi o'zgarsa va SDK eski qiymat bilan
// qolsa, ikkita jimgina nosozlik chiqadi:
//
//   - chegara KENGAYSA — SDK haqiqatda ishlaydigan so'rovni to'sib qo'yadi;
//   - chegara TORAYSA — SDK server rad etadigan so'rovni yuboradi.
//
// Ikkalasi ham SDK tarafdan ko'rinmaydi (u serverni bilmaydi) va Go
// tarafdan ham ko'rinmaydi (u SDK'ni bilmaydi). Shuning uchun bog'lovchi
// shu yerda: server qiymati o'zgarsa bu test yiqiladi va SDK'ni yangilash
// esdan chiqmaydi.
// ═══════════════════════════════════════════════════════════════════════

// sdkLimits — `sdk/js/src/limits.ts` faylini o'qiydi.
//
// TypeScript matn sifatida tahlil qilinadi: Go tarafga TS tahlilchisi
// qo'shish mumkin emas, va bu yerda kerak ham emas — biz faqat sonlarni
// solishtiramiz. Fayl topilmasa test YIQILADI (skip emas): SDK repoda
// bo'lishi shart, va uni ko'chirib yuborish qulfni jimgina uzib qo'yardi.
func sdkLimits(t *testing.T) string {
	t.Helper()
	// internal/httpapi → repo ildizi.
	yol := filepath.Join("..", "..", "sdk", "js", "src", "limits.ts")
	b, err := os.ReadFile(yol)
	if err != nil {
		t.Fatalf("SDK chegaralari o'qilmadi (%s): %v\n"+
			"Fayl ko'chirilgan bo'lsa shu testdagi yo'lni ham yangilang — "+
			"aks holda SDK va server jimgina ajralib qoladi.", yol, err)
	}
	return string(b)
}

// sdkSoni — `limits.ts` dagi `nom: 12.34` ko'rinishidagi sonni oladi.
func sdkSoni(t *testing.T, matn, nom string) float64 {
	t.Helper()
	re := regexp.MustCompile(`(?m)^\s*` + regexp.QuoteMeta(nom) + `\s*:\s*(-?\d+(?:\.\d+)?)`)
	m := re.FindStringSubmatch(matn)
	if m == nil {
		t.Fatalf("SDK chegaralarida `%s` topilmadi — nomi o'zgarganmi?", nom)
	}
	v, err := strconv.ParseFloat(m[1], 64)
	if err != nil {
		t.Fatalf("`%s` soni o'qilmadi: %v", nom, err)
	}
	return v
}

// TestSDKServiceAreaMatchesServer — SDK'dagi xizmat hududi
// `places.MinLng…MaxLat` bilan bir xilmi.
//
// Bu to'rtta son SDK'da `clampBBox` uchun ishlatiladi: ko'rinishning
// chekkasi hududdan chiqib ketsa u qirqiladi. Server hududi kengroq bo'lsa
// SDK haqiqiy ma'lumotni kesib tashlaydi.
func TestSDKServiceAreaMatchesServer(t *testing.T) {
	matn := sdkLimits(t)

	// Server qiymatlari `internal/places/validate.go` da; ular
	// `openapi_test.go` orqali kontraktga ham bog'langan.
	for _, c := range []struct {
		nom  string
		want float64
	}{
		{"minLng", 55.5},
		{"minLat", 37.0},
		{"maxLng", 73.5},
		{"maxLat", 45.8},
	} {
		// `SERVICE_AREA` blokidagi qiymat.
		blok := sdkBlok(t, matn, "SERVICE_AREA")
		if got := sdkSoni(t, blok, c.nom); got != c.want {
			t.Errorf("SDK SERVICE_AREA.%s = %v, serverda %v", c.nom, got, c.want)
		}
	}
}

// TestSDKReverseAreaMatchesServer — reverse/directions hududi
// `routes_geo.go` dagi qiymatlar bilan bir xilmi.
//
// Bu eng nozik nusxa: reverse butun mamlakatni qamramaydi, va SDK
// undan tashqarida so'rov YUBORMAYDI. Server hududi kengaytirilsa-yu
// SDK yangilanmasa, ishlaydigan hudud jimgina o'chib qolardi.
func TestSDKReverseAreaMatchesServer(t *testing.T) {
	blok := sdkBlok(t, sdkLimits(t), "REVERSE_AREA")

	for _, c := range []struct {
		nom  string
		want float64
	}{
		{"minLat", minLat},
		{"maxLat", maxLat},
		{"minLng", minLng},
		{"maxLng", maxLng},
	} {
		if got := sdkSoni(t, blok, c.nom); got != c.want {
			t.Errorf("SDK REVERSE_AREA.%s = %v, serverda %v", c.nom, got, c.want)
		}
	}
}

// TestSDKBBoxSpanMatchesPlans — SDK'dagi tarif chegaralari
// `devplatform.DefaultPlans()` bilan bir xilmi.
func TestSDKBBoxSpanMatchesPlans(t *testing.T) {
	blok := sdkBlok(t, sdkLimits(t), "BBOX_SPAN")
	p := devplatform.DefaultPlans()

	for _, c := range []struct {
		nom  string
		want float64
	}{
		{"free", p.Free.MaxBBoxSpan},
		{"paid", p.Paid.MaxBBoxSpan},
		{"ecosystem", p.Ecosystem.MaxBBoxSpan},
	} {
		if got := sdkSoni(t, blok, c.nom); got != c.want {
			t.Errorf("SDK BBOX_SPAN.%s = %v, serverda %v", c.nom, got, c.want)
		}
	}
}

// TestSDKGeocodeLimitMatchesServer — `GEOCODE_MAX_LIMIT` server
// tekshiruvidagi son bilan bir xilmi.
func TestSDKGeocodeLimitMatchesServer(t *testing.T) {
	matn := sdkLimits(t)
	re := regexp.MustCompile(`GEOCODE_MAX_LIMIT\s*=\s*(\d+)`)
	m := re.FindStringSubmatch(matn)
	if m == nil {
		t.Fatal("SDK'da GEOCODE_MAX_LIMIT topilmadi")
	}
	got, _ := strconv.Atoi(m[1])
	if got != v2GeocodeMaxLimit {
		t.Errorf("SDK GEOCODE_MAX_LIMIT = %d, serverda %d", got, v2GeocodeMaxLimit)
	}
}

// TestSDKBaseURLsArePublic — SDK'ning standart manzillari haqiqiy
// ommaviy domenlarmi.
//
// `localhost` yoki ichki manzil SDK'ga tushib qolsa, u nashr etilgach
// har bir integratorda jimgina ishlamay qo'yardi.
func TestSDKBaseURLsArePublic(t *testing.T) {
	matn := sdkLimits(t)

	for _, nom := range []string{"DEFAULT_API_BASE", "DEFAULT_STYLE_URL", "COPYRIGHT_URL"} {
		re := regexp.MustCompile(regexp.QuoteMeta(nom) + `\s*=\s*"([^"]+)"`)
		m := re.FindStringSubmatch(matn)
		if m == nil {
			t.Fatalf("SDK'da %s topilmadi", nom)
		}
		u := m[1]
		if !strings.HasPrefix(u, "https://") {
			t.Errorf("%s = %q — HTTPS bo'lishi shart", nom, u)
		}
		if strings.Contains(u, "localhost") || strings.Contains(u, "127.0.0.1") {
			t.Errorf("%s = %q — lokal manzil nashrga tushib qolgan", nom, u)
		}
		if !strings.Contains(u, "ondex.uz") {
			t.Errorf("%s = %q — begona domen", nom, u)
		}
	}
}

// sdkBlok — `export const NOM = { … }` ichidagi matnni ajratadi.
//
// Nomlar bloklarda takrorlanadi (`minLat` ham SERVICE_AREA da, ham
// REVERSE_AREA da bor), shuning uchun avval blok kesiladi.
func sdkBlok(t *testing.T, matn, nom string) string {
	t.Helper()
	i := strings.Index(matn, nom)
	if i < 0 {
		t.Fatalf("SDK'da `%s` bloki topilmadi", nom)
	}
	ochilish := strings.Index(matn[i:], "{")
	yopilish := strings.Index(matn[i:], "}")
	if ochilish < 0 || yopilish < ochilish {
		t.Fatalf("`%s` bloki noto'g'ri shaklda", nom)
	}
	return matn[i+ochilish : i+yopilish]
}
