package places

import (
	"errors"
	"math"
	"strings"
	"unicode"
	"unicode/utf8"
)

// Chegaralar. Bazada ham mos CHECK cheklovlari bor (0007 migratsiyasi).
const (
	MaxName        = 120
	MaxDescription = 1000
	MaxHours       = 80
	MaxStreet      = 120
	MaxHouse       = 16
)

// O'zbekiston chegarasi — ob'ekt shundan tashqarida bo'lishi mumkin emas.
// Qidiruv va sun'iy yo'ldosh proksisidagi chegara bilan BIR XIL.
const (
	MinLng, MinLat = 55.5, 37.0
	MaxLng, MaxLat = 73.5, 45.8
)

// ValidationError — foydalanuvchiga ko'rsatilishi MUMKIN xato.
//
// Xabar bizning o'z matnimiz (kiruvchi qiymat unga qo'shilmaydi), shuning
// uchun uni javobga qo'yish xavfsiz: ichki tafsilot yoki hujumchi kiritgan
// matn aks etmaydi.
type ValidationError struct{ Msg string }

func (e *ValidationError) Error() string { return e.Msg }

func bad(msg string) error { return &ValidationError{Msg: msg} }

// Input — ommaviy shakl.
//
// `Website` — asalari (honeypot): odam ko'rmaydi va to'ldirmaydi, bot esa
// hamma maydonni to'ldiradi. Bo'sh bo'lmasa so'rov sun'iy deb hisoblanadi.
type Input struct {
	Kind        string   `json:"kind"`
	Lat         *float64 `json:"lat"`
	Lng         *float64 `json:"lng"`
	Name        string   `json:"name"`
	Category    string   `json:"category"`
	Description string   `json:"description"`
	Phone       string   `json:"phone"`
	Hours       string   `json:"hours"`
	Street      string   `json:"street"`
	House       string   `json:"house"`
	Website     string   `json:"website"`
}

// Clean — tekshirilgan va tozalangan ob'ekt. Bazaga FAQAT shu yoziladi.
type Clean struct {
	Kind        string
	Lat, Lng    float64
	Name        string
	Category    string
	Description string
	Phone       string
	Hours       string
	Street      string
	House       string
}

// Value — maydon qiymati (Field bo'yicha).
func (c *Clean) Value(f Field) string {
	switch f {
	case FName:
		return c.Name
	case FCategory:
		return c.Category
	case FDescription:
		return c.Description
	case FPhone:
		return c.Phone
	case FHours:
		return c.Hours
	case FStreet:
		return c.Street
	case FHouse:
		return c.House
	}
	return ""
}

func (in *Input) value(f Field) string {
	switch f {
	case FName:
		return in.Name
	case FCategory:
		return in.Category
	case FDescription:
		return in.Description
	case FPhone:
		return in.Phone
	case FHours:
		return in.Hours
	case FStreet:
		return in.Street
	case FHouse:
		return in.House
	}
	return ""
}

var fieldLabel = map[Field]string{
	FName: "nom", FCategory: "turkum", FDescription: "tavsif", FPhone: "telefon",
	FHours: "ish vaqti", FStreet: "ko'cha", FHouse: "uy raqami",
}

// IsBot — asalari to'ldirilgan (so'rov sun'iy).
func (in *Input) IsBot() bool { return strings.TrimSpace(in.Website) != "" }

// Validate — kiruvchi ma'lumotni tekshiradi va tozalaydi.
//
// Tartib: tur → koordinata → maydonlar. Har bir noto'g'ri qiymat darrov
// rad etiladi (yumshoq "tuzatib qabul qilish" YO'Q — istisno: bo'sh joylar
// va ko'rinmas belgilar tozalanadi, chunki ular xato emas, axlat).
func Validate(in Input) (Clean, error) {
	spec, ok := Spec(in.Kind)
	if !ok {
		return Clean{}, bad("ob'ekt turi noto'g'ri")
	}

	if in.Lat == nil || in.Lng == nil {
		return Clean{}, bad("joylashuv ko'rsatilmagan")
	}
	lat, lng := *in.Lat, *in.Lng
	// NaN va ±Inf uchun oddiy `<` `>` solishtirish `false` beradi va ularni
	// o'tkazib yuborardi — shuning uchun avval aniq tekshiriladi.
	if math.IsNaN(lat) || math.IsInf(lat, 0) || math.IsNaN(lng) || math.IsInf(lng, 0) {
		return Clean{}, bad("joylashuv noto'g'ri")
	}
	if lat < MinLat || lat > MaxLat || lng < MinLng || lng > MaxLng {
		return Clean{}, bad("joylashuv O'zbekiston hududidan tashqarida")
	}

	allowed := make(map[Field]bool, len(spec.Allowed))
	for _, f := range spec.Allowed {
		allowed[f] = true
	}
	for _, f := range []Field{FName, FCategory, FDescription, FPhone, FHours, FStreet, FHouse} {
		if !allowed[f] && strings.TrimSpace(in.value(f)) != "" {
			return Clean{}, bad("«" + spec.Label + "» uchun «" + fieldLabel[f] + "» maydoni yo'q")
		}
	}

	var err error
	c := Clean{Kind: spec.Key, Lat: round6(lat), Lng: round6(lng)}
	if c.Name, err = cleanLine(in.Name, MaxName, "nom"); err != nil {
		return Clean{}, err
	}
	if c.Description, err = cleanText(in.Description, MaxDescription, "tavsif"); err != nil {
		return Clean{}, err
	}
	if c.Street, err = cleanLine(in.Street, MaxStreet, "ko'cha"); err != nil {
		return Clean{}, err
	}
	if c.Hours, err = cleanLine(in.Hours, MaxHours, "ish vaqti"); err != nil {
		return Clean{}, err
	}
	if c.House, err = cleanHouse(in.House); err != nil {
		return Clean{}, err
	}
	if c.Phone, err = cleanPhone(in.Phone); err != nil {
		return Clean{}, err
	}
	if cat := strings.TrimSpace(in.Category); cat != "" {
		if !categorySet[cat] {
			return Clean{}, bad("turkum ro'yxatda yo'q")
		}
		c.Category = cat
	}

	for _, f := range spec.Required {
		if c.Value(f) == "" {
			return Clean{}, bad("«" + fieldLabel[f] + "» to'ldirilishi shart")
		}
	}
	if len(spec.AnyOf) > 0 {
		filled := false
		for _, f := range spec.AnyOf {
			if c.Value(f) != "" {
				filled = true
			}
		}
		if !filled {
			names := make([]string, len(spec.AnyOf))
			for i, f := range spec.AnyOf {
				names[i] = "«" + fieldLabel[f] + "»"
			}
			return Clean{}, bad(strings.Join(names, " yoki ") + " dan kamida bittasi to'ldirilishi shart")
		}
	}
	return c, nil
}

