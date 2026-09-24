package console

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"ondexmap/internal/devplatform"
)

const testOrigin = "https://console.ondex.uz"

type env struct {
	t    *testing.T
	srv  *Server
	h    http.Handler
	st   *memStore
	mail *captureMailer
	now  time.Time
}

func newEnv(t *testing.T) *env {
	t.Helper()
	st, mail := newMemStore(), &captureMailer{}
	e := &env{t: t, st: st, mail: mail, now: time.Now()}
	e.srv = New(Config{Pepper: []byte("console-test-pepper-0123456789abcdef01"), Origin: testOrigin, Secure: true,
		Plans: devplatform.DefaultPlans(), BillingInstructions: "Karta: 8600 ..."}, st, mail)
	e.srv.now = func() time.Time { return e.now }
	e.h = e.srv.Handler()
	return e
}

type resp struct {
	*httptest.ResponseRecorder
}

func (r resp) json() map[string]any {
	var m map[string]any
	_ = json.Unmarshal(r.Body.Bytes(), &m)
	return m
}

func (r resp) errCode() string {
	if e, ok := r.json()["error"].(map[string]any); ok {
		s, _ := e["code"].(string)
		return s
	}
	return ""
}

type opts struct {
	cookie, csrf, origin string
	noOrigin             bool
	ctype                string
}

func (e *env) do(method, path string, body any, o opts) resp {
	e.t.Helper()
	var rd *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	} else {
		rd = bytes.NewReader(nil)
	}
	r := httptest.NewRequest(method, path, rd)
	if body != nil {
		ct := o.ctype
		if ct == "" {
			ct = "application/json"
		}
		r.Header.Set("Content-Type", ct)
	}
	if !o.noOrigin && method != http.MethodGet {
		origin := o.origin
		if origin == "" {
			origin = testOrigin
		}
		r.Header.Set("Origin", origin)
	}
	if o.cookie != "" {
		r.AddCookie(&http.Cookie{Name: "__Host-omk_session", Value: o.cookie})
	}
	if o.csrf != "" {
		r.Header.Set("X-CSRF-Token", o.csrf)
	}
	w := httptest.NewRecorder()
	e.h.ServeHTTP(w, r)
	return resp{w}
}

// login — to'liq kirish oqimi: (cookie, csrf).
func (e *env) login(email string) (string, string) {
	e.t.Helper()
	if r := e.do("POST", "/api/auth/request-code", map[string]string{"email": email}, opts{}); r.Code != 202 {
		e.t.Fatalf("request-code: %d %s", r.Code, r.Body)
	}
	code := e.mail.codes[email]
	r := e.do("POST", "/api/auth/verify", map[string]string{"email": email, "code": code}, opts{})
	if r.Code != 200 {
		e.t.Fatalf("verify: %d %s", r.Code, r.Body)
	}
	var cookie string
	for _, c := range r.Result().Cookies() {
		cookie = c.Value
	}
	return cookie, r.json()["csrf"].(string)
}

func TestLoginFlowAndCookieFlags(t *testing.T) {
	e := newEnv(t)
	e.do("POST", "/api/auth/request-code", map[string]string{"email": "Dev@Example.com "}, opts{})
	code := e.mail.codes["dev@example.com"]
	if len(code) != 6 {
		t.Fatalf("kod: %q", code)
	}
	r := e.do("POST", "/api/auth/verify", map[string]string{"email": "dev@example.com", "code": code}, opts{})
	if r.Code != 200 {
		t.Fatalf("%d %s", r.Code, r.Body)
	}
	c := r.Result().Cookies()
	if len(c) != 1 || c[0].Name != "__Host-omk_session" || !c[0].HttpOnly || !c[0].Secure ||
		c[0].SameSite != http.SameSiteStrictMode || c[0].Path != "/" || c[0].Domain != "" {
		t.Fatalf("cookie sozlamalari xavfsiz emas: %+v", c)
	}
	// sessiya tokeni bazada ochiq saqlanmaydi
	for h := range e.st.sessions {
		if h == c[0].Value || strings.Contains(h, c[0].Value) {
			t.Fatal("token bazada ochiq")
		}
	}
	// kod bir martalik
	if r := e.do("POST", "/api/auth/verify", map[string]string{"email": "dev@example.com", "code": code}, opts{}); r.Code != 401 {
		t.Fatalf("kod qayta ishlatildi: %d", r.Code)
	}
	me := e.do("GET", "/api/me", nil, opts{cookie: c[0].Value})
	if me.Code != 200 || me.json()["plan"].(map[string]any)["id"] != "free" {
		t.Fatalf("/me: %d %s", me.Code, me.Body)
	}
}

