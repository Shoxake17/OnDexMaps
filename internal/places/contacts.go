package places

import (
	"net"
	"net/url"
	"strconv"
	"strings"
	"unicode"
)

// ═══════════════════════════════════════════════════════════════════
// KONTAKTLAR: veb-sayt va ijtimoiy tarmoq manzili
//
// Bu manzillar HAMMAGA havola bo'lib ko'rinadi, shuning uchun ular hujum
// yo'li bo'lishi mumkin (`javascript:` havolasi, fishing, ichki tarmoqqa
// yo'naltirish, foydalanuvchi nomi/paroli bilan aldash). Qoidalar:
//
//   • faqat `http` / `https` (boshqa sxema — `javascript:`, `data:`, `file:`,
//     `ftp:` ... — rad etiladi); sxema yozilmagan bo'lsa `https://` qo'yiladi;
//   • `user:parol@` qismi YO'Q (havola boshqa saytga o'xshab ko'rinmasin);
//   • manzil — DOMEN nomi: IP manzil, `localhost` va ichki domenlar
//     (`.local`, `.internal`, ...) rad etiladi;
//   • ijtimoiy tarmoq — faqat ma'lum tarmoqlar (`socialHosts`) va akkaunt
//     yo'li bilan (bosh sahifa emas). «Ijtimoiy tarmoq» deb boshqa sayt
//     havolasini yashirib bo'lmasin.
//
// Bazada ham CHECK bor (0010): kod xato qilsa ham `javascript:` saqlanmaydi.
// ═══════════════════════════════════════════════════════════════════

// Manzil uzunligi chegarasi (bazadagi CHECK bilan bir xil).
const (
	MaxSite   = 200
	MaxSocial = 200
)

// socialHosts — ruxsat etilgan ijtimoiy tarmoq domenlari. Subdomenlar
// (`www.`, `m.`, `uz.`) ham ruxsat etiladi.
var socialHosts = []string{
	"instagram.com", "t.me", "telegram.me", "facebook.com", "fb.com",
	"youtube.com", "youtu.be", "tiktok.com", "x.com", "twitter.com",
	"linkedin.com", "vk.com", "ok.ru", "threads.net", "wa.me",
}

// SocialHosts — ruxsat etilgan ijtimoiy tarmoq domenlari (forma maslahati uchun).
func SocialHosts() []string { return append([]string(nil), socialHosts...) }

// internalSuffixes — ichki tarmoq domenlari: ommaviy havola bo'la olmaydi.
var internalSuffixes = []string{
	".local", ".localhost", ".internal", ".intranet", ".lan", ".home", ".corp", ".test", ".invalid",
}

// cleanWebURL — http(s) manzilni tekshiradi va bir xil ko'rinishga keltiradi
// (sxema va domen kichik harfda, `#bo'lak` olib tashlanadi).
func cleanWebURL(s string, max int, label string) (string, error) {
	raw, err := cleanLine(s, max, label)
	if err != nil || raw == "" {
		return raw, err
	}
	// Ichida bo'sh joy bo'lgan manzil — URL emas (matn yoki hujum).
	if strings.ContainsFunc(raw, unicode.IsSpace) {
		return "", bad("«" + label + "» manzili noto'g'ri")
	}
	// Sxema bor bo'lsa faqat http/https. `javascript:alert(1)` kabi «://»siz
	// sxemalar ham shu yerda ushlanadi: `:` dan oldin «/» yo'q va u port emas.
	lower := strings.ToLower(raw)
	switch {
	case strings.HasPrefix(lower, "http://"), strings.HasPrefix(lower, "https://"):
	case strings.Contains(lower, "://"):
		return "", bad("«" + label + "» faqat http yoki https bo'lishi mumkin")
	case hasBareScheme(lower):
		return "", bad("«" + label + "» faqat http yoki https bo'lishi mumkin")
	default:
		raw = "https://" + raw
	}

	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || u.Opaque != "" {
		return "", bad("«" + label + "» manzili noto'g'ri")
	}
	if u.User != nil {
		return "", bad("«" + label + "» manzilida foydalanuvchi nomi/paroli bo'lmasligi kerak")
	}
	host := strings.ToLower(u.Hostname())
	if !publicHostname(host) {
		return "", bad("«" + label + "» manzilida to'g'ri domen nomi bo'lishi kerak")
	}
	port := u.Port()
	if port != "" {
		n, convErr := strconv.Atoi(port)
		if convErr != nil || n < 1 || n > 65535 {
			return "", bad("«" + label + "» manzilidagi port noto'g'ri")
		}
	}
	u.Scheme = strings.ToLower(u.Scheme)
	u.Host = host
	if port != "" {
		u.Host = host + ":" + port
	}
	u.Fragment, u.RawFragment = "", ""
	out := u.String()
	if len([]rune(out)) > max {
		return "", bad("«" + label + "» juda uzun")
	}
	return out, nil
}

