package devplatform

import (
	"strings"
	"testing"
)

func TestNormalizeOrigin(t *testing.T) {
	ok := map[string]string{
		"https://app.example.com":      "https://app.example.com",
		"HTTPS://App.Example.COM/":     "https://app.example.com",
		"https://app.example.com:8443": "https://app.example.com:8443",
		"https://*.example.com":        "https://*.example.com",
		"http://localhost":             "http://localhost",
		"http://localhost:3000":        "http://localhost:3000",
		"http://127.0.0.1:3100":        "http://127.0.0.1:3100",
		" https://ondex.uz ":           "https://ondex.uz",
	}
	for in, want := range ok {
		got, err := NormalizeOrigin(in)
		if err != nil || got != want {
			t.Errorf("NormalizeOrigin(%q) = %q, %v; kutilgan %q", in, got, err, want)
		}
	}
	bad := []string{
		"", "*", "https://*", "https://*.com", "https://*.*.example.com", "https://a*.example.com",
		"http://example.com", "http://evil.localhost.com", "ftp://example.com", "example.com",
		"https://example.com/path", "https://example.com?x=1", "https://example.com#f",
		"https://user:pw@example.com", "https://exa mple.com", "https://-bad.com", "https://bad-.com",
		"https://example.com:0", "https://example.com:99999x", "http://*.localhost",
		"https://" + strings.Repeat("a", 64) + ".com", "https://" + strings.Repeat("a.", 120) + "com",
		"javascript:alert(1)", "data:text/html,x", "null",
	}
	for _, s := range bad {
		if got, err := NormalizeOrigin(s); err == nil {
			t.Errorf("NormalizeOrigin(%q) qabul qildi: %q", s, got)
		}
	}
}

func TestNormalizeOriginsDedupAndLimit(t *testing.T) {
	got, err := NormalizeOrigins([]string{"https://a.com", "https://A.com/", "https://b.com"})
	if err != nil || len(got) != 2 {
		t.Fatalf("%v %v", got, err)
	}
	many := make([]string, MaxOrigins+1)
	for i := range many {
		many[i] = "https://a" + string(rune('a'+i%20)) + ".com"
	}
	if _, err := NormalizeOrigins(many); err == nil {
		t.Error("limitdan ko'p origin qabul qilindi")
	}
	if _, err := NormalizeOrigins([]string{"https://ok.com", "http://bad.com"}); err == nil {
		t.Error("yaroqsiz element o'tib ketdi")
	}
}

func TestOriginAllowed(t *testing.T) {
	list := []string{"https://app.example.com", "https://*.partner.uz", "http://localhost:3000"}
	yes := []string{
		"https://app.example.com", "https://APP.example.com", "https://a.partner.uz",
		"https://a.b.partner.uz", "http://localhost:3000",
	}
	no := []string{
		"", "null", "https://example.com", "https://evil-app.example.com", "https://partner.uz", // wildcard apex'ni qamramaydi
		"https://evilpartner.uz", "https://a.partner.uz.evil.com", "http://app.example.com",
		"https://a.partner.uz:8443", "http://localhost:3001", "http://localhost", "https://app.example.com:444",
	}
	for _, o := range yes {
		if !OriginAllowed(list, o) {
			t.Errorf("OriginAllowed(%q) rad etdi", o)
		}
	}
	for _, o := range no {
		if OriginAllowed(list, o) {
			t.Errorf("OriginAllowed(%q) ruxsat berdi", o)
		}
	}
	if OriginAllowed(nil, "https://app.example.com") {
		t.Error("bo'sh ro'yxat ruxsat berdi (fail-closed bo'lishi kerak)")
	}
}

func TestOriginFromReferer(t *testing.T) {
	if got := OriginFromReferer("https://App.Example.com/a/b?x=1#f"); got != "https://app.example.com" {
		t.Errorf("got %q", got)
	}
	for _, r := range []string{"", "not a url", "/relative", "javascript:1", "http://example.com/x"} {
		if got := OriginFromReferer(r); got != "" {
			t.Errorf("OriginFromReferer(%q) = %q", r, got)
		}
	}
}

func TestParseIPList(t *testing.T) {
	got, err := ParseIPList([]string{"203.0.113.7", "10.0.0.0/8", "2001:db8::/32", "203.0.113.7", "10.1.2.3/8"})
	if err != nil || len(got) != 3 { // takror va "10.1.2.3/8" → 10.0.0.0/8 (takror) olib tashlandi
		t.Fatalf("%v %v", got, err)
	}
	for _, bad := range []string{"0.0.0.0/0", "::/0", "1.0.0.0/7", "2001::/31", "abc", "1.2.3", "1.2.3.4/33", "", "1.2.3.4/x"} {
		if _, err := ParseIPList([]string{bad}); err == nil {
			t.Errorf("ParseIPList(%q) qabul qildi", bad)
		}
	}
	tooMany := make([]string, MaxIPs+1)
	for i := range tooMany {
		tooMany[i] = "198.51.100." + string(rune('0'+i%10)) + string(rune('0'+i/10%10))
	}
	if _, err := ParseIPList(tooMany); err == nil {
		t.Error("limitdan ko'p IP qabul qilindi")
	}
}

func TestIPAllowed(t *testing.T) {
	list, _ := ParseIPList([]string{"203.0.113.0/24", "2001:db8::/32"})
	if !IPAllowed(list, ip("203.0.113.9")) || !IPAllowed(list, ip("2001:db8::1")) {
		t.Error("ruxsat etilgan IP rad etildi")
	}
	if IPAllowed(list, ip("203.0.114.1")) || IPAllowed(list, ip("8.8.8.8")) {
		t.Error("begona IP ruxsat oldi")
	}
	if !IPAllowed(list, ip("::ffff:203.0.113.9")) { // IPv4-mapped IPv6
		t.Error("IPv4-mapped manzil moslanmadi")
	}
	if !IPAllowed(nil, ip("8.8.8.8")) {
		t.Error("bo'sh ro'yxat = cheklov yo'q bo'lishi kerak")
	}
}