func TestRequestCodeDoesNotRevealAccounts(t *testing.T) {
	e := newEnv(t)
	e.login("known@example.com")
	e.now = e.now.Add(2 * time.Minute)
	a := e.do("POST", "/api/auth/request-code", map[string]string{"email": "known@example.com"}, opts{})
	b := e.do("POST", "/api/auth/request-code", map[string]string{"email": "unknown@example.com"}, opts{})
	if a.Code != b.Code || a.Body.String() != b.Body.String() {
		t.Fatalf("mavjud/mavjud emas farqlanadi: %d %q vs %d %q", a.Code, a.Body, b.Code, b.Body)
	}
}

func TestEmailValidation(t *testing.T) {
	e := newEnv(t)
	for _, bad := range []string{"", "x", "a@b", "a b@c.com", "@c.com", "a@c..com", "a@@c.com", "é@c.com",
		"a@" + strings.Repeat("x", 250) + ".com", "javascript:alert(1)@x.com", "a@c.com\nBcc: x@y.com"} {
		e.srv.lim = devplatform.NewLimiter() // IP chegarasi bu testni to'sib qo'ymasin
		if r := e.do("POST", "/api/auth/request-code", map[string]string{"email": bad}, opts{}); r.Code != 400 {
			t.Errorf("%q: %d", bad, r.Code)
		}
	}
	if e.mail.sent != 0 {
		t.Fatal("yaroqsiz emailga xat ketdi")
	}
}

func TestOTPBruteForceLocksAfterFiveAttempts(t *testing.T) {
	e := newEnv(t)
	email := "victim@example.com"
	e.do("POST", "/api/auth/request-code", map[string]string{"email": email}, opts{})
	good := e.mail.codes[email]
	wrong := "000000"
	if good == wrong {
		wrong = "111111"
	}
	for i := 0; i < 5; i++ {
		if r := e.do("POST", "/api/auth/verify", map[string]string{"email": email, "code": wrong}, opts{}); r.Code != 401 {
			t.Fatalf("#%d: %d", i, r.Code)
		}
	}
	// 5 xatodan keyin TO'G'RI kod ham ishlamaydi
	if r := e.do("POST", "/api/auth/verify", map[string]string{"email": email, "code": good}, opts{}); r.Code != 401 {
		t.Fatalf("bloklangan kod ishladi: %d", r.Code)
	}
}

func TestOTPExpiresAndCooldownAndQuota(t *testing.T) {
	e := newEnv(t)
	email := "a@example.com"
	e.do("POST", "/api/auth/request-code", map[string]string{"email": email}, opts{})
	// 60 s ichida qayta so'rash — cheklov
	if r := e.do("POST", "/api/auth/request-code", map[string]string{"email": email}, opts{}); r.Code != 429 {
		t.Fatalf("cooldown: %d", r.Code)
	}
	// muddati o'tgan kod
	code := e.mail.codes[email]
	e.now = e.now.Add(11 * time.Minute)
	if r := e.do("POST", "/api/auth/verify", map[string]string{"email": email, "code": code}, opts{}); r.Code != 401 {
		t.Fatalf("muddati o'tgan kod ishladi: %d", r.Code)
	}
}

func TestOTPEmailQuotaPer10Minutes(t *testing.T) {
	e := newEnv(t)
	email := "spam@example.com"
	sent := 0
	for i := 0; i < 6; i++ {
		r := e.do("POST", "/api/auth/request-code", map[string]string{"email": email}, opts{})
		if r.Code == 202 {
			sent++
		}
		e.now = e.now.Add(61 * time.Second) // cooldown'dan o'tadi, 10 daqiqa chegarasi qoladi
		// fake store CreatedAt = haqiqiy vaqt: hammasi "hozirgi" oynada
	}
	if sent > otpPer10Min {
		t.Fatalf("10 daqiqada %d ta kod yuborildi (chegara %d)", sent, otpPer10Min)
	}
}