// hasBareScheme — «sxema:...» ko'rinishidami (masalan `javascript:alert(1)`,
// `mailto:a@b.uz`). «domen:port» (`example.uz:8080`) sxema EMAS.
func hasBareScheme(lower string) bool {
	i := strings.IndexAny(lower, ":/?#")
	if i <= 0 || lower[i] != ':' {
		return false
	}
	rest := lower[i+1:]
	// «domen:8080» yoki «domen:8080/yo'l» — port.
	j := 0
	for j < len(rest) && rest[j] >= '0' && rest[j] <= '9' {
		j++
	}
	if j > 0 && (j == len(rest) || rest[j] == '/' || rest[j] == '?' || rest[j] == '#') {
		return false
	}
	return true
}

// publicHostname — ommaviy domen nomimi: ASCII harf/raqam/tire bo'laklari,
// kamida bitta nuqta, oxirgi bo'lak harflardan (TLD), IP va ichki nomlar emas.
func publicHostname(h string) bool {
	if h == "" || len(h) > 253 || net.ParseIP(h) != nil {
		return false
	}
	if h == "localhost" {
		return false
	}
	for _, suf := range internalSuffixes {
		if strings.HasSuffix(h, suf) {
			return false
		}
	}
	labels := strings.Split(h, ".")
	if len(labels) < 2 {
		return false
	}
	for _, l := range labels {
		if l == "" || len(l) > 63 || l[0] == '-' || l[len(l)-1] == '-' {
			return false
		}
		for i := 0; i < len(l); i++ {
			c := l[i]
			if !(c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '-') {
				return false
			}
		}
	}
	tld := labels[len(labels)-1]
	if len(tld) < 2 {
		return false
	}
	for i := 0; i < len(tld); i++ {
		if tld[i] < 'a' || tld[i] > 'z' {
			// `xn--p1ai` kabi punycode TLD ham ruxsat.
			if !strings.HasPrefix(tld, "xn--") {
				return false
			}
			break
		}
	}
	return true
}

// cleanSocial — ijtimoiy tarmoq akkaunti manzili: ma'lum tarmoq domeni va
// akkaunt yo'li (`instagram.com/chustnon`) bo'lishi shart.
func cleanSocial(s string) (string, error) {
	out, err := cleanWebURL(s, MaxSocial, "ijtimoiy tarmoq")
	if err != nil || out == "" {
		return out, err
	}
	u, err := url.Parse(out)
	if err != nil {
		return "", bad("«ijtimoiy tarmoq» manzili noto'g'ri")
	}
	host := u.Hostname()
	known := false
	for _, d := range socialHosts {
		if host == d || strings.HasSuffix(host, "."+d) {
			known = true
			break
		}
	}
	if !known {
		return "", bad("«ijtimoiy tarmoq» manzili ma'lum tarmoqdan bo'lishi kerak (Instagram, Telegram, Facebook, YouTube, TikTok, X, LinkedIn, VK, OK, Threads, WhatsApp)")
	}
	if strings.Trim(u.Path, "/") == "" {
		return "", bad("«ijtimoiy tarmoq» manzilida akkaunt yo'li bo'lishi kerak (masalan: instagram.com/nomi)")
	}
	return out, nil
}
