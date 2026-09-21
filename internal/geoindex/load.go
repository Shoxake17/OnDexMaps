package geoindex

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"

	"ondexmap/internal/storage"
)

// Xizmat hududi (O'zbekiston): frontendning `UZ_BOUNDS` (web/src/lib/config.ts)
// va `routes_satellite.go` dagi `uzMin*/uzMax*` bilan BIR XIL.
//
// Nega kerak: PBF chegara yaqinida qo'shni davlat obyektlarini ham o'z
// ichiga olishi mumkin. Ular qidiruvda chiqib, bosilganda xarita
// `maxBounds` dan tashqariga uchishga urinardi.
const (
	minLng, minLat = 55.5, 37.0
	maxLng, maxLat = 73.5, 45.8
)

// Chiziqli obyektlarni birlashtirish masofasi (EPSG:3857 metrida; Toshkent
// kengligida haqiqiy masofa ~0.76 barobar). Bir nomli ko'chaning bo'laklari
// shu masofadan yaqin bo'lsa BITTA natija bo'ladi; uzoq bo'lsa (boshqa
// shaharda xuddi shu nomli ko'cha) alohida qoladi.
//
// Aholi punktlari va ma'muriy birliklar uchun ham shu usul: OSM'da bitta
// shahar ko'pincha ikki marta bor (`place=town` tuguni + chegara relyatsiyasi
// yoki ikki tugun) va ikkalasi qidiruvda alohida chiqardi. Masofa tur
// bo'yicha: tuman markazi bilan `place=county` tuguni orasi o'nlab km bo'lishi
// mumkin, qishloq esa bir necha yuz metr ichida.
var epsMeters = []any{
	2000.0,   // $1 ko'cha
	8000.0,   // $2 daryo/ariq
	150.0,    // $3 joy/bino: bir joyning tugun + maydon ko'rinishi
	6000.0,   // $4 shahar, shaharcha
	1500.0,   // $5 qishloq, mahalla, joy nomi
	40000.0,  // $6 tuman
	200000.0, // $7 viloyat
}

// Result — import hisoboti.
type Result struct {
	ByKind map[string]int
	Total  int
}

// Load — qatorlarni bazaga yuklaydi va `geo_names` ni BUTUNLAY almashtiradi.
//
// Hammasi BITTA tranzaksiyada: import o'rtasida yiqilsa eski indeks
// o'z holicha qoladi, qidiruv hech qachon yarim to'lgan jadvalni ko'rmaydi.
// `TRUNCATE` emas `DELETE` ishlatiladi: TRUNCATE jadvalni tranzaksiya
// tugaguncha BLOKLAB qo'yardi (qidiruv shu vaqt kutib turardi), DELETE esa
// MVCC tufayli o'quvchilarni to'xtatmaydi.
func Load(ctx context.Context, pool *storage.Pool, rows []Row) (Result, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return Result{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }() // Commit'dan keyin zararsiz

	// Bazada `statement_timeout` = 10 s — API so'rovlarini himoya qiladi
	// (0002 va pool sozlamasi). Import esa ATAYLAB og'ir (yuz minglab qatorda
	// DBSCAN va KNN) va bir necha o'n soniya oladi. `SET LOCAL` faqat SHU
	// tranzaksiyaga ta'sir qiladi: API va boshqa ulanishlar himoyasi o'zgarmaydi.
	if _, err := tx.Exec(ctx, `SET LOCAL statement_timeout = '20min'`); err != nil {
		return Result{}, fmt.Errorf("statement_timeout: %w", err)
	}

	if _, err := tx.Exec(ctx, sqlRawTable); err != nil {
		return Result{}, fmt.Errorf("vaqtinchalik jadval: %w", err)
	}

	cols := []string{"osm_type", "osm_id", "kind", "class", "subclass", "name", "alt",
		"lon", "lat", "has_bbox", "w", "s", "e", "n", "linear"}
	i := 0
	src := pgx.CopyFromFunc(func() ([]any, error) {
		if i >= len(rows) {
			return nil, nil
		}
		r := rows[i]
		i++
		return []any{r.OSMType, r.OSMID, r.Kind, r.Class, r.Subclass, r.Name, r.Alt,
			r.Lon, r.Lat, r.HasBBox, r.W, r.S, r.E, r.N, r.Linear}, nil
	})
	if _, err := tx.CopyFrom(ctx, pgx.Identifier{"geo_raw"}, cols, src); err != nil {
		return Result{}, fmt.Errorf("COPY: %w", err)
	}

	// Chegara qiymatlari SQL matniga emas, PARAMETR sifatida beriladi.
	// ⚠️ pgx parametrli so'rovda BIR buyruqqa ruxsat beradi — shuning uchun
	// parametrli qadamlar alohida, parametrsizlari esa bir nechta buyruq bo'lishi mumkin.
	steps := []struct {
		name string
		sql  string
		args []any
	}{
		{"tozalash", sqlPrepare, []any{minLng, minLat, maxLng, maxLat}},
		{"tozalash (indeks)", sqlPrepareIndex, nil},
		{"guruhlash", sqlCluster, epsMeters},
		{"birlashtirish", sqlUnify, nil},
		{"yaqin joylar", sqlNearTables, nil},
		{"almashtirish", sqlReplace, nil},
	}
	for _, s := range steps {
		if _, err := tx.Exec(ctx, s.sql, s.args...); err != nil {
			return Result{}, fmt.Errorf("%s: %w", s.name, err)
		}
	}

	res := Result{ByKind: map[string]int{}}
	rs, err := tx.Query(ctx, `SELECT kind, count(*) FROM geo_names GROUP BY kind`)
	if err != nil {
		return Result{}, err
	}
	for rs.Next() {
		var k string
		var n int
		if err := rs.Scan(&k, &n); err != nil {
			rs.Close()
			return Result{}, err
		}
		res.ByKind[k] = n
		res.Total += n
	}
	rs.Close()
	if err := rs.Err(); err != nil {
		return Result{}, err
	}

	// Bo'sh natija — import buzilgan belgisi (masalan noto'g'ri fayl). Eski
	// indeksni o'chirib, qidiruvni BO'SH qoldirmaymiz.
	if res.Total == 0 {
		return Result{}, fmt.Errorf("import 0 ta qator berdi — eski indeks saqlandi")
	}

	if err := tx.Commit(ctx); err != nil {
		return Result{}, err
	}
	// Reja hisoblagichi yangi taqsimotni bilishi uchun (indeks tanlash).
	if _, err := pool.Exec(ctx, `ANALYZE geo_names`); err != nil {
		return res, fmt.Errorf("ANALYZE: %w", err)
	}
	return res, nil
}

