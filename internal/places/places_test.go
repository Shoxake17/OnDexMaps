package places

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"hash/crc32"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"math"
	"os"
	"regexp"
	"strings"
	"testing"
)

func f(v float64) *float64 { return &v }

func base(kind string) Input {
	return Input{Kind: kind, Lat: f(41.0), Lng: f(71.24)}
}

func TestEveryKindHasSpec(t *testing.T) {
	if len(Kinds) != 11 {
		t.Fatalf("Yandex ro'yxatida 11 tur bor, kodda %d", len(Kinds))
	}
	seen := map[string]bool{}
	for _, k := range Kinds {
		if seen[k.Key] {
			t.Errorf("tur takrorlangan: %s", k.Key)
		}
		seen[k.Key] = true
		if k.Label == "" {
			t.Errorf("%s: yorliq yo'q", k.Key)
		}
		for _, r := range k.Required {
			if !contains(k.Allowed, r) {
				t.Errorf("%s: shart maydon %q ruxsat etilganlar ichida yo'q", k.Key, r)
			}
		}
		for _, r := range k.AnyOf {
			if !contains(k.Allowed, r) {
				t.Errorf("%s: anyOf maydon %q ruxsat etilganlar ichida yo'q", k.Key, r)
			}
		}
	}
}

// Baza CHECK cheklovi va kod turlari ro'yxati BIR XIL bo'lishi shart: kodga tur
// qo'shilib migratsiya unutilsa, o'sha tur bazada "jimgina" rad etilardi.
func TestMigrationKindsMatchCode(t *testing.T) {
	raw, err := os.ReadFile("../../migrations/0007_places.sql")
	if err != nil {
		t.Fatal(err)
	}
	re := regexp.MustCompile(`(?s)kind\s+TEXT NOT NULL CHECK \(kind IN \((.*?)\)\)`)
	found := re.FindAllStringSubmatch(string(raw), -1)
	if len(found) != 2 { // places va place_submissions
		t.Fatalf("migratsiyada kind CHECK %d ta, 2 ta kutilgan", len(found))
	}
	want := map[string]bool{}
	for _, k := range KindKeys() {
		want[k] = true
	}
	for i, m := range found {
		got := map[string]bool{}
		for _, part := range strings.Split(m[1], ",") {
			got[strings.Trim(strings.TrimSpace(part), "'")] = true
		}
		if len(got) != len(want) {
			t.Errorf("%d-jadval: bazada %d tur, kodda %d", i, len(got), len(want))
		}
		for k := range want {
			if !got[k] {
				t.Errorf("%d-jadval: %q bazada yo'q", i, k)
			}
		}
	}
}

func contains(list []Field, x Field) bool {
	for _, v := range list {
		if v == x {
			return true
		}
	}
	return false
}

func TestValidateAccepts(t *testing.T) {
	cases := map[string]Input{
		"organization": {Kind: "organization", Lat: f(41), Lng: f(71.2), Name: "  Chust   Non ", Category: "Kafe", Phone: "+998 90 123-45-67", Hours: "09:00–18:00"},
		"address":      {Kind: "address", Lat: f(41), Lng: f(71.2), Street: "Navoiy ko'chasi", House: "12/A"},
		"entrance":     {Kind: "entrance", Lat: f(41), Lng: f(71.2), Description: "2-kirish"},
		"road":         {Kind: "road", Lat: f(41), Lng: f(71.2), Description: "Yo'l qazilgan"},
		"barrier":      {Kind: "barrier", Lat: f(41), Lng: f(71.2), Description: "Avtomatik shlagbaum"},
		"stop":         {Kind: "stop", Lat: f(41), Lng: f(71.2), Name: "Bozor bekati"},
		"parking":      {Kind: "parking", Lat: f(41), Lng: f(71.2), Name: "Pullik turargoh"},
		"crossing":     base("crossing"),
		"fence":        base("fence"),
		"gate":         base("gate"),
		"other":        {Kind: "other", Lat: f(41), Lng: f(71.2), Description: "Ko'l"},
	}
	for name, in := range cases {
		if _, err := Validate(in); err != nil {
			t.Errorf("%s: qabul qilinishi kerak edi: %v", name, err)
		}
	}
}

