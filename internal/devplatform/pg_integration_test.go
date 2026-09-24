package devplatform_test

// Integratsiya testi — HAQIQIY bazada (docker PostGIS, migratsiyalar qo'llangan).
//
//	$env:ONDEXMAP_INTEGRATION='1'; go test ./internal/devplatform/ -run Integration -count=1 -v
//
// Isbotlaydi:
//  1. meter/console do'konlari haqiqiy SQL bilan ishlaydi (kalit qidirish, hisoblagich UPSERT, oylik yig'indi);
//  2. XAVFSIZLIK: rol grantlari haqiqatan ushlaydi — konsol o'ziga obuna/ekotizim bera olmaydi, hisob-fakturaga
//     yozolmaydi; hisoblovchi kalit yarata olmaydi; ommaviy rollar yangi jadvallarni ko'rmaydi.
//
// Test o'z qatorlarini o'zi tozalaydi (`itest-` email prefiksi).

import (
	"context"
	"net/netip"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"ondexmap/internal/config"
	"ondexmap/internal/console"
	"ondexmap/internal/devplatform"
	"ondexmap/internal/storage"
)

type dsns struct{ owner, app, submit, meter, console string }

func itestDSNs(t *testing.T) dsns {
	t.Helper()
	if os.Getenv("ONDEXMAP_INTEGRATION") != "1" {
		t.Skip("ONDEXMAP_INTEGRATION=1 emas — integratsiya testi o'tkazib yuborildi")
	}
	cfg, err := config.Load("../../.env")
	if err != nil {
		t.Fatalf("sozlama: %v", err)
	}
	d := dsns{cfg.DatabaseURLMigrate, cfg.DatabaseURL, cfg.SubmitDatabaseURL, cfg.MeterDatabaseURL, cfg.ConsoleDatabaseURL}
	if d.owner == "" || d.app == "" || d.submit == "" || d.meter == "" || d.console == "" {
		t.Skip("DATABASE_URL_MIGRATE / DATABASE_URL / SUBMIT / METER / CONSOLE DATABASE_URL to'ldirilmagan")
	}
	return d
}

func exec(t *testing.T, dsn, sql string, args ...any) error {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	c, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatalf("ulanish: %v", err)
	}
	defer func() { _ = c.Close(ctx) }()
	_, err = c.Exec(ctx, sql, args...)
	return err
}

// denied — 42501 (insufficient_privilege) kutiladi: boshqa xato ham "ruxsat yo'q" degani EMAS.
func denied(t *testing.T, name string, err error) {
	t.Helper()
	var pe *pgconn.PgError
	if err == nil {
		t.Errorf("%s: RUXSAT BERILDI (rad etilishi kerak edi)", name)
		return
	}
	if !asPg(err, &pe) || pe.Code != "42501" {
		t.Errorf("%s: kutilgan 42501, got %v", name, err)
	}
}

func asPg(err error, target **pgconn.PgError) bool {
	for err != nil {
		if pe, ok := err.(*pgconn.PgError); ok { //nolint:errorlint // zanjir qo'lda ochiladi
			*target = pe
			return true
		}
		u, ok := err.(interface{ Unwrap() error }) //nolint:errorlint
		if !ok {
			return false
		}
		err = u.Unwrap()
	}
	return false
}

func cleanup(t *testing.T, owner string) {
	t.Helper()
	q := []string{
		`DELETE FROM billing_invoices WHERE account_id IN (SELECT id FROM dev_accounts WHERE email LIKE 'itest-%')`,
		`DELETE FROM dev_accounts WHERE email LIKE 'itest-%'`,
		`DELETE FROM dev_otps WHERE email LIKE 'itest-%'`,
	}
	for _, s := range q {
		if err := exec(t, owner, s); err != nil {
			t.Fatalf("tozalash: %v", err)
		}
	}
}

var pepper = []byte("integration-pepper-0123456789abcdef0123")