// Xom qatorlar uchun vaqtinchalik jadval — tranzaksiya tugagach o'zi yo'qoladi.
const sqlRawTable = `
CREATE TEMP TABLE geo_raw (
    osm_type text, osm_id bigint, kind text, class text, subclass text,
    name text, alt text, lon float8, lat float8,
    has_bbox bool, w float8, s float8, e float8, n float8, linear bool
) ON COMMIT DROP`

// Tozalash: normalizatsiyasi bo'sh nom (faqat xitoy/arab belgilari kabi —
// `ondex_normalize` ularni butunlay o'chiradi, qidirib bo'lmaydi) va
// xizmat hududidan tashqaridagilar tashlanadi.
const sqlPrepare = `
CREATE TEMP TABLE r ON COMMIT DROP AS
SELECT osm_type, osm_id, kind, class, subclass, name, alt,
       ondex_normalize(name) AS nn,
       ST_SetSRID(ST_MakePoint(lon, lat), 4326) AS geom,
       CASE WHEN has_bbox THEN w END AS w, CASE WHEN has_bbox THEN s END AS s,
       CASE WHEN has_bbox THEN e END AS e, CASE WHEN has_bbox THEN n END AS n,
       linear
FROM geo_raw
WHERE lon BETWEEN $1 AND $3 AND lat BETWEEN $2 AND $4
  AND ondex_normalize(name) <> ''`

const sqlPrepareIndex = `
CREATE INDEX ON r USING GIST (geom);
ANALYZE r;`

// Birlashtirish.
//
//  1. Ko'cha/daryo — bir nomning ko'p bo'lagi (DBSCAN, nom+tur bo'yicha).
//  2. Joy/bino — bir joyning tugun va maydon ko'rinishi (150 m ichida).
//  3. Aholi punkti/tuman/viloyat — bir joyning ikki yozuvi (tugun + chegara
//     relyatsiyasi yoki ikki tugun), masofa tur bo'yicha (`epsMeters`).
//  4. Manzil (uy raqami) — birlashtirilmaydi, o'z holicha.
//
// Guruh faqat SHU NOM va SHU TUR ichida: turli nomlar hech qachon qo'shilmaydi.
// Markaz — guruh markaziga ENG YAQIN haqiqiy nuqta (o'rtacha nuqta egri
// ko'chada ko'chadan tashqariga tushardi).
const sqlCluster = `
CREATE TEMP TABLE c ON COMMIT DROP AS
SELECT r.*,
       ST_ClusterDBSCAN(ST_Transform(geom, 3857),
           CASE kind
             WHEN 'street'   THEN $1::float8
             WHEN 'water'    THEN $2::float8
             WHEN 'city'     THEN $4::float8
             WHEN 'town'     THEN $4::float8
             WHEN 'village'  THEN $5::float8
             WHEN 'hamlet'   THEN $5::float8
             WHEN 'suburb'   THEN $5::float8
             WHEN 'locality' THEN $5::float8
             WHEN 'district' THEN $6::float8
             WHEN 'region'   THEN $7::float8
             ELSE $3::float8            -- poi, building
           END,
           1) OVER (PARTITION BY nn, kind) AS cid
FROM r
WHERE kind <> 'address'`

