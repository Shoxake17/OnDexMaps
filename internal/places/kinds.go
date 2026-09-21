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
)

// KindSpec — bitta ob'ekt turining qoidasi.
type KindSpec struct {
	Key   string
	Label string
	// Allowed — shu turda BO'LISHI MUMKIN maydonlar. Ro'yxatda yo'q maydon
	// yuborilsa so'rov rad etiladi (jimgina tashlanmaydi): noto'g'ri mijoz
	// yoki qo'lda yasalgan so'rov darrov ko'rinsin.
	Allowed []Field
	// Required — har doim to'ldirilishi SHART maydonlar.
	Required []Field
	// AnyOf — bo'sh bo'lmagan ro'yxat bo'lsa, undan KAMIDA BITTASI
	// to'ldirilishi shart (masalan avtoturargoh: nom yoki tavsif).
	AnyOf []Field
}

// Kinds — turlar, yon paneldagi ro'yxat tartibida (Yandex «Добавить объект»).
var Kinds = []KindSpec{
	{
		Key: "organization", Label: "Tashkilot",
		Allowed:  []Field{FName, FCategory, FPhone, FHours, FStreet, FHouse, FDescription},
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
		AnyOf:   []Field{FName, FDescription},
	},
	{
		Key: "road", Label: "Yo'l",
		Allowed:  []Field{FName, FDescription},
		Required: []Field{FDescription},
	},
	{
		Key: "barrier", Label: "Shlagbaum",
		Allowed:  []Field{FDescription},
		Required: []Field{FDescription},
	},
	{
		Key: "stop", Label: "Transport bekati",
		Allowed:  []Field{FName, FDescription},
		Required: []Field{FName},
	},
	{
		Key: "parking", Label: "Avtoturargoh",
		Allowed: []Field{FName, FDescription},
		AnyOf:   []Field{FName, FDescription},
	},
	{
		Key: "crossing", Label: "Piyodalar o'tish joyi",
		Allowed: []Field{FDescription},
	},
	{
		Key: "fence", Label: "To'siq",
		Allowed: []Field{FDescription},
	},
	{
		Key: "gate", Label: "Kalitka",
		Allowed: []Field{FDescription},
	},
	{
		Key: "other", Label: "Boshqa ob'ekt",
		Allowed:  []Field{FDescription},
		Required: []Field{FDescription},
	},
}

var kindByKey = func() map[string]KindSpec {
	m := make(map[string]KindSpec, len(Kinds))
	for _, k := range Kinds {
		m[k.Key] = k
	}
	return m
}()

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
