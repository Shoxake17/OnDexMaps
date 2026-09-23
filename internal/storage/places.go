package storage

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"ondexmap/internal/places"
)

// ═══════════════════════════════════════════════════════════════════
// OB'EKTLAR (places)
//
// Bu fayl uch guruh amaldan iborat:
//   1. OMMAVIY O'QISH  — jonli `places` (faqat tasdiqlanganlar). Ommaviy
//      API (`ondexmap_app`, faqat SELECT) chaqiradi.
//   2. QIDIRUV        — tasdiqlangan ob'ektlar umumiy qidiruvga qo'shiladi.
//   3. MODERATSIYA    — karantinni ko'rish, tasdiqlash, rad etish, olib
//      tashlash. ⚠️ FAQAT yozuvchi hovuz bilan (`cmd/admin`, lokal).
//      Ommaviy hovuzda baza bularni rad etadi (grantlar + read-only).
// ═══════════════════════════════════════════════════════════════════

// idPattern — ob'ekt/taklif identifikatori (UUID). Bazaga borishdan OLDIN
// tekshiriladi: yaroqsiz qiymat hovuzdan ulanish ham olmaydi.
var idPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// ValidID — `id` UUID shaklidami.
func ValidID(id string) bool { return idPattern.MatchString(id) }

// MaxPlacesPerView — bitta xarita ko'rinishida qaytariladigan eng ko'p ob'ekt.
const MaxPlacesPerView = 500

// ── 1. Ommaviy o'qish ────────────────────────────────────────────────

// PlacesGeoJSON — berilgan to'rtburchakdagi tasdiqlangan ob'ektlar (GeoJSON).
// Baza tayyor JSON qaytaradi — qayta kodlanmaydi.
func (p *Pool) PlacesGeoJSON(ctx context.Context, west, south, east, north float64, limit int) ([]byte, error) {
	if limit <= 0 || limit > MaxPlacesPerView {
		limit = MaxPlacesPerView
	}
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	const sql = `
SELECT jsonb_build_object('type', 'FeatureCollection', 'features',
    COALESCE(jsonb_agg(jsonb_build_object(
        'type', 'Feature',
        'id', id,
        'geometry', ST_AsGeoJSON(geom::geometry, 6)::jsonb,
        'properties', jsonb_build_object(
            'id', id, 'kind', kind,
            'name', COALESCE(name, ''), 'category', COALESCE(category, ''))
    )), '[]'::jsonb))::text
FROM (
    SELECT id, kind, name, category, geom
    FROM places
    WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography
    ORDER BY created_at DESC
    LIMIT $5
) t`

	var out []byte
	if err := p.QueryRow(ctx, sql, west, south, east, north, limit).Scan(&out); err != nil {
		return nil, errQuery
	}
	return out, nil
}

