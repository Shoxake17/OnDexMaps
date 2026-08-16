package storage

import (
	"context"
	"errors"
	"strings"
)

// ═══════════════════════════════════════════════════════════════════
// YOZISH AMALLARI
//
// ⚠️ Bu fayldagi funksiyalar FAQAT yozuvchi hovuz bilan ishlaydi
// (`ReadWrite`, `DATABASE_URL_MIGRATE`). Ommaviy API `ReadOnly` hovuz
// ishlatadi va `ondexmap_app` rolida yozish huquqi umuman yo'q —
// ya'ni bu funksiyalarni tasodifan chaqirish ham natija bermaydi,
// baza rad etadi.
//
// Chaqiruvchilar: `cmd/admin` va `cmd/geoimport`. Ikkalasi ham lokal.
// ═══════════════════════════════════════════════════════════════════

// serviceBBoxSQL — xizmat hududi (Chust atrofi).
//
// MA'LUMOT ZAHARLANISHIDAN himoya: bu chegaradan tashqaridagi
// geometriya bazaga UMUMAN kirmaydi. Noto'g'ri koordinata tizimi
// (masalan metrlarda berilgan raqamlar) ham shu yerda to'xtaydi.
const serviceBBoxSQL = `ST_MakeEnvelope(70.5, 40.5, 72.0, 41.6, 4326)`

// ErrOutsideServiceArea — geometriya xizmat hududidan tashqarida.
var ErrOutsideServiceArea = errors.New("geometriya xizmat hududidan tashqarida")

// ErrInvalidInput — kiruvchi ma'lumot yaroqsiz.
var ErrInvalidInput = errors.New("ma'lumot yaroqsiz")

var validSources = map[string]bool{
	"official": true, "survey": true, "osm": true, "community": true,
}

var validStreetKinds = map[string]bool{
	"kocha": true, "tor_kocha": true, "xiyobon": true,
	"shox_kocha": true, "maydon": true,
}

// MahallaInput — mahalla yaratish/yangilash uchun.
type MahallaInput struct {
	ID       string `json:"id,omitempty"` // bo'sh bo'lsa — yangi yozuv
	Name     string `json:"name"`
	Source   string `json:"source"`
	Geometry string `json:"geometry"` // xom GeoJSON
}

// StreetInput — ko'cha yaratish/yangilash uchun.
type StreetInput struct {
	ID       string `json:"id,omitempty"`
	Name     string `json:"name"`
	Kind     string `json:"kind"`
	Source   string `json:"source"`
	Geometry string `json:"geometry"`
}

func validateName(name string) error {
	n := strings.TrimSpace(name)
	if n == "" {
		return errors.New("nom bo'sh")
	}
	// Yuqori chegara: bazada cheklov yo'q, lekin cheksiz uzun nom
	// interfeysni buzadi va foydali emas.
	if len([]rune(n)) > 200 {
		return errors.New("nom juda uzun (200 belgidan ko'p)")
	}
	return nil
}

// UpsertMahalla — mahallani saqlaydi. ID bo'sh bo'lsa yangi yaratadi.
func (p *Pool) UpsertMahalla(ctx context.Context, in MahallaInput) (string, error) {
	if err := validateName(in.Name); err != nil {
		return "", err
	}
	if !validSources[in.Source] {
		return "", errors.New("`source` noto'g'ri")
	}
	if strings.TrimSpace(in.Geometry) == "" {
		return "", errors.New("geometriya yo'q")
	}

	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	// Geometriya PARAMETR sifatida uzatiladi — SQL satriga
	// yopishtirilmaydi.
	const sql = `
WITH g AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($4), 4326) AS geom)
INSERT INTO mahallas (id, name, center, geom, source)
SELECT COALESCE(NULLIF($1, ''), gen_random_uuid()::text),
       $2,
       ST_Centroid(g.geom)::geography,
       CASE WHEN ST_GeometryType(g.geom) IN ('ST_Polygon','ST_MultiPolygon')
            THEN ST_Multi(g.geom)::geography END,
       $3
FROM g
WHERE ST_Within(g.geom, ` + serviceBBoxSQL + `)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, center = EXCLUDED.center,
    geom = EXCLUDED.geom, source = EXCLUDED.source
RETURNING id`

	var id string
	err := p.QueryRow(ctx, sql, in.ID, strings.TrimSpace(in.Name), in.Source, in.Geometry).Scan(&id)
	if err != nil {
		// Qator qaytmasa — `WHERE` sharti bajarilmagan, ya'ni
		// geometriya hudud tashqarisida.
		return "", ErrOutsideServiceArea
	}
	return id, nil
}

