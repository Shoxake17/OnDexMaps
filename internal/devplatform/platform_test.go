package devplatform

import (
	"context"
	"errors"
	"net/http"
	"net/netip"
	"testing"
	"time"
)

type fixture struct {
	p      *Platform
	st     *fakeStore
	server string
	brow   string
}

func newFixture(t *testing.T, acc AccountState) *fixture {
	t.Helper()
	st := newFakeStore()
	f := &fixture{p: New(st, Config{Pepper: testPepper, Plans: DefaultPlans()}), st: st,
		server: mustKey(KindServer), brow: mustKey(KindBrowser)}
	ips, _ := ParseIPList([]string{"203.0.113.0/24"})
	acc.ID = "acc1"
	st.add(testPepper, f.server, KeyRecord{ID: "ks", AccountID: "acc1", Kind: KindServer,
		APIs: []string{APIGeocode, APIDirections}, IPs: ips, Account: acc})
	st.add(testPepper, f.brow, KeyRecord{ID: "kb", AccountID: "acc1", Kind: KindBrowser,
		APIs: []string{APIGeocode}, Origins: []string{"https://app.example.com", "https://*.partner.uz"}, Account: acc})
	return f
}

func serverIn(f *fixture, mod func(*AuthInput)) AuthInput {
	in := AuthInput{Secret: f.server, API: APIGeocode, ClientIP: ip("203.0.113.5")}
	if mod != nil {
		mod(&in)
	}
	return in
}

func wantDeny(t *testing.T, d *Denial, status int, code string) {
	t.Helper()
	if d == nil {
		t.Fatalf("ruxsat berildi; kutilgan %d %s", status, code)
	}
	if d.Status != status || d.Code != code {
		t.Fatalf("got %d %s; kutilgan %d %s", d.Status, d.Code, status, code)
	}
}

func TestAuthorizeServerKeyMatrix(t *testing.T) {
	f := newFixture(t, AccountState{})
	ctx := context.Background()

	if g, d := f.p.Authorize(ctx, serverIn(f, nil)); d != nil || g == nil || g.Plan.ID != PlanFree {
		t.Fatalf("to'g'ri so'rov rad etildi: %v", d)
	}
	cases := []struct {
		name   string
		mod    func(*AuthInput)
		status int
		code   string
	}{
		{"kalit yo'q", func(i *AuthInput) { i.Secret = "" }, 401, CodeMissingKey},
		{"axlat kalit", func(i *AuthInput) { i.Secret = "abc" }, 401, CodeInvalidKey},
		{"noma'lum kalit", func(i *AuthInput) { i.Secret = mustKey(KindServer) }, 401, CodeInvalidKey},
		{"URL'da server kaliti", func(i *AuthInput) { i.SecretFromQuery = true }, 403, CodeKeyRestricted},
		{"Origin bilan server kaliti", func(i *AuthInput) { i.Origin = "https://app.example.com" }, 403, CodeKeyRestricted},
		{"begona IP", func(i *AuthInput) { i.ClientIP = ip("198.51.100.1") }, 403, CodeKeyRestricted},
		{"yoqilmagan API (reverse)", func(i *AuthInput) { i.API = APIReverse }, 403, CodeAPINotAllowed},
		{"yoqilmagan API (places)", func(i *AuthInput) { i.API = APIPlaces }, 403, CodeAPINotAllowed},
		{"ruxsat etilmagan API nomi", func(i *AuthInput) { i.API = "submit" }, 403, CodeAPINotAllowed},
		{"bo'sh API nomi", func(i *AuthInput) { i.API = "" }, 403, CodeAPINotAllowed},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			f := newFixture(t, AccountState{})
			_, d := f.p.Authorize(ctx, serverIn(f, c.mod))
			wantDeny(t, d, c.status, c.code)
		})
	}
}

