package storage

// Integratsiya testi — HAQIQIY bazada (docker PostGIS) ishlaydi.
//
//	$env:ONDEXMAP_INTEGRATION='1'; go test ./internal/storage/ -run Integration -count=1 -v
//
// Ikki narsani isbotlaydi:
//  1. butun oqim ishlaydi: yuborish → karantin → tasdiqlash → hammaga ko'rinadi;
//  2. XAVFSIZLIK grantlari haqiqatan ushlaydi: yuboruvchi rol jonli jadvalga
//     tegolmaydi va karantinni o'qiy olmaydi; o'qish roli karantinni ko'rmaydi
//     va hech narsa yoza olmaydi.
//
// Test o'z qatorlarini o'zi tozalaydi (`ITEST-` prefiksi).

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"ondexmap/internal/config"
	"ondexmap/internal/places"
)

func itestDSNs(t *testing.T) (owner, app, submit string) {
	t.Helper()
	if os.Getenv("ONDEXMAP_INTEGRATION") != "1" {
		t.Skip("ONDEXMAP_INTEGRATION=1 emas — integratsiya testi o'tkazib yuborildi")
	}
	cfg, err := config.Load("../../.env")
	if err != nil {
		t.Fatalf("sozlama: %v", err)
	}
	if cfg.DatabaseURLMigrate == "" || cfg.DatabaseURL == "" || cfg.SubmitDatabaseURL == "" {
		t.Skip("DATABASE_URL_MIGRATE / DATABASE_URL / SUBMIT_DATABASE_URL to'ldirilmagan")
	}
	return cfg.DatabaseURLMigrate, cfg.DatabaseURL, cfg.SubmitDatabaseURL
}

func itestPhoto(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{uint8(x), uint8(y), 60, 255})
		}
	}
	var b bytes.Buffer
	if err := jpeg.Encode(&b, img, nil); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

func fp(v float64) *float64 { return &v }

// fakeR2 — xotiradagi R2 do'koni (haqiqiy R2'ga tarmoq chaqiruvisiz). Test uni
// `Submitter`/`Pool` ga `WithR2` orqali ulaydi va R2 obyektlarining YASHASH
// TSIKLINI tekshiradi: yuklash → (tasdiqlash: tanlanmaganlar o'chadi) →
// (rad etish/o'chirish: o'chadi). Aks holda R2'da orfan obyekt qolib ketishi
// hech qayerda ko'rinmas edi.
type fakeR2 struct {
	mu   sync.Mutex
	objs map[string][]byte
}

func newFakeR2() *fakeR2 { return &fakeR2{objs: map[string][]byte{}} }

func (f *fakeR2) Upload(_ context.Context, key string, data []byte, _ string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.objs[key] = data
	return nil
}

func (f *fakeR2) Delete(_ context.Context, key string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.objs, key)
	return nil
}

func (f *fakeR2) DeleteMany(ctx context.Context, keys []string) error {
	for _, k := range keys {
		_ = f.Delete(ctx, k)
	}
	return nil
}

func (f *fakeR2) count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.objs)
}

func (f *fakeR2) has(key string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	_, ok := f.objs[key]
	return ok
}

