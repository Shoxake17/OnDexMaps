// Package localsession — admin muharriri uchun LOKAL sessiya "qo'l berishi".
//
// ┌─ MUAMMO ───────────────────────────────────────────────────────────┐
// Admin muharriri va moderatsiya ChustApp admin panelining ichida (nativ Flutter ekran) ishlaydi.
// Foydalanuvchi panelga ALLAQACHON kirgan bo'ladi, lekin muharrir
// undan YANA `ONDEXMAP_ADMIN_KEY` ni so'rardi — ya'ni bir ekotizimda
// ikkinchi kirish oynasi paydo bo'lardi.
// └────────────────────────────────────────────────────────────────────┘
//
// ┌─ NEGA KALITNI SHUNCHAKI ChustApp'GA BERMAYMIZ ──────────────────────┐
// README §4.3: `ONDEXMAP_ADMIN_KEY` ChustApp'ga HECH QACHON berilmaydi.
// Uni ChustApp'ning env'iga qo'yish — internetga qaragan API egallab
// olinsa, u bilan birga OnDexMap'ning YOZISH huquqini ham berish
// degani. Flutter binariga yozish esa uni har bir o'rnatilgan nusxaga
// tarqatish degani (EXE ochib o'qiladi).
// └────────────────────────────────────────────────────────────────────┘
//
// ┌─ YECHIM: BIR MARTALIK SESSIYA FAYLI ───────────────────────────────┐
// Admin serveri ishga tushganda tasodifiy sessiya tokeni yaratadi va
// uni faqat SHU foydalanuvchi profiliga tegishli papkaga yozadi
// (`%LOCALAPPDATA%\OnDexMap\admin_session.json`). Panel o'sha faylni
// o'qib, tokenni X-API-Key sarlavhasida yuboradi — kirish oynasi ko'rinmaydi.
//
// Nega kalit tekshiruvining O'ZI saqlanadi (umuman olib tashlanmaydi):
// 8091 loopback'da tursa ham, brauzerdagi ZARARLI SAHIFA
// `fetch("http://127.0.0.1:8091/api/delete")` qilishi mumkin. Kalit
// aynan shuni to'xtatadi. Sahifa esa lokal FAYLNI o'qiy olmaydi —
// shuning uchun fayl orqali qo'l berish haqiqiy chegara, bezak emas.
//
// Token kalitdan ustun tomonlari:
//   - jarayon bilan birga o'ladi (server to'xtaganda fayl o'chiriladi);
//   - ChustApp'ning env'ida ham, binarida ham turmaydi;
//   - o'g'irlansa ham `ONDEXMAP_ADMIN_KEY` fosh bo'lmaydi va uni
//     almashtirish uchun hech narsa qilish shart emas.
//
// └────────────────────────────────────────────────────────────────────┘
package localsession

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// FileName — panel qidiradigan fayl nomi. Bu nom ChustApp tomonidagi
// `apps/admin_panel/lib/ondexmap/ondexmap_session_io.dart` bilan SHARTNOMA: o'zgarsa, panel
// tokenni topa olmaydi va yana kirish oynasi chiqadi (buzilmaydi,
// lekin qulaylik yo'qoladi).
const FileName = "admin_session.json"

// DirName — `%LOCALAPPDATA%` (Windows) yoki `~/.cache` ichidagi papka.
const DirName = "OnDexMap"

// tokenBytes — 32 bayt = 256 bit entropiya.
const tokenBytes = 32

// Session — ishlab turgan admin serverining lokal sessiyasi.
type Session struct {
	Token string
	Path  string
}

// payload — faylning tuzilishi. Panel `url` va `token` ni o'qiydi;
// qolganlari diagnostika uchun (kim yozgan, qachon).
type payload struct {
	URL       string `json:"url"`
	Token     string `json:"token"`
	PID       int    `json:"pid"`
	StartedAt string `json:"started_at"`
}

// Dir — sessiya fayli turadigan papka.
func Dir() (string, error) {
	base, err := os.UserCacheDir() // Windows'da bu %LOCALAPPDATA%
	if err != nil {
		return "", err
	}
	return filepath.Join(base, DirName), nil
}

// FilePath — sessiya faylining to'liq yo'li.
func FilePath() (string, error) {
	dir, err := Dir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, FileName), nil
}

// Create — yangi sessiya tokeni yaratib, uni faylga yozadi.
//
// `url` — serverning haqiqiy manzili; panel shuni ochadi. Ya'ni port
// o'zgarsa panelni qayta yozish kerak emas.
func Create(url string) (*Session, error) {
	raw := make([]byte, tokenBytes)
	if _, err := rand.Read(raw); err != nil {
		// Tasodifiylik manbasi ishlamasa TOKEN YARATILMAYDI. Zaxira
		// sifatida vaqt yoki PID ishlatish — taxmin qilinadigan token
		// degani bo'lardi.
		return nil, fmt.Errorf("tasodifiy token yaratilmadi: %w", err)
	}
	token := base64.RawURLEncoding.EncodeToString(raw)

	path, err := FilePath()
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, err
	}

	body, err := json.MarshalIndent(payload{
		URL:       url,
		Token:     token,
		PID:       os.Getpid(),
		StartedAt: time.Now().Format(time.RFC3339),
	}, "", "  ")
	if err != nil {
		return nil, err
	}

	// 0o600 — Windows'da POSIX huquqlari e'tiborga olinmaydi, lekin
	// `%LOCALAPPDATA%` baribir foydalanuvchi profiliga tegishli va
	// boshqa hisoblar uni o'qiy olmaydi. Linux/macOS'da esa mode
	// haqiqatda ishlaydi.
	if err := os.WriteFile(path, body, 0o600); err != nil {
		return nil, err
	}
	return &Session{Token: token, Path: path}, nil
}

// Remove — faylni o'chiradi. Server to'xtaganda CHAQIRILISHI SHART:
// aks holda o'lgan jarayonning tokeni diskda qolib, panel unga
// ishonib xato holatga tushardi.
func (s *Session) Remove() {
	if s == nil || s.Path == "" {
		return
	}
	_ = os.Remove(s.Path)
}