func TestCSRFAndOriginProtection(t *testing.T) {
	e := newEnv(t)
	cookie, csrf := e.login("u@example.com")
	body := map[string]any{"name": "k1", "kind": "server", "apis": []string{"geocode"}}

	if r := e.do("POST", "/api/keys", body, opts{cookie: cookie, csrf: csrf, origin: "https://evil.com"}); r.Code != 403 || r.errCode() != "bad_origin" {
		t.Fatalf("begona origin: %d %s", r.Code, r.Body)
	}
	if r := e.do("POST", "/api/keys", body, opts{cookie: cookie, csrf: csrf, noOrigin: true}); r.Code != 403 {
		t.Fatalf("Origin'siz POST: %d", r.Code)
	}
	if r := e.do("POST", "/api/keys", body, opts{cookie: cookie}); r.Code != 403 || r.errCode() != "bad_csrf" {
		t.Fatalf("CSRF'siz: %d %s", r.Code, r.Body)
	}
	if r := e.do("POST", "/api/keys", body, opts{cookie: cookie, csrf: "x" + csrf}); r.Code != 403 {
		t.Fatalf("noto'g'ri CSRF: %d", r.Code)
	}
	if r := e.do("POST", "/api/keys", body, opts{cookie: cookie, csrf: csrf, ctype: "text/plain"}); r.Code != 415 {
		t.Fatalf("Content-Type: %d", r.Code)
	}
	if r := e.do("POST", "/api/keys", body, opts{cookie: cookie, csrf: csrf}); r.Code != 201 {
		t.Fatalf("to'g'ri so'rov: %d %s", r.Code, r.Body)
	}
}

func TestUnauthenticatedAndBadSession(t *testing.T) {
	e := newEnv(t)
	for _, p := range []string{"/api/me", "/api/keys", "/api/usage", "/api/billing"} {
		if r := e.do("GET", p, nil, opts{}); r.Code != 401 {
			t.Errorf("%s: %d", p, r.Code)
		}
		if r := e.do("GET", p, nil, opts{cookie: "yolg'on-token"}); r.Code != 401 {
			t.Errorf("%s (yolg'on): %d", p, r.Code)
		}
	}
	cookie, _ := e.login("s@example.com")
	e.now = e.now.Add(25 * time.Hour) // faolsizlik muddati
	if r := e.do("GET", "/api/me", nil, opts{cookie: cookie}); r.Code != 401 {
		t.Fatalf("faolsiz sessiya ishladi: %d", r.Code)
	}
}

func TestLogoutInvalidatesSession(t *testing.T) {
	e := newEnv(t)
	cookie, csrf := e.login("l@example.com")
	if r := e.do("POST", "/api/auth/logout", nil, opts{cookie: cookie, csrf: csrf}); r.Code != 204 {
		t.Fatalf("%d", r.Code)
	}
	if r := e.do("GET", "/api/me", nil, opts{cookie: cookie}); r.Code != 401 {
		t.Fatalf("logoutdan keyin sessiya ishlayapti: %d", r.Code)
	}
}