func TestAuthorizeBrowserKeyMatrix(t *testing.T) {
	f := newFixture(t, AccountState{})
	ctx := context.Background()
	in := func(mod func(*AuthInput)) AuthInput {
		i := AuthInput{Secret: f.brow, SecretFromQuery: true, API: APIGeocode,
			Origin: "https://app.example.com", ClientIP: ip("8.8.8.8")}
		if mod != nil {
			mod(&i)
		}
		return i
	}
	if _, d := f.p.Authorize(ctx, in(nil)); d != nil {
		t.Fatalf("to'g'ri brauzer so'rovi rad etildi: %v", d)
	}
	if _, d := f.p.Authorize(ctx, in(func(i *AuthInput) { i.Origin = "https://x.partner.uz" })); d != nil {
		t.Fatalf("wildcard origin rad etildi: %v", d)
	}
	// Origin yo'q, lekin Referer to'g'ri — ruxsat
	if _, d := f.p.Authorize(ctx, in(func(i *AuthInput) { i.Origin = ""; i.Referer = "https://app.example.com/page?a=1" })); d != nil {
		t.Fatalf("Referer bilan rad etildi: %v", d)
	}
	bad := []func(*AuthInput){
		func(i *AuthInput) { i.Origin = ""; i.Referer = "" }, // sarlavhasiz (curl) — brauzer kaliti ishlamaydi
		func(i *AuthInput) { i.Origin = "https://evil.com" },
		func(i *AuthInput) { i.Origin = "null" },
		func(i *AuthInput) { i.Origin = "https://partner.uz" },
		func(i *AuthInput) { i.Origin = ""; i.Referer = "https://evil.com/" },
	}
	for n, mod := range bad {
		_, d := f.p.Authorize(ctx, in(mod))
		if d == nil || d.Code != CodeKeyRestricted {
			t.Errorf("#%d: kutilgan key_restricted, got %v", n, d)
		}
	}
	_, d := f.p.Authorize(ctx, in(func(i *AuthInput) { i.API = APIDirections }))
	wantDeny(t, d, 403, CodeAPINotAllowed)
}

func TestAuthorizeRevokedExpiredSuspended(t *testing.T) {
	ctx := context.Background()
	past := time.Now().Add(-time.Minute)
	future := time.Now().Add(time.Hour)
	for name, rec := range map[string]KeyRecord{
		"bekor":          {Revoked: true},
		"muddati o'tgan": {ExpiresAt: &past},
	} {
		st := newFakeStore()
		p := New(st, Config{Pepper: testPepper, Plans: DefaultPlans()})
		k := mustKey(KindServer)
		rec.ID, rec.AccountID, rec.Kind, rec.APIs = "k", "a", KindServer, []string{APIGeocode}
		st.add(testPepper, k, rec)
		_, d := p.Authorize(ctx, AuthInput{Secret: k, API: APIGeocode, ClientIP: ip("1.1.1.1")})
		if d == nil || d.Code != CodeInvalidKey {
			t.Errorf("%s: kutilgan invalid_key, got %v", name, d)
		}
	}
	// muddati kelajakda — ishlaydi
	st := newFakeStore()
	p := New(st, Config{Pepper: testPepper, Plans: DefaultPlans()})
	k := mustKey(KindServer)
	st.add(testPepper, k, KeyRecord{ID: "k", AccountID: "a", Kind: KindServer, APIs: []string{APIGeocode}, ExpiresAt: &future})
	if _, d := p.Authorize(ctx, AuthInput{Secret: k, API: APIGeocode, ClientIP: ip("1.1.1.1")}); d != nil {
		t.Fatalf("muddati tugamagan kalit rad etildi: %v", d)
	}
	// hisob to'xtatilgan
	f := newFixture(t, AccountState{Suspended: true})
	_, d := f.p.Authorize(ctx, serverIn(f, nil))
	wantDeny(t, d, 403, CodeAccountSuspended)
}

func TestAuthorizePlanSelection(t *testing.T) {
	ctx := context.Background()
	cases := []struct {
		acc  AccountState
		want PlanID
	}{
		{AccountState{}, PlanFree},
		{AccountState{Subscription: true}, PlanPaid},
		{AccountState{Subscription: true, Overdue: true}, PlanFree}, // qarzdor — bepul limitlarga, bloklanmaydi
		{AccountState{Ecosystem: true}, PlanEcosystem},
		{AccountState{Ecosystem: true, Subscription: true, Overdue: true}, PlanEcosystem},
	}
	for _, c := range cases {
		f := newFixture(t, c.acc)
		g, d := f.p.Authorize(ctx, serverIn(f, nil))
		if d != nil || g.Plan.ID != c.want {
			t.Errorf("%+v: reja %v, kutilgan %v (%v)", c.acc, g, c.want, d)
		}
	}
}

