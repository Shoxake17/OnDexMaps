// GeoJSON import vositasi — QGIS'dan eksport qilingan faylni
// PostGIS'ga yuklaydi.
//
// XAVFSIZLIK: bu vosita ham BAZA EGASI huquqi bilan ishlaydi va
// ATAYLAB alohida binar. HTTP serveri ma'lumot yoza olmaydi — yozish
// faqat shu vosita orqali, sizning mashinangizdan.
//
// IDEMPOTENT: har bir obyekt `ext_key` bo'yicha aniqlanadi. Bir xil
// faylni ikki marta import qilish dublikat YARATMAYDI, mavjud
// yozuvni yangilaydi. Bu muhim — QGIS'da tuzatish kiritib qayta
// eksport qilish odatiy ish oqimi.
//
// Ishga tushirish:
//
//	go run ./cmd/geoimport -kind=mahalla -file=data/mahallas.geojson -dry-run
//	go run ./cmd/geoimport -kind=street  -file=data/streets.geojson
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"slices"
	"strings"
	"time"

	"ondexmap/internal/config"
	"ondexmap/internal/storage"
)

const (
	// maxFileSize — 64 MB. Chust miqyosida ko'chalar fayli bir necha
	// MB dan oshmaydi; chegara tasodifan noto'g'ri fayl (masalan
	// butun mamlakat ekstrakti) berilganda xotirani himoya qiladi.
	maxFileSize = 64 << 20
	// maxFeatures — bitta importdagi eng ko'p obyekt.
	maxFeatures = 100_000
)

// allowedSources — `source` uchun ruxsat etilgan qiymatlar.
//
// Bazada ham CHECK bor, lekin bu yerda ham tekshiriladi: xato butun
// tranzaksiya yiqilgandan keyin emas, ANIQ qaysi obyektda ekani
// ko'rsatilib xabar qilinadi.
var allowedSources = []string{"official", "survey", "osm", "community"}

var allowedStreetKinds = []string{"kocha", "tor_kocha", "xiyobon", "shox_kocha", "maydon"}

type featureCollection struct {
	Type     string    `json:"type"`
	Features []feature `json:"features"`
}

type feature struct {
	Geometry json.RawMessage `json:"geometry"`
	Props    struct {
		ExtKey string `json:"ext_key"`
		Name   string `json:"name"`
		Kind   string `json:"kind"`
		Source string `json:"source"`
	} `json:"properties"`
}