func TestKeyCreateShowsSecretOnceAndValidates(t *testing.T) {
	e := newEnv(t)
	cookie, csrf := e.login("k@example.com")
	o := opts{cookie: cookie, csrf: csrf}

	r := e.do("POST", "/api/keys", map[string]any{"name": "Prod", "kind": "server",
		"apis": []string{"geocode", "directions", "geocode"}, "ips": []string{"203.0.113.7"}}, o)
	if r.Code != 201 {
		t.Fatalf("%d %s", r.Code, r.Body)
	}
	secret := r.json()["secret"].(string)
	if kind, ok := devplatform.KindOf(secret); !ok || kind != "server" {
		t.Fatalf("secret: %q", secret)
	}
	// sir ro'yxatda YO'Q, bazada faqat xesh
	list := e.do("GET", "/api/keys", nil, o)
	if strings.Contains(list.Body.String(), secret) || strings.Contains(list.Body.String(), secret[8:]) {
		t.Fatal("sir ro'yxatda ko'rinyapti")
	}
	keys := r.json()["key"].(map[string]any)
	stored := e.st.keyHash[keys["id"].(string)]
	if string(stored) == secret || string(stored) != string(devplatform.HashKey(e.srv.cfg.Pepper, secret)) {
		t.Fatal("bazada kalit xeshi HMAC(pepper, kalit) bo'lishi kerak, ochiq emas")
	}
	if len(keys["apis"].([]any)) != 2 {
		t.Fatalf("takror API olib tashlanmadi: %v", keys["apis"])
	}

	bad := []map[string]any{
		{"name": "", "kind": "server", "apis": []string{"geocode"}},
		{"name": "x", "kind": "root", "apis": []string{"geocode"}},
		{"name": "x", "kind": "server", "apis": []string{}},
		{"name": "x", "kind": "server", "apis": []string{"places", "submit"}}, // v2'da yo'q API
		{"name": "x", "kind": "server", "apis": []string{"admin"}},
		{"name": "x", "kind": "browser", "apis": []string{"geocode"}}, // origin yo'q
		{"name": "x", "kind": "browser", "apis": []string{"geocode"}, "origins": []string{"*"}},
		{"name": "x", "kind": "browser", "apis": []string{"geocode"}, "origins": []string{"http://evil.com"}},
		{"name": "x", "kind": "browser", "apis": []string{"geocode"}, "origins": []string{"https://a.com"}, "ips": []string{"1.2.3.4"}},
		{"name": "x", "kind": "server", "apis": []string{"geocode"}, "origins": []string{"https://a.com"}},
		{"name": "x", "kind": "server", "apis": []string{"geocode"}, "ips": []string{"0.0.0.0/0"}},
		{"name": "x\x00y", "kind": "server", "apis": []string{"geocode"}},
		{"name": strings.Repeat("n", 61), "kind": "server", "apis": []string{"geocode"}},
	}
	for i, b := range bad {
		e.srv.lim = devplatform.NewLimiter()
		if r := e.do("POST", "/api/keys", b, o); r.Code != 400 {
			t.Errorf("#%d qabul qilindi: %d %v", i, r.Code, b)
		}
	}
	// noma'lum maydon rad etiladi (masalan, hisobni almashtirishga urinish)
	if r := e.do("POST", "/api/keys", map[string]any{"name": "x", "kind": "server", "apis": []string{"geocode"}, "account_id": "acc1"}, o); r.Code != 400 {
		t.Errorf("noma'lum maydon: %d", r.Code)
	}
}

func TestKeyLimitAndOwnership(t *testing.T) {
	e := newEnv(t)
	cookie, csrf := e.login("own@example.com")
	o := opts{cookie: cookie, csrf: csrf}
	spec := map[string]any{"name": "k", "kind": "server", "apis": []string{"geocode"}}
	var firstID string
	for i := 0; i < maxActiveKeys; i++ {
		e.srv.lim = devplatform.NewLimiter() // kalit-mutatsiya limitini bu testda aylanib o'tamiz
		r := e.do("POST", "/api/keys", spec, o)
		if r.Code != 201 {
			t.Fatalf("#%d: %d %s", i, r.Code, r.Body)
		}
		if i == 0 {
			firstID = r.json()["key"].(map[string]any)["id"].(string)
		}
	}
	e.srv.lim = devplatform.NewLimiter()
	if r := e.do("POST", "/api/keys", spec, o); r.Code != 409 || r.errCode() != "key_limit" {
		t.Fatalf("chegara: %d %s", r.Code, r.Body)
	}

	// boshqa hisob birinchi hisobning kalitiga tega olmaydi
	e.srv.lim = devplatform.NewLimiter()
	c2, csrf2 := e.login("other@example.com")
	o2 := opts{cookie: c2, csrf: csrf2}
	e.srv.lim = devplatform.NewLimiter()
	if r := e.do("PATCH", "/api/keys/"+firstID, map[string]any{"name": "hack", "apis": []string{"geocode"}}, o2); r.Code != 404 {
		t.Errorf("boshqa hisob PATCH: %d", r.Code)
	}
	if r := e.do("DELETE", "/api/keys/"+firstID, nil, o2); r.Code != 404 {
		t.Errorf("boshqa hisob DELETE: %d", r.Code)
	}
	if r := e.do("POST", "/api/keys/"+firstID+"/rotate", nil, o2); r.Code != 404 {
		t.Errorf("boshqa hisob rotate: %d", r.Code)
	}
}

