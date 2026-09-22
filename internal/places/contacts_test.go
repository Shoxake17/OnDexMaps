package places

import (
	"strings"
	"testing"
)

func TestCleanWebURLAccepts(t *testing.T) {
	cases := map[string]string{
		"example.uz":                             "https://example.uz",
		"  Example.UZ  ":                         "https://example.uz",
		"http://example.uz/menyu":                "http://example.uz/menyu",
		"HTTPS://WWW.Example.uz/Yo'l?a=1#bo'lak": "https://www.example.uz/Yo'l?a=1",
		"example.uz:8080/x":                      "https://example.uz:8080/x",
		"sub.example.co.uk":                      "https://sub.example.co.uk",
	}
	for in, want := range cases {
		got, err := cleanWebURL(in, MaxSite, "veb-sayt")
		if err != nil {
			t.Errorf("%q: qabul qilinishi kerak edi: %v", in, err)
			continue
		}
		if got != want {
			t.Errorf("%q → %q, kutilgan %q", in, got, want)
		}
	}
}

func TestCleanWebURLEmptyIsOK(t *testing.T) {
	for _, in := range []string{"", "   ", "\t"} {
		got, err := cleanWebURL(in, MaxSite, "veb-sayt")
		if err != nil || got != "" {
			t.Errorf("%q: bo'sh qiymat qabul qilinishi kerak: %q, %v", in, got, err)
		}
	}
}

// Hujum yo'llari: xavfli sxema, yashirin kirish ma'lumoti, ichki tarmoq, IP.
func TestCleanWebURLRejects(t *testing.T) {
	cases := map[string]string{
		"javascript:alert(1)":          "javascript sxemasi",
		"JaVaScRiPt:alert(1)":          "javascript (katta-kichik aralash)",
		"data:text/html,<script>":      "data sxemasi",
		"file:///etc/passwd":           "file sxemasi",
		"ftp://example.uz":             "ftp sxemasi",
		"mailto:a@example.uz":          "mailto",
		"//example.uz":                 "sxemasiz «//»",
		"https://user:pass@example.uz": "kirish ma'lumoti bilan",
		"https://google.com@evil.uz":   "aldov: google.com@evil.uz",
		"http://localhost":             "localhost",
		"http://localhost:3000/x":      "localhost + port",
		"http://127.0.0.1":             "IPv4",
		"http://192.168.1.1/admin":     "ichki IPv4",
		"http://[::1]/":                "IPv6",
		"http://169.254.169.254/":      "bulut metadata manzili",
		"http://server.internal":       "ichki domen",
		"http://printer.local":         "ichki domen (.local)",
		"http://intranet":              "nuqtasiz nom",
		"http://-bad.uz":               "tire bilan boshlanadi",
		"http://exa mple.uz":           "bo'sh joy",
		"https://example.uz:99999x":    "port noto'g'ri",
		"http://пример.уз":             "punycode'siz kirill domen",
		"http://example.":              "oxiri nuqta",
		"http://.example.uz":           "boshi nuqta",
		"http://example.u":             "TLD juda qisqa",
		"http://example.123":           "TLD raqam",
		"https://":                     "domen yo'q",
		"http://a b":                   "bo'sh joy",
	}
	for in, why := range cases {
		if got, err := cleanWebURL(in, MaxSite, "veb-sayt"); err == nil {
			t.Errorf("%s (%q): rad etilishi kerak edi, qabul qilindi: %q", why, in, got)
		}
	}
}

func TestCleanWebURLTooLong(t *testing.T) {
	long := "https://example.uz/" + strings.Repeat("a", MaxSite)
	if _, err := cleanWebURL(long, MaxSite, "veb-sayt"); err == nil {
		t.Error("juda uzun manzil rad etilishi kerak")
	}
}

func TestCleanWebURLErrorDoesNotEchoInput(t *testing.T) {
	_, err := cleanWebURL("javascript:alert('XSS-MARKER')", MaxSite, "veb-sayt")
	if err == nil {
		t.Fatal("rad etilishi kerak edi")
	}
	if strings.Contains(err.Error(), "XSS-MARKER") || strings.Contains(err.Error(), "alert") {
		t.Errorf("xato kiruvchi matnni aks ettirdi: %q", err.Error())
	}
}

