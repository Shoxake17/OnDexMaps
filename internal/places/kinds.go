// Package places — foydalanuvchi xaritaga qo'shadigan ob'ektlar (tashkilot,
// manzil, bekat va h.k.): turlar, tekshiruv va rasmni tozalash.
//
// NEGA ALOHIDA PAKET: bu qoidalar uch joyda kerak — ommaviy API (qabul
// qilish), admin vositasi (tahrirlab tasdiqlash) va baza qatlami. Har
// joyda o'z nusxasi bo'lsa, ular vaqt o'tib bir-biridan farq qilib
// qoladi va "API qabul qildi, admin rad etdi" kabi nomuvofiqlik chiqadi.
// Paket ATAYLAB hech qaysi ichki paketga bog'lanmaydi (aylanma import
// bo'lmasligi uchun).
//
// ┌─ MODERATSIYA ──────────────────────────────────────────────────────┐
// Bu paket faqat MA'LUMOTNI TEKSHIRADI. Yuborilgan ob'ekt xaritaga
// TO'G'RIDAN-TO'G'RI tushmaydi: u karantinga (`place_submissions`)
// yoziladi va admin tasdiqlagach hamma uchun ko'rinadi
// (`migrations/0007_places.sql`).
// └────────────────────────────────────────────────────────────────────┘
package places

// Field — ob'ektning matnli maydoni.
type Field string

const (
	FName        Field = "name"
	FCategory    Field = "category"
	FDescription Field = "description"
	FPhone       Field = "phone"
	FHours       Field = "hours"
	FStreet      Field = "street"
	FHouse       Field = "house"
	// FSite — tashkilotning veb-sayti (http/https URL).
	FSite Field = "site"
	// FSocial — ijtimoiy tarmoqdagi rasmiy akkaunt manzili (URL; faqat ma'lum tarmoqlar).
	FSocial Field = "social"
)

// Geometry — ob'ekt xaritada qanday shaklda: bitta nuqta yoki chiziq.
type Geometry string

const (
	// GeomPoint — bitta nuqta (standart). Bino kirishi, shlagbaum, bekat va h.k.
	GeomPoint Geometry = "point"
	// GeomLine — chiziq (kamida 2 nuqta). Yo'l: foydalanuvchi uni xaritada CHIZADI.
	GeomLine Geometry = "line"
)

// LineRule — chiziq shaklidagi turning chegaralari. Har tur o'zinikini talab
// qiladi: yo'l kilometrlab bo'lishi mumkin, piyodalar o'tish joyi esa 10 m dan
// oshmaydi. Forma bularni `/v1/places/meta` dan oladi (ikkinchi nusxa yo'q),
// bazadagi CHECK esa (0010) biroz KENGROQ — sferoid hisobi farqi uchun.
type LineRule struct {
	// MinMeters, MaxMeters — chiziq uzunligi (metr).
	MinMeters, MaxMeters float64
	// MaxPoints — eng ko'p nuqta.
	MaxPoints int
}

// KindSpec — bitta ob'ekt turining qoidasi.
type KindSpec struct {
	Key   string
	Label string
	// Geometry — shakl. Bo'sh qiymat = `GeomPoint`. Tur o'z shaklida bo'lishi
	// SHART: nuqta turiga chiziq yoki chiziq turiga nuqta yuborilsa rad
	// etiladi (bazadagi CHECK ham shuni majburlaydi, 0009/0010 migratsiyalari).
	Geometry Geometry
	// Line — chiziq turining chegaralari. Faqat `GeomLine` uchun (aks holda nol).
	Line LineRule
	// Allowed — shu turda BO'LISHI MUMKIN maydonlar. Ro'yxatda yo'q maydon
	// yuborilsa so'rov rad etiladi (jimgina tashlanmaydi): noto'g'ri mijoz
	// yoki qo'lda yasalgan so'rov darrov ko'rinsin.
	Allowed []Field
	// Required — har doim to'ldirilishi SHART maydonlar.
	Required []Field
	// AnyOf — bo'sh bo'lmagan ro'yxat bo'lsa, undan KAMIDA BITTASI
	// to'ldirilishi shart. Hozir hech bir turda ishlatilmaydi (mexanizm
	// kelajak uchun saqlangan; tavsif bu ro'yxatga KIRMAYDI).
	AnyOf []Field
}

