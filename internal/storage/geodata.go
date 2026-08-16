package storage

import (
	"context"
	"errors"
	"time"
)

// Match — qidiruv natijasidagi bitta yozuv.
type Match struct {
	ID    string  `json:"id"`
	Type  string  `json:"type"` // "street" | "mahalla"
	Name  string  `json:"name"`
	Kind  string  `json:"kind,omitempty"`
	Score float64 `json:"score"`
	// MatchedVia — qaysi nom orqali topildi. Alias orqali topilganda
	// foydalanuvchiga "Katta ko'cha (rasmiy: Navoiy ko'chasi)" deb
	// ko'rsatish imkonini beradi.
	MatchedVia string `json:"matched_via,omitempty"`
}

// Place — koordinata bo'yicha aniqlangan joy.
type Place struct {
	Mahalla    *Named `json:"mahalla,omitempty"`
	Street     *Named `json:"street,omitempty"`
	StreetDist *int   `json:"street_distance_m,omitempty"`
	Text       string `json:"text"`
}

type Named struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// ErrNotFound — so'ralgan nuqta xizmat hududida topilmadi.
var ErrNotFound = errors.New("topilmadi")

// maxSearchLimit — chaqiruvchi so'ray oladigan eng katta natija soni.
//
// Chegarasiz `LIMIT` bilan bitta so'rov butun jadvalni xotiraga
// tortib serverni yiqitishi mumkin edi.
const maxSearchLimit = 25

// queryTimeout — har bir so'rov uchun eng uzun vaqt.
//
// Bazadagi `statement_timeout` (10s) dan QISQAROQ: Go tomoni birinchi
// bo'lib uziladi va foydalanuvchi tushunarli xato oladi, baza esa
// zaxira to'siq bo'lib qoladi.
const queryTimeout = 3 * time.Second

// Search — ko'cha va mahallalarni nom bo'yicha qidiradi.
//
// `q` bu yerga XOM ko'rinishda keladi va SQL ichida `ondex_normalize()`
// orqali normallashtiriladi — ya'ni indeksdagi qiymat bilan AYNAN bir
// xil funksiya ishlaydi. Normalizatsiyani Go tomonida takrorlash
// ikkita mustaqil amalga oshiruv degani bo'lardi va ular vaqt o'tib
// bir-biridan uzoqlashardi.
//
// Barcha qiymatlar parametr sifatida uzatiladi ($1, $2) — SQL satriga
// hech narsa yopishtirilmaydi.
func (p *Pool) Search(ctx context.Context, q string, limit int) ([]Match, error) {
	if limit <= 0 || limit > maxSearchLimit {
		limit = maxSearchLimit
	}
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	const sql = `
WITH needle AS (SELECT ondex_normalize($1) AS n)
SELECT id, type, name, kind, score, matched_via FROM (
    SELECT s.id, 'street' AS type, s.name, s.kind,
           similarity(s.name_norm, needle.n) AS score,
           NULL::text AS matched_via
    FROM streets s, needle
    WHERE s.name_norm %> needle.n

    UNION ALL

    -- Alias orqali topilganlar: xalq nomi, eski nom, kirill yozuvi.
    SELECT s.id, 'street', s.name, s.kind,
           similarity(a.alias_norm, needle.n) * 0.95,  -- rasmiy nomdan bir oz past
           a.alias
    FROM street_aliases a
    JOIN streets s ON s.id = a.street_id, needle
    WHERE a.alias_norm %> needle.n

    UNION ALL

    SELECT m.id, 'mahalla', m.name, NULL,
           similarity(m.name_norm, needle.n),
           NULL
    FROM mahallas m, needle
    WHERE m.name_norm %> needle.n
) r
ORDER BY score DESC, name ASC
LIMIT $2;`

	rows, err := p.Query(ctx, sql, q, limit)
	if err != nil {
		return nil, errQuery
	}
	defer rows.Close()

	out := make([]Match, 0, limit)
	for rows.Next() {
		var m Match
		var kind, via *string
		if err := rows.Scan(&m.ID, &m.Type, &m.Name, &kind, &m.Score, &via); err != nil {
			return nil, errQuery
		}
		if kind != nil {
			m.Kind = *kind
		}
		if via != nil {
			m.MatchedVia = *via
		}
		out = append(out, m)
	}
	if rows.Err() != nil {
		return nil, errQuery
	}
	return out, nil
}