func TestValidateTrimsAndCollapses(t *testing.T) {
	c, err := Validate(Input{Kind: "organization", Lat: f(41), Lng: f(71.2),
		Name: "  Chust \t  Non\u200b\u202e  ", Category: "Kafe"})
	if err != nil {
		t.Fatal(err)
	}
	if c.Name != "Chust Non" {
		t.Errorf("nom tozalanmadi: %q", c.Name)
	}
}

func TestValidateRejects(t *testing.T) {
	long := strings.Repeat("a", 2000)
	cases := map[string]Input{
		"noma'lum tur":               {Kind: "zavod", Lat: f(41), Lng: f(71)},
		"bo'sh tur":                  {Lat: f(41), Lng: f(71)},
		"koordinata yo'q":            {Kind: "other", Description: "x"},
		"faqat lat":                  {Kind: "other", Lat: f(41), Description: "x"},
		"NaN":                        {Kind: "other", Lat: f(math.NaN()), Lng: f(71), Description: "x"},
		"Inf":                        {Kind: "other", Lat: f(41), Lng: f(math.Inf(1)), Description: "x"},
		"okeandan o'rtada":           {Kind: "other", Lat: f(0), Lng: f(0), Description: "x"},
		"O'zbekistondan tashqari":    {Kind: "other", Lat: f(55.7), Lng: f(37.6), Description: "x"},
		"tashkilotda nom yo'q":       {Kind: "organization", Lat: f(41), Lng: f(71), Category: "Kafe"},
		"tashkilotda turkum yo'q":    {Kind: "organization", Lat: f(41), Lng: f(71), Name: "X"},
		"turkum ro'yxatda yo'q":      {Kind: "organization", Lat: f(41), Lng: f(71), Name: "X", Category: "<script>"},
		"manzilda uy yo'q":           {Kind: "address", Lat: f(41), Lng: f(71), Street: "Navoiy"},
		"uyda taqiqlangan belgi":     {Kind: "address", Lat: f(41), Lng: f(71), House: "12<b>"},
		"boshqada tavsif yo'q":       {Kind: "other", Lat: f(41), Lng: f(71)},
		"tavsif juda uzun":           {Kind: "other", Lat: f(41), Lng: f(71), Description: long},
		"kirishda hech narsa yo'q":   {Kind: "entrance", Lat: f(41), Lng: f(71)},
		"turargohda hech narsa yo'q": {Kind: "parking", Lat: f(41), Lng: f(71)},
		"to'siqda nom (ruxsat yo'q)": {Kind: "fence", Lat: f(41), Lng: f(71), Name: "X"},
		"kalitkada telefon":          {Kind: "gate", Lat: f(41), Lng: f(71), Phone: "+998901234567"},
		"telefon harf":               {Kind: "organization", Lat: f(41), Lng: f(71), Name: "X", Category: "Kafe", Phone: "abc"},
		"telefon qisqa":              {Kind: "organization", Lat: f(41), Lng: f(71), Name: "X", Category: "Kafe", Phone: "123"},
		"yaroqsiz UTF-8":             {Kind: "other", Lat: f(41), Lng: f(71), Description: "a\xffb"},
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

func TestValidateErrorDoesNotEchoInput(t *testing.T) {
	// Xato matni foydalanuvchi kiritgan qiymatni QAYTARMASLIGI kerak.
	_, err := Validate(Input{Kind: "organization", Lat: f(41), Lng: f(71), Name: "X",
		Category: "<img src=x onerror=alert(1)>"})
	if err == nil {
		t.Fatal("rad etilishi kerak edi")
	}
	if strings.Contains(err.Error(), "<") || strings.Contains(err.Error(), "alert") {
		t.Errorf("xato kiruvchi matnni aks ettirdi: %q", err.Error())
	}
}

func TestDescriptionKeepsNewlinesButLimitsBlankRuns(t *testing.T) {
	c, err := Validate(Input{Kind: "other", Lat: f(41), Lng: f(71),
		Description: "\n\nBirinchi\r\n\r\n\r\n\r\nIkkinchi   qator\n"})
	if err != nil {
		t.Fatal(err)
	}
	if c.Description != "Birinchi\n\nIkkinchi qator" {
		t.Errorf("tavsif: %q", c.Description)
	}
}

func TestIsBot(t *testing.T) {
	in := base("crossing")
	if in.IsBot() {
		t.Error("bo'sh asalari bot emas")
	}
	in.Website = " http://spam.example "
	if !in.IsBot() {
		t.Error("to'ldirilgan asalari bot hisoblanishi kerak")
	}
}

// ── Rasm ─────────────────────────────────────────────────────────────

func makePNG(t *testing.T, w, h int, c color.Color) []byte {
	t.Helper()
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, c)
		}
	}
	var b bytes.Buffer
	if err := png.Encode(&b, img); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