// PlaceDetail — bitta ob'ektning to'liq ma'lumoti (rasm baytlarisiz).
type PlaceDetail struct {
	ID          string `json:"id"`
	Kind        string `json:"kind"`
	KindLabel   string `json:"kind_label"`
	Name        string `json:"name,omitempty"`
	Category    string `json:"category,omitempty"`
	Description string `json:"description,omitempty"`
	Phone       string `json:"phone,omitempty"`
	Hours       string `json:"hours,omitempty"`
	Street      string `json:"street,omitempty"`
	House       string `json:"house,omitempty"`
	// Site, Social — veb-sayt va ijtimoiy tarmoq manzili (faqat http/https;
	// `places.Validate` va bazadagi CHECK kafolatlaydi).
	Site   string `json:"site,omitempty"`
	Social string `json:"social,omitempty"`
	// Lat, Lng — nuqta uchun o'zi; chiziq (yo'l) uchun chiziqning O'ZIDA
	// yotgan bitta nuqta (`ST_PointOnSurface`): xaritani shu joyga olib borish,
	// qidiruv natijasi va manzil uchun.
	Lat    float64 `json:"lat"`
	Lng    float64 `json:"lng"`
	Photos int     `json:"photos"`
	// Geometry — GeoJSON (Point yoki LineString). Chiziqni xaritada chizish
	// va moderatorga ko'rsatish uchun.
	Geometry json.RawMessage `json:"geometry,omitempty"`
	// LengthM — chiziq uzunligi (metr); nuqta uchun 0 (JSON'da yo'q).
	LengthM   float64   `json:"length_m,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// placeGeomCols — geometriya ustunlari (Lat, Lng, Geometry, LengthM) — `places`
// va `place_submissions` bir xil shaklda o'qiydi. Tartib scanPlace bilan BIR XIL.
const placeGeomCols = `ST_Y(ST_PointOnSurface(geom::geometry)), ST_X(ST_PointOnSurface(geom::geometry)),
       photo_count, ST_AsGeoJSON(geom::geometry, 6),
       CASE WHEN GeometryType(geom::geometry) = 'LINESTRING' THEN ST_Length(geom) ELSE 0 END`

// placeTextCols — matnli ustunlar; `places` va `place_submissions` bir xil
// shaklda o'qiydi. Tartib `scanTargets` bilan BIR XIL.
const placeTextCols = `id, kind, COALESCE(name,''), COALESCE(category,''), COALESCE(description,''),
       COALESCE(phone,''), COALESCE(hours,''), COALESCE(street,''), COALESCE(house,''),
       COALESCE(site,''), COALESCE(social,'')`

const placeCols = placeTextCols + `,
       ` + placeGeomCols + `, created_at`

// placeScanTargets — placeCols/ListSubmissions tartibidagi maydonlar.
func (d *PlaceDetail) scanTargets(geom *string) []any {
	return []any{&d.ID, &d.Kind, &d.Name, &d.Category, &d.Description, &d.Phone,
		&d.Hours, &d.Street, &d.House, &d.Site, &d.Social,
		&d.Lat, &d.Lng, &d.Photos, geom, &d.LengthM}
}

func scanPlace(row pgx.Row) (*PlaceDetail, error) {
	var d PlaceDetail
	var geom string
	dest := append(d.scanTargets(&geom), &d.CreatedAt)
	if err := row.Scan(dest...); err != nil {
		return nil, err
	}
	d.Geometry = json.RawMessage(geom)
	d.KindLabel = places.KindLabel(d.Kind)
	return &d, nil
}

// geomSQL — geography ifodasi: xs/ys — `float64[]` parametrlarining raqami.
// Bitta element bo'lsa NUQTA, ko'p bo'lsa CHIZIQ (`ST_MakeLine`, nuqtalar
// berilgan tartibda). Qiymatlar parametr sifatida keladi — SQL matniga
// hech qachon qo'shilmaydi.
func geomSQL(xs, ys int) string {
	x, y := "$"+strconv.Itoa(xs)+"::float8[]", "$"+strconv.Itoa(ys)+"::float8[]"
	return `ST_SetSRID(CASE WHEN cardinality(` + x + `) = 1
	         THEN ST_MakePoint((` + x + `)[1], (` + y + `)[1])
	         ELSE ST_MakeLine(ARRAY(
	             SELECT ST_MakePoint(px, py)
	             FROM unnest(` + x + `, ` + y + `) WITH ORDINALITY AS t(px, py, ord)
	             ORDER BY ord))
	       END, 4326)::geography`
}

// geomArgs — `geomSQL` uchun ikki massiv (lng lar va lat lar).
func geomArgs(c places.Clean) (xs, ys []float64) {
	if c.IsLine() {
		xs, ys = make([]float64, len(c.Line)), make([]float64, len(c.Line))
		for i, p := range c.Line {
			xs[i], ys[i] = p[0], p[1]
		}
		return xs, ys
	}
	return []float64{c.Lng}, []float64{c.Lat}
}

// PlaceByID — tasdiqlangan ob'ekt; topilmasa `ErrNotFound`.
func (p *Pool) PlaceByID(ctx context.Context, id string) (*PlaceDetail, error) {
	if !ValidID(id) {
		return nil, ErrNotFound
	}
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()
	d, err := scanPlace(p.QueryRow(ctx, `SELECT `+placeCols+` FROM places WHERE id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, errQuery
	}
	return d, nil
}

