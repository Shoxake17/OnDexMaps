// Package devplatform — dasturchilar platformasining YADROSI: API kalit, cheklovlar (Origin/IP),
// tarif rejalari, kalit tekshiruvi (Authorize), hisoblash (Meter).
//
// HTTP handler'larini BILMAYDI (faqat holat kodlari): shu sabab butun qaror mantig'i
// (kim ruxsat oladi, kim rad etiladi, nima hisoblanadi) server'siz, tez unit-testlanadi.
// HTTP qatlami (`internal/httpapi/routes_v2.go`) faqat sarlavhalarni o'qib Authorize'ni chaqiradi.
//
// Arxitektura shartnomasi: docs/developer-platform.md
package devplatform

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base32"
	"errors"
	"regexp"
	"strings"
)

// Kalit turlari.
const (
	KindServer  = "server"  // server-server; faqat X-API-Key sarlavhasi; IP cheklovi
	KindBrowser = "browser" // brauzer JS; ?key= yoki sarlavha; Origin cheklovi MAJBURIY
)

// API nomlari — ruxsat etilgan ro'yxat (allowlist). Bu ro'yxat migrations/0012 dagi
// `api_keys.apis` CHECK ro'yxati bilan BIR XIL bo'lishi shart (TestAPIsMatchMigration).
const (
	APIGeocode    = "geocode"
	APIReverse    = "reverse"
	APIDirections = "directions"
	APIPlaces     = "places"
)

// AllAPIs — mavjud API'lar (kalitda `apis` bo'sh bo'lsa hammasi emas, xato: kamida bittasi kerak).
var AllAPIs = []string{APIGeocode, APIReverse, APIDirections, APIPlaces}

// IsAPI — nom ruxsat etilgan API'mi.
func IsAPI(name string) bool {
	for _, a := range AllAPIs {
		if a == name {
			return true
		}
	}
	return false
}

// keyRandBytes — kalitdagi tasodifiylik: 32 bayt = 256 bit (brute-force imkonsiz).
const keyRandBytes = 32

// Kalit shakli: `omk_s_` yoki `omk_b_` + 52 belgi (base32, kichik harf, to'ldirishsiz).
// Format oldindan tekshiriladi: axlat kirish bazaga/HMAC'ga umuman yetmaydi.
var keyFormat = regexp.MustCompile(`^omk_([sb])_[a-z2-7]{52}$`)

var b32 = base32.StdEncoding.WithPadding(base32.NoPadding)

// GenerateKey — yangi kalit yaratadi. `secret` FAQAT BIR MARTA (yaratilganda) foydalanuvchiga
// ko'rsatiladi; bazaga faqat HashKey(...) va ko'rsatish uchun `prefix` yoziladi.
func GenerateKey(kind string) (secret, prefix string, err error) {
	var letter string
	switch kind {
	case KindServer:
		letter = "s"
	case KindBrowser:
		letter = "b"
	default:
		return "", "", errors.New("noma'lum kalit turi")
	}
	buf := make([]byte, keyRandBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", "", err
	}
	secret = "omk_" + letter + "_" + strings.ToLower(b32.EncodeToString(buf))
	return secret, DisplayPrefix(secret), nil
}

// DisplayPrefix — kalitni tanish uchun ko'rsatiladigan boshlanish (sirning atigi 8 belgisi).
func DisplayPrefix(secret string) string {
	const n = len("omk_s_") + 8
	if len(secret) < n {
		return secret
	}
	return secret[:n]
}

// KindOf — kalit shaklini tekshiradi va turini qaytaradi.
func KindOf(secret string) (kind string, ok bool) {
	m := keyFormat.FindStringSubmatch(secret)
	if m == nil {
		return "", false
	}
	if m[1] == "s" {
		return KindServer, true
	}
	return KindBrowser, true
}

// HashKey — kalitning bazada saqlanadigan xeshi: HMAC-SHA256(pepper, kalit).
//
// NEGA HMAC (oddiy SHA-256 emas): baza sizib chiqsa ham hujumchi pepper'siz kalitlarni
// oldindan hisoblab (rainbow) tekshira olmaydi. Kalit 256 bit tasodifiy, shuning uchun sekin
// parol xeshi (bcrypt/argon) KERAK EMAS — brute-force baribir mumkin emas, tezlik esa har
// so'rovda kerak.
func HashKey(pepper []byte, secret string) []byte {
	m := hmac.New(sha256.New, pepper)
	m.Write([]byte(secret))
	return m.Sum(nil)
}