func TestIntegrationMeterAndConsoleStores(t *testing.T) {
	d := itestDSNs(t)
	cleanup(t, d.owner)
	t.Cleanup(func() { cleanup(t, d.owner) })
	ctx := context.Background()

	cpool, err := storage.OpenConsole(ctx, d.console)
	if err != nil {
		t.Fatal(err)
	}
	defer cpool.Close()
	mpool, err := storage.OpenMeter(ctx, d.meter)
	if err != nil {
		t.Fatal(err)
	}
	defer mpool.Close()
	cs, ms := console.NewPGStore(cpool), devplatform.NewPGStore(mpool)

	acc, err := cs.CreateAccount(ctx, "itest-a@example.com")
	if err != nil {
		t.Fatal(err)
	}
	if again, err := cs.CreateAccount(ctx, "itest-a@example.com"); err != nil || again.ID != acc.ID {
		t.Fatalf("takroriy CreateAccount: %v", err)
	}
	if acc.Subscription || acc.Ecosystem || acc.Suspended {
		t.Fatal("yangi hisob bepul, ekotizimsiz va faol bo'lishi kerak")
	}

	// kalit yaratish -> hisoblovchi topadi
	secret, prefix, _ := devplatform.GenerateKey(devplatform.KindBrowser)
	hash := devplatform.HashKey(pepper, secret)
	k, err := cs.CreateKey(ctx, console.NewKey{AccountID: acc.ID, Name: "web", Kind: devplatform.KindBrowser, Prefix: prefix,
		Hash: hash, APIs: []string{"geocode", "places"}, Origins: []string{"https://app.example.com"}})
	if err != nil {
		t.Fatal(err)
	}
	rec, err := ms.LookupKey(ctx, hash)
	if err != nil || rec.ID != k.ID || rec.Kind != devplatform.KindBrowser || rec.Revoked || rec.Account.Subscription {
		t.Fatalf("LookupKey: %+v %v", rec, err)
	}
	if _, err := ms.LookupKey(ctx, devplatform.HashKey(pepper, "boshqa")); err != devplatform.ErrNotFound { //nolint:errorlint
		t.Fatalf("noma'lum kalit: %v", err)
	}

	// server kaliti + IP (cidr) aylanishi
	ssecret, sprefix, _ := devplatform.GenerateKey(devplatform.KindServer)
	shash := devplatform.HashKey(pepper, ssecret)
	if _, err := cs.CreateKey(ctx, console.NewKey{AccountID: acc.ID, Name: "srv", Kind: devplatform.KindServer, Prefix: sprefix,
		Hash: shash, APIs: []string{"directions"}, IPs: []string{"203.0.113.0/24", "2001:db8::/32"}}); err != nil {
		t.Fatal(err)
	}
	srec, err := ms.LookupKey(ctx, shash)
	if err != nil || len(srec.IPs) != 2 || !devplatform.IPAllowed(srec.IPs, mustAddr("203.0.113.9")) {
		t.Fatalf("IP ro'yxati: %+v %v", srec, err)
	}

	// hisoblagich: ikki marta yozish YIG'ADI
	day := time.Now().UTC().Truncate(24 * time.Hour)
	rows := []devplatform.UsageRow{{KeyID: k.ID, Day: day, API: "geocode", Requests: 10, Errors: 1}}
	for i := 0; i < 2; i++ {
		if err := ms.WriteUsage(ctx, rows); err != nil {
			t.Fatalf("WriteUsage #%d: %v", i, err)
		}
	}
	if err := ms.TouchKeys(ctx, []string{k.ID}, time.Now()); err != nil {
		t.Fatal(err)
	}
	used, err := ms.MonthUsage(ctx, acc.ID, time.Date(day.Year(), day.Month(), 1, 0, 0, 0, 0, time.UTC))
	if err != nil || used != 20 {
		t.Fatalf("oylik hisob %d (kutilgan 20): %v", used, err)
	}
	usage, err := cs.UsageDaily(ctx, acc.ID, day, day)
	if err != nil || len(usage) != 1 || usage[0].Requests != 20 || usage[0].Errors != 2 {
		t.Fatalf("UsageDaily: %+v %v", usage, err)
	}

	// bekor qilish -> hisoblovchi ko'radi
	if err := cs.RevokeKey(ctx, acc.ID, k.ID, time.Now()); err != nil {
		t.Fatal(err)
	}
	if rec, _ := ms.LookupKey(ctx, hash); rec == nil || !rec.Revoked {
		t.Fatal("bekor qilingan kalit Revoked ko'rinmadi")
	}

	// almashtirish: eskisi qisqa muddat, yangisi ishlaydi
	s2, p2, _ := devplatform.GenerateKey(devplatform.KindServer)
	nk, err := cs.RotateKey(ctx, acc.ID, srec.ID, console.NewKey{AccountID: acc.ID, Name: "srv", Kind: devplatform.KindServer,
		Prefix: p2, Hash: devplatform.HashKey(pepper, s2), APIs: []string{"directions"}, IPs: []string{"203.0.113.0/24"}},
		time.Now().Add(24*time.Hour))
	if err != nil || nk.ID == srec.ID {
		t.Fatalf("RotateKey: %v", err)
	}
	if old, _ := ms.LookupKey(ctx, shash); old == nil || old.ExpiresAt == nil {
		t.Fatal("eski kalit muddati qo'yilmadi")
	}
}