func TestKeyPatchRotateRevoke(t *testing.T) {
	e := newEnv(t)
	cookie, csrf := e.login("r@example.com")
	o := opts{cookie: cookie, csrf: csrf}
	r := e.do("POST", "/api/keys", map[string]any{"name": "b", "kind": "browser", "apis": []string{"geocode"},
		"origins": []string{"https://app.example.com"}}, o)
	id := r.json()["key"].(map[string]any)["id"].(string)

	// PATCH: tur o'zgarmaydi, brauzer kalitidan origin olib tashlab bo'lmaydi
	if r := e.do("PATCH", "/api/keys/"+id, map[string]any{"name": "b2", "kind": "server", "apis": []string{"geocode"}, "origins": []string{}}, o); r.Code != 400 {
		t.Fatalf("originsiz brauzer kaliti: %d %s", r.Code, r.Body)
	}
	if r := e.do("PATCH", "/api/keys/"+id, map[string]any{"name": "b2", "apis": []string{"geocode", "reverse"},
		"origins": []string{"https://*.example.com"}}, o); r.Code != 200 {
		t.Fatalf("patch: %d %s", r.Code, r.Body)
	}

	rot := e.do("POST", "/api/keys/"+id+"/rotate", nil, o)
	if rot.Code != 201 {
		t.Fatalf("rotate: %d %s", rot.Code, rot.Body)
	}
	newSecret := rot.json()["secret"].(string)
	if kind, ok := devplatform.KindOf(newSecret); !ok || kind != "browser" {
		t.Fatal("yangi kalit turi buzildi")
	}
	if e.st.keys[id].ExpiresAt == nil || e.st.keys[id].ExpiresAt.Sub(e.now) > RotationGrace+time.Second {
		t.Fatalf("eski kalit muddati: %v", e.st.keys[id].ExpiresAt)
	}
	if rot.json()["key"].(map[string]any)["id"] == id {
		t.Fatal("yangi kalit eskisi bilan bir xil id")
	}

	if r := e.do("DELETE", "/api/keys/"+id, nil, o); r.Code != 204 {
		t.Fatalf("revoke: %d", r.Code)
	}
	if r := e.do("DELETE", "/api/keys/"+id, nil, o); r.Code != 404 {
		t.Fatalf("ikkinchi revoke: %d", r.Code)
	}
	if r := e.do("POST", "/api/keys/"+id+"/rotate", nil, o); r.Code != 404 {
		t.Fatalf("bekor qilinganni almashtirish: %d", r.Code)
	}
}

func TestUsageAndBilling(t *testing.T) {
	e := newEnv(t)
	cookie, csrf := e.login("u2@example.com")
	o := opts{cookie: cookie, csrf: csrf}
	r := e.do("POST", "/api/keys", map[string]any{"name": "k", "kind": "server", "apis": []string{"geocode"}}, o)
	kid := r.json()["key"].(map[string]any)["id"].(string)
	today := utcDay(e.now)
	e.st.usage = []UsageDay{
		{Day: today, KeyID: kid, API: "geocode", Requests: 100, Errors: 3},
		{Day: today.AddDate(0, 0, -1), KeyID: kid, API: "reverse", Requests: 50, Errors: 1},
		{Day: today, KeyID: "boshqa-kalit", API: "geocode", Requests: 9999}, // boshqa hisob — ko'rinmaydi
	}
	u := e.do("GET", "/api/usage?days=7", nil, o)
	if u.Code != 200 {
		t.Fatalf("%d %s", u.Code, u.Body)
	}
	body := u.json()
	if len(body["daily"].([]any)) != 7 {
		t.Fatalf("kunlar to'ldirilmadi: %d", len(body["daily"].([]any)))
	}
	by := body["by_key"].([]any)[0].(map[string]any)
	if by["requests"].(float64) != 150 || by["errors"].(float64) != 4 {
		t.Fatalf("by_key: %v", by)
	}
	if strings.Contains(u.Body.String(), "9999") {
		t.Fatal("boshqa hisob statistikasi sizdi")
	}
	if e.do("GET", "/api/usage?days=0", nil, o).Code != 400 || e.do("GET", "/api/usage?days=999", nil, o).Code != 400 {
		t.Fatal("days chegarasi")
	}

	b := e.do("GET", "/api/billing", nil, o)
	bj := b.json()
	if b.Code != 200 || bj["price_uzs"].(float64) != 50000 || bj["plan"] != "free" || bj["instructions"] != "Karta: 8600 ..." {
		t.Fatalf("billing: %s", b.Body)
	}
}