func makeJPEG(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{uint8(x), uint8(y), 128, 255})
		}
	}
	var b bytes.Buffer
	if err := jpeg.Encode(&b, img, nil); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

func TestNormalizePhotoDownscalesAndReencodesToJPEG(t *testing.T) {
	out, err := NormalizePhoto(context.Background(), makeJPEG(t, 3200, 2400))
	if err != nil {
		t.Fatal(err)
	}
	cfg, format, err := image.DecodeConfig(bytes.NewReader(out))
	if err != nil {
		t.Fatal(err)
	}
	if format != "jpeg" {
		t.Errorf("format %q, jpeg kutilgan", format)
	}
	if cfg.Width != 1600 || cfg.Height != 1200 {
		t.Errorf("o'lcham %dx%d, 1600x1200 kutilgan", cfg.Width, cfg.Height)
	}
}

// Siqilmaydigan (tasodifiy shovqin) rasm ham baza chegarasidan (1.5 MB) oshmasligi
// kerak: aks holda foydalanuvchi "saqlab bo'lmadi" ko'rardi.
func TestNormalizePhotoNoiseStaysUnderStorageLimit(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 1600, 1600))
	seed := uint32(12345)
	for i := 0; i < len(img.Pix); i += 4 {
		seed = seed*1664525 + 1013904223
		img.Pix[i], img.Pix[i+1], img.Pix[i+2], img.Pix[i+3] = byte(seed>>8), byte(seed>>16), byte(seed>>24), 255
	}
	var src bytes.Buffer
	if err := jpeg.Encode(&src, img, &jpeg.Options{Quality: 95}); err != nil {
		t.Fatal(err)
	}
	out, err := NormalizePhoto(context.Background(), src.Bytes())
	if err != nil {
		t.Fatalf("shovqinli rasm rad etildi: %v", err)
	}
	if len(out) > MaxStoredPhotoBytes {
		t.Errorf("natija %d bayt, chegara %d", len(out), MaxStoredPhotoBytes)
	}
	if MaxStoredPhotoBytes >= 1_500_000 {
		t.Error("kod chegarasi bazadagi CHECK (1 500 000) dan kichik bo'lishi kerak")
	}
}

func TestNormalizePhotoKeepsSmallImageSize(t *testing.T) {
	out, err := NormalizePhoto(context.Background(), makeJPEG(t, 640, 480))
	if err != nil {
		t.Fatal(err)
	}
	cfg, _, _ := image.DecodeConfig(bytes.NewReader(out))
	if cfg.Width != 640 || cfg.Height != 480 {
		t.Errorf("kichik rasm o'zgargan: %dx%d", cfg.Width, cfg.Height)
	}
}

func TestNormalizePhotoFlattensTransparencyOnWhite(t *testing.T) {
	// To'liq shaffof PNG — oq JPEG bo'lishi kerak (qora emas).
	out, err := NormalizePhoto(context.Background(), makePNG(t, 100, 100, color.NRGBA{0, 0, 0, 0}))
	if err != nil {
		t.Fatal(err)
	}
	img, err := jpeg.Decode(bytes.NewReader(out))
	if err != nil {
		t.Fatal(err)
	}
	r, g, b, _ := img.At(50, 50).RGBA()
	if r>>8 < 250 || g>>8 < 250 || b>>8 < 250 {
		t.Errorf("shaffof piksel oq emas: %d %d %d", r>>8, g>>8, b>>8)
	}
}

