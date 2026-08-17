package storage

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

// ═══════════════════════════════════════════════════════════════════
// JAMOA TAKLIFLARI
//
// Oqim: yuborish → KARANTIN (pending) → admin ko'radi → tasdiq/rad.
//
// Tasdiqlanmagan taklif xaritada UMUMAN ko'rinmaydi. Ommaviy API
// faqat `Submit` ni chaqira oladi — qolgan funksiyalar yozuvchi
// ulanishni talab qiladi va ular admin vositasida ishlaydi.
// ═══════════════════════════════════════════════════════════════════

// Contribution — moderatsiya navbatidagi bitta taklif.
type Contribution struct {
	ID            string          `json:"id"`
	Kind          string          `json:"kind"`
	Op            string          `json:"op"`
	TargetID      string          `json:"target_id,omitempty"`
	Payload       json.RawMessage `json:"payload"`
	Geometry      json.RawMessage `json:"geometry,omitempty"`
	Status        string          `json:"status"`
	SubmittedBy   string          `json:"submitted_by,omitempty"`
	SubmitterNote string          `json:"submitter_note,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
}

// SubmitInput — ommaviy taklif.
//
// DIQQAT: bu yerda `source` maydoni ATAYLAB YO'Q. Provenans — bizning
// da'vomiz, foydalanuvchining emas. Ommaviy taklif har doim
// `community` sifatida yoziladi; admin tasdiqlashda uni o'zgartira
// oladi (masalan dala survey bilan tasdiqlagan bo'lsa).
type SubmitInput struct {
	Kind     string `json:"kind"` // mahalla | street | alias
	Name     string `json:"name"`
	Note     string `json:"note,omitempty"`      // "3-qavat, ko'k darvoza" kabi izoh
	Geometry string `json:"geometry,omitempty"`  // GeoJSON (odatda Point)
	TargetID string `json:"target_id,omitempty"` // alias uchun: qaysi ko'cha
	// StreetKind — faqat `kind=street` uchun.
	StreetKind string `json:"street_kind,omitempty"`
}

var validContribKinds = map[string]bool{"mahalla": true, "street": true, "alias": true}

const (
	maxNoteLen    = 500
	maxGeometryKB = 256 // ommaviy taklif uchun murakkab poligon kerak emas
)

// Submit — taklifni KARANTIN jadvaliga yozadi.
//
// Bu — ommaviy API chaqira oladigan YAGONA yozish amali. Baza
// grantlari ham shuni majburlaydi: `ondexmap_app` roli faqat
// `geo_contributions` ga INSERT qila oladi (0003 migratsiyasi).
//
// `hint` — yuboruvchining qo'pol belgisi (IP xeshi). XOM IP
// SAQLANMAYDI: u shaxsiy ma'lumot va uni saqlashning ehtiyoji yo'q —
// bizga faqat spamni guruhlash uchun barqaror belgi kerak.
func (p *Pool) Submit(ctx context.Context, in SubmitInput, submittedBy, hint string) (string, error) {
	if !validContribKinds[in.Kind] {
		return "", errors.New("`kind` noto'g'ri (mahalla | street | alias)")
	}
	if err := validateName(in.Name); err != nil {
		return "", err
	}
	if len([]rune(in.Note)) > maxNoteLen {
		return "", errors.New("izoh juda uzun")
	}
	if len(in.Geometry) > maxGeometryKB*1024 {
		return "", errors.New("geometriya juda katta")
	}
	if in.Kind == "alias" && strings.TrimSpace(in.TargetID) == "" {
		return "", errors.New("muqobil nom uchun ko'cha tanlanmagan")
	}
	if in.Kind == "street" && in.StreetKind != "" && !validStreetKinds[in.StreetKind] {
		return "", errors.New("`street_kind` noto'g'ri")
	}

	payload, err := json.Marshal(map[string]string{
		"name":        strings.TrimSpace(in.Name),
		"street_kind": in.StreetKind,
	})
	if err != nil {
		return "", ErrInvalidInput
	}

	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	// Geometriya berilgan bo'lsa — xizmat hududi tekshiruvidan o'tadi.
	// Berilmagan bo'lsa (faqat nom taklifi) — NULL bo'lib qoladi.
	const sql = `
INSERT INTO geo_contributions
    (kind, op, target_id, payload, geom, submitted_by, submitter_hint, submitter_note)
SELECT $1, 'create', NULLIF($2,''), $3::jsonb,
       CASE WHEN NULLIF($4,'') IS NULL THEN NULL
            ELSE ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)::geography END,
       NULLIF($5,''), NULLIF($6,''), NULLIF($7,'')