func main() {
	kind := flag.String("kind", "", "mahalla | street")
	file := flag.String("file", "", "GeoJSON fayl yo'li")
	dryRun := flag.Bool("dry-run", false, "tekshirish, bazaga yozmaslik")
	flag.Parse()

	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, nil)))

	if *file == "" || (*kind != "mahalla" && *kind != "street") {
		slog.Error("foydalanish: -kind=mahalla|street -file=...geojson [-dry-run]")
		os.Exit(1)
	}

	features, err := readFeatures(*file)
	if err != nil {
		slog.Error("faylni o'qib bo'lmadi", "err", err)
		os.Exit(1)
	}

	// ── Bazaga borishdan OLDIN to'liq tekshirish ─────────────────────
	// Yarim import qilingan fayl eng yomon holat: qaysi obyekt
	// o'tgan-o'tmaganini keyin aniqlash qiyin. Shuning uchun avval
	// hammasi tekshiriladi, keyin bittada yoziladi.
	var problems []string
	seen := map[string]bool{}
	for i, f := range features {
		if err := validate(f, *kind); err != nil {
			problems = append(problems, fmt.Sprintf("  #%d (%s): %v", i+1, f.Props.Name, err))
			continue
		}
		if seen[f.Props.ExtKey] {
			problems = append(problems, fmt.Sprintf("  #%d: ext_key takrorlangan: %q", i+1, f.Props.ExtKey))
		}
		seen[f.Props.ExtKey] = true
	}
	if len(problems) > 0 {
		slog.Error(fmt.Sprintf("%d ta obyektda muammo — HECH NARSA import qilinmadi:\n%s",
			len(problems), strings.Join(problems, "\n")))
		os.Exit(1)
	}
	slog.Info("tekshiruv o'tdi", "obyektlar", len(features), "tur", *kind)

	if *dryRun {
		slog.Info("dry-run: bazaga yozilmadi")
		return
	}

	cfg, err := config.Load(".env")
	if err != nil {
		slog.Error("sozlama xatosi", "err", err)
		os.Exit(1)
	}
	if cfg.DatabaseURLMigrate == "" {
		slog.Error("DATABASE_URL_MIGRATE yo'q — import baza egasi huquqini talab qiladi")
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	pool, err := storage.ReadWrite(ctx, cfg.DatabaseURLMigrate)
	if err != nil {
		slog.Error("bazaga ulanib bo'lmadi", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	inserted, rejected, err := importAll(ctx, pool, features, *kind)
	if err != nil {
		slog.Error("import muvaffaqiyatsiz — hech narsa saqlanmadi", "err", err)
		os.Exit(1)
	}

	slog.Info("import yakunlandi", "saqlandi", inserted, "rad_etildi", rejected)
	if rejected > 0 {
		// Rad etilganlar — xizmat hududidan tashqaridagilar. Bu xato
		// emas, lekin jimgina o'tib ketmasligi kerak.
		slog.Warn("rad etilganlar xizmat hududidan (Chust atrofi) tashqarida edi")
	}
}

func readFeatures(path string) ([]feature, error) {
	st, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	if st.Size() > maxFileSize {
		return nil, fmt.Errorf("fayl juda katta (%d MB, chegara %d MB)", st.Size()>>20, maxFileSize>>20)
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	// UTF-8 BOM ni olib tashlaymiz.
	//
	// Windows vositalari (QGIS eksporti, PowerShell `Out-File -Encoding
	// utf8`, Bloknot) fayl boshiga EF BB BF qo'shadi. `json.Unmarshal`
	// buni "noto'g'ri belgi" deb rad etadi va xato xabari BOM haqida
	// hech narsa aytmaydi — natijada mukammal ko'rinadigan fayl
	// tushunarsiz sababga ko'ra o'qilmaydi.
	raw = bytes.TrimPrefix(raw, []byte{0xEF, 0xBB, 0xBF})

	var fc featureCollection
	if err := json.Unmarshal(raw, &fc); err != nil {
		return nil, errors.New("GeoJSON o'qib bo'lmadi (FeatureCollection kutilgan)")
	}
	if fc.Type != "FeatureCollection" {
		return nil, fmt.Errorf("type=%q, FeatureCollection kutilgan", fc.Type)
	}
	if len(fc.Features) == 0 {
		return nil, errors.New("faylda obyekt yo'q")
	}
	if len(fc.Features) > maxFeatures {
		return nil, fmt.Errorf("obyektlar juda ko'p (%d, chegara %d)", len(fc.Features), maxFeatures)
	}
	return fc.Features, nil
}

func validate(f feature, kind string) error {
	if strings.TrimSpace(f.Props.Name) == "" {
		return errors.New("`name` bo'sh")
	}
	if strings.TrimSpace(f.Props.ExtKey) == "" {
		return errors.New("`ext_key` bo'sh — usiz qayta import dublikat yaratadi")
	}
	if !slices.Contains(allowedSources, f.Props.Source) {
		return fmt.Errorf("`source` = %q, ruxsat etilganlar: %s",
			f.Props.Source, strings.Join(allowedSources, ", "))
	}
	if kind == "street" && f.Props.Kind != "" && !slices.Contains(allowedStreetKinds, f.Props.Kind) {
		return fmt.Errorf("`kind` = %q noto'g'ri", f.Props.Kind)
	}
	if len(f.Geometry) == 0 || string(f.Geometry) == "null" {
		return errors.New("geometriya yo'q")
	}
	return nil
}

// importAll — hammasi BITTA tranzaksiyada.
//
// Xato bo'lsa hech narsa saqlanmaydi: yarim import qilingan holatdan
// ko'ra umuman import qilinmagan holat ancha yaxshi — birinchisida
// nima o'tgani noma'lum bo'lib qoladi.
func importAll(ctx context.Context, pool *storage.Pool, features []feature, kind string) (int, int, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback(ctx) //nolint // Commit muvaffaqiyatli bo'lsa bu no-op

	sql := mahallaUpsert
	if kind == "street" {
		sql = streetUpsert
	}

	var inserted, rejected int
	for _, f := range features {
		tag, err := tx.Exec(ctx, sql,
			f.Props.ExtKey, f.Props.Name, string(f.Geometry), f.Props.Source, f.Props.Kind)
		if err != nil {
			return 0, 0, fmt.Errorf("obyekt %q: %w", f.Props.Name, err)
		}
		if tag.RowsAffected() == 0 {
			rejected++
		} else {
			inserted++
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, 0, err
	}
	return inserted, rejected, nil
}

// ── SQL ──────────────────────────────────────────────────────────────
//
// Hamma qiymat PARAMETR sifatida uzatiladi. Geometriya ham: xom
// GeoJSON matni $3 orqali `ST_GeomFromGeoJSON` ga beriladi, SQL
// satriga yopishtirilmaydi.
//
// `ST_Within(...)` sharti — MA'LUMOT ZAHARLANISHIDAN himoya: xizmat
// hududidan (Chust atrofi) tashqaridagi geometriya bazaga UMUMAN
// kirmaydi. Noto'g'ri fayl yoki noto'g'ri koordinata tizimi (masalan
// metrlarda berilgan geometriya) shu yerda to'xtaydi.

const serviceBBox = `ST_MakeEnvelope(70.5, 40.5, 72.0, 41.6, 4326)`

const mahallaUpsert = `
WITH g AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($3), 4326) AS geom)
INSERT INTO mahallas (ext_key, name, center, geom, source)
SELECT $1, $2,
       ST_Centroid(g.geom)::geography,
       CASE WHEN ST_GeometryType(g.geom) IN ('ST_Polygon','ST_MultiPolygon')
            THEN ST_Multi(g.geom)::geography END,
       $4
FROM g
WHERE ST_Within(g.geom, ` + serviceBBox + `)
  AND ($5 = $5)  -- kind mahallada ishlatilmaydi, parametr soni bir xil bo'lsin
ON CONFLICT (ext_key) DO UPDATE
SET name = EXCLUDED.name, center = EXCLUDED.center,
    geom = EXCLUDED.geom, source = EXCLUDED.source`

const streetUpsert = `
WITH g AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($3), 4326) AS geom)
INSERT INTO streets (ext_key, name, geom, source, kind)
SELECT $1, $2,
       CASE WHEN ST_GeometryType(g.geom) IN ('ST_LineString','ST_MultiLineString')
            THEN ST_Multi(g.geom)::geography END,
       $4,
       COALESCE(NULLIF($5, ''), 'kocha')
FROM g
WHERE ST_Within(g.geom, ` + serviceBBox + `)
ON CONFLICT (ext_key) DO UPDATE
SET name = EXCLUDED.name, geom = EXCLUDED.geom,
    source = EXCLUDED.source, kind = EXCLUDED.kind`