// UpsertStreet — ko'chani saqlaydi.
func (p *Pool) UpsertStreet(ctx context.Context, in StreetInput) (string, error) {
	if err := validateName(in.Name); err != nil {
		return "", err
	}
	if !validSources[in.Source] {
		return "", errors.New("`source` noto'g'ri")
	}
	if in.Kind == "" {
		in.Kind = "kocha"
	}
	if !validStreetKinds[in.Kind] {
		return "", errors.New("`kind` noto'g'ri")
	}
	if strings.TrimSpace(in.Geometry) == "" {
		return "", errors.New("geometriya yo'q")
	}

	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	const sql = `
WITH g AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($5), 4326) AS geom)
INSERT INTO streets (id, name, kind, geom, source)
SELECT COALESCE(NULLIF($1, ''), gen_random_uuid()::text),
       $2, $3,
       CASE WHEN ST_GeometryType(g.geom) IN ('ST_LineString','ST_MultiLineString')
            THEN ST_Multi(g.geom)::geography END,
       $4
FROM g
WHERE ST_Within(g.geom, ` + serviceBBoxSQL + `)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, kind = EXCLUDED.kind,
    geom = EXCLUDED.geom, source = EXCLUDED.source
RETURNING id`

	var id string
	err := p.QueryRow(ctx, sql, in.ID, strings.TrimSpace(in.Name), in.Kind, in.Source, in.Geometry).Scan(&id)
	if err != nil {
		return "", ErrOutsideServiceArea
	}
	return id, nil
}

// Delete — mahalla yoki ko'chani o'chiradi.
//
// `kind` chaqiruvchidan keladi, lekin u SQL satriga QO'SHILMAYDI —
// aniq `switch` orqali oldindan yozilgan so'rov tanlanadi.
func (p *Pool) Delete(ctx context.Context, kind, id string) error {
	if strings.TrimSpace(id) == "" {
		return ErrInvalidInput
	}
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	var sql string
	switch kind {
	case "mahalla":
		sql = `DELETE FROM mahallas WHERE id = $1`
	case "street":
		sql = `DELETE FROM streets WHERE id = $1`
	case "alias":
		sql = `DELETE FROM street_aliases WHERE id = $1`
	default:
		return ErrInvalidInput
	}

	tag, err := p.Exec(ctx, sql, id)
	if err != nil {
		return errQuery
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// AddAlias — ko'chaga muqobil nom qo'shadi (xalq nomi, eski nom).
func (p *Pool) AddAlias(ctx context.Context, streetID, alias, kind, source string) error {
	if err := validateName(alias); err != nil {
		return err
	}
	if !validSources[source] {
		return errors.New("`source` noto'g'ri")
	}
	switch kind {
	case "official", "xalq", "eski", "kirill":
	default:
		return errors.New("alias turi noto'g'ri")
	}

	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	const sql = `
INSERT INTO street_aliases (street_id, alias, kind, source)
VALUES ($1, $2, $3, $4)
ON CONFLICT (street_id, alias) DO UPDATE SET kind = EXCLUDED.kind`

	if _, err := p.Exec(ctx, sql, streetID, strings.TrimSpace(alias), kind, source); err != nil {
		return errors.New("saqlab bo'lmadi — ko'cha mavjudmi?")
	}
	return nil
}

// AdminFeature — admin ro'yxatidagi bitta yozuv.
//
// Ommaviy `/v1/mahallas` dan FARQLI: bu yerda `source` ham
// qaytariladi, chunki muharrirga provenans ko'rinishi kerak.
type AdminFeature struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Kind     string `json:"kind,omitempty"`
	Source   string `json:"source"`
	Geometry []byte `json:"-"`
	HasGeom  bool   `json:"has_geom"`
}

// ListAll — admin muharriri uchun barcha obyektlar GeoJSON sifatida.
func (p *Pool) ListAll(ctx context.Context, kind string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	var sql string
	switch kind {
	case "mahalla":
		sql = `
SELECT COALESCE(jsonb_build_object('type','FeatureCollection','features',
    COALESCE(jsonb_agg(jsonb_build_object(
        'type','Feature',
        'geometry', ST_AsGeoJSON(geom)::jsonb,
        'properties', jsonb_build_object(
            'id', id, 'name', name, 'source', source, 'layer', 'mahalla')
    ) ORDER BY name), '[]'::jsonb)), '{}'::jsonb)::text
FROM mahallas WHERE geom IS NOT NULL`
	case "street":
		sql = `
SELECT COALESCE(jsonb_build_object('type','FeatureCollection','features',
    COALESCE(jsonb_agg(jsonb_build_object(
        'type','Feature',
        'geometry', ST_AsGeoJSON(geom)::jsonb,
        'properties', jsonb_build_object(
            'id', id, 'name', name, 'kind', kind, 'source', source, 'layer', 'street')
    ) ORDER BY name), '[]'::jsonb)), '{}'::jsonb)::text
FROM streets WHERE geom IS NOT NULL`
	default:
		return nil, ErrInvalidInput
	}

	var out []byte
	if err := p.QueryRow(ctx, sql).Scan(&out); err != nil {
		return nil, errQuery
	}
	return out, nil
}