const sqlUnify = `
CREATE TEMP TABLE u ON COMMIT DROP AS
SELECT (array_agg(osm_type ORDER BY osm_id))[1] AS osm_type,
       min(osm_id) AS osm_id, kind,
       mode() WITHIN GROUP (ORDER BY class)    AS class,
       mode() WITHIN GROUP (ORDER BY subclass) AS subclass,
       mode() WITHIN GROUP (ORDER BY name)     AS name,
       left(coalesce(string_agg(DISTINCT alt, '; ') FILTER (WHERE alt <> ''), ''), 500) AS alt,
       ST_ClosestPoint(ST_Collect(geom), ST_Centroid(ST_Collect(geom))) AS geom,
       min(w) AS w, min(s) AS s, max(e) AS e, max(n) AS n
FROM c
GROUP BY nn, kind, cid

UNION ALL

-- Manzillar (uy raqami) birlashtirilmaydi: har biri o'z joyida.
SELECT osm_type, osm_id, kind, class, subclass, name, alt, geom, w, s, e, n
FROM r
WHERE kind = 'address';

CREATE INDEX ON u USING GIST (geom);`

// Yaqin aholi punktlari (KNN uchun): "Ko'cha · Serob" izohi.
const sqlNearTables = `
CREATE TEMP TABLE np ON COMMIT DROP AS
SELECT name, geom FROM u WHERE kind IN ('city', 'town', 'village', 'suburb', 'hamlet')
  AND name !~ '[А-Яа-яЁёЎўҚқҒғҲҳ]';
CREATE INDEX ON np USING GIST (geom);
CREATE TEMP TABLE nbig ON COMMIT DROP AS
SELECT name, geom FROM u WHERE kind IN ('city', 'town')
  AND name !~ '[А-Яа-яЁёЎўҚқҒғҲҳ]';
CREATE INDEX ON nbig USING GIST (geom);
ANALYZE np; ANALYZE nbig;`

// Almashtirish: eski indeks o'chiriladi, yangisi yoziladi (BITTA tranzaksiya).
//
// `rank` — tur muhimligi: «Toshkent» so'rovida shahar viloyat, ko'cha va
// do'kondan oldin chiqishi uchun.
const sqlReplace = `
DELETE FROM geo_names;
INSERT INTO geo_names (osm_type, osm_id, kind, class, subclass, name, alt, alt_norm, geom,
                       west, south, east, north, near, rank)
SELECT u.osm_type, u.osm_id, u.kind, coalesce(u.class, ''), coalesce(u.subclass, ''),
       u.name, coalesce(u.alt, ''),
       -- Har bir yozilish ALOHIDA normallashadi (masalan |tashkent|), qidiruv shu
       -- bilan «Tashkent» yozilganini nomning O'ZIGA aniq mos deb biladi.
       '|' || coalesce((SELECT string_agg(DISTINCT ondex_normalize(a), '|')
                         FROM unnest(string_to_array(u.alt, '; ')) a
                         WHERE ondex_normalize(a) <> ''), '') || '|',
       u.geom, u.w, u.s, u.e, u.n,
       CASE
         WHEN u.kind IN ('city', 'town', 'region', 'district') THEN NULL
         WHEN u.kind IN ('village', 'hamlet', 'suburb', 'locality') THEN
              (SELECT b.name FROM nbig b WHERE b.name <> u.name ORDER BY b.geom <-> u.geom LIMIT 1)
         ELSE (SELECT a.name FROM np a ORDER BY a.geom <-> u.geom LIMIT 1)
       END,
       CASE u.kind
         WHEN 'city' THEN 100 WHEN 'town' THEN 90 WHEN 'region' THEN 88
         WHEN 'district' THEN 80 WHEN 'village' THEN 70 WHEN 'suburb' THEN 62
         WHEN 'hamlet' THEN 55 WHEN 'locality' THEN 50 WHEN 'street' THEN 45
         WHEN 'water' THEN 40 WHEN 'poi' THEN 30 WHEN 'building' THEN 22
         ELSE 12 END
FROM u;`