// Resolve — koordinatani mahalla va eng yaqin ko'chaga bog'laydi.
func (p *Pool) Resolve(ctx context.Context, lat, lng float64) (*Place, error) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	var place Place

	// ── Mahalla ──────────────────────────────────────────────────────
	// Avval chegara ichida qidiriladi (aniq javob). Chegara hali
	// chizilmagan bo'lsa — eng yaqin markaz bo'yicha, lekin FAQAT
	// 3 km ichida: undan uzoqdagi javob yolg'on aniqlik berardi.
	const mahallaSQL = `
SELECT id, name FROM mahallas
WHERE geom IS NOT NULL AND ST_Covers(geom, ST_Point($1, $2)::geography)
LIMIT 1`
	var m Named
	err := p.QueryRow(ctx, mahallaSQL, lng, lat).Scan(&m.ID, &m.Name)
	if err == nil {
		place.Mahalla = &m
	} else {
		const nearestSQL = `
SELECT id, name FROM mahallas
WHERE ST_DWithin(center, ST_Point($1, $2)::geography, 3000)
ORDER BY center <-> ST_Point($1, $2)::geography
LIMIT 1`
		if err := p.QueryRow(ctx, nearestSQL, lng, lat).Scan(&m.ID, &m.Name); err == nil {
			place.Mahalla = &m
		}
	}

	// ── Eng yaqin ko'cha (200 m ichida) ──────────────────────────────
	const streetSQL = `
SELECT id, name, ROUND(ST_Distance(geom, ST_Point($1, $2)::geography))::int
FROM streets
WHERE geom IS NOT NULL
  AND ST_DWithin(geom, ST_Point($1, $2)::geography, 200)
ORDER BY geom <-> ST_Point($1, $2)::geography
LIMIT 1`
	var s Named
	var dist int
	if err := p.QueryRow(ctx, streetSQL, lng, lat).Scan(&s.ID, &s.Name, &dist); err == nil {
		place.Street = &s
		place.StreetDist = &dist
	}

	if place.Mahalla == nil && place.Street == nil {
		return nil, ErrNotFound
	}
	place.Text = formatAddress(place)
	return &place, nil
}

// formatAddress — "Mahalla, Ko'cha" ko'rinishidagi matn.
func formatAddress(p Place) string {
	switch {
	case p.Mahalla != nil && p.Street != nil:
		return p.Mahalla.Name + ", " + p.Street.Name
	case p.Street != nil:
		return p.Street.Name
	case p.Mahalla != nil:
		return p.Mahalla.Name
	}
	return ""
}

// maxMahallas — GeoJSON javobidagi eng ko'p obyekt.
//
// Chust'da mahallalar soni o'nlab, shuning uchun 500 juda keng
// zaxira. Chegara MAJBURIY: bu endpoint kalitsiz ochiq va poligon
// geometriyasi og'ir — chegarasiz javob o'n megabaytga yetib,
// serverning xotirasi va kanalini yeb qo'yardi.
const maxMahallas = 500

// MahallasGeoJSON — xarita qatlami uchun mahalla poligonlari.
//
// GeoJSON BAZADA yig'iladi (`ST_AsGeoJSON`): geometriyani Go tomonida
// qayta qurish ortiqcha nusxa va xato manbai bo'lardi.
//
// Chegarasi hali chizilmagan mahallalar (`geom IS NULL`) tushmaydi —
// ular xaritada chizilmaydi, lekin qidiruvda topiladi.
func (p *Pool) MahallasGeoJSON(ctx context.Context) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	const sql = `
SELECT COALESCE(jsonb_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(jsonb_agg(f.feature), '[]'::jsonb)
), '{}'::jsonb)::text
FROM (
    SELECT jsonb_build_object(
        'type', 'Feature',
        'geometry', ST_AsGeoJSON(geom)::jsonb,
        -- DIQQAT: source ustuni ATAYLAB chiqarilmaydi. U ichki maydon
        -- (provenans/litsenziya uchun) va ommaviy endpointda
        -- oshkor qilinmaydi.
        'properties', jsonb_build_object('id', id, 'name', name)
    ) AS feature
    FROM mahallas
    WHERE geom IS NOT NULL
    ORDER BY name
    LIMIT $1
) f;`

	var out []byte
	if err := p.QueryRow(ctx, sql, maxMahallas).Scan(&out); err != nil {
		return nil, errQuery
	}
	return out, nil
}

// errQuery — bazadan kelgan HAR QANDAY xato uchun yagona javob.
//
// pgx xatosi tashqariga uzatilmaydi: unda jadval nomi, ustun nomi va
// ba'zan so'rov matni bo'ladi — bular hujumchi uchun tayyor xarita.
// Haqiqiy xato server logiga chaqiruvchi tomonda yoziladi.
var errQuery = errors.New("bazaga so'rov bajarilmadi")
