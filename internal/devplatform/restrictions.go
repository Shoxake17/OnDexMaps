package devplatform

import (
	"errors"
	"net"
	"net/netip"
	"net/url"
	"strings"
)

// ── Origin cheklovi (brauzer kalitlari) ───────────────────────────────

// Cheklovlar: Origin ro'yxati uzunligi va har birining uzunligi (DoS/axlat).
const (
	MaxOrigins   = 20
	MaxIPs       = 50
	maxOriginLen = 200
)

var (
	ErrBadOrigin = errors.New("origin noto'g'ri: `https://domen`, `https://*.domen` yoki `http://localhost[:port]` shaklida bo'lishi kerak (yo'l, so'rov yoki login bo'lmasin)")
	ErrBadIP     = errors.New("IP/CIDR noto'g'ri yoki juda keng (0.0.0.0/0 va shunga o'xshash ruxsat etilmaydi)")
)

// NormalizeOrigin — foydalanuvchi kiritgan Origin'ni tekshiradi va kanonik shaklga keltiradi.
//
// Ruxsat etiladi:
//   - `https://app.example.com`, `https://app.example.com:8443`
//   - `https://*.example.com`   (faqat CHAP tomonda, faqat https; `example.com` o'zini QAMRAMAYDI)
//   - `http://localhost`, `http://localhost:3000`, `http://127.0.0.1:3000` (faqat dev uchun)
//
// Rad etiladi: yo'l/so'rov/fragment/login, `*` yakka o'zi, `https://*`, `https://*.com` (TLD),
// bo'sh joy, juda uzun, `http://` (localhost'dan tashqari).
func NormalizeOrigin(raw string) (string, error) {
	s := strings.TrimSpace(raw)
	if s == "" || len(s) > maxOriginLen || strings.ContainsAny(s, " \t\r\n") {
		return "", ErrBadOrigin
	}
	u, err := url.Parse(s)
	if err != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" ||
		(u.Path != "" && u.Path != "/") {
		return "", ErrBadOrigin
	}
	scheme := strings.ToLower(u.Scheme)
	host := strings.ToLower(u.Hostname())
	port := u.Port()
	if host == "" {
		return "", ErrBadOrigin
	}

	isLocal := host == "localhost" || host == "127.0.0.1"
	switch scheme {
	case "https":
	case "http":
		if !isLocal {
			return "", ErrBadOrigin
		}
	default:
		return "", ErrBadOrigin
	}

	if strings.Contains(host, "*") {
		// Faqat `*.` boshlanishi va ostida kamida IKKI belgili domen (example.com), TLD emas.
		if scheme != "https" || !strings.HasPrefix(host, "*.") || strings.Count(host, "*") != 1 {
			return "", ErrBadOrigin
		}
		base := strings.TrimPrefix(host, "*.")
		if !validHost(base) || !strings.Contains(base, ".") {
			return "", ErrBadOrigin
		}
	} else if !validHost(host) && net.ParseIP(host) == nil {
		return "", ErrBadOrigin
	}

	if port != "" {
		if len(port) > 5 || strings.Trim(port, "0123456789") != "" || port == "0" {
			return "", ErrBadOrigin
		}
	}
	out := scheme + "://" + host
	if port != "" {
		out += ":" + port
	}
	return out, nil
}

// validHost — DNS nomi: harf/raqam/tire, nuqta bilan ajratilgan.
func validHost(h string) bool {
	if h == "" || len(h) > 253 {
		return false
	}
	for _, label := range strings.Split(h, ".") {
		if label == "" || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return false
		}
		for _, c := range label {
			ok := (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-'
			if !ok {
				return false
			}
		}
	}
	return true
}

// NormalizeOrigins — ro'yxat: har birini tekshiradi, takrorlarni olib tashlaydi.
func NormalizeOrigins(in []string) ([]string, error) {
	if len(in) > MaxOrigins {
		return nil, errors.New("origin'lar soni juda ko'p")
	}
	seen := map[string]bool{}
	out := make([]string, 0, len(in))
	for _, raw := range in {
		o, err := NormalizeOrigin(raw)
		if err != nil {
			return nil, err
		}
		if !seen[o] {
			seen[o] = true
			out = append(out, o)
		}
	}
	return out, nil
}

// OriginFromReferer — Referer URL'idan Origin (`scheme://host[:port]`) ajratadi.
func OriginFromReferer(referer string) string {
	u, err := url.Parse(referer)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return ""
	}
	o, err := NormalizeOrigin(u.Scheme + "://" + u.Host)
	if err != nil {
		return ""
	}
	return o
}

// OriginAllowed — so'rov Origin'i kalit ro'yxatiga to'g'ri keladimi.
//
// `origin` brauzer yuborgan Origin sarlavhasi (yoki Referer'dan ajratilgan). Ro'yxat elementlari
// allaqachon NormalizeOrigin'dan o'tgan. `https://*.x.com` — `x.com` ning barcha
// pastki domenlarini qamraydi (a.x.com, a.b.x.com), `x.com` o'zini emas; sxema va port teng bo'lishi shart.
func OriginAllowed(allowed []string, origin string) bool {
	o, err := NormalizeOrigin(origin)
	if err != nil {
		return false
	}
	ou, _ := url.Parse(o)
	for _, a := range allowed {
		if a == o {
			return true
		}
		au, err := url.Parse(a)
		if err != nil || !strings.HasPrefix(au.Hostname(), "*.") {
			continue
		}
		suffix := strings.TrimPrefix(au.Hostname(), "*") // ".example.com"
		if au.Scheme == ou.Scheme && au.Port() == ou.Port() &&
			strings.HasSuffix(ou.Hostname(), suffix) && len(ou.Hostname()) > len(suffix) {
			return true
		}
	}
	return false
}

// ── IP cheklovi (server kalitlari) ────────────────────────────────────

// ParseIPList — IP/CIDR ro'yxatini tekshiradi. Yakka IP → /32 (/128).
// Juda keng diapazon (0.0.0.0/0, ::/0, IPv4 /8 dan keng, IPv6 /32 dan keng) RAD ETILADI —
// "hamma IP'ga ruxsat" cheklovning butun ma'nosini yo'qotadi.
func ParseIPList(in []string) ([]netip.Prefix, error) {
	if len(in) > MaxIPs {
		return nil, errors.New("IP'lar soni juda ko'p")
	}
	out := make([]netip.Prefix, 0, len(in))
	seen := map[netip.Prefix]bool{}
	for _, raw := range in {
		s := strings.TrimSpace(raw)
		var p netip.Prefix
		if strings.Contains(s, "/") {
			pp, err := netip.ParsePrefix(s)
			if err != nil {
				return nil, ErrBadIP
			}
			p = pp.Masked()
		} else {
			a, err := netip.ParseAddr(s)
			if err != nil {
				return nil, ErrBadIP
			}
			p = netip.PrefixFrom(a.Unmap(), a.Unmap().BitLen())
		}
		if (p.Addr().Is4() && p.Bits() < 8) || (p.Addr().Is6() && p.Bits() < 32) {
			return nil, ErrBadIP
		}
		if !seen[p] {
			seen[p] = true
			out = append(out, p)
		}
	}
	return out, nil
}

// IPAllowed — ro'yxat bo'sh bo'lsa cheklov YO'Q (true); aks holda IP diapazonlardan biriga tegishli bo'lishi shart.
func IPAllowed(list []netip.Prefix, ip netip.Addr) bool {
	if len(list) == 0 {
		return true
	}
	ip = ip.Unmap()
	for _, p := range list {
		if p.Contains(ip) {
			return true
		}
	}
	return false
}