// Kinds — turlar, yon paneldagi ro'yxat tartibida (Yandex «Добавить объект»).
//
// ┌─ TAVSIF (IZOH) HECH QAYSI TURDA MAJBURIY EMAS ─────────────────────┐
// Foydalanuvchi talabi (2026-09-21): izoh ixtiyoriy. Shuning uchun `Required`
// va `AnyOf` da FDescription BO'LMAYDI (`TestDescriptionIsNeverRequired` buni
// qulflaydi). Majburiy qolganlari — turning o'z ma'nosidagi maydonlar:
// tashkilotda nom va turkum, manzilda uy raqami, bekatda nom.
// └────────────────────────────────────────────────────────────────────┘
var Kinds = []KindSpec{
	{
		Key: "organization", Label: "Tashkilot",
		Allowed:  []Field{FName, FCategory, FPhone, FSite, FSocial, FHours, FStreet, FHouse, FDescription},
		Required: []Field{FName, FCategory},
	},
	{
		Key: "address", Label: "Manzil",
		Allowed:  []Field{FStreet, FHouse, FDescription},
		Required: []Field{FHouse},
	},
	{
		Key: "entrance", Label: "Bino kirishi",
		Allowed: []Field{FName, FDescription},
	},
	{
		Key: "road", Label: "Yo'l", Geometry: GeomLine,
		Line:    LineRule{MinMeters: 5, MaxMeters: 30000, MaxPoints: 500},
		Allowed: []Field{FName, FDescription},
	},
	{
		Key: "barrier", Label: "Shlagbaum",
		Allowed: []Field{FDescription},
	},
	{
		Key: "stop", Label: "Transport bekati",
		Allowed:  []Field{FName, FDescription},
		Required: []Field{FName},
	},
	{
		Key: "parking", Label: "Avtoturargoh",
		Allowed: []Field{FName, FDescription},
	},
	{
		// Piyodalar o'tish joyi — yo'lni KESIB o'tadigan qisqa chiziq: xaritada
		// zebra (yo'l-yo'l) bo'lib chiziladi. 10 m dan oshmaydi: bundan uzun
		// «o'tish joyi» aslida yo'l yoki xato chizilgan chiziq.
		Key: "crossing", Label: "Piyodalar o'tish joyi", Geometry: GeomLine,
		Line:    LineRule{MinMeters: 2, MaxMeters: 10, MaxPoints: 4},
		Allowed: []Field{FDescription},
	},
	{
		// To'siq — chiziq (devor, panjara): xaritada chiziladi, o'rtasida belgi turadi.
		Key: "fence", Label: "To'siq", Geometry: GeomLine,
		Line:    LineRule{MinMeters: 1, MaxMeters: 2000, MaxPoints: 200},
		Allowed: []Field{FDescription},
	},
	{
		// Kalit `gate` O'ZGARMAYDI (bazada va mijozlarda shu bilan saqlangan);
		// faqat foydalanuvchiga ko'rinadigan nom «Kalitka» → «Darvoza».
		Key: "gate", Label: "Darvoza",
		Allowed: []Field{FDescription},
	},
	{
		Key: "other", Label: "Boshqa ob'ekt",
		Allowed: []Field{FDescription},
	},
}

var kindByKey = func() map[string]KindSpec {
	m := make(map[string]KindSpec, len(Kinds))
	for _, k := range Kinds {
		m[k.Key] = k
	}
	return m
}()

// Shape — turning shakli (`Geometry` bo'sh bo'lsa nuqta).
func (k KindSpec) Shape() Geometry {
	if k.Geometry == "" {
		return GeomPoint
	}
	return k.Geometry
}

// LineKindKeys — chiziq shaklidagi turlar (bazadagi CHECK bilan moslikni
// tekshirish uchun).
func LineKindKeys() []string {
	var out []string
	for _, k := range Kinds {
		if k.Shape() == GeomLine {
			out = append(out, k.Key)
		}
	}
	return out
}

// Spec — tur qoidasi; noma'lum tur uchun `false`.
func Spec(key string) (KindSpec, bool) {
	s, ok := kindByKey[key]
	return s, ok
}

// KindLabel — turning o'zbekcha nomi (noma'lum tur uchun umumiy «Joy»).
func KindLabel(key string) string {
	if s, ok := kindByKey[key]; ok {
		return s.Label
	}
	return "Joy"
}

// KindKeys — turlar kaliti (baza CHECK cheklovi va testlar uchun).
func KindKeys() []string {
	out := make([]string, len(Kinds))
	for i, k := range Kinds {
		out[i] = k.Key
	}
	return out
}

// Categories — «Tashkilot» turkumlari. Erkin matn EMAS, yopiq ro'yxat:
// turkum bo'yicha qidirish va belgilash uchun barqaror qiymat kerak.
var Categories = []string{
	"Oziq-ovqat do'koni",
	"Restoran",
	"Kafe",
	"Choyxona",
	"Dorixona",
	"Shifoxona / Klinika",
	"Bank / Bankomat",
	"Maktab",
	"Bolalar bog'chasi",
	"Kollej / Universitet",
	"Masjid",
	"Yoqilg'i shoxobchasi",
	"Avtoservis",
	"Go'zallik saloni",
	"Kiyim do'koni",
	"Bozor",
	"Mehmonxona",
	"Idora / Ofis",
	"Davlat muassasasi",
	"Ta'mirlash va xizmatlar",
	"Boshqa",
}

var categorySet = func() map[string]bool {
	m := make(map[string]bool, len(Categories))
	for _, c := range Categories {
		m[c] = true
	}
	return m
}()
