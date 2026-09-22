package places

import (
	"errors"
	"math"
	"os"
	"strings"
	"testing"
)

// roadLine — Chust markazidagi ~200 m uzunlikdagi to'g'ri yo'l.
func roadLine() [][2]float64 {
	return [][2]float64{{71.2400, 41.0000}, {71.2412, 41.0009}, {71.2425, 41.0016}}
}

func roadInput(line [][2]float64) Input {
	return Input{Kind: "road", Line: line, Name: "Navoiy ko'chasi", Description: "Yo'l qazilgan"}
}

// Chiziq shaklidagi turlar: yo'l, piyodalar o'tish joyi va to'siq. Qolganlari nuqta.
var wantLineKinds = map[string]bool{"road": true, "crossing": true, "fence": true}

func TestLineKinds(t *testing.T) {
	for _, k := range Kinds {
		want := wantLineKinds[k.Key]
		if got := k.Shape() == GeomLine; got != want {
			t.Errorf("%s: chiziq=%v, kutilgan %v", k.Key, got, want)
		}
		if want {
			r := k.Line
			if r.MinMeters <= 0 || r.MaxMeters <= r.MinMeters || r.MaxPoints < 2 {
				t.Errorf("%s: chiziq qoidasi yaroqsiz: %+v", k.Key, r)
			}
		} else if k.Line != (LineRule{}) {
			t.Errorf("%s: nuqta turida chiziq qoidasi bo'lmasligi kerak", k.Key)
		}
	}
	if got := LineKindKeys(); len(got) != len(wantLineKinds) {
		t.Fatalf("chiziq turlari %v bo'lishi kerak: %v", wantLineKinds, got)
	}
	// Piyodalar o'tish joyi 10 m dan oshmaydi (talab).
	if s, _ := Spec("crossing"); s.Line.MaxMeters != 10 {
		t.Errorf("o'tish joyi eng ko'pi 10 m bo'lishi kerak: %v", s.Line.MaxMeters)
	}
}

// Eski nomlar (`MaxLinePoints` ...) yo'l qoidasining nusxasi — ular ajralib qolmasin.
func TestRoadConstantsMatchSpec(t *testing.T) {
	s, _ := Spec("road")
	if s.Line.MinMeters != MinLineMeters || s.Line.MaxMeters != MaxLineMeters || s.Line.MaxPoints != MaxLinePoints {
		t.Errorf("yo'l qoidasi doimiylardan farq qiladi: %+v", s.Line)
	}
}

// «Kalitka» → «Darvoza»: foydalanuvchiga ko'rinadigan nom o'zgardi, kalit (`gate`) emas.
func TestGateIsCalledDarvoza(t *testing.T) {
	s, ok := Spec("gate")
	if !ok || s.Label != "Darvoza" {
		t.Fatalf("`gate` turi «Darvoza» deb atalishi kerak: %+v", s)
	}
	for _, k := range Kinds {
		if strings.Contains(strings.ToLower(k.Label), "kalitka") {
			t.Errorf("%s: «Kalitka» nomi qolmasligi kerak", k.Key)
		}
	}
}

// Baza CHECK cheklovi (0010) va kod bir xil chiziq turlarini bilishi shart.
func TestMigrationLineKindsMatchCode(t *testing.T) {
	raw, err := os.ReadFile("../../migrations/0010_place_contacts_and_shapes.sql")
	if err != nil {
		t.Fatal(err)
	}
	sql := string(raw)
	for _, k := range LineKindKeys() {
		// Har chiziq turi ikkala jadval (places va place_submissions) uchun alohida cheklovda.
		if n := strings.Count(sql, "kind = '"+k+"'"); n != 2 {
			t.Errorf("0010 da %q cheklovi ikkala jadval uchun bo'lishi kerak, %d ta", k, n)
		}
	}
	// Nuqta turlari `NOT IN (...)` ro'yxatida chiziq turlarining HAMMASI bo'lishi shart.
	want := "NOT IN ('" + strings.Join(LineKindKeys(), "', '") + "')"
	if n := strings.Count(sql, want); n != 2 {
		t.Errorf("0010 dagi «nuqta» ro'yxati %s bo'lishi kerak (ikkala jadvalda), %d ta topildi", want, n)
	}
	// Kontakt ustunlari bazada ham faqat http(s) bilan cheklanadi (`javascript:` saqlanmasin).
	if n := strings.Count(sql, `~ '^https?://[^[:space:]]+$'`); n != 4 {
		t.Errorf("0010 da site/social uchun http(s) CHECK 4 ta bo'lishi kerak (2 jadval × 2 ustun), %d ta", n)
	}
}

func crossingInput(line [][2]float64) Input {
	return Input{Kind: "crossing", Line: line}
}

