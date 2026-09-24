package adminapi

// Integratsiya testi — HAQIQIY bazada (ONDEXMAP_INTEGRATION=1, migratsiyalar qo'llangan).
// Obuna flagi → hisob-faktura → to'lov → "muddati o'tgan qarz" → reja, butun zanjirni haqiqiy SQL bilan sinaydi.

import (
	"context"
	"os"
	"testing"
	"time"

	"ondexmap/internal/config"
	"ondexmap/internal/console"
	"ondexmap/internal/devplatform"
	"ondexmap/internal/storage"
)

func TestIntegrationSubscriptionBillingChain(t *testing.T) {
	if os.Getenv("ONDEXMAP_INTEGRATION") != "1" {
		t.Skip("ONDEXMAP_INTEGRATION=1 emas — integratsiya testi o'tkazib yuborildi")
	}
	cfg, err := config.Load("../../.env")
	if err != nil {
		t.Fatalf("sozlama: %v", err)
	}
	if cfg.DatabaseURLMigrate == "" || cfg.MeterDatabaseURL == "" || cfg.ConsoleDatabaseURL == "" {
		t.Skip("DATABASE_URL_MIGRATE / METER / CONSOLE DATABASE_URL to'ldirilmagan")
	}
	ctx := context.Background()

	owner, err := storage.ReadWrite(ctx, cfg.DatabaseURLMigrate)
	if err != nil {
		t.Fatal(err)
	}
	defer owner.Close()
	cpool, err := storage.OpenConsole(ctx, cfg.ConsoleDatabaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer cpool.Close()
	mpool, err := storage.OpenMeter(ctx, cfg.MeterDatabaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer mpool.Close()

	clean := func() {
		for _, q := range []string{
			`DELETE FROM billing_invoices WHERE account_id IN (SELECT id FROM dev_accounts WHERE email LIKE 'itest-%')`,
			`DELETE FROM dev_accounts WHERE email LIKE 'itest-%'`,
		} {
			if _, err := owner.Exec(ctx, q); err != nil {
				t.Fatalf("tozalash: %v", err)
			}
		}
	}
	clean()
	t.Cleanup(clean)

	staff := newDevStaffPG(owner)
	cs := console.NewPGStore(cpool)
	ms := devplatform.NewPGStore(mpool)
	plans := devplatform.DefaultPlans()

	acc, err := cs.CreateAccount(ctx, "itest-billing@example.com")
	if err != nil {
		t.Fatal(err)
	}
	secret, prefix, _ := devplatform.GenerateKey(devplatform.KindServer)
	hash := devplatform.HashKey([]byte("integration-pepper-0123456789abcdef0123"), secret)
	if _, err := cs.CreateKey(ctx, console.NewKey{AccountID: acc.ID, Name: "k", Kind: devplatform.KindServer,
		Prefix: prefix, Hash: hash, APIs: []string{"geocode"}}); err != nil {
		t.Fatal(err)
	}
	planNow := func() devplatform.PlanID {
		t.Helper()
		rec, err := ms.LookupKey(ctx, hash)
		if err != nil {
			t.Fatal(err)
		}
		return plans.For(rec.Account).ID
	}
	openInvoices := func() []StaffInvoice {
		t.Helper()
		all, err := staff.ListInvoices(ctx, "open", 500)
		if err != nil {
			t.Fatal(err)
		}
		var mine []StaffInvoice
		for _, v := range all {
			if v.AccountID == acc.ID {
				mine = append(mine, v)
			}
		}
		return mine
	}

	if planNow() != devplatform.PlanFree {
		t.Fatal("yangi hisob bepul bo'lishi kerak")
	}

	// 1. Obunani yoqish: reja paid, birinchi hisob-faktura 50 000
	now := time.Now()
	if err := staff.SetSubscription(ctx, acc.ID, true, now); err != nil {
		t.Fatal(err)
	}
	if planNow() != devplatform.PlanPaid {
		t.Fatal("obunadan keyin reja paid emas")
	}
	inv := openInvoices()
	if len(inv) != 1 || inv[0].AmountUZS != 50_000 || inv[0].Status != "open" {
		t.Fatalf("birinchi hisob-faktura: %+v", inv)
	}

	// 2. Idempotent: qayta ishga tushirish yangisini yaratmaydi (bir davr = bitta hisob-faktura)
	for i := 0; i < 3; i++ {
		if _, err := staff.IssueDueInvoices(ctx, now); err != nil {
			t.Fatal(err)
		}
	}
	if got := openInvoices(); len(got) != 1 {
		t.Fatalf("takroriy ishga tushirish dublikat yaratdi: %d ta", len(got))
	}
	if err := staff.SetSubscription(ctx, acc.ID, true, now); err != nil { // yoqilgan holatda yana yoqish — zararsiz
		t.Fatal(err)
	}
	if got := openInvoices(); len(got) != 1 {
		t.Fatalf("qayta yoqish dublikat yaratdi: %d ta", len(got))
	}

	// 3. Muddati 8+ kun o'tgan to'lanmagan hisob-faktura → bepul limitlarga (bloklanmaydi)
	if _, err := owner.Exec(ctx, `UPDATE billing_invoices SET due_at = now() - interval '8 days' WHERE id = $1`, inv[0].ID); err != nil {
		t.Fatal(err)
	}
	if planNow() != devplatform.PlanFree {
		t.Fatal("qarzdor obuna bepul limitga tushmadi")
	}
	if a, _ := cs.AccountByID(ctx, acc.ID); a == nil || !a.Overdue || !a.Subscription {
		t.Fatalf("konsol ko'rinishi: %+v", a)
	}

	// 4. To'lov tasdig'i: darhol tiklanadi; ikkinchi tasdiq — topilmadi
	if err := staff.MarkPaid(ctx, inv[0].ID, "TEST-REF", time.Now()); err != nil {
		t.Fatal(err)
	}
	if planNow() != devplatform.PlanPaid {
		t.Fatal("to'lovdan keyin reja tiklanmadi")
	}
	if err := staff.MarkPaid(ctx, inv[0].ID, "X", time.Now()); err != ErrStaffNotFound { //nolint:errorlint
		t.Fatalf("ikkinchi to'lov tasdig'i: %v", err)
	}

	// 5. Keyingi davr: davr tugagach yangi hisob-faktura chiqadi; obunani o'chirish uni bekor qiladi (void)
	if _, err := owner.Exec(ctx, `UPDATE billing_invoices SET period_start = current_date - 31, period_end = current_date - 1 WHERE id = $1`, inv[0].ID); err != nil {
		t.Fatal(err)
	}
	if n, err := staff.IssueDueInvoices(ctx, time.Now()); err != nil || n < 1 {
		t.Fatalf("keyingi davr hisob-fakturasi: n=%d err=%v", n, err)
	}
	if got := openInvoices(); len(got) != 1 {
		t.Fatalf("keyingi davr: %d ta ochiq", len(got))
	}
	if err := staff.SetSubscription(ctx, acc.ID, false, time.Now()); err != nil {
		t.Fatal(err)
	}
	if got := openInvoices(); len(got) != 0 {
		t.Fatalf("obuna o'chirilgach ochiq hisob-faktura qoldi: %d", len(got))
	}
	if planNow() != devplatform.PlanFree {
		t.Fatal("obuna o'chirilgach reja bepul emas")
	}

	// 6. Ekotizim: bepul va cheklovsiz; hisob-faktura chiqmaydi
	if err := staff.SetEcosystem(ctx, acc.ID, true); err != nil {
		t.Fatal(err)
	}
	if planNow() != devplatform.PlanEcosystem {
		t.Fatal("ekotizim rejasi yoqilmadi")
	}
	if err := staff.SetSubscription(ctx, acc.ID, true, time.Now()); err != nil {
		t.Fatal(err)
	}
	if got := openInvoices(); len(got) != 0 {
		t.Fatalf("ekotizim hisobiga hisob-faktura chiqdi: %d", len(got))
	}

	// 7. To'xtatish hisoblovchiga ko'rinadi
	if err := staff.SetSuspended(ctx, acc.ID, true); err != nil {
		t.Fatal(err)
	}
	if rec, _ := ms.LookupKey(ctx, hash); rec == nil || !rec.Account.Suspended {
		t.Fatal("to'xtatish hisoblovchiga ko'rinmadi")
	}

	// noma'lum hisob
	if err := staff.SetSubscription(ctx, "00000000-0000-4000-8000-00000000dead", true, time.Now()); err != ErrStaffNotFound { //nolint:errorlint
		t.Fatalf("noma'lum hisob: %v", err)
	}
}