func TestSubscribeRequestIsOnlyARequest(t *testing.T) {
	e := newEnv(t)
	cookie, csrf := e.login("sub@example.com")
	o := opts{cookie: cookie, csrf: csrf}
	if r := e.do("POST", "/api/billing/subscribe-request", map[string]string{"note": "kerak"}, o); r.Code != 202 {
		t.Fatalf("%d %s", r.Code, r.Body)
	}
	// so'rov obunani YOQMAYDI
	me := e.do("GET", "/api/me", nil, o).json()["account"].(map[string]any)
	if me["subscription"] != false {
		t.Fatal("so'rov obunani o'zi yoqib yubordi")
	}
	if r := e.do("POST", "/api/billing/subscribe-request", map[string]string{}, o); r.Code != 409 {
		t.Fatalf("takroriy so'rov: %d", r.Code)
	}
	if r := e.do("POST", "/api/billing/subscribe-request", map[string]string{"note": strings.Repeat("x", 501)}, o); r.Code == 202 {
		t.Fatal("uzun izoh qabul qilindi")
	}
}

func TestSuspendedAccountCannotMutate(t *testing.T) {
	e := newEnv(t)
	cookie, csrf := e.login("bad@example.com")
	o := opts{cookie: cookie, csrf: csrf}
	for _, a := range e.st.accounts {
		a.Suspended = true
	}
	if r := e.do("POST", "/api/keys", map[string]any{"name": "k", "kind": "server", "apis": []string{"geocode"}}, o); r.Code != 403 {
		t.Fatalf("to'xtatilgan hisob kalit yaratdi: %d", r.Code)
	}
	if r := e.do("GET", "/api/keys", nil, o); r.Code != 200 {
		t.Fatalf("ko'rish ishlashi kerak: %d", r.Code)
	}
	if r := e.do("POST", "/api/auth/logout", nil, o); r.Code != 204 {
		t.Fatalf("chiqish ishlashi kerak: %d", r.Code)
	}
}

func TestPlanReflectsAccountFlags(t *testing.T) {
	e := newEnv(t)
	cookie, csrf := e.login("plan@example.com")
	o := opts{cookie: cookie, csrf: csrf}
	get := func() string {
		return e.do("GET", "/api/me", nil, o).json()["plan"].(map[string]any)["id"].(string)
	}
	for _, a := range e.st.accounts {
		a.Subscription = true
	}
	if get() != "paid" {
		t.Fatal("obuna: paid emas")
	}
	for _, a := range e.st.accounts {
		a.Overdue = true
	}
	if get() != "free" {
		t.Fatal("qarzdor obuna bepul limitga tushmadi")
	}
	for _, a := range e.st.accounts {
		a.Ecosystem = true
	}
	if get() != "ecosystem" {
		t.Fatal("ekotizim")
	}
}

func TestSecurityHeadersAndNotFound(t *testing.T) {
	e := newEnv(t)
	r := e.do("GET", "/healthz", nil, opts{})
	for k, want := range map[string]string{
		"X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Cache-Control": "no-store",
		"Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
	} {
		if r.Header().Get(k) != want {
			t.Errorf("%s = %q", k, r.Header().Get(k))
		}
	}
	if r.Header().Get("Strict-Transport-Security") == "" {
		t.Error("HSTS yo'q")
	}
	if r.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Error("konsol CORS ochmasligi kerak (faqat same-origin)")
	}
	if e.do("GET", "/api/nope", nil, opts{}).Code != 404 {
		t.Error("noma'lum yo'l 404 emas")
	}
}
