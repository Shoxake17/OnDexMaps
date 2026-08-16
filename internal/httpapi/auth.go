package httpapi

import (
	"net/http"

	"ondexmap/internal/apikey"
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
	// ScopeAdmin — yozish huquqi.
	//
	// ESLATMA: ommaviy API'da yozish endpointlari UMUMAN yo'q —
	// ular alohida `cmd/admin` binarida (lokal). Bu daraja shu
	// binarda ishlatiladi va bu yerda faqat to'liqlik uchun bor.
	ScopeAdmin
)

// apiKeyHeader — kalit FAQAT shu sarlavhada qabul qilinadi.
const apiKeyHeader = apikey.Header

type authenticator struct {
	read  *apikey.Set
	admin *apikey.Set
}

func newAuthenticator(readKey, readPrev, adminKey, adminPrev string) *authenticator {
	return &authenticator{
		read:  apikey.New(readKey, readPrev),
		admin: apikey.New(adminKey, adminPrev),
	}
}

// allow — so'rovdagi kalit talab qilingan darajaga yetadimi.
//
// Admin kaliti o'qish huquqini HAM beradi (ustki to'plam) — aks holda
// admin vositasi ikkita kalit ko'tarib yurishi kerak bo'lardi.
// Teskarisi ISHLAMAYDI: read kaliti hech qachon admin darajasiga
// yetmaydi.
func (a *authenticator) allow(key string, need Scope) bool {
	switch need {
	case ScopePublic:
		return true
	case ScopeRead:
		return a.read.Matches(key) || a.admin.Matches(key)
	case ScopeAdmin:
		return a.admin.Matches(key)
	default:
		// Noma'lum daraja — RAD ETILADI (fail-closed). Yangi Scope
		// qo'shilib bu switch yangilanmasa, u ochiq qolib ketmasin.
		return false
	}
}

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
