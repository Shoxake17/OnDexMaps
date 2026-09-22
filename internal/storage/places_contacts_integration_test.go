package storage

// Integratsiya testi — kontaktlar (sayt, ijtimoiy tarmoq) va yangi chiziq turlari
// (piyodalar o'tish joyi ≤10 m, to'siq), HAQIQIY bazada:
//
//	$env:ONDEXMAP_INTEGRATION='1'; go test ./internal/storage/ -run IntegrationContacts -count=1 -v
//
// Isbotlaydi: kontaktlar karantinga yoziladi, moderatorga ko'rinadi, tasdiqlangach
// ommaviy tafsilotda chiqadi; baza `javascript:` havolani va noto'g'ri shaklni
// (kod xato qilsa ham) o'zi rad etadi. Test o'z qatorlarini tozalaydi (`ITEST-`).

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"ondexmap/internal/places"
)

func TestIntegrationContactsAndShapes(t *testing.T) {
	ownerDSN, appDSN, submitDSN := itestDSNs(t)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	owner, err := ReadWrite(ctx, ownerDSN)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(owner.Close)
	app, err := ReadOnly(ctx, appDSN)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(app.Close)
	sub, err := OpenSubmitter(ctx, submitDSN)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(sub.Close)

	tag := "ITEST-" + time.Now().Format("150405.000")
	hint := "itest-" + strings.ReplaceAll(tag, ".", "")
	t.Cleanup(func() {
		c := context.Background()
		_, _ = owner.Exec(c, `DELETE FROM places WHERE name LIKE 'ITEST-%' OR description LIKE 'ITEST-%'`)
		_, _ = owner.Exec(c, `DELETE FROM place_submissions WHERE submitter_hint LIKE 'itest-%'`)
		_, _ = owner.Exec(c, `DELETE FROM geo_revisions WHERE target_kind='place' AND applied_by='itest'`)
	})

	// ── 1. Kontaktlar: yuborish → moderator → tasdiqlash → ommaviy tafsilot ──
	in := places.Input{
		Kind: "organization", Lat: fp(41.0005), Lng: fp(71.2405),
		Name: tag + " Non", Category: "Kafe", Phone: "+998 90 123-45-67",
		Hours: "Har kuni, 09:00–18:00, tanaffus 13:00–14:00",
		Site:  "chustnon.uz/menyu", Social: "instagram.com/chustnon",
	}
	clean, err := places.Validate(in)
	if err != nil {
		t.Fatal(err)
	}
	if err := sub.Submit(ctx, Submission{Clean: clean, Hint: hint}); err != nil {
		t.Fatalf("Submit(kontaktlar): %v", err)
	}
	rows, err := owner.ListSubmissions(ctx, "pending", 200)
	if err != nil {
		t.Fatal(err)
	}
	var subID string
	for _, r := range rows {
		if r.Name != tag+" Non" {
			continue
		}
		subID = r.ID
		if r.Site != "https://chustnon.uz/menyu" || r.Social != "https://instagram.com/chustnon" || r.Hours != in.Hours {
			t.Errorf("moderator kontaktlarni ko'rmadi: site=%q social=%q hours=%q", r.Site, r.Social, r.Hours)
		}
	}
	if subID == "" {
		t.Fatal("taklif navbatda ko'rinmadi")
	}
	placeID, err := owner.ApproveSubmission(ctx, ApprovePlace{ID: subID, Reviewer: "itest", Edit: in})
	if err != nil {
		t.Fatalf("ApproveSubmission(kontaktlar): %v", err)
	}
	d, err := app.PlaceByID(ctx, placeID)
	if err != nil {
		t.Fatal(err)
	}
	if d.Site != "https://chustnon.uz/menyu" || d.Social != "https://instagram.com/chustnon" || d.Phone != "+998 90 123-45-67" {
		t.Errorf("ommaviy tafsilotda kontaktlar bo'lishi kerak: %+v", d)
	}

	// Kontaktsiz tashkilot ham to'g'ri: ustunlar NULL, tafsilotda bo'sh.
	bare, _ := places.Validate(places.Input{Kind: "organization", Lat: fp(41.0006), Lng: fp(71.2406),
		Name: tag + " Bare", Category: "Kafe"})
	bareID, err := owner.ApproveSubmission(ctx, mustSubmitID(t, ctx, sub, owner, bare, hint, "Bare", tag))
	if err != nil {
		t.Fatalf("ApproveSubmission(kontaktsiz): %v", err)
	}
	if b, err := app.PlaceByID(ctx, bareID); err != nil || b.Site != "" || b.Social != "" {
		t.Errorf("kontaktsiz ob'ektda sayt/ijtimoiy tarmoq bo'sh bo'lishi kerak: %+v, %v", b, err)
	}

	// ── 2. Baza xavfli havolani o'zi rad etadi (kod xato qilsa ham) ─────────
	mustCheck := func(who, what string, exec func(sql string) error, sql string) {
		t.Helper()
		err := exec(sql)
		var pe *pgconn.PgError
		if err == nil || !errors.As(err, &pe) || pe.Code != "23514" {
			t.Errorf("%s: %s — baza CHECK (23514) bilan rad etishi kerak edi, keldi: %v", who, what, err)
		}
	}
	mustOK := func(who, what string, exec func(sql string) error, sql string) {
		t.Helper()
		if err := exec(sql); err != nil {
			t.Errorf("%s: %s — baza qabul qilishi kerak edi: %v", who, what, err)
		}
	}
	subExec := func(sql string) error { _, err := sub.pool.Exec(ctx, sql); return err }
	ownExec := func(sql string) error { _, err := owner.Exec(ctx, sql); return err }
	const pt = `ST_SetSRID(ST_MakePoint(71,41),4326)::geography`
	// 71.0 → 71.00008 (~6.7 m) va 71.0 → 71.0003 (~25 m), kenglik 41°.
	const ln7 = `ST_SetSRID(ST_MakeLine(ST_MakePoint(71,41), ST_MakePoint(71.00008,41)),4326)::geography`
	const ln25 = `ST_SetSRID(ST_MakeLine(ST_MakePoint(71,41), ST_MakePoint(71.0003,41)),4326)::geography`
	const ln400 = `ST_SetSRID(ST_MakeLine(ST_MakePoint(71,41), ST_MakePoint(71.005,41)),4326)::geography`

	mustCheck("yuboruvchi", "sayt `javascript:`", subExec,
		`INSERT INTO place_submissions (kind, name, category, site, geom, submitter_hint)
		 VALUES ('organization', 'ITEST-x', 'Kafe', 'javascript:alert(1)', `+pt+`, 'itest-x')`)
	mustCheck("yuboruvchi", "ijtimoiy tarmoq bo'sh joy bilan", subExec,
		`INSERT INTO place_submissions (kind, name, category, social, geom, submitter_hint)
		 VALUES ('organization', 'ITEST-x', 'Kafe', 'https://t.me/a b', `+pt+`, 'itest-x')`)
	mustCheck("moderator", "jonli sayt `data:`", ownExec,
		`INSERT INTO places (kind, name, site, geom, approved_by)
		 VALUES ('organization', 'ITEST-x', 'data:text/html,x', `+pt+`, 'itest')`)

	// ── 3. Piyodalar o'tish joyi: chiziq, ≤10 m ─────────────────────────────
	mustOK("yuboruvchi", "7 m li o'tish joyi", subExec,
		`INSERT INTO place_submissions (kind, geom, submitter_hint) VALUES ('crossing', `+ln7+`, 'itest-x')`)
	mustCheck("yuboruvchi", "25 m li o'tish joyi", subExec,
		`INSERT INTO place_submissions (kind, geom, submitter_hint) VALUES ('crossing', `+ln25+`, 'itest-x')`)
	mustCheck("yuboruvchi", "o'tish joyi NUQTA bilan", subExec,
		`INSERT INTO place_submissions (kind, geom, submitter_hint) VALUES ('crossing', `+pt+`, 'itest-x')`)
	mustCheck("moderator", "jonli 25 m li o'tish joyi", ownExec,
		`INSERT INTO places (kind, geom, approved_by) VALUES ('crossing', `+ln25+`, 'itest')`)

	// ── 4. To'siq: chiziq; nuqta emas ────────────────────────────────────────
	mustOK("yuboruvchi", "400 m to'siq", subExec,
		`INSERT INTO place_submissions (kind, geom, submitter_hint) VALUES ('fence', `+ln400+`, 'itest-x')`)
	mustCheck("yuboruvchi", "to'siq NUQTA bilan", subExec,
		`INSERT INTO place_submissions (kind, geom, submitter_hint) VALUES ('fence', `+pt+`, 'itest-x')`)
	// Darvoza (`gate`) — hamon nuqta.
	mustOK("yuboruvchi", "darvoza NUQTA bilan", subExec,
		`INSERT INTO place_submissions (kind, geom, submitter_hint) VALUES ('gate', `+pt+`, 'itest-x')`)
	mustCheck("yuboruvchi", "darvoza CHIZIQ bilan", subExec,
		`INSERT INTO place_submissions (kind, geom, submitter_hint) VALUES ('gate', `+ln7+`, 'itest-x')`)

	// ── 5. Moderator o'tish joyini tasdiqlaydi; xaritada chiziq ─────────────
	cross, err := places.Validate(places.Input{Kind: "crossing", Description: "ITEST o'tish joyi",
		Line: [][2]float64{{71.2410, 41.0010}, {71.24108, 41.0010}}})
	if err != nil {
		t.Fatal(err)
	}
	crossID, err := owner.ApproveSubmission(ctx, mustSubmitID(t, ctx, sub, owner, cross, hint, "", "ITEST o'tish joyi"))
	if err != nil {
		t.Fatalf("ApproveSubmission(o'tish joyi): %v", err)
	}
	c, err := app.PlaceByID(ctx, crossID)
	if err != nil {
		t.Fatal(err)
	}
	if c.Kind != "crossing" || !strings.Contains(string(c.Geometry), "LineString") || c.LengthM < 5 || c.LengthM > 10 {
		t.Errorf("o'tish joyi 5..10 m li LineString bo'lishi kerak: %+v %s", c, c.Geometry)
	}
	// 10 m dan uzun o'tish joyini kod ham tasdiqlamaydi (baza 11 m gacha kengroq).
	if _, err := owner.ApproveSubmission(ctx, ApprovePlace{ID: subID, Reviewer: "itest",
		Edit: places.Input{Kind: "crossing", Line: [][2]float64{{71.2410, 41.0010}, {71.24125, 41.0010}}}}); err == nil {
		t.Error("~21 m li o'tish joyi tasdiqlanmasligi kerak")
	}
}