func TestCleanSocialAccepts(t *testing.T) {
	cases := map[string]string{
		"instagram.com/chustnon":                "https://instagram.com/chustnon",
		"https://www.instagram.com/x_y/":        "https://www.instagram.com/x_y/",
		"t.me/chustnon":                         "https://t.me/chustnon",
		"https://facebook.com/chust.non":        "https://facebook.com/chust.non",
		"m.facebook.com/chust":                  "https://m.facebook.com/chust",
		"youtube.com/@chustnon":                 "https://youtube.com/@chustnon",
		"https://www.tiktok.com/@chust":         "https://www.tiktok.com/@chust",
		"x.com/chust":                           "https://x.com/chust",
		"https://wa.me/998901234567":            "https://wa.me/998901234567",
		"https://uz.linkedin.com/company/chust": "https://uz.linkedin.com/company/chust",
	}
	for in, want := range cases {
		got, err := cleanSocial(in)
		if err != nil {
			t.Errorf("%q: qabul qilinishi kerak edi: %v", in, err)
			continue
		}
		if got != want {
			t.Errorf("%q → %q, kutilgan %q", in, got, want)
		}
	}
}

func TestCleanSocialRejects(t *testing.T) {
	cases := map[string]string{
		"https://example.uz/chust":        "ma'lum tarmoq emas",
		"https://instagram.com":           "akkaunt yo'li yo'q",
		"https://instagram.com/":          "akkaunt yo'li yo'q (faqat «/»)",
		"https://evilinstagram.com/x":     "domen o'xshash, lekin boshqa",
		"https://instagram.com.evil.uz/x": "domen prefiksi bilan aldov",
		"https://t.me.evil.uz/x":          "domen prefiksi bilan aldov",
		"javascript:alert(1)":             "javascript",
		"@chustnon":                       "«@nom» — URL emas",
		"https://user@instagram.com/x":    "kirish ma'lumoti bilan",
	}
	for in, why := range cases {
		if got, err := cleanSocial(in); err == nil {
			t.Errorf("%s (%q): rad etilishi kerak edi, qabul qilindi: %q", why, in, got)
		}
	}
}

// Validate: kontaktlar faqat «Tashkilot» da; boshqa turda rad etiladi.
func TestValidateContacts(t *testing.T) {
	ok := Input{
		Kind: "organization", Lat: f(41), Lng: f(71.2), Name: "Non", Category: "Kafe",
		Phone: "+998 90 123-45-67", Site: "chustnon.uz", Social: "https://instagram.com/chustnon",
	}
	c, err := Validate(ok)
	if err != nil {
		t.Fatalf("kontaktlar bilan tashkilot qabul qilinishi kerak: %v", err)
	}
	if c.Site != "https://chustnon.uz" || c.Social != "https://instagram.com/chustnon" {
		t.Errorf("kontaktlar tozalanmadi: site=%q social=%q", c.Site, c.Social)
	}

	// Kontaktsiz ham to'g'ri (hech biri majburiy emas).
	bare := Input{Kind: "organization", Lat: f(41), Lng: f(71.2), Name: "Non", Category: "Kafe"}
	if _, err := Validate(bare); err != nil {
		t.Errorf("kontaktsiz tashkilot qabul qilinishi kerak: %v", err)
	}

	// Xavfli qiymat butun so'rovni rad etadi.
	bad := ok
	bad.Site = "javascript:alert(1)"
	if _, err := Validate(bad); err == nil {
		t.Error("javascript: sayt rad etilishi kerak")
	}
	bad = ok
	bad.Social = "https://example.uz/x"
	if _, err := Validate(bad); err == nil {
		t.Error("ma'lum tarmoqdan tashqari akkaunt rad etilishi kerak")
	}

	// Boshqa turlarda kontakt maydoni yo'q.
	for _, kind := range []string{"address", "entrance", "barrier", "stop", "parking", "gate", "other"} {
		in := Input{Kind: kind, Lat: f(41), Lng: f(71.2), Name: "X", House: "1", Site: "https://example.uz"}
		if _, err := Validate(in); err == nil {
			t.Errorf("%s: sayt maydoni bu turda bo'lmasligi kerak", kind)
		}
	}
}

func TestSocialHostsAreAllPublic(t *testing.T) {
	for _, h := range SocialHosts() {
		if !publicHostname(h) {
			t.Errorf("ijtimoiy tarmoq domeni %q ommaviy domen sifatida qabul qilinmadi", h)
		}
	}
}