func TestAuthorizeRateLimit(t *testing.T) {
	f := newFixture(t, AccountState{}) // Free: burst 20
	ctx := context.Background()
	now := time.Now()
	f.p.limiter.now = func() time.Time { return now }
	allowed := 0
	var last *Denial
	for i := 0; i < 30; i++ {
		if _, d := f.p.Authorize(ctx, serverIn(f, nil)); d == nil {
			allowed++
		} else {
			last = d
		}
	}
	if allowed != 20 {
		t.Fatalf("burst 20 kutilgan, ruxsat berilgan: %d", allowed)
	}
	wantDeny(t, last, http.StatusTooManyRequests, CodeRateLimited)
	if last.RetryAfter < time.Second {
		t.Errorf("RetryAfter butun soniyadan kam: %v", last.RetryAfter)
	}
	now = now.Add(time.Second) // 10 token tiklanadi
	ok := 0
	for i := 0; i < 15; i++ {
		if _, d := f.p.Authorize(ctx, serverIn(f, nil)); d == nil {
			ok++
		}
	}
	if ok != 10 {
		t.Fatalf("1 soniyadan keyin 10 ta kutilgan, got %d", ok)
	}
}

func TestAuthorizeMonthlyQuotaFreeOnly(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t, AccountState{})
	f.st.usage["acc1"] = 200_000
	_, d := f.p.Authorize(ctx, serverIn(f, nil))
	wantDeny(t, d, 429, CodeQuotaExceeded)
	if d.RetryAfter <= 0 {
		t.Error("quota_exceeded uchun RetryAfter (oy oxirigacha) yo'q")
	}

	// 199 999 — ruxsat; bitta hisoblangach — tugadi (jarayon ichida qayta o'qimasdan)
	f = newFixture(t, AccountState{})
	f.st.usage["acc1"] = 199_999
	g, d := f.p.Authorize(ctx, serverIn(f, nil))
	if d != nil {
		t.Fatal(d)
	}
	f.p.Record(g, APIGeocode, 200)
	f.p.limiter.now = func() time.Time { return time.Now().Add(time.Hour) } // tezlik to'sig'i xalaqit bermasin
	_, d = f.p.Authorize(ctx, serverIn(f, nil))
	wantDeny(t, d, 429, CodeQuotaExceeded)

	// Obuna va ekotizim: oylik chegara yo'q
	for _, acc := range []AccountState{{Subscription: true}, {Ecosystem: true}} {
		f := newFixture(t, acc)
		f.st.usage["acc1"] = 50_000_000
		if _, d := f.p.Authorize(ctx, serverIn(f, nil)); d != nil {
			t.Errorf("%+v: chegarasiz reja rad etildi: %v", acc, d)
		}
	}
}

func TestAuthorizeStoreErrorFailsClosedWithoutBlamingKey(t *testing.T) {
	f := newFixture(t, AccountState{})
	f.st.lookErr = errors.New("baza yiqildi")
	_, d := f.p.Authorize(context.Background(), serverIn(f, nil))
	wantDeny(t, d, 503, CodeUnavailable)

	f = newFixture(t, AccountState{})
	f.st.usageErr = errors.New("baza yiqildi")
	_, d = f.p.Authorize(context.Background(), serverIn(f, nil))
	wantDeny(t, d, 503, CodeUnavailable)
}

func TestAuthFailGuardBlocksBruteForceButNotOtherIPs(t *testing.T) {
	f := newFixture(t, AccountState{})
	ctx := context.Background()
	attacker, other := ip("198.51.100.9"), ip("203.0.113.5")
	bad := func() *Denial {
		_, d := f.p.Authorize(ctx, AuthInput{Secret: mustKey(KindServer), API: APIGeocode, ClientIP: attacker})
		return d
	}
	for i := 0; i < 20; i++ {
		if d := bad(); d == nil || d.Code != CodeInvalidKey {
			t.Fatalf("#%d: %v", i, d)
		}
	}
	wantDeny(t, bad(), 429, CodeAuthBlocked)
	// bloklangan IP to'g'ri kalit bilan ham kirolmaydi (kalitga umuman qaralmaydi)
	_, d := f.p.Authorize(ctx, AuthInput{Secret: f.server, API: APIGeocode, ClientIP: attacker})
	wantDeny(t, d, 429, CodeAuthBlocked)
	// boshqa IP ta'sirlanmaydi
	if _, d := f.p.Authorize(ctx, serverIn(f, func(i *AuthInput) { i.ClientIP = other })); d != nil {
		t.Fatalf("begona IP xatosi bilan boshqa IP jazolandi: %v", d)
	}
}