// ~7 m uzunlikdagi o'tish joyi (yo'lni kesib o'tadi).
func crossingLine() [][2]float64 {
	return [][2]float64{{71.240000, 41.000000}, {71.240080, 41.000030}}
}

func TestValidateCrossingLine(t *testing.T) {
	c, err := Validate(crossingInput(crossingLine()))
	if err != nil {
		t.Fatalf("7 m li o'tish joyi qabul qilinishi kerak: %v", err)
	}
	if !c.IsLine() {
		t.Fatal("o'tish joyi chiziq bo'lishi kerak")
	}
	if l := LineLengthMeters(c.Line); l < 2 || l > 10 {
		t.Fatalf("sinov chizig'i 2..10 m bo'lishi kerak, %.1f", l)
	}
}

func TestValidateCrossingRejects(t *testing.T) {
	cases := map[string]Input{
		// ~13 m: 10 m dan oshadi.
		"10 m dan uzun":           crossingInput([][2]float64{{71.24, 41.0}, {71.24015, 41.00003}}),
		"yo'l uzunligida (200 m)": crossingInput(roadLine()),
		"juda qisqa (~1 m)":       crossingInput([][2]float64{{71.24, 41.0}, {71.240012, 41.0}}),
		"bitta nuqta":             crossingInput([][2]float64{{71.24, 41.0}}),
		"nuqta bilan (lat/lng)":   {Kind: "crossing", Lat: f(41), Lng: f(71.2)},
		"5 nuqta":                 crossingInput([][2]float64{{71.24, 41.0}, {71.24002, 41.00001}, {71.24004, 41.00002}, {71.24006, 41.00003}, {71.24008, 41.00004}}),
		"telefon (ruxsat yo'q)":   {Kind: "crossing", Line: crossingLine(), Phone: "+998901234567"},
		"sayt (ruxsat yo'q)":      {Kind: "crossing", Line: crossingLine(), Site: "https://example.uz"},
	}
	for name, in := range cases {
		if _, err := Validate(in); err == nil {
			t.Errorf("%s: rad etilishi kerak edi", name)
		}
	}
}

func TestValidateFenceLine(t *testing.T) {
	if _, err := Validate(Input{Kind: "fence", Line: roadLine(), Description: "Temir panjara"}); err != nil {
		t.Fatalf("~200 m to'siq qabul qilinishi kerak: %v", err)
	}
	// Izohsiz ham (izoh ixtiyoriy).
	if _, err := Validate(Input{Kind: "fence", Line: roadLine()}); err != nil {
		t.Fatalf("izohsiz to'siq qabul qilinishi kerak: %v", err)
	}
	// Nuqta bilan yuborib bo'lmaydi: to'siq endi chiziq.
	if _, err := Validate(Input{Kind: "fence", Lat: f(41), Lng: f(71.2)}); err == nil {
		t.Error("to'siq nuqta bilan yuborilmasligi kerak")
	}
	// ~3 km — 2 km chegarasidan oshadi.
	if _, err := Validate(Input{Kind: "fence", Line: [][2]float64{{71.24, 41.0}, {71.28, 41.0}}}); err == nil {
		t.Error("2 km dan uzun to'siq rad etilishi kerak")
	}
}

func TestValidateRoadLine(t *testing.T) {
	c, err := Validate(roadInput(roadLine()))
	if err != nil {
		t.Fatal(err)
	}
	if !c.IsLine() || len(c.Line) != 3 {
		t.Fatalf("chiziq saqlanishi kerak: %+v", c.Line)
	}
	if c.Lat != 0 || c.Lng != 0 {
		t.Errorf("chiziq turida lat/lng ishlatilmaydi: %v,%v", c.Lat, c.Lng)
	}
	if c.Name != "Navoiy ko'chasi" {
		t.Errorf("nom: %q", c.Name)
	}
}

func TestRoadLineRoundedAndDeduped(t *testing.T) {
	c, err := Validate(roadInput([][2]float64{
		{71.2400001, 41.0000001},
		{71.24000012, 41.00000009}, // 6 xonaga yaxlitlangach avvalgisi bilan bir xil
		{71.2412, 41.0009},
		{71.2412, 41.0009}, // ketma-ket takror
		{71.2425, 41.0016},
	}))
	if err != nil {
		t.Fatal(err)
	}
	if len(c.Line) != 3 {
		t.Fatalf("takror nuqtalar olib tashlanishi kerak: %v", c.Line)
	}
	if c.Line[0] != [2]float64{71.24, 41.0} {
		t.Errorf("6 xonaga yaxlitlanishi kerak: %v", c.Line[0])
	}
}