func TestIntegrationConstraints(t *testing.T) {
	d := itestDSNs(t)
	cleanup(t, d.owner)
	t.Cleanup(func() { cleanup(t, d.owner) })
	ctx := context.Background()
	cpool, err := storage.OpenConsole(ctx, d.console)
	if err != nil {
		t.Fatal(err)
	}
	defer cpool.Close()
	cs := console.NewPGStore(cpool)
	acc, _ := cs.CreateAccount(ctx, "itest-c@example.com")

	mk := func(kind string, apis, origins, ips []string) error {
		s, p, _ := devplatform.GenerateKey(kind)
		_, err := cs.CreateKey(ctx, console.NewKey{AccountID: acc.ID, Name: "x", Kind: kind, Prefix: p,
			Hash: devplatform.HashKey(pepper, s), APIs: apis, Origins: origins, IPs: ips})
		return err
	}
	// Ilova qatlami xatosi bo'lsa ham BAZA rad etishi kerak (ikkinchi qatlam).
	if err := mk(devplatform.KindBrowser, []string{"geocode"}, nil, nil); err == nil {
		t.Error("originsiz brauzer kaliti bazaga o'tdi")
	}
	if err := mk(devplatform.KindServer, []string{"geocode"}, []string{"https://a.com"}, nil); err == nil {
		t.Error("originli server kaliti bazaga o'tdi")
	}
	if err := mk(devplatform.KindBrowser, []string{"geocode"}, []string{"https://a.com"}, []string{"1.2.3.4/32"}); err == nil {
		t.Error("IP'li brauzer kaliti bazaga o'tdi")
	}
	for _, bad := range [][]string{{"admin"}, {"submit"}, {"geocode", "photos"}, {}} {
		if err := mk(devplatform.KindServer, bad, nil, nil); err == nil {
			t.Errorf("API %v bazaga o'tdi", bad)
		}
	}
	if err := mk(devplatform.KindServer, []string{"geocode", "reverse", "directions", "places"}, nil, nil); err != nil {
		t.Errorf("to'g'ri kalit rad etildi: %v", err)
	}
}