func TestNormalizePhotoStripsMetadata(t *testing.T) {
	// JPEG'ga soxta EXIF (APP1) qo'shamiz — chiqishda bo'lmasligi kerak.
	src := makeJPEG(t, 200, 200)
	marker := []byte("GPS-SECRET-LOCATION")
	app1 := append([]byte{0xFF, 0xE1}, 0, 0)
	payload := append([]byte("Exif\x00\x00"), marker...)
	binary.BigEndian.PutUint16(app1[2:], uint16(len(payload)+2))
	app1 = append(app1, payload...)
	withExif := append(append(append([]byte{}, src[:2]...), app1...), src[2:]...)
	if !bytes.Contains(withExif, marker) {
		t.Fatal("test tayyorlanmadi")
	}
	out, err := NormalizePhoto(context.Background(), withExif)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(out, marker) {
		t.Error("EXIF metama'lumoti chiqishda qolgan")
	}
}

func TestNormalizePhotoRejects(t *testing.T) {
	ctx := context.Background()
	cases := map[string][]byte{
		"bo'sh":                   {},
		"matn":                    []byte("salom, men rasm emasman"),
		"html":                    []byte("<html><script>alert(1)</script></html>"),
		"gif":                     []byte("GIF89a\x01\x00\x01\x00\x00\x00\x00;"),
		"kesilgan jpeg":           makeJPEG(t, 300, 300)[:120],
		"juda kichik":             makePNG(t, 8, 8, color.White),
		"svg":                     []byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`),
		"jpeg sarlavhasi + axlat": append([]byte{0xFF, 0xD8, 0xFF, 0xE0}, bytes.Repeat([]byte{0x41}, 400)...),
	}
	for name, raw := range cases {
		if _, err := NormalizePhoto(ctx, raw); err == nil {
			t.Errorf("%s: rad etilishi kerak edi", name)
		}
	}
}

func TestNormalizePhotoRejectsDecompressionBomb(t *testing.T) {
	// Kichik fayl, lekin sarlavhada 30000×30000 piksel: dekodlanmasdan rad etilishi
	// kerak (dekodlansa ~3.6 GB xotira ketardi).
	raw := makePNG(t, 100, 100, color.White)
	// PNG IHDR: 8 bayt imzo + 4 uzunlik + 4 "IHDR" → kenglik/balandlik keyingi 8 bayt.
	// 5000×5000 = 25 MP: har tomoni chegaradan kichik, lekin MAYDONI MaxPixels'dan katta.
	binary.BigEndian.PutUint32(raw[16:], 5000)
	binary.BigEndian.PutUint32(raw[20:], 5000)
	// IHDR CRC (tur + 13 bayt ma'lumot) qayta hisoblanadi — aks holda dekoder
	// rasmni CRC xatosi tufayli rad etadi va test piksel chegarasini emas,
	// CRC'ni sinagan bo'lib qoladi.
	binary.BigEndian.PutUint32(raw[29:], crc32.ChecksumIEEE(raw[12:29]))
	cfg, _, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil {
		t.Fatalf("test tayyorlanmadi (sarlavha o'qilmadi): %v", err)
	}
	if cfg.Width*cfg.Height <= MaxPixels {
		t.Fatalf("test tayyorlanmadi: %d piksel chegaradan oshmaydi", cfg.Width*cfg.Height)
	}
	if _, err := NormalizePhoto(context.Background(), raw); err == nil {
		t.Fatal("bomba rad etilishi kerak edi")
	}
}

func TestNormalizePhotoRejectsTooLargeRaw(t *testing.T) {
	raw := make([]byte, MaxRawPhotoBytes+1)
	copy(raw, []byte{0xFF, 0xD8, 0xFF})
	if _, err := NormalizePhoto(context.Background(), raw); err == nil {
		t.Fatal("juda katta fayl rad etilishi kerak edi")
	}
}

func TestNormalizePhotoHonorsCancelledContextWhenBusy(t *testing.T) {
	// Semafor to'la va kontekst bekor — kutib qolmasdan qaytishi kerak.
	for i := 0; i < cap(decodeSem); i++ {
		decodeSem <- struct{}{}
	}
	defer func() {
		for i := 0; i < cap(decodeSem); i++ {
			<-decodeSem
		}
	}()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := NormalizePhoto(ctx, makeJPEG(t, 100, 100)); err == nil {
		t.Fatal("bekor qilingan kontekstda xato kutilgan")
	}
}
