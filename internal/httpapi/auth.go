package httpapi

import (
	"crypto/sha256"
	"crypto/subtle"
	"net/http"
)

// Scope — so'rov uchun talab qilinadigan huquq darajasi.
type Scope int

const (
	// ScopePublic — kalit talab qilinmaydi (ommaviy o'qish).
	//
	// Xarita sayti anonim ishlaydi: login talab qiladigan xaritani
	// hech kim ishlatmaydi. Himoya bu yerda kalit emas, rate limit.
	ScopePublic Scope = iota
	// ScopeRead — ChustApp'ning server-server o'qishi.
	ScopeRead
	// ScopeAdmin — yozish: import, moderatsiya.
	ScopeAdmin
)

// authenticator — kalitlarni SHA-256 xesh ko'rinishida saqlaydi.
//
// NEGA XESH, oddiy matn emas:
//
//  1. Solishtirish har doim QAT'IY 32 baytda bo'ladi. To'g'ridan-to'g'ri
//     matn solishtirilganda `subtle.ConstantTimeCompare` uzunliklar
//     har xil bo'lsa DARHOL 0 qaytaradi — ya'ni kalitning UZUNLIGI
//     vaqt orqali sizib chiqadi. Xeshda bunday sizish yo'q.
//
//  2. Xotira dumpi yoki tasodifiy log'da xom kalit turmaydi.
type authenticator struct {
	read  [][32]byte
	admin [][32]byte
}

func newAuthenticator(readKey, readPrev, adminKey, adminPrev string) *authenticator {
	return &authenticator{
		read:  hashKeys(readKey, readPrev),
		admin: hashKeys(adminKey, adminPrev),
	}
}

// hashKeys — bo'sh qiymatlarni TASHLAB YUBORADI.
//
// XAVFSIZLIK: bu eng muhim qator. Agar bo'sh kalit ham ro'yxatga
// tushsa, so'rovda `X-API-Key:` bo'sh yuborgan HAR KIM
// autentifikatsiyadan o'tardi. Sozlanmagan kalit = o'chirilgan slot,
// hammaga ochiq eshik EMAS.
func hashKeys(keys ...string) [][32]byte {
	var out [][32]byte
	for _, k := range keys {
		if k == "" {
			continue
		}
		out = append(out, sha256.Sum256([]byte(k)))
	}
	return out
}

// matches — berilgan kalit ro'yxatdagilardan biriga mos keladimi.
//
// Sikl birinchi mos kelganda UZILMAYDI — barcha slotlar har doim
// tekshiriladi. Aks holda "birinchi kalit to'g'ri" va "ikkinchi kalit
// to'g'ri" holatlari turli vaqt olardi va qaysi slot ishlaganini
// tashqaridan aniqlash mumkin bo'lardi.
func matches(candidate string, allowed [][32]byte) bool {
	if len(allowed) == 0 {
		return false
	}
	sum := sha256.Sum256([]byte(candidate))
	var ok int
	for _, want := range allowed {
		ok |= subtle.ConstantTimeCompare(sum[:], want[:])
	}
	return ok == 1
}

// allow — so'rovdagi kalit talab qilingan darajaga yetadimi.
//
// Admin kaliti o'qish huquqini HAM beradi (ustki to'plam) — aks holda
// import vositasi ikkita kalit ko'tarib yurishi kerak bo'lardi.
// Teskarisi ISHLAMAYDI: read kaliti hech qachon yozishga yetmaydi.
func (a *authenticator) allow(key string, need Scope) bool {
	switch need {
	case ScopePublic:
		return true
	case ScopeRead:
		return matches(key, a.read) || matches(key, a.admin)
	case ScopeAdmin:
		return matches(key, a.admin)
	default:
		// Noma'lum daraja — RAD ETILADI (fail-closed). Yangi Scope
		// qo'shilib bu switch yangilanmasa, u ochiq qolib ketmasin.
		return false
	}
}

// apiKeyHeader — kalit FAQAT shu sarlavhada qabul qilinadi.
//
// URL so'rov qatorida (`?key=...`) ATAYLAB qabul qilinmaydi: query
// string reverse-proxy kirish loglariga yoziladi, brauzer tarixida
// qoladi va tashqi resurs so'ralganda `Referer` sarlavhasida chiqib
// ketishi mumkin. ChustApp'da bu dars `mini_app_webview.dart` izohida
// yozilgan — bir marta shu sabab token URL'dan POST tanasiga ko'chirilgan.
const apiKeyHeader = "X-API-Key"

// requireScope — himoya middleware'i.
func (s *Server) requireScope(need Scope, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.auth.allow(r.Header.Get(apiKeyHeader), need) {
			// Xato xabari ATAYLAB umumiy: kalit noto'g'rimi, yo'qmi
			// yoki huquqi yetmayaptimi — aytilmaydi. Har biri
			// hujumchiga alohida ma'lumot berardi.
			//
			// Kalitning O'ZI hech qachon javobga ham, logga ham
			// tushmaydi.
			httpError(w, http.StatusUnauthorized, "kalit yaroqsiz yoki yetarli huquqqa ega emas")
			return
		}
		next(w, r)
	}
}