func TestMissingKeyDoesNotCountAsFailure(t *testing.T) {
	f := newFixture(t, AccountState{})
	for i := 0; i < 100; i++ {
		_, d := f.p.Authorize(context.Background(), AuthInput{API: APIGeocode, ClientIP: ip("198.51.100.9")})
		wantDeny(t, d, 401, CodeMissingKey)
	}
}

// ---- Resolver kesh ----

func TestResolverCachesAndExpires(t *testing.T) {
	st := newFakeStore()
	r := NewResolver(st, testPepper, DefaultPlans())
	now := time.Now()
	r.now = func() time.Time { return now }
	k := mustKey(KindServer)
	st.add(testPepper, k, KeyRecord{ID: "k", AccountID: "a", Kind: KindServer, APIs: []string{APIGeocode}})
	ctx := context.Background()

	for i := 0; i < 5; i++ {
		if _, err := r.Resolve(ctx, k); err != nil {
			t.Fatal(err)
		}
	}
	if st.lookupCount() != 1 {
		t.Fatalf("kesh ishlamadi: %d ta so'rov", st.lookupCount())
	}
	// bekor qilindi: kesh muddati o'tgach ko'rinadi (≤15 s — hujjatlashtirilgan)
	st.mu.Lock()
	for _, v := range st.keys {
		v.Revoked = true
	}
	st.mu.Unlock()
	now = now.Add(16 * time.Second)
	if _, err := r.Resolve(ctx, k); !errors.Is(err, ErrInvalidKey) {
		t.Fatalf("bekor qilingan kalit 16 s dan keyin ham ishlayapti: %v", err)
	}
}

func TestResolverNegativeCacheProtectsDB(t *testing.T) {
	st := newFakeStore()
	r := NewResolver(st, testPepper, DefaultPlans())
	k := mustKey(KindServer)
	for i := 0; i < 50; i++ {
		if _, err := r.Resolve(context.Background(), k); !errors.Is(err, ErrInvalidKey) {
			t.Fatal(err)
		}
	}
	if st.lookupCount() != 1 {
		t.Fatalf("manfiy kesh ishlamadi: %d", st.lookupCount())
	}
	// noto'g'ri shakl — bazaga umuman bormaydi
	if _, err := r.Resolve(context.Background(), "junk"); !errors.Is(err, ErrInvalidKey) || st.lookupCount() != 1 {
		t.Fatal("axlat kalit bazaga yetdi")
	}
}

func TestResolverEvictsWhenFull(t *testing.T) {
	st := newFakeStore()
	r := NewResolver(st, testPepper, DefaultPlans())
	r.maxEntries = 10
	for i := 0; i < 100; i++ {
		_, _ = r.Resolve(context.Background(), mustKey(KindServer))
	}
	r.mu.Lock()
	n := len(r.pos) + len(r.neg)
	r.mu.Unlock()
	if n > 10 {
		t.Fatalf("kesh chegarasi buzildi: %d", n)
	}
}

// ---- Limiter ----

func TestLimiterZeroRPSDenies(t *testing.T) {
	if ok, _ := NewLimiter().Allow("x", 0, 10); ok {
		t.Fatal("rps=0 ruxsat berdi")
	}
}

func TestLimiterIsolatedPerKey(t *testing.T) {
	l := NewLimiter()
	now := time.Now()
	l.now = func() time.Time { return now }
	for i := 0; i < 5; i++ {
		l.Allow("a", 1, 5)
	}
	if ok, _ := l.Allow("a", 1, 5); ok {
		t.Fatal("a kaliti burst'dan oshdi")
	}
	if ok, _ := l.Allow("b", 1, 5); !ok {
		t.Fatal("b kaliti a bilan bog'landi")
	}
}

// ---- Meter ----

func TestClassify(t *testing.T) {
	cases := []struct {
		s          int
		counted, e bool
	}{
		{200, true, false}, {204, true, false}, {302, true, false}, {404, true, false},
		{400, false, true}, {401, false, true}, {403, false, true}, {422, false, true},
		{500, false, true}, {503, false, true}, {429, false, false}, {100, false, true},
	}
	for _, c := range cases {
		counted, e := classify(c.s)
		if counted != c.counted || e != c.e {
			t.Errorf("classify(%d) = %v,%v", c.s, counted, e)
		}
	}
}