// PlacePhoto — tasdiqlangan ob'ekt rasmining R2 kaliti (baytlar EMAS —
// baytlar R2'da; chaqiruvchi kalitni HTTP qatlamidagi R2 do'koni orqali
// yuklab oladi).
func (p *Pool) PlacePhoto(ctx context.Context, id string, pos int) (string, error) {
	if !ValidID(id) || pos < 0 || pos >= places.MaxPhotos {
		return "", ErrNotFound
	}
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()
	var key string
	err := p.QueryRow(ctx,
		`SELECT r2_key FROM place_photos WHERE place_id = $1 AND pos = $2`, id, pos).Scan(&key)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", errQuery
	}
	return key, nil
}

// ── 2. Qidiruv ───────────────────────────────────────────────────────

// likeEscape — LIKE naqshidagi maxsus belgilarni (`%`, `_`, `\`) oddiy belgiga
// aylantiradi. Normallashgan so'zda ular odatda bo'lmaydi, lekin naqshga
// kiruvchi matn qo'shiladigan joyda bunga tayanmaymiz.
func likeEscape(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

// searchPlaces — tasdiqlangan ob'ektlarni nom/ko'cha/uy bo'yicha qidiradi.
//
// Ball `geo_names` shkalasiga mos (95 aniq, 80 boshlanadi, 70 so'z boshi,
// 40 ichida): shu tufayli natijalar birga adolatli tartiblanadi.
func (p *Pool) searchPlaces(ctx context.Context, norm string, toks []string, limit int) ([]Match, error) {
	var sb strings.Builder
	args := []any{norm, limit}
	sb.WriteString(`
SELECT id, kind, COALESCE(name,''), COALESCE(category,''), COALESCE(street,''), COALESCE(house,''),
       ST_Y(ST_PointOnSurface(geom::geometry)), ST_X(ST_PointOnSurface(geom::geometry)),
       (CASE
          WHEN name_norm = $1 THEN 95.0
          WHEN name_norm LIKE $1 || '%' THEN 80.0
          WHEN ' ' || name_norm LIKE '% ' || $1 || '%' THEN 70.0
          ELSE 40.0
        END) AS ts
FROM places
WHERE search <> ''`)
	for _, t := range toks {
		args = append(args, likeEscape(t))
		sb.WriteString(" AND search LIKE '%' || $" + strconv.Itoa(len(args)) + " || '%'")
	}
	sb.WriteString(` ORDER BY ts DESC, created_at DESC LIMIT $2`)

	rows, err := p.Query(ctx, sb.String(), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Match{}
	for rows.Next() {
		var id, kind, name, category, street, house string
		var lat, lng, ts float64
		if err := rows.Scan(&id, &kind, &name, &category, &street, &house, &lat, &lng, &ts); err != nil {
			return nil, err
		}
		title := name
		if title == "" {
			title = strings.TrimSpace(street + " " + house)
		}
		label := places.KindLabel(kind)
		if kind == "organization" && category != "" {
			label = category
		}
		la, ln := lat, lng
		out = append(out, Match{
			ID: "p" + id, Type: "place", Name: title, Label: label,
			Lat: &la, Lng: &ln,
			// Jamoa kiritgan (admin tasdiqlagan) ob'ekt OSM'dagi bir xil
			// nomdan biroz ustun: u ishonchli va yangi.
			Score: ts + 5,
		})
	}
	return out, rows.Err()
}

// ── 3. Moderatsiya (FAQAT yozuvchi hovuz) ────────────────────────────

// SubmissionRow — moderatsiya navbatidagi bitta taklif.
type SubmissionRow struct {
	PlaceDetail
	Status      string     `json:"status"`
	Hint        string     `json:"hint"`
	ReviewedBy  string     `json:"reviewed_by,omitempty"`
	ReviewedAt  *time.Time `json:"reviewed_at,omitempty"`
	ReviewNote  string     `json:"review_note,omitempty"`
	PlaceID     string     `json:"place_id,omitempty"`
	SubmittedAt time.Time  `json:"submitted_at"`
}

// ListSubmissions — navbat. `status` bo'sh bo'lsa `pending`.
func (p *Pool) ListSubmissions(ctx context.Context, status string, limit int) ([]SubmissionRow, error) {
	switch status {
	case "":
		status = "pending"
	case "pending", "approved", "rejected":
	default:
		return nil, ErrInvalidInput
	}
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	rows, err := p.Query(ctx, `
SELECT `+placeTextCols+`,
       `+placeGeomCols+`, created_at,
       status, submitter_hint, COALESCE(reviewed_by,''), reviewed_at,
       COALESCE(review_note,''), COALESCE(place_id,'')
FROM place_submissions
WHERE status = $1
ORDER BY created_at DESC
LIMIT $2`, status, limit)
	if err != nil {
		return nil, errQuery
	}
	defer rows.Close()

	out := []SubmissionRow{}
	for rows.Next() {
		var r SubmissionRow
		var geom string
		dest := append(r.scanTargets(&geom), &r.CreatedAt,
			&r.Status, &r.Hint, &r.ReviewedBy, &r.ReviewedAt, &r.ReviewNote, &r.PlaceID)
		if err := rows.Scan(dest...); err != nil {
			return nil, errQuery
		}
		r.Geometry = json.RawMessage(geom)
		r.KindLabel = places.KindLabel(r.Kind)
		r.SubmittedAt = r.CreatedAt
		out = append(out, r)
	}
	return out, rows.Err()
}

// SubmissionPhoto — karantindagi taklif rasmining R2 kaliti (moderator
// ko'rishi uchun; baytlar R2'da, kalit HTTP qatlamida yuklab olinadi).
func (p *Pool) SubmissionPhoto(ctx context.Context, id string, pos int) (string, error) {
	if !ValidID(id) || pos < 0 || pos >= places.MaxPhotos {
		return "", ErrNotFound
	}
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()
	var key string
	err := p.QueryRow(ctx,
		`SELECT r2_key FROM place_submission_photos WHERE submission_id = $1 AND pos = $2`,
		id, pos).Scan(&key)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", errQuery
	}
	return key, nil
}

// ApprovePlace — tasdiqlash. Moderator taklifni TAHRIRLAB tasdiqlaydi:
// nomni to'g'rilaydi, nuqtani suradi, keraksiz rasmni tashlaydi.
type ApprovePlace struct {
	ID       string
	Reviewer string
	// Edit — yakuniy qiymatlar (yuboruvchining asl matni EMAS). Ommaviy
	// API'dagi bilan BIR XIL qoidalardan o'tadi (`places.Validate`).
	Edit places.Input
	// Source — provenans; bo'sh bo'lsa `community`.
	Source string
	// KeepPhotos — qoldiriladigan rasm o'rinlari. `nil` — hammasi.
	KeepPhotos []int
}

// ApproveSubmission — taklifni jonli `places` ga ko'chiradi.
//
// HAMMASI BITTA TRANZAKSIYADA:
//  1. taklif qatori qulflanadi va holati tekshiriladi (ikki moderator bir
//     vaqtda bosib, ikkita ob'ekt yaratib qo'ymasin);
//  2. jonli jadvalga yoziladi, tanlangan rasmlar ko'chiriladi;
//  3. karantindagi rasmlar o'chiriladi (joy bo'shatiladi);
//  4. `geo_revisions` ga qayd qilinadi (qaytarish uchun);
//  5. taklif `approved` deb belgilanadi.
//
// Xato bo'lsa hech biri saqlanmaydi.
func (p *Pool) ApproveSubmission(ctx context.Context, in ApprovePlace) (string, error) {
	if !ValidID(in.ID) || strings.TrimSpace(in.Reviewer) == "" {
		return "", ErrInvalidInput
	}
	source := in.Source
	if source == "" {
		source = "community"
	}
	if !validSources[source] {
		return "", errors.New("`source` noto'g'ri")
	}
	c, err := places.Validate(in.Edit)
	if err != nil {
		return "", err
	}
	keep := map[int]bool{}
	for _, k := range in.KeepPhotos {
		if k < 0 || k >= places.MaxPhotos {
			return "", ErrInvalidInput
		}
		keep[k] = true
	}

	ctx, cancel := context.WithTimeout(ctx, queryTimeout*4)
	defer cancel()
	tx, err := p.Begin(ctx)
	if err != nil {
		return "", errQuery
	}
	defer tx.Rollback(ctx) //nolint:errcheck // Commit'dan keyin no-op

	var status string
	if err := tx.QueryRow(ctx,
		`SELECT status FROM place_submissions WHERE id = $1 FOR UPDATE`, in.ID).Scan(&status); err != nil {
		return "", ErrNotFound
	}
	if status != "pending" {
		return "", errors.New("bu taklif allaqachon ko'rib chiqilgan")
	}

	// Nuqta yoki chiziq — `geomSQL` (qiymatlar parametr, SQL matniga qo'shilmaydi).
	xs, ys := geomArgs(c)
	var placeID string
	if err := tx.QueryRow(ctx, `
INSERT INTO places (kind, name, category, description, phone, hours, street, house,
                    site, social, geom, source, submission_id, approved_by)
VALUES ($1, NULLIF($2,''), NULLIF($3,''), NULLIF($4,''), NULLIF($5,''), NULLIF($6,''),
        NULLIF($7,''), NULLIF($8,''), NULLIF($9,''), NULLIF($10,''),
        `+geomSQL(11, 12)+`, $13, $14, $15)
RETURNING id`,
		c.Kind, c.Name, c.Category, c.Description, c.Phone, c.Hours, c.Street, c.House,
		c.Site, c.Social,
		xs, ys, source, in.ID, in.Reviewer).Scan(&placeID); err != nil {
		return "", errQuery
	}

	// R2 tozalash uchun: KO'CHIRISHDAN OLDIN barcha karantin rasm
	// kalitlarini o'qib olamiz. Tashlab yuboriladigan (KeepPhotos'ga
	// kirmagan) pozitsiyalarning R2 obyekti hech qayerdan
	// ko'rsatilmay qoladi — tranzaksiya muvaffaqiyatli yakunlangach
	// ularni R2'dan ham o'chiramiz (pastda).
	subKeys, err := submissionPhotoKeys(ctx, tx, in.ID)
	if err != nil {
		return "", err
	}

	// Tanlangan rasmlarni 0..n-1 qilib qayta raqamlab ko'chiramiz.
	keepAll := in.KeepPhotos == nil
	positions := keptPositions(keepAll, keep)
	tag, err := tx.Exec(ctx, `
INSERT INTO place_photos (place_id, pos, r2_key)
SELECT $1, (row_number() OVER (ORDER BY pos) - 1)::smallint, r2_key
FROM place_submission_photos
WHERE submission_id = $2 AND pos = ANY($3::smallint[])`, placeID, in.ID, positions)
	if err != nil {
		return "", errQuery
	}
	if _, err := tx.Exec(ctx,
		`UPDATE places SET photo_count = $2 WHERE id = $1`, placeID, int(tag.RowsAffected())); err != nil {
		return "", errQuery
	}
	if _, err := tx.Exec(ctx,
		`DELETE FROM place_submission_photos WHERE submission_id = $1`, in.ID); err != nil {
		return "", errQuery
	}

	afterDoc := map[string]any{
		"kind": c.Kind, "name": c.Name, "category": c.Category, "description": c.Description,
		"phone": c.Phone, "hours": c.Hours, "street": c.Street, "house": c.House,
		"site": c.Site, "social": c.Social,
		"source": source, "submission_id": in.ID,
		"photos": tag.RowsAffected(),
	}
	if c.IsLine() {
		afterDoc["line"] = c.Line
		afterDoc["length_m"] = int(places.LineLengthMeters(c.Line))
	} else {
		afterDoc["lat"], afterDoc["lng"] = c.Lat, c.Lng
	}
	after, _ := json.Marshal(afterDoc)
	if _, err := tx.Exec(ctx, `
INSERT INTO geo_revisions (target_kind, target_id, op, before, after, applied_by)
VALUES ('place', $1, 'create', NULL, $2::jsonb, $3)`, placeID, string(after), in.Reviewer); err != nil {
		return "", errQuery
	}
	if _, err := tx.Exec(ctx, `
UPDATE place_submissions
SET status = 'approved', reviewed_by = $2, reviewed_at = now(), place_id = $3
WHERE id = $1`, in.ID, in.Reviewer, placeID); err != nil {
		return "", errQuery
	}
	if err := tx.Commit(ctx); err != nil {
		return "", errQuery
	}

	// Tashlab yuborilgan rasmlarni R2'dan tozalaymiz (best-effort — DB
	// tranzaksiyasi allaqachon committed, bu yerdagi xato tasdiqlashni
	// bekor qilmaydi).
	if !keepAll && p.r2 != nil {
		p.cleanupUnkept(subKeys, keep)
	}
	return placeID, nil
}

// submissionPhotoKeys — karantindagi taklifning barcha rasm kalitlari
// (pozitsiya bo'yicha). `ApproveSubmission`dan ajratilgan — R2 tozalash
// uchun ko'chirishdan OLDIN kerak.
func submissionPhotoKeys(ctx context.Context, tx pgx.Tx, submissionID string) (map[int]string, error) {
	rows, err := tx.Query(ctx,
		`SELECT pos, r2_key FROM place_submission_photos WHERE submission_id = $1`, submissionID)
	if err != nil {
		return nil, errQuery
	}
	defer rows.Close()
	keys := map[int]string{}
	for rows.Next() {
		var pos int
		var key string
		if err := rows.Scan(&pos, &key); err != nil {
			return nil, errQuery
		}
		keys[pos] = key
	}
	if err := rows.Err(); err != nil {
		return nil, errQuery
	}
	return keys, nil
}

// keptPositions — tasdiqlashda ko'chiriladigan pozitsiyalar ro'yxati.
// `keepAll` bo'lsa (KeepPhotos == nil) — barcha mumkin bo'lgan pozitsiya.
func keptPositions(keepAll bool, keep map[int]bool) []int32 {
	var positions []int32
	if keepAll {
		for i := 0; i < places.MaxPhotos; i++ {
			positions = append(positions, int32(i))
		}
		return positions
	}
	for k := range keep {
		// G115 emas: `keep` `places.MaxPhotos` (kichik sobit son) bilan
		// chegaralangan — `k` hech qachon int32 sig'imidan oshmaydi.
		positions = append(positions, int32(k)) //nolint:gosec
	}
	return positions
}

// cleanupUnkept — tasdiqlashda TANLANMAGAN rasmlarni R2'dan o'chiradi
// (best-effort, DB tranzaksiyasi allaqachon committed).
func (p *Pool) cleanupUnkept(subKeys map[int]string, keep map[int]bool) {
	var drop []string
	for pos, key := range subKeys {
		if !keep[pos] {
			drop = append(drop, key)
		}
	}
	if len(drop) == 0 {
		return
	}
	if err := p.r2.DeleteMany(context.Background(), drop); err != nil {
		slog.Warn("R2 tozalanmadi (tanlanmagan rasm)", "err", err)
	}
}

// RejectSubmission — taklifni rad etadi. Yozuvning O'ZI qoladi (kim nima
// yuborganini ko'rish va takroriy spamni aniqlash uchun), lekin RASMLAR
// o'chiriladi: rad etilgan (ehtimol zararli) tasvirni saqlashning ehtiyoji yo'q.
func (p *Pool) RejectSubmission(ctx context.Context, id, reviewer, note string) error {
	if !ValidID(id) || strings.TrimSpace(reviewer) == "" {
		return ErrInvalidInput
	}
	if len([]rune(note)) > 500 {
		return errors.New("izoh juda uzun")
	}
	ctx, cancel := context.WithTimeout(ctx, queryTimeout*2)
	defer cancel()
	tx, err := p.Begin(ctx)
	if err != nil {
		return errQuery
	}
	defer tx.Rollback(ctx) //nolint:errcheck // Commit'dan keyin no-op

	tag, err := tx.Exec(ctx, `
UPDATE place_submissions
SET status = 'rejected', reviewed_by = $2, reviewed_at = now(), review_note = NULLIF($3,'')
WHERE id = $1 AND status = 'pending'`, id, reviewer, strings.TrimSpace(note))
	if err != nil {
		return errQuery
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}

	// R2 tozalash uchun: o'chirilishidan OLDIN kalitlarni o'qib olamiz.
	var dropKeys []string
	rows, err := tx.Query(ctx,
		`SELECT r2_key FROM place_submission_photos WHERE submission_id = $1`, id)
	if err != nil {
		return errQuery
	}
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			rows.Close()
			return errQuery
		}
		dropKeys = append(dropKeys, key)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return errQuery
	}
	rows.Close()

	if _, err := tx.Exec(ctx,
		`DELETE FROM place_submission_photos WHERE submission_id = $1`, id); err != nil {
		return errQuery
	}
	if err := tx.Commit(ctx); err != nil {
		return errQuery
	}

	if p.r2 != nil && len(dropKeys) > 0 {
		if err := p.r2.DeleteMany(context.Background(), dropKeys); err != nil {
			slog.Warn("R2 tozalanmadi (rad etilgan taklif)", "err", err)
		}
	}
	return nil
}

