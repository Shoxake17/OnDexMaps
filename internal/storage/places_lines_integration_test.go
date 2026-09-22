package storage

// Integratsiya testi — yo'l (CHIZIQ) shakli, HAQIQIY bazada:
//
//	$env:ONDEXMAP_INTEGRATION='1'; go test ./internal/storage/ -run IntegrationRoad -count=1 -v
//
// Isbotlaydi: chiziq karantinga yoziladi → moderator ko'radi → tasdiqlaydi →
// hammaga CHIZIQ sifatida ko'rinadi (xarita GeoJSON, tafsilot, qidiruv);
// baza shaklni (yo'l = chiziq, qolgani = nuqta) o'zi ham majburlaydi.
//
// Test o'z qatorlarini o'zi tozalaydi (`ITEST-` prefiksi).

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"ondexmap/internal/places"
)

func TestIntegrationRoadLine(t *testing.T) {
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

	tag := "ITEST-" + time.Now().Format("150405.000")
	hint := "itest-" + strings.ReplaceAll(tag, ".", "")
	t.Cleanup(func() {
		c := context.Background()
		_, _ = owner.Exec(c, `DELETE FROM places WHERE name LIKE 'ITEST-%' OR description LIKE 'ITEST-%'`)
		_, _ = owner.Exec(c, `DELETE FROM place_submissions WHERE submitter_hint LIKE 'itest-%'`)
		_, _ = owner.Exec(c, `DELETE FROM geo_revisions WHERE target_kind='place' AND applied_by='itest'`)
	})

	// ~400 m yo'l, 4 nuqta (o'rtada burilish bor).
	line := [][2]float64{{71.2400, 41.0000}, {71.2412, 41.0009}, {71.2425, 41.0011}, {71.2438, 41.0021}}
	clean, err := places.Validate(places.Input{Kind: "road", Line: line, Name: tag + " ko'chasi", Description: "ITEST yo'l"})
	if err != nil {
		t.Fatal(err)
	}
	if err := sub.Submit(ctx, Submission{Clean: clean, Hint: hint}); err != nil {
		t.Fatalf("Submit(line): %v", err)
	}

	// ── 1. Karantindagi chiziq: moderator geometriyani ko'radi ──────────
	rows, err := owner.ListSubmissions(ctx, "pending", 200)
	if err != nil {
		t.Fatal(err)
	}
	var subID string
	for _, r := range rows {
		if r.Name != tag+" ko'chasi" {
			continue
		}
		subID = r.ID
		var g struct {
			Type        string      `json:"type"`
			Coordinates [][]float64 `json:"coordinates"`
		}
		if err := json.Unmarshal(r.Geometry, &g); err != nil {
			t.Fatalf("geometriya JSON emas: %v (%s)", err, r.Geometry)
		}
		if g.Type != "LineString" || len(g.Coordinates) != 4 {
			t.Errorf("chiziq saqlanishi kerak: %s %d nuqta", g.Type, len(g.Coordinates))
		}
		// GeoJSON tartibi [lng, lat]: birinchi nuqta ketma-ketlikni saqlashi shart.
		if g.Coordinates[0][0] != 71.24 || g.Coordinates[0][1] != 41.0 || g.Coordinates[3][0] != 71.2438 {
			t.Errorf("nuqtalar tartibi buzildi: %v", g.Coordinates)
		}
		// Baza (sferoid) va kod (sfera) hisobi ~0.5% dan ko'p farq qilmasligi kerak.
		if want := places.LineLengthMeters(line); math.Abs(r.LengthM-want) > want*0.01 {
			t.Errorf("uzunlik ~%.1f m bo'lishi kerak: %.1f", want, r.LengthM)
		}
		if r.Lat == 0 || r.Lng == 0 {
			t.Errorf("chiziq ustidagi nuqta (lat/lng) bo'sh: %v,%v", r.Lat, r.Lng)
		}
	}
	if subID == "" {
		t.Fatal("chiziq taklifi navbatda ko'rinmadi")
	}
	// Tasdiqlanmagan chiziq ommaviy xaritada YO'Q.
	body, err := app.PlacesGeoJSON(ctx, 71.20, 40.95, 71.30, 41.05, 100)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(body), tag) {
		t.Fatal("TASDIQLANMAGAN yo'l ommaviy xaritada ko'rindi")
	}

	// ── 2. Baza shaklni o'zi majburlaydi ────────────────────────────────
	mustCheck := func(who, what string, exec func(sql string) error, sql string) {
		t.Helper()
		err := exec(sql)
		var pe *pgconn.PgError
		if err == nil || !errors.As(err, &pe) || pe.Code != "23514" {
			t.Errorf("%s: %s — baza CHECK (23514) bilan rad etishi kerak edi, keldi: %v", who, what, err)
		}
	}
	subExec := func(sql string) error { _, err := sub.pool.Exec(ctx, sql); return err }
	ownExec := func(sql string) error { _, err := owner.Exec(ctx, sql); return err }
	const pt = `ST_SetSRID(ST_MakePoint(71,41),4326)::geography`
	const ln = `ST_SetSRID(ST_MakeLine(ST_MakePoint(71,41), ST_MakePoint(71.001,41.001)),4326)::geography`
	const shortLn = `ST_SetSRID(ST_MakeLine(ST_MakePoint(71,41), ST_MakePoint(71.0000001,41)),4326)::geography` // <1 m
	mustCheck("yuboruvchi", "yo'l NUQTA bilan", subExec,
		`INSERT INTO place_submissions (kind, geom, submitter_hint) VALUES ('road', `+pt+`, 'itest-x')`)
	mustCheck("yuboruvchi", "shlagbaum CHIZIQ bilan", subExec,
		`INSERT INTO place_submissions (kind, geom, submitter_hint) VALUES ('barrier', `+ln+`, 'itest-x')`)
	mustCheck("yuboruvchi", "1 m dan qisqa yo'l", subExec,
		`INSERT INTO place_submissions (kind, geom, submitter_hint) VALUES ('road', `+shortLn+`, 'itest-x')`)
	mustCheck("moderator", "jonli yo'l NUQTA bilan", ownExec,
		`INSERT INTO places (kind, geom, approved_by) VALUES ('road', `+pt+`, 'itest')`)
	mustCheck("moderator", "jonli bekat CHIZIQ bilan", ownExec,
		`INSERT INTO places (kind, geom, approved_by) VALUES ('stop', `+ln+`, 'itest')`)

	// ── 3. Moderator chiziqni TUZATIB tasdiqlaydi ───────────────────────
	// Bitta nuqta qo'shiladi (5 nuqta); nom tuzatiladi.
	edited := append(append([][2]float64{}, line...), [2]float64{71.2450, 41.0030})
	placeID, err := owner.ApproveSubmission(ctx, ApprovePlace{
		ID: subID, Reviewer: "itest",
		Edit: places.Input{Kind: "road", Line: edited, Name: tag + " ko'chasi (tuzatildi)", Description: "ITEST yo'l"},
	})
	if err != nil {
		t.Fatalf("ApproveSubmission(line): %v", err)
	}
	// Chiziq turini nuqta bilan tasdiqlab bo'lmaydi (kod ham rad etadi).
	if _, err := owner.ApproveSubmission(ctx, ApprovePlace{ID: subID, Reviewer: "itest",
		Edit: places.Input{Kind: "road", Lat: fp(41), Lng: fp(71), Description: "ITEST"}}); err == nil {
		t.Error("yo'l nuqta bilan tasdiqlandi")
	}

	// ── 4. Hammaga CHIZIQ sifatida ko'rinadi ────────────────────────────
	body, err = app.PlacesGeoJSON(ctx, 71.20, 40.95, 71.30, 41.05, 100)
	if err != nil {
		t.Fatal(err)
	}
	var fc struct {
		Features []struct {
			ID       string `json:"id"`
			Geometry struct {
				Type string `json:"type"`
				// Nuqta uchun [x,y], chiziq uchun [[x,y],...] — shakl turlicha.
				Coordinates json.RawMessage `json:"coordinates"`
			} `json:"geometry"`
			Properties map[string]any `json:"properties"`
		} `json:"features"`
	}
	if err := json.Unmarshal(body, &fc); err != nil {
		t.Fatal(err)
	}
	seen := false
	for _, f := range fc.Features {
		if f.ID != placeID {
			continue
		}
		seen = true
		var coords [][]float64
		if f.Geometry.Type != "LineString" || json.Unmarshal(f.Geometry.Coordinates, &coords) != nil || len(coords) != 5 {
			t.Errorf("xaritada 5 nuqtali chiziq bo'lishi kerak: %s %s", f.Geometry.Type, f.Geometry.Coordinates)
		}
		if f.Properties["kind"] != "road" {
			t.Errorf("tur road bo'lishi kerak: %v", f.Properties["kind"])
		}
	}
	if !seen {
		t.Fatal("tasdiqlangan yo'l xaritada ko'rinmadi")
	}

	d, err := app.PlaceByID(ctx, placeID)
	if err != nil {
		t.Fatal(err)
	}
	if d.Kind != "road" || d.KindLabel != "Yo'l" || d.Name != tag+" ko'chasi (tuzatildi)" {
		t.Errorf("ob'ekt: %+v", d)
	}
	if want := places.LineLengthMeters(edited); math.Abs(d.LengthM-want) > want*0.01 {
		t.Errorf("uzunlik ~%.1f m bo'lishi kerak: %.1f", want, d.LengthM)
	}
	if d.Lat < 41.0 || d.Lat > 41.0031 || d.Lng < 71.24 || d.Lng > 71.2451 {
		t.Errorf("chiziq ustidagi nuqta yo'l yaqinida bo'lishi kerak: %v,%v", d.Lat, d.Lng)
	}
	if !strings.Contains(string(d.Geometry), "LineString") {
		t.Errorf("tafsilotda geometriya LineString bo'lishi kerak: %s", d.Geometry)
	}

	// Qidiruv chiziqni topadi va koordinata beradi (ST_Y nuqta bo'lmagan
	// geometriyada NULL bergan bo'lardi — shuning uchun PointOnSurface).
	ms, err := app.Search(ctx, tag, 10, nil)
	if err != nil {
		t.Fatalf("qidiruv chiziq bilan yiqildi: %v", err)
	}
	found := false
	for _, m := range ms {
		if m.ID == "p"+placeID && m.Type == "place" && m.Lat != nil && m.Lng != nil {
			found = true
		}
	}
	if !found {
		t.Errorf("tasdiqlangan yo'l qidiruvda topilmadi: %+v", ms)
	}

	// Yon panelda ro'yxat (admin) ham chiziq bilan ishlaydi.
	list, err := owner.ListPlacesAdmin(ctx, 50)
	if err != nil {
		t.Fatalf("ListPlacesAdmin chiziq bilan yiqildi: %v", err)
	}
	ok := false
	for _, p := range list {
		if p.ID == placeID && p.LengthM > 0 {
			ok = true
		}
	}
	if !ok {
		t.Error("admin ro'yxatida yo'l (uzunligi bilan) topilmadi")
	}

	// ── 5. Olib tashlash: reviziyada chiziq saqlanadi ───────────────────
	if err := owner.DeletePlace(ctx, placeID, "itest"); err != nil {
		t.Fatalf("DeletePlace(line): %v", err)
	}
	var before string
	if err := owner.QueryRow(ctx, `SELECT before::text FROM geo_revisions
		WHERE target_id = $1 AND op = 'delete'`, placeID).Scan(&before); err != nil {
		t.Fatalf("reviziya: %v", err)
	}
	if !strings.Contains(before, "LineString") {
		t.Errorf("o'chirilgan yo'l geometriyasi reviziyada saqlanishi kerak: %s", before)
	}
}