func TestIntegrationPlacesLifecycleAndPrivileges(t *testing.T) {
	ownerDSN, appDSN, submitDSN := itestDSNs(t)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	owner, err := ReadWrite(ctx, ownerDSN)
	if err != nil {
		t.Fatal(err)
	}
	// t.Cleanup (defer emas): tozalash (pastda) hovuz YOPILGUNCHA ishlashi shart —
	// LIFO tartibda oxirroq ro'yxatga olingani birinchi ishlaydi.
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

	// R2 soxta do'koni: yuboruvchi (yuklaydi) va moderator hovuzi (tozalaydi) BIR
	// xil do'konga ulanadi, shuning uchun yashash tsiklini oxirigacha kuzatamiz.
	r2 := newFakeR2()
	sub.WithR2(r2)
	owner.WithR2(r2)

	tag := "ITEST-" + time.Now().Format("150405.000")
	hint := "itest-" + strings.ReplaceAll(tag, ".", "")
	t.Cleanup(func() {
		c := context.Background()
		_, _ = owner.Exec(c, `DELETE FROM places WHERE name LIKE 'ITEST-%' OR description LIKE 'ITEST-%'`)
		_, _ = owner.Exec(c, `DELETE FROM place_submissions WHERE submitter_hint LIKE 'itest-%'`)
		_, _ = owner.Exec(c, `DELETE FROM geo_revisions WHERE target_kind='place' AND applied_by='itest'`)
	})

	// ── 1. Yuborish → karantin ──────────────────────────────────────
	clean, err := places.Validate(places.Input{Kind: "organization", Lat: fp(41.0004), Lng: fp(71.2394),
		Name: tag + " Non", Category: "Kafe", Phone: "+998901234567", Description: "ITEST tavsif"})
	if err != nil {
		t.Fatal(err)
	}
	photos := [][]byte{itestPhoto(t, 300, 200), itestPhoto(t, 320, 240)}
	if err := sub.Submit(ctx, Submission{Clean: clean, Photos: photos, Hint: hint}); err != nil {
		t.Fatalf("Submit: %v", err)
	}
	// Ikkala rasm R2'ga yuklangan (bazaga baytlar EMAS, faqat kalit yoziladi).
	if n := r2.count(); n != 2 {
		t.Fatalf("Submit'dan keyin R2'da %d obyekt (2 kutilgan)", n)
	}
	if n, err := sub.RecentCount(ctx, hint); err != nil || n != 1 {
		t.Fatalf("RecentCount = %d, %v", n, err)
	}
	if _, err := sub.PendingTotal(ctx); err != nil {
		t.Fatalf("PendingTotal: %v", err)
	}

	// Karantinda tasdiqlanmagan taklif xaritada (ommaviy o'qishda) YO'Q.
	body, err := app.PlacesGeoJSON(ctx, 71.20, 40.95, 71.30, 41.05, 100)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(body), tag) {
		t.Fatal("TASDIQLANMAGAN taklif ommaviy xaritada ko'rindi")
	}
	if ms, _ := app.searchPlaces(ctx, "itest", []string{"itest"}, 10); len(ms) != 0 {
		t.Fatal("tasdiqlanmagan taklif qidiruvda chiqdi")
	}

	// ── 2. Xavfsizlik: yuboruvchi rol ───────────────────────────────
	sp := sub.pool
	mustFail := func(what, sql string, args ...any) {
		t.Helper()
		_, err := sp.Exec(ctx, sql, args...)
		if err == nil {
			t.Errorf("YUBORUVCHI ROL bajara oldi (bo'lmasligi kerak): %s", what)
			return
		}
		// Rad etish SABABI muhim: sintaksis xatosi ham "xato" beradi va testni
		// soxta o'tkazib yuborardi. Kutilgan sabab — ruxsat yo'qligi (42501)
		// yoki baza CHECK cheklovi (23514).
		var pe *pgconn.PgError
		if !errors.As(err, &pe) || (pe.Code != "42501" && pe.Code != "23514") {
			t.Errorf("%s: kutilmagan sabab bilan rad etildi (ruxsat/CHECK emas): %v", what, err)
		}
	}
	mustFail("places ga INSERT", `INSERT INTO places (kind, geom, approved_by) VALUES ('other', ST_SetSRID(ST_MakePoint(71,41),4326)::geography, 'x')`)
	mustFail("places dan UPDATE", `UPDATE places SET name='x'`)
	mustFail("places dan DELETE", `DELETE FROM places`)
	mustFail("karantin UPDATE", `UPDATE place_submissions SET status='approved'`)
	mustFail("karantin DELETE", `DELETE FROM place_submissions`)
	mustFail("karantin matnini o'qish", `SELECT name, description FROM place_submissions`)
	mustFail("karantin rasmini o'qish", `SELECT r2_key FROM place_submission_photos`)
	mustFail("jonli rasmni o'qish", `SELECT r2_key FROM place_photos`)
	mustFail("jonli ob'ektni o'qish", `SELECT name FROM places`)
	mustFail("mahallalarni o'qish", `SELECT name FROM mahallas`)
	mustFail("reviziyalarni o'qish", `SELECT * FROM geo_revisions`)
	mustFail("jadval yaratish", `CREATE TABLE itest_x (a int)`)
	// Moderatsiya ustunlarini yozish (0008: INSERT ustun darajasida cheklangan).
	const pt = `ST_SetSRID(ST_MakePoint(71,41),4326)::geography`
	mustFail("o'zini 'approved' deb kiritish",
		`INSERT INTO place_submissions (kind, geom, submitter_hint, status) VALUES ('other', `+pt+`, 'itest-x', 'approved')`)
	mustFail("created_at ni soxtalashtirish",
		`INSERT INTO place_submissions (kind, geom, submitter_hint, created_at) VALUES ('other', `+pt+`, 'itest-x', now() - interval '2 days')`)
	mustFail("soxta moderator izi",
		`INSERT INTO place_submissions (kind, geom, submitter_hint, reviewed_by) VALUES ('other', `+pt+`, 'itest-x', 'admin')`)
	mustFail("O'zbekistondan tashqari nuqta (baza CHECK)",
		`INSERT INTO place_submissions (kind, geom, submitter_hint) VALUES ('other', ST_SetSRID(ST_MakePoint(0,0),4326)::geography, 'itest-x')`)
	mustFail("noma'lum tur (baza CHECK)",
		`INSERT INTO place_submissions (kind, geom, submitter_hint) VALUES ('zavod', `+pt+`, 'itest-x')`)

	// ── 3. Xavfsizlik: o'qish roli ──────────────────────────────────
	mustFailApp := func(what, sql string) {
		t.Helper()
		_, err := app.Exec(ctx, sql)
		if err == nil {
			t.Errorf("O'QISH ROLI bajara oldi (bo'lmasligi kerak): %s", what)
			return
		}
		// 42501 — ruxsat yo'q; 25006 — read-only tranzaksiya (ikkinchi qatlam).
		var pe *pgconn.PgError
		if !errors.As(err, &pe) || (pe.Code != "42501" && pe.Code != "25006") {
			t.Errorf("%s: kutilmagan sabab bilan rad etildi: %v", what, err)
		}
	}
	mustFailApp("karantinni o'qish", `SELECT * FROM place_submissions`)
	mustFailApp("karantin rasmini o'qish", `SELECT r2_key FROM place_submission_photos`)
	mustFailApp("places ga yozish", `INSERT INTO places (kind, geom, approved_by) VALUES ('other', ST_SetSRID(ST_MakePoint(71,41),4326)::geography, 'x')`)
	mustFailApp("karantinga yozish", `INSERT INTO place_submissions (kind, geom, submitter_hint) VALUES ('other', ST_SetSRID(ST_MakePoint(71,41),4326)::geography, 'x')`)

	// ── 4. Moderator: ro'yxat → tasdiqlash ──────────────────────────
	rows, err := owner.ListSubmissions(ctx, "pending", 200)
	if err != nil {
		t.Fatal(err)
	}
	var subID string
	for _, r := range rows {
		if r.Name == tag+" Non" {
			subID = r.ID
			if r.Photos != 2 || r.Status != "pending" {
				t.Errorf("taklif: photos=%d status=%s", r.Photos, r.Status)
			}
		}
	}
	if subID == "" {
		t.Fatal("taklif moderatsiya navbatida ko'rinmadi")
	}
	if _, err := owner.SubmissionPhoto(ctx, subID, 1); err != nil {
		t.Fatalf("taklif rasmi: %v", err)
	}

	// Moderator matnni TUZATADI va faqat 2-rasmni qoldiradi.
	placeID, err := owner.ApproveSubmission(ctx, ApprovePlace{
		ID: subID, Reviewer: "itest",
		Edit: places.Input{Kind: "organization", Lat: fp(41.0005), Lng: fp(71.2395),
			Name: tag + " Non (tuzatildi)", Category: "Kafe", Description: "ITEST tavsif"},
		KeepPhotos: []int{1},
	})
	if err != nil {
		t.Fatalf("ApproveSubmission: %v", err)
	}
	// Ikkinchi marta tasdiqlab bo'lmaydi.
	if _, err := owner.ApproveSubmission(ctx, ApprovePlace{ID: subID, Reviewer: "itest",
		Edit: places.Input{Kind: "other", Lat: fp(41), Lng: fp(71), Description: "ITEST"}}); err == nil {
		t.Error("bir taklif ikki marta tasdiqlandi")
	}

	// ── 5. Endi HAMMAGA ko'rinadi (o'qish roli orqali) ──────────────
	body, err = app.PlacesGeoJSON(ctx, 71.20, 40.95, 71.30, 41.05, 100)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(body), placeID) {
		t.Fatal("tasdiqlangan ob'ekt xaritada (GeoJSON) ko'rinmadi")
	}
	d, err := app.PlaceByID(ctx, placeID)
	if err != nil {
		t.Fatal(err)
	}
	if d.Name != tag+" Non (tuzatildi)" || d.Photos != 1 || d.KindLabel != "Tashkilot" {
		t.Errorf("ob'ekt: %+v", d)
	}
	// Faqat 2-rasm (pos 1) qoldirilgan: jonli ob'ektning 0-o'rni ASL karantin
	// kalitiga ishora qiladi (R2'da qayta yuklash yo'q — obyekt joyida qoladi).
	keptKey := "submissions/" + subID + "/1.jpg"
	droppedKey := "submissions/" + subID + "/0.jpg"
	if k, err := app.PlacePhoto(ctx, placeID, 0); err != nil || k != keptKey {
		t.Errorf("0-rasm kaliti = %q, %v (kutilgan %q)", k, err, keptKey)
	}
	if _, err := app.PlacePhoto(ctx, placeID, 1); err != ErrNotFound {
		t.Errorf("1-rasm tashlangan edi, xato = %v", err)
	}
	// Karantindagi rasm yozuvlari tasdiqlangach o'chirilgan.
	if _, err := owner.SubmissionPhoto(ctx, subID, 0); err != ErrNotFound {
		t.Errorf("karantin rasmi tasdiqdan keyin qolgan: %v", err)
	}
	// R2: qoldirilgan obyekt SAQLANGAN, TANLANMAGANI (pos 0) O'CHIRILGAN (orfan yo'q).
	if !r2.has(keptKey) {
		t.Errorf("qoldirilgan rasm R2'dan yo'qolgan: %s", keptKey)
	}
	if r2.has(droppedKey) {
		t.Errorf("tanlanmagan rasm R2'da orfan bo'lib qoldi: %s", droppedKey)
	}
	if n := r2.count(); n != 1 {
		t.Errorf("tasdiqdan keyin R2'da %d obyekt (1 kutilgan)", n)
	}

	// Qidiruv: yangi ob'ekt topiladi.
	ms, err := app.Search(ctx, tag, 10, nil)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, m := range ms {
		if m.ID == "p"+placeID && m.Type == "place" && m.Lat != nil {
			found = true
		}
	}
	if !found {
		t.Errorf("tasdiqlangan ob'ekt qidiruvda topilmadi: %+v", ms)
	}

	// ── 6. Rad etish rasmlarni o'chiradi ────────────────────────────
	c2, _ := places.Validate(places.Input{Kind: "other", Lat: fp(41.001), Lng: fp(71.24), Description: "ITEST rad"})
	if err := sub.Submit(ctx, Submission{Clean: c2, Photos: photos[:1], Hint: hint}); err != nil {
		t.Fatal(err)
	}
	rows, _ = owner.ListSubmissions(ctx, "pending", 200)
	var rejID string
	for _, r := range rows {
		if r.Description == "ITEST rad" {
			rejID = r.ID
		}
	}
	if rejID == "" {
		t.Fatal("ikkinchi taklif ko'rinmadi")
	}
	if n := r2.count(); n != 2 { // tasdiqlangan ob'ektning 1 ta + yangi taklifning 1 ta
		t.Fatalf("ikkinchi Submit'dan keyin R2'da %d obyekt (2 kutilgan)", n)
	}
	if err := owner.RejectSubmission(ctx, rejID, "itest", "spam"); err != nil {
		t.Fatal(err)
	}
	if _, err := owner.SubmissionPhoto(ctx, rejID, 0); err != ErrNotFound {
		t.Errorf("rad etilgan taklif rasmi qolgan: %v", err)
	}
	// R2: rad etilgan taklifning rasmi O'CHIRILGAN; tasdiqlangan ob'ektniki tegilmagan.
	if r2.has("submissions/" + rejID + "/0.jpg") {
		t.Errorf("rad etilgan taklif rasmi R2'da orfan bo'lib qoldi")
	}
	if !r2.has(keptKey) || r2.count() != 1 {
		t.Errorf("rad etish tasdiqlangan ob'ekt rasmiga tegdi: %d obyekt", r2.count())
	}
	if err := owner.RejectSubmission(ctx, rejID, "itest", ""); err == nil {
		t.Error("rad etilgan taklif ikkinchi marta rad etildi")
	}

	// ── 7. Olib tashlash ────────────────────────────────────────────
	if err := owner.DeletePlace(ctx, placeID, "itest"); err != nil {
		t.Fatal(err)
	}
	if _, err := app.PlaceByID(ctx, placeID); err != ErrNotFound {
		t.Errorf("olib tashlangan ob'ekt hamon ko'rinadi: %v", err)
	}
	// R2: ob'ekt o'chirilgach uning rasmi ham ketgan (CASCADE R2'ni bilmaydi — kalitlar
	// DELETE'dan OLDIN o'qilib, commit'dan keyin R2'dan o'chiriladi).
	if n := r2.count(); n != 0 {
		t.Errorf("ob'ekt o'chirilgach R2'da %d orfan obyekt qoldi", n)
	}
	var revs int
	if err := owner.QueryRow(ctx,
		`SELECT count(*) FROM geo_revisions WHERE target_id = $1 AND target_kind = 'place'`, placeID).Scan(&revs); err != nil || revs != 2 {
		t.Errorf("reviziyalar %d (2 kutilgan: create + delete): %v", revs, err)
	}
}