WHERE NULLIF($4,'') IS NULL
   OR ST_Within(ST_SetSRID(ST_GeomFromGeoJSON($4), 4326), ` + serviceBBoxSQL + `)
RETURNING id`

	var id string
	err = p.QueryRow(ctx, sql,
		in.Kind, in.TargetID, string(payload), in.Geometry,
		submittedBy, hint, strings.TrimSpace(in.Note),
	).Scan(&id)
	if err != nil {
		return "", ErrOutsideServiceArea
	}
	return id, nil
}

// RecentCountByHint — bir yuboruvchidan oxirgi soatdagi takliflar soni.
//
// Rate limit'dan QO'SHIMCHA qatlam: rate limit xotirada va server
// qayta ishga tushganda nolga qaytadi, bu esa BAZADA. Spam yuboruvchi
// serverni qayta yuklashini kutib o'tira olmaydi.
func (p *Pool) RecentCountByHint(ctx context.Context, hint string) (int, error) {
	if hint == "" {
		return 0, nil
	}
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	const sql = `
SELECT count(*) FROM geo_contributions
WHERE submitter_hint = $1 AND created_at > now() - interval '1 hour'`

	var n int
	if err := p.QueryRow(ctx, sql, hint).Scan(&n); err != nil {
		return 0, errQuery
	}
	return n, nil
}

// ── Moderatsiya (admin vositasi) ─────────────────────────────────────

// ListContributions — navbat. `status` bo'sh bo'lsa `pending`.
func (p *Pool) ListContributions(ctx context.Context, status string, limit int) ([]Contribution, error) {
	switch status {
	case "", "pending":
		status = "pending"
	case "approved", "rejected":
	default:
		return nil, ErrInvalidInput
	}
	if limit <= 0 || limit > 200 {
		limit = 100
	}

	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	const sql = `
SELECT id, kind, op, COALESCE(target_id,''), payload,
       COALESCE(ST_AsGeoJSON(geom)::jsonb, 'null'::jsonb),
       status, COALESCE(submitted_by,''), COALESCE(submitter_note,''), created_at
FROM geo_contributions
WHERE status = $1
ORDER BY created_at DESC
LIMIT $2`

	rows, err := p.Query(ctx, sql, status, limit)
	if err != nil {
		return nil, errQuery
	}
	defer rows.Close()

	out := []Contribution{}
	for rows.Next() {
		var c Contribution
		if err := rows.Scan(&c.ID, &c.Kind, &c.Op, &c.TargetID, &c.Payload,
			&c.Geometry, &c.Status, &c.SubmittedBy, &c.SubmitterNote, &c.CreatedAt); err != nil {
			return nil, errQuery
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// PendingCount — navbatdagi takliflar soni (admin paneldagi belgi).
func (p *Pool) PendingCount(ctx context.Context) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()
	var n int
	if err := p.QueryRow(ctx,
		`SELECT count(*) FROM geo_contributions WHERE status='pending'`).Scan(&n); err != nil {
		return 0, errQuery
	}
	return n, nil
}

// ApproveInput — tasdiqlash. Admin taklifni TAHRIRLAB tasdiqlaydi:
// nomni to'g'rilaydi, aniq geometriya chizadi, provenansni belgilaydi.
type ApproveInput struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Kind     string `json:"kind,omitempty"` // ko'cha turi
	Source   string `json:"source"`         // provenans — ADMIN belgilaydi
	Geometry string `json:"geometry"`
	Reviewer string `json:"-"`
}

// Approve — taklifni jonli jadvalga ko'chiradi.
//
// HAMMASI BITTA TRANZAKSIYADA:
//  1. taklif qatori qulflanadi va holati tekshiriladi
//  2. jonli jadvalga yoziladi
//  3. `geo_revisions` ga qayd qilinadi (orqaga qaytarish uchun)
//  4. taklif `approved` deb belgilanadi
//
// Xato bo'lsa hech biri saqlanmaydi — yarim tasdiqlangan holat
// bo'lmaydi.
func (p *Pool) Approve(ctx context.Context, in ApproveInput) (string, error) {
	if strings.TrimSpace(in.ID) == "" {
		return "", ErrInvalidInput
	}
	if err := validateName(in.Name); err != nil {
		return "", err
	}
	if !validSources[in.Source] {
		return "", errors.New("`source` noto'g'ri")
	}

	ctx, cancel := context.WithTimeout(ctx, queryTimeout*3)
	defer cancel()

	tx, err := p.Begin(ctx)
	if err != nil {
		return "", errQuery
	}
	defer tx.Rollback(ctx) //nolint:errcheck // Commit'dan keyin no-op

	// `FOR UPDATE` — ikki admin bir vaqtda bir taklifni tasdiqlab,
	// ikkita yozuv yaratib qo'ymasin.
	var kind, status, targetID string
	err = tx.QueryRow(ctx,
		`SELECT kind, status, COALESCE(target_id,'') FROM geo_contributions
		 WHERE id = $1 FOR UPDATE`, in.ID).Scan(&kind, &status, &targetID)
	if err != nil {
		return "", ErrNotFound
	}
	if status != "pending" {
		return "", errors.New("bu taklif allaqachon ko'rib chiqilgan")
	}

	var liveID string
	switch kind {
	case "mahalla":
		err = tx.QueryRow(ctx, `