func TestMeterFlushAggregatesAndRollsBack(t *testing.T) {
	st := newFakeStore()
	m := NewMeter(st)
	key := &Key{KeyRecord: KeyRecord{ID: "k1", AccountID: "a1"}}
	for i := 0; i < 5; i++ {
		m.Record(key, APIGeocode, 200)
	}
	m.Record(key, APIGeocode, 404)
	m.Record(key, APIGeocode, 500)
	m.Record(key, APIGeocode, 429) // hisoblanmaydi
	m.Record(key, APIDirections, 200)

	st.writeErr = errors.New("baza yo'q")
	if err := m.Flush(context.Background()); err == nil {
		t.Fatal("xato qaytmadi")
	}
	if len(st.written) != 0 {
		t.Fatal("xatoda yozilgan bo'lmasligi kerak")
	}
	m.Record(key, APIGeocode, 200) // xato paytida ham yig'ish davom etadi
	st.writeErr = nil
	if err := m.Flush(context.Background()); err != nil {
		t.Fatal(err)
	}
	got := map[string]UsageRow{}
	for _, r := range st.written {
		got[r.API] = r
	}
	if g := got[APIGeocode]; g.Requests != 7 || g.Errors != 1 {
		t.Errorf("geocode: %+v (kutilgan 7 so'rov, 1 xato)", g)
	}
	if g := got[APIDirections]; g.Requests != 1 {
		t.Errorf("directions: %+v", g)
	}
	// ikkinchi yuvish — bo'sh, qayta yozilmaydi
	n := len(st.written)
	_ = m.Flush(context.Background())
	if len(st.written) != n {
		t.Error("ortirmalar ikki marta yozildi")
	}
}

func TestMeterMonthCounterNoDoubleCount(t *testing.T) {
	st := newFakeStore()
	st.usage["a1"] = 100
	m := NewMeter(st)
	ctx := context.Background()
	key := &Key{KeyRecord: KeyRecord{ID: "k1", AccountID: "a1"}}
	if v, _ := m.MonthUsed(ctx, "a1"); v != 100 {
		t.Fatal(v)
	}
	m.Record(key, APIGeocode, 200)
	m.Record(key, APIGeocode, 200)
	m.Record(key, APIGeocode, 500) // xato — oylikka kirmaydi
	_ = m.Flush(ctx)
	if v, _ := m.MonthUsed(ctx, "a1"); v != 102 {
		t.Fatalf("oylik hisob %d, kutilgan 102 (qayta o'qilmasligi kerak)", v)
	}
}

func TestMeterMonthRollover(t *testing.T) {
	st := newFakeStore()
	st.usage["a1"] = 500
	m := NewMeter(st)
	now := time.Date(2026, 9, 30, 23, 59, 0, 0, time.UTC)
	m.now = func() time.Time { return now }
	ctx := context.Background()
	if v, _ := m.MonthUsed(ctx, "a1"); v != 500 {
		t.Fatal(v)
	}
	st.mu.Lock()
	st.usage["a1"] = 0 // yangi oyda baza 0 qaytaradi
	st.mu.Unlock()
	now = time.Date(2026, 10, 1, 0, 0, 1, 0, time.UTC)
	if v, _ := m.MonthUsed(ctx, "a1"); v != 0 {
		t.Fatalf("oy almashganda hisoblagich yangilanmadi: %d", v)
	}
}

func TestMeterRunFlushesOnShutdown(t *testing.T) {
	st := newFakeStore()
	m := NewMeter(st)
	m.Record(&Key{KeyRecord: KeyRecord{ID: "k", AccountID: "a"}}, APIPlaces, 200)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { m.Run(ctx, time.Hour); close(done) }()
	cancel()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("Run to'xtamadi")
	}
	if len(st.written) != 1 {
		t.Fatal("to'xtashda oxirgi yuvish bajarilmadi")
	}
}

func TestPlansForDefaultsAreAsAgreed(t *testing.T) {
	p := DefaultPlans()
	if p.Free.RPS != 10 || p.Free.MonthlyCap != 200_000 || p.Paid.RPS != 100 || p.Paid.MonthlyCap != 0 {
		t.Fatalf("kelishilgan chegaralar buzildi: %+v", p)
	}
	if SubscriptionPriceUZS != 50_000 {
		t.Fatal("obuna narxi 50 000 bo'lishi kerak")
	}
	_ = netip.Addr{}
}