func TestRoadLineKeepsLoops(t *testing.T) {
	// O'zini kesib o'tuvchi/yopiq yo'l (aylanma) — MUMKIN: yo'l poligon emas.
	loop := [][2]float64{{71.2400, 41.0000}, {71.2420, 41.0000}, {71.2420, 41.0020}, {71.2400, 41.0020}, {71.2400, 41.0000}}
	c, err := Validate(roadInput(loop))
	if err != nil {
		t.Fatalf("yopiq yo'l qabul qilinishi kerak: %v", err)
	}
	if len(c.Line) != 5 {
		t.Errorf("nuqtalar saqlanishi kerak: %d", len(c.Line))
	}
}

func TestValidateRoadLineRejects(t *testing.T) {
	many := make([][2]float64, MaxLinePoints+1)
	for i := range many {
		many[i] = [2]float64{71.0 + float64(i)*0.00001, 41.0}
	}
	// ~31 km: 71.0 dan 71.37 gacha (kenglik 41°).
	tooLong := [][2]float64{{71.0, 41.0}, {71.37, 41.0}}

	cases := map[string]Input{
		"chiziq yo'q":               roadInput(nil),
		"bitta nuqta":               roadInput([][2]float64{{71.24, 41.0}}),
		"ikki bir xil nuqta":        roadInput([][2]float64{{71.24, 41.0}, {71.24, 41.0}}),
		"juda qisqa (~1 m)":         roadInput([][2]float64{{71.24, 41.0}, {71.24001, 41.0}}),
		"juda uzun":                 roadInput(tooLong),
		"juda ko'p nuqta":           roadInput(many),
		"NaN":                       roadInput([][2]float64{{71.24, 41.0}, {math.NaN(), 41.001}}),
		"Inf":                       roadInput([][2]float64{{71.24, 41.0}, {71.25, math.Inf(1)}}),
		"O'zbekistondan tashqari":   roadInput([][2]float64{{37.6, 55.7}, {37.61, 55.71}}),
		"bir uchi tashqarida":       roadInput([][2]float64{{71.24, 41.0}, {90.0, 41.0}}),
		"lat/lng bilan (nuqta)":     {Kind: "road", Lat: f(41), Lng: f(71.2), Line: roadLine(), Description: "x"},
		"faqat lat bilan":           {Kind: "road", Lat: f(41), Line: roadLine(), Description: "x"},
		"noma'lum maydon (telefon)": {Kind: "road", Line: roadLine(), Description: "x", Phone: "+998901234567"},
	}
	for name, in := range cases {
		_, err := Validate(in)
		if err == nil {
			t.Errorf("%s: rad etilishi kerak edi", name)
			continue
		}
		var ve *ValidationError
		if !errors.As(err, &ve) {
			t.Errorf("%s: xato ValidationError emas: %T", name, err)
		}
	}
}

// Shakl turga mos bo'lishi shart: nuqta turiga chiziq, chiziq turiga nuqta rad.
func TestShapeMustMatchKind(t *testing.T) {
	if _, err := Validate(Input{Kind: "barrier", Line: roadLine(), Description: "x"}); err == nil {
		t.Error("nuqta turiga (shlagbaum) chiziq yuborib bo'lmaydi")
	}
	if _, err := Validate(Input{Kind: "barrier", Lat: f(41), Lng: f(71.2), Line: roadLine(), Description: "x"}); err == nil {
		t.Error("nuqta turida ham lat/lng, ham chiziq bo'lishi mumkin emas")
	}
	if _, err := Validate(Input{Kind: "road", Lat: f(41), Lng: f(71.2), Description: "x"}); err == nil {
		t.Error("yo'l nuqta bilan yuborilishi mumkin emas")
	}
}

func TestRoadErrorDoesNotEchoInput(t *testing.T) {
	_, err := Validate(roadInput([][2]float64{{71.24, 41.0}, {math.NaN(), 41.0}}))
	if err == nil {
		t.Fatal("rad etilishi kerak edi")
	}
	if strings.Contains(strings.ToLower(err.Error()), "nan") {
		t.Errorf("xato kiruvchi qiymatni aks ettirdi: %q", err.Error())
	}
}

func TestLineLengthMeters(t *testing.T) {
	// 0.001° kenglik ≈ 111.2 m.
	got := LineLengthMeters([][2]float64{{71.0, 41.0}, {71.0, 41.001}})
	if math.Abs(got-111.2) > 1 {
		t.Errorf("0.001° kenglik ~111.2 m bo'lishi kerak, keldi %.2f", got)
	}
	if LineLengthMeters(nil) != 0 || LineLengthMeters([][2]float64{{71, 41}}) != 0 {
		t.Error("bo'sh yoki bitta nuqtaning uzunligi 0")
	}
}