func TestIntegrationRolePrivileges(t *testing.T) {
	d := itestDSNs(t)
	cleanup(t, d.owner)
	t.Cleanup(func() { cleanup(t, d.owner) })

	// tayyorgarlik: egasi orqali hisob, kalit, hisob-faktura
	if err := exec(t, d.owner, `INSERT INTO dev_accounts (email) VALUES ('itest-p@example.com')`); err != nil {
		t.Fatal(err)
	}
	const acc = `(SELECT id FROM dev_accounts WHERE email = 'itest-p@example.com')`
	if err := exec(t, d.owner, `INSERT INTO api_keys (account_id, name, kind, prefix, key_hash, apis)
		VALUES (`+acc+`, 'k', 'server', 'omk_s_aaaaaaaa', decode('00112233','hex'), ARRAY['geocode'])`); err != nil {
		t.Fatal(err)
	}
	if err := exec(t, d.owner, `INSERT INTO billing_invoices (account_id, period_start, period_end, amount_uzs, due_at)
		VALUES (`+acc+`, current_date, current_date + 30, 50000, now() + interval '7 days')`); err != nil {
		t.Fatal(err)
	}

	// ── KONSOL: pul va huquq ustunlariga TEGA OLMAYDI ──
	for name, sql := range map[string]string{
		"konsol: obunani yoqish":             `UPDATE dev_accounts SET subscription = true`,
		"konsol: ekotizimni yoqish":          `UPDATE dev_accounts SET is_ecosystem = true`,
		"konsol: hisobni tiklash":            `UPDATE dev_accounts SET status = 'active'`,
		"konsol: obuna sanasi":               `UPDATE dev_accounts SET subscription_since = now()`,
		"konsol: obunali hisob yaratish":     `INSERT INTO dev_accounts (email, subscription) VALUES ('itest-x@example.com', true)`,
		"konsol: ekotizimli hisob":           `INSERT INTO dev_accounts (email, is_ecosystem) VALUES ('itest-y@example.com', true)`,
		"konsol: hisob-faktura yozish":       `INSERT INTO billing_invoices (account_id, period_start, period_end, amount_uzs, due_at) VALUES (` + acc + `, current_date + 100, current_date + 130, 0, now())`,
		"konsol: hisob-faktura to'lash":      `UPDATE billing_invoices SET status = 'paid', paid_at = now()`,
		"konsol: hisob-faktura narxi":        `UPDATE billing_invoices SET amount_uzs = 0`,
		"konsol: hisob-faktura o'chirish":    `DELETE FROM billing_invoices`,
		"konsol: kalit xeshini almashtirish": `UPDATE api_keys SET key_hash = decode('ff','hex')`,
		"konsol: kalit turini almashtirish":  `UPDATE api_keys SET kind = 'browser'`,
		"konsol: hisoblagichni yozish":       `INSERT INTO api_usage_daily (key_id, day, api, requests) SELECT id, current_date, 'geocode', 1 FROM api_keys`,
		"konsol: hisobni o'chirish":          `DELETE FROM dev_accounts`,
		"konsol: auditni o'zgartirish":       `UPDATE dev_audit_log SET actor = 'x'`,
		"konsol: auditni o'chirish":          `DELETE FROM dev_audit_log`,
	} {
		denied(t, name, exec(t, d.console, sql))
	}
	// ...lekin o'z vazifasini bajara oladi
	if err := exec(t, d.console, `UPDATE dev_accounts SET name = 'Ali' WHERE email = 'itest-p@example.com'`); err != nil {
		t.Errorf("konsol ism o'zgartira olmadi: %v", err)
	}
	if err := exec(t, d.console, `UPDATE api_keys SET status = 'revoked', revoked_at = now() WHERE prefix = 'omk_s_aaaaaaaa'`); err != nil {
		t.Errorf("konsol kalitni bekor qila olmadi: %v", err)
	}

	// ── HISOBLOVCHI (cmd/api): kalit yarata olmaydi, hisob/obunaga tegolmaydi ──
	for name, sql := range map[string]string{
		"meter: kalit yaratish":                    `INSERT INTO api_keys (account_id, name, kind, prefix, key_hash, apis) SELECT id, 'x', 'server', 'omk_s_bbbbbbbb', decode('aa','hex'), ARRAY['geocode'] FROM dev_accounts`,
		"meter: kalitni tiklash":                   `UPDATE api_keys SET status = 'active'`,
		"meter: hisobni o'zgartirish":              `UPDATE dev_accounts SET subscription = true`,
		"meter: hisob-faktura":                     `UPDATE billing_invoices SET status = 'paid', paid_at = now()`,
		"meter: sessiyani o'qish":                  `SELECT * FROM dev_sessions`,
		"meter: OTP ni o'qish":                     `SELECT * FROM dev_otps`,
		"meter: auditni o'qish":                    `SELECT * FROM dev_audit_log`,
		"meter: hisoblagichni o'chirish":           `DELETE FROM api_usage_daily`,
		"meter: hisoblagich kalitini almashtirish": `UPDATE api_usage_daily SET key_id = key_id`,
	} {
		denied(t, name, exec(t, d.meter, sql))
	}
	if err := exec(t, d.meter, `SELECT key_hash FROM api_keys LIMIT 1`); err != nil {
		t.Errorf("meter kalit xeshini o'qiy olmadi: %v", err)
	}

	// ── OMMAVIY ROLLAR: yangi jadvallarni UMUMAN ko'rmaydi (0002 dagi avtomatik SELECT olib tashlangan) ──
	for _, role := range []struct{ name, dsn string }{{"app", d.app}, {"submit", d.submit}} {
		for _, tbl := range []string{"dev_accounts", "dev_otps", "dev_sessions", "api_keys", "api_usage_daily",
			"billing_invoices", "dev_subscription_requests", "dev_audit_log"} {
			denied(t, role.name+": "+tbl, exec(t, role.dsn, `SELECT 1 FROM `+tbl+` LIMIT 1`))
		}
	}
}

func mustAddr(s string) netip.Addr { return netip.MustParseAddr(s) }