WITH g AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($2), 4326) AS geom)
INSERT INTO mahallas (name, center, geom, source)
SELECT $1,
       ST_Centroid(g.geom)::geography,
       CASE WHEN ST_GeometryType(g.geom) IN ('ST_Polygon','ST_MultiPolygon')
            THEN ST_Multi(g.geom)::geography END,
       $3
FROM g
WHERE ST_Within(g.geom, `+serviceBBoxSQL+`)
RETURNING id`, strings.TrimSpace(in.Name), in.Geometry, in.Source).Scan(&liveID)

	case "street":
		streetKind := in.Kind
		if streetKind == "" || !validStreetKinds[streetKind] {
			streetKind = "kocha"
		}
		err = tx.QueryRow(ctx, `
WITH g AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($2), 4326) AS geom)
INSERT INTO streets (name, kind, geom, source)
SELECT $1, $4,
       CASE WHEN ST_GeometryType(g.geom) IN ('ST_LineString','ST_MultiLineString')
            THEN ST_Multi(g.geom)::geography END,
       $3
FROM g
WHERE ST_Within(g.geom, `+serviceBBoxSQL+`)
RETURNING id`, strings.TrimSpace(in.Name), in.Geometry, in.Source, streetKind).Scan(&liveID)

	case "alias":
		if targetID == "" {
			return "", errors.New("muqobil nom uchun ko'cha ko'rsatilmagan")
		}
		err = tx.QueryRow(ctx, `
INSERT INTO street_aliases (street_id, alias, kind, source)
VALUES ($1, $2, 'xalq', $3)
ON CONFLICT (street_id, alias) DO UPDATE SET kind = EXCLUDED.kind
RETURNING id`, targetID, strings.TrimSpace(in.Name), in.Source).Scan(&liveID)

	default:
		return "", ErrInvalidInput
	}
	if err != nil {
		return "", ErrOutsideServiceArea
	}

	after, _ := json.Marshal(map[string]string{
		"name": strings.TrimSpace(in.Name), "source": in.Source, "kind": in.Kind,
	})
	if _, err := tx.Exec(ctx, `
INSERT INTO geo_revisions (target_kind, target_id, op, before, after, contribution_id, applied_by)
VALUES ($1, $2, 'create', NULL, $3::jsonb, $4, $5)`,
		kind, liveID, string(after), in.ID, in.Reviewer); err != nil {
		return "", errQuery
	}

	if _, err := tx.Exec(ctx, `
UPDATE geo_contributions
SET status='approved', reviewed_by=$2, reviewed_at=now()
WHERE id=$1`, in.ID, in.Reviewer); err != nil {
		return "", errQuery
	}

	if err := tx.Commit(ctx); err != nil {
		return "", errQuery
	}
	return liveID, nil
}

// Reject — taklifni rad etadi. Yozuv O'CHIRILMAYDI: rad etilgan
// takliflar ham tarixda qoladi (kim nima yuborganini ko'rish va
// takroriy spamni aniqlash uchun).
func (p *Pool) Reject(ctx context.Context, id, reviewer, note string) error {
	if strings.TrimSpace(id) == "" {
		return ErrInvalidInput
	}
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	tag, err := p.Exec(ctx, `
UPDATE geo_contributions
SET status='rejected', reviewed_by=$2, reviewed_at=now(), review_note=NULLIF($3,'')
WHERE id=$1 AND status='pending'`, id, reviewer, strings.TrimSpace(note))
	if err != nil {
		return errQuery
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