// mustSubmitID — taklifni karantinga yozadi va moderator uchun `ApprovePlace` qaytaradi.
// `nameOrDesc` — navbatdan shu taklifni topish uchun (nom yoki tavsif).
func mustSubmitID(t *testing.T, ctx context.Context, sub *Submitter, owner *Pool,
	clean places.Clean, hint, nameSuffix, tag string) ApprovePlace {
	t.Helper()
	if err := sub.Submit(ctx, Submission{Clean: clean, Hint: hint}); err != nil {
		t.Fatalf("Submit: %v", err)
	}
	rows, err := owner.ListSubmissions(ctx, "pending", 200)
	if err != nil {
		t.Fatal(err)
	}
	for _, r := range rows {
		if (nameSuffix != "" && strings.HasSuffix(r.Name, nameSuffix) && strings.HasPrefix(r.Name, tag)) ||
			(nameSuffix == "" && r.Description == tag) {
			edit := places.Input{
				Kind: clean.Kind, Name: clean.Name, Category: clean.Category, Description: clean.Description,
				Phone: clean.Phone, Hours: clean.Hours, Street: clean.Street, House: clean.House,
				Site: clean.Site, Social: clean.Social,
			}
			if clean.IsLine() {
				edit.Line = clean.Line
			} else {
				edit.Lat, edit.Lng = fp(clean.Lat), fp(clean.Lng)
			}
			return ApprovePlace{ID: r.ID, Reviewer: "itest", Edit: edit}
		}
	}
	t.Fatalf("taklif navbatda topilmadi: %q", tag)
	return ApprovePlace{}
}