func round6(v float64) float64 { return math.Round(v*1e6) / 1e6 }

// strip — ko'rinmas va boshqaruv belgilarini olib tashlaydi.
//
// `unicode.Cf` (format belgilari) ichida o'ngdan-chapga yozuvni majburlovchi
// belgilar (U+202E — matnni teskari ko'rsatib "aldash" uchun) va nol kenglikli
// belgilar bor: ular moderator ko'rmaydigan yashirin matn yashirishga imkon
// beradi. `keepNewline` faqat tavsif uchun.
func strip(s string, keepNewline bool) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		switch {
		case r == '\n' && keepNewline:
			b.WriteRune('\n')
		case r == '\r':
			// \r\n → \n: alohida \r yozilmaydi.
		case r == '\t' || unicode.IsSpace(r):
			b.WriteRune(' ')
		case unicode.IsControl(r), unicode.Is(unicode.Cf, r), r == utf8.RuneError:
			// tashlanadi
		default:
			b.WriteRune(r)
		}
	}
	return b.String()
}

// collapseSpaces — ketma-ket bo'sh joylarni bittaga keltiradi.
func collapseSpaces(s string) string { return strings.Join(strings.Fields(s), " ") }

func cleanLine(s string, max int, label string) (string, error) {
	if !utf8.ValidString(s) {
		return "", bad("«" + label + "» da yaroqsiz belgi bor")
	}
	out := collapseSpaces(strip(s, false))
	if utf8.RuneCountInString(out) > max {
		return "", bad("«" + label + "» juda uzun")
	}
	return out, nil
}

// cleanText — ko'p qatorli matn: qator uzilishlari saqlanadi, lekin ketma-ket
// ikkitadan ortig'i qisqartiriladi (sahifani cho'zib yuborish uchun).
func cleanText(s string, max int, label string) (string, error) {
	if !utf8.ValidString(s) {
		return "", bad("«" + label + "» da yaroqsiz belgi bor")
	}
	lines := strings.Split(strip(s, true), "\n")
	out := make([]string, 0, len(lines))
	blank := 0
	for _, ln := range lines {
		ln = collapseSpaces(ln)
		if ln == "" {
			blank++
			if blank > 1 || len(out) == 0 {
				continue
			}
		} else {
			blank = 0
		}
		out = append(out, ln)
	}
	res := strings.TrimSpace(strings.Join(out, "\n"))
	if utf8.RuneCountInString(res) > max {
		return "", bad("«" + label + "» juda uzun")
	}
	return res, nil
}

func cleanHouse(s string) (string, error) {
	h, err := cleanLine(s, MaxHouse, "uy raqami")
	if err != nil || h == "" {
		return h, err
	}
	for _, r := range h {
		if !(unicode.IsLetter(r) || unicode.IsDigit(r) || r == '/' || r == '-' || r == ' ') {
			return "", bad("uy raqamida faqat harf, raqam, «/» va «-» bo'lishi mumkin")
		}
	}
	return h, nil
}

// cleanPhone — telefon: raqamlar, «+», bo'sh joy, qavs va chiziqcha; 7–15 raqam.
func cleanPhone(s string) (string, error) {
	p, err := cleanLine(s, 24, "telefon")
	if err != nil || p == "" {
		return p, err
	}
	digits := 0
	for _, r := range p {
		switch {
		case r >= '0' && r <= '9':
			digits++
		case r == '+' || r == ' ' || r == '-' || r == '(' || r == ')':
		default:
			return "", bad("telefon raqami noto'g'ri")
		}
	}
	if digits < 7 || digits > 15 {
		return "", bad("telefon raqami noto'g'ri")
	}
	return p, nil
}

// ErrTooManyPhotos — rasm soni chegaradan oshdi.
var ErrTooManyPhotos = errors.New("rasm soni chegaradan oshdi")