// ListPlacesAdmin — eng yangi tasdiqlangan ob'ektlar (olib tashlash uchun).
func (p *Pool) ListPlacesAdmin(ctx context.Context, limit int) ([]PlaceDetail, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()
	rows, err := p.Query(ctx,
		`SELECT `+placeCols+` FROM places ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, errQuery
	}
	defer rows.Close()
	out := []PlaceDetail{}
	for rows.Next() {
		d, err := scanPlace(rows)
		if err != nil {
			return nil, errQuery
		}
		out = append(out, *d)
	}
	return out, rows.Err()
}

// DeletePlace — tasdiqlangan ob'ektni xaritadan olib tashlaydi (vandalizm yoki
// xato). Oldingi holat `geo_revisions` ga yoziladi — "nima o'chirildi?" degan
// savolga javob qoladi.
func (p *Pool) DeletePlace(ctx context.Context, id, reviewer string) error {
	if !ValidID(id) || strings.TrimSpace(reviewer) == "" {
		return ErrInvalidInput
	}
	ctx, cancel := context.WithTimeout(ctx, queryTimeout*2)
	defer cancel()
	tx, err := p.Begin(ctx)
	if err != nil {
		return errQuery
	}
	defer tx.Rollback(ctx) //nolint:errcheck // Commit'dan keyin no-op

	var before []byte
	err = tx.QueryRow(ctx, `
SELECT jsonb_build_object('kind', kind, 'name', name, 'category', category,
       'description', description, 'phone', phone, 'hours', hours, 'street', street,
       'house', house, 'site', site, 'social', social, 'geometry', ST_AsGeoJSON(geom::geometry, 6)::jsonb,
       'lat', ST_Y(ST_PointOnSurface(geom::geometry)), 'lng', ST_X(ST_PointOnSurface(geom::geometry)),
       'source', source, 'submission_id', submission_id)::text
FROM places WHERE id = $1 FOR UPDATE`, id).Scan(&before)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return errQuery
	}

	// R2 tozalash uchun: `places` o'chirilishidan OLDIN kalitlarni o'qib
	// olamiz — `place_photos` qatorlari CASCADE bilan avtomatik ketadi
	// (0007_places.sql), lekin R2 obyekti CASCADE bilmaydi.
	var dropKeys []string
	rows, err := tx.Query(ctx, `SELECT r2_key FROM place_photos WHERE place_id = $1`, id)
	if err != nil {
		return errQuery
	}
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			rows.Close()
			return errQuery
		}
		dropKeys = append(dropKeys, key)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return errQuery
	}
	rows.Close()

	if _, err := tx.Exec(ctx, `DELETE FROM places WHERE id = $1`, id); err != nil {
		return errQuery
	}
	if _, err := tx.Exec(ctx, `
INSERT INTO geo_revisions (target_kind, target_id, op, before, after, applied_by)
VALUES ('place', $1, 'delete', $2::jsonb, NULL, $3)`, id, string(before), reviewer); err != nil {
		return errQuery
	}
	if err := tx.Commit(ctx); err != nil {
		return errQuery
	}

	if p.r2 != nil && len(dropKeys) > 0 {
		if err := p.r2.DeleteMany(context.Background(), dropKeys); err != nil {
			slog.Warn("R2 tozalanmadi (o'chirilgan ob'ekt)", "err", err)
		}
	}
	return nil
}

// PendingSubmissionCount — navbatdagi takliflar soni (admin paneldagi belgi).
func (p *Pool) PendingSubmissionCount(ctx context.Context) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()
	var n int
	if err := p.QueryRow(ctx,
		`SELECT count(*) FROM place_submissions WHERE status = 'pending'`).Scan(&n); err != nil {
		return 0, errQuery
	}
	return n, nil
}
