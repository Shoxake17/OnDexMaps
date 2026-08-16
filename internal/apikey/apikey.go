// Package apikey — API kalitlarini xavfsiz solishtirish.
//
// NEGA ALOHIDA PAKET: bu mantiq ikki joyda kerak (ommaviy API va
// admin vositasi). Nusxa ko'chirilsa, ular vaqt o'tib bir-biridan
// uzoqlashadi va tuzatish faqat bittasiga tushadi — xavfsizlik
// kodida bu qabul qilinmaydigan xavf.
package apikey

import (
	"crypto/sha256"
	"crypto/subtle"
)

// Set — qabul qilinadigan kalitlar to'plami.
//
// Kalitlar SHA-256 XESHI sifatida saqlanadi, xom matn emas:
//
//  1. Solishtirish har doim QAT'IY 32 baytda bo'ladi. Xom matn
//     solishtirilganda `subtle.ConstantTimeCompare` uzunliklar har xil
//     bo'lsa darhol qaytadi — ya'ni kalitning UZUNLIGI vaqt orqali
//     sizib chiqadi.
//  2. Xotira dumpida yoki tasodifiy log'da xom kalit turmaydi.
type Set struct {
	hashes [][32]byte
}

// New — kalitlar to'plamini quradi.
//
// BO'SH qiymatlar TASHLAB YUBORILADI. Bu eng muhim qator: agar bo'sh
// kalit to'plamga tushsa, `X-API-Key:` ni bo'sh yuborgan HAR KIM
// autentifikatsiyadan o'tardi. Sozlanmagan kalit = o'chirilgan slot,
// hammaga ochiq eshik EMAS.
func New(keys ...string) *Set {
	s := &Set{}
	for _, k := range keys {
		if k == "" {
			continue
		}
		s.hashes = append(s.hashes, sha256.Sum256([]byte(k)))
	}
	return s
}

// Empty — to'plamda birorta kalit bormi.
func (s *Set) Empty() bool { return len(s.hashes) == 0 }

// Matches — nomzod kalit to'plamdagilardan biriga mos keladimi.
//
// Sikl birinchi mos kelganda UZILMAYDI — barcha slotlar har doim
// tekshiriladi. Aks holda "birinchi kalit to'g'ri" va "ikkinchi kalit
// to'g'ri" holatlari turli vaqt olardi va qaysi slot ishlaganini
// tashqaridan aniqlash mumkin bo'lardi.
func (s *Set) Matches(candidate string) bool {
	if len(s.hashes) == 0 {
		return false
	}
	sum := sha256.Sum256([]byte(candidate))
	var ok int
	for _, want := range s.hashes {
		ok |= subtle.ConstantTimeCompare(sum[:], want[:])
	}
	return ok == 1
}

// Header — kalit uzatiladigan YAGONA sarlavha.
//
// URL so'rov qatorida (`?key=...`) ATAYLAB qabul qilinmaydi: query
// string reverse-proxy kirish loglariga yoziladi, brauzer tarixida
// qoladi va tashqi resurs so'ralganda `Referer` sarlavhasida chiqib
// ketishi mumkin.
const Header = "X-API-Key"
