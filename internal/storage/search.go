package storage

import (
	"context"
	"fmt"
	"log/slog"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
)

// Point — qidiruv natijalarini yaqinlik bo'yicha tartiblash uchun (xarita markazi).
type Point struct{ Lat, Lng float64 }

// Search — barcha nomli obyektlarni qidiradi: shahar, qishloq, mahalla,
// ko'cha, joy, bino va uy manzili.
//
// Ikki manbadan birlashtiradi:
//   - `geo_names` — OSM'dan olingan hamma nomlar (`cmd/osmimport`);
//   - `mahallas` / `streets` — jamoa kiritgan, chegarali, ishonchli ma'lumot
//     (alias — xalq nomlari bilan). Ular ustun turadi (`legacyBonus`).
//
// `q` XOM ko'rinishda keladi va SQL ichida `ondex_normalize()` orqali
// normallashadi — indeksdagi qiymat bilan AYNAN bir xil funksiya. Kirill,
// lotin va apostrof variantlari shu tufayli bir kalitga tushadi.
//
// `bias` (ixtiyoriy) — xarita markazi: teng natijalardan yaqini oldinda
// turadi («Navoiy ko'chasi» deganda foydalanuvchi turgan shahardagisi).
func (p *Pool) Search(ctx context.Context, q string, limit int, bias *Point) ([]Match, error) {
	if limit <= 0 || limit > maxSearchLimit {
		limit = maxSearchLimit
	}
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	var norm string
	if err := p.QueryRow(ctx, `SELECT ondex_normalize($1)`, q).Scan(&norm); err != nil {
		return nil, errQuery
	}
	toks := strings.Fields(norm)
	if len(toks) == 0 {
		return []Match{}, nil // faqat tinish belgilari yoki qo'llab-quvvatlanmaydigan yozuv
	}
	if len(toks) > maxTokens {
		toks = toks[:maxTokens] // qolgani ahamiyatsiz: aniqlik so'zlar ko'payishi bilan oshmaydi
	}

	geo, geoErr := searchGeo(ctx, p, norm, toks, limit, bias)
	legacy, legacyErr := p.searchLegacy(ctx, q, limit)

	// Bir manba yiqilsa ikkinchisi baribir natija beradi: qidiruv butunlay
	// "o'chib" qolmasligi kerak. Lekin xato jimgina yutilmaydi — logga yoziladi.
	if geoErr != nil {
		slog.Error("geo_names qidiruvi xatosi", "err", geoErr)
	}
	if legacyErr != nil {
		slog.Error("mahalla/ko'cha qidiruvi xatosi", "err", legacyErr)
	}
	if geoErr != nil && legacyErr != nil {
		return nil, errQuery
	}

	// Aniq natija kam bo'lsa — imlo xatosi bo'lishi mumkin («toshknet»): shunda
	// o'xshashlik chegarasi pasaytirilib qayta qidiriladi. Oddiy so'rovlarda bu
	// bajarilmaydi (u sekinroq: indeks bilan ishlaydigan qat'iy qidiruv yetarli).
	if geoErr == nil && needsFuzzy(geo, legacy) {
		if extra, err := p.searchGeoFuzzy(ctx, norm, toks, limit, bias); err != nil {
			slog.Warn("noaniq qidiruv xatosi", "err", err)
		} else {
			geo = mergeMatches(geo, extra)
		}
	}

	// Foydalanuvchi qo'shgan va admin tasdiqlagan ob'ektlar (`places`). Jadval
	// hali yo'q bo'lgan bazada (0007 qo'llanmagan) bu xato beradi — qidiruv
	// o'chib qolmasin, xato faqat logga yoziladi.
	community, placesErr := p.searchPlaces(ctx, norm, toks, limit)
	if placesErr != nil {
		slog.Warn("ob'ektlar qidiruvi xatosi", "err", placesErr)
	}

	out := append(legacy, geo...)
	out = append(out, community...)
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Score != out[j].Score {
			return out[i].Score > out[j].Score
		}
		return out[i].Name < out[j].Name
	})
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

const (
	// maxTokens — so'rovdagi eng ko'p so'z. Har biri SQL'da alohida shart bo'ladi.
	maxTokens = 6
	// fuzzyBelow — shundan kam natija bo'lsa imlo xatosi uchun qayta qidiriladi.
	fuzzyBelow = 3
	// goodScore — shu balldan yuqori natija "yaxshi mos" hisoblanadi (nom
	// so'rov bilan boshlanadi yoki so'zlari butun kiradi). Eng yaxshisi shundan
	// past bo'lsa, natija soni qancha bo'lishidan qat'i nazar imlo xatosi
	// ehtimoli bor: «toshknet» uchun 3 ta zaif (o'xshash ko'chalar) natija
	// «yetarli» hisoblanib, haqiqiy «Toshkent» topilmay qolardi.
	goodScore = 70.0
	// fuzzyThreshold — noaniq qidiruvda so'z o'xshashligi chegarasi (standart 0.6:
	// «toshknet» → «toshkent» uchun yetarli emas).
	fuzzyThreshold = "0.42"
)

// Jamoa kiritgan mahalla/ko'cha OSM'dagi bir xil nomdan ustun turadi: u
// tekshirilgan, chegarasi bor va alias bilan boyitilgan. Bonus shuncha: aniq
// mos kelgan mahalla (70+30+bonus = 125) OSM dagi shahar/qishloqdan (95 + rank
// hissasi ≤ 30) oldinda yoki teng bo'lishi uchun.
const legacyBonus = 25.0

// needsFuzzy — noaniq (imlo xatosiga bardoshli) qidiruv kerakmi.
func needsFuzzy(geo, legacy []Match) bool {
	if len(geo)+len(legacy) < fuzzyBelow {
		return true
	}
	best := 0.0
	for _, m := range geo {
		best = max(best, m.Score)
	}
	for _, m := range legacy {
		best = max(best, m.Score)
	}
	return best < goodScore
}

// genericWords — nomlarning yuz minglablarida uchraydigan so'zlar. Ular YAKKA
// so'rov bo'lsa trigram indeksi foydasiz (deyarli butun jadval mos keladi va
// so'rov ~1 s oladi), shuning uchun faqat nom BOSHIGA qarab qidiriladi.
// Boshqa so'z bilan birga kelsa («Amir Temur ko'chasi») muammo yo'q — o'sha
// boshqa so'z indeksni toraytiradi.
var genericWords = map[string]bool{
	"kocha": true, "kochasi": true, "mahalla": true, "mahallasi": true,
	"maxalla": true, "street": true, "ulitsa": true, "tumani": true,
	"shahri": true, "viloyati": true, "massivi": true, "mavzesi": true,
	"prospekti": true, "tor": true, "yoli": true, "road": true,
}

// querier — `*Pool` va tranzaksiya uchun umumiy (noaniq qidiruv tranzaksiyada
// ishlaydi: `SET LOCAL` faqat shu so'rovga ta'sir qilsin).
type querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

// candShort — 1–2 harfli so'rov: trigram indeksi ishlamaydi (trigram uchun
// kamida 3 belgi kerak), shuning uchun faqat nom BOSHIGA qarab qidiriladi —
// btree indeksi (`geo_names_norm_prefix`) tez ishlaydi.
const candShort = `
SELECT g.id, g.kind, g.class, g.subclass, g.name, g.near, g.rank, g.geom,
       g.west, g.south, g.east, g.north, 80.0 AS ts
FROM geo_names g
WHERE g.name_norm LIKE $1 || '%'
  -- $2 bu shaklda ishlatilmaydi; PostgreSQL ishlatilmagan parametr tipini
  -- aniqlay olmaydi, shuning uchun uni shu yerda tipi bilan eslatamiz.
  AND $2::text[] IS NOT NULL
ORDER BY g.rank DESC, length(g.name)
LIMIT 200`

// candFull — to'liq qidiruv. `%s` — har bir so'z uchun alohida `LIKE` sharti.
//
// ┌─ NEGA HAR BIR SO'Z ALOHIDA SHART ──────────────────────────────────
// Ilgari faqat ENG UZUN so'z indeks "langari" bo'lardi. «Amir Temur ko'chasi»
// da bu «ko'chasi» — yuz minglab qatorga mos, indeks foydasiz va so'rov
// 800 ms olardi. Endi har so'z o'z sharti: PostgreSQL trigram indekslarini
// (`BitmapAnd`) birlashtirib, eng KAM uchraydigan so'zdan boshlaydi.
// └──────────────────────────────────────────────────────────────────
//
// Nomzod: barcha so'zlar matnda bor, yoki so'z o'xshashligi (`%>`, imlo xatosi).
//
// Matn balli (ts), yuqoridan pastga:
//
//	95  nom aynan so'rov
//	92  boshqa yozilish (ingliz, kirill, rus) aynan so'rov: «Tashkent», «Ташкент»
//	84  so'rovdagi hamma so'zlar nomda BUTUN so'z sifatida (tartibsiz)
//	80  nom so'rov bilan boshlanadi
//	78  oxirgi so'z hali yozilmoqda: qolganlari butun, oxirgisi so'z boshi
//	70  nom ichidagi so'z so'rov bilan boshlanadi
//	60  boshqa yozilish shunday
//	40  ichida
//	20+ o'xshashlik (imlo xatosi)
//
// «Oxirgi so'z prefiks» qoidasi yozish paytidagi qidiruv uchun: «navoiy 1»
// yozilganda «Navoiy ko'chasi 12» topilishi kerak, lekin «navoiy» so'zi
// yozib bo'lingan — u BUTUN so'z bo'lishi shart.
//
// Mahalla jadvalida bir xil nom yaqinda bo'lsa (5 km) OSM nusxasi tashlanadi:
// aks holda «Serob» ikki marta chiqardi.
const candFull = `
SELECT g.id, g.kind, g.class, g.subclass, g.name, g.near, g.rank, g.geom,
       g.west, g.south, g.east, g.north,
       (CASE
          WHEN g.name_norm = $1 THEN 95.0
          -- Boshqa yozilish NOMNING O'ZIGA teng: aks holda «Tashkent» nomli
          -- qishloq va kafe Toshkent shahridan oldin chiqardi.
          WHEN g.alt_norm LIKE '%%|' || $1 || '|%%' THEN 92.0
          WHEN NOT EXISTS (SELECT 1 FROM unnest($2::text[]) x
                           WHERE ' ' || g.name_norm || ' ' NOT LIKE '%% ' || x || ' %%') THEN 84.0
          WHEN g.name_norm LIKE $1 || '%%' THEN 80.0
          WHEN NOT EXISTS (SELECT 1 FROM unnest($2::text[]) WITH ORDINALITY t(x, i)
                           WHERE i < array_length($2::text[], 1)
                             AND ' ' || g.name_norm || ' ' NOT LIKE '%% ' || x || ' %%')
               AND ' ' || g.name_norm LIKE '%% ' || ($2::text[])[array_length($2::text[], 1)] || '%%' THEN 78.0
          WHEN g.name_norm LIKE '%% ' || $1 || '%%' THEN 70.0
          WHEN g.search LIKE $1 || '%%' OR g.search LIKE '%% ' || $1 || '%%' THEN 60.0
          WHEN g.search LIKE '%%' || $1 || '%%' THEN 40.0
          ELSE 20.0 + 20.0 * word_similarity($1, g.search)
        END) AS ts
FROM geo_names g
WHERE ((%s) OR g.search %%> $1)
  AND NOT (g.kind IN ('suburb', 'village', 'hamlet', 'locality') AND EXISTS (
        SELECT 1 FROM mahallas m
        WHERE m.name_norm = g.name_norm AND ST_DWithin(m.center, g.geom::geography, 5000)))
ORDER BY ts DESC, g.rank DESC
LIMIT 200`

// geoTail — nomzodlardan yakuniy ball va cheklov.
//
// Nomzodlar avval matn bali bo'yicha 200 taga qisqartiriladi, keyin masofa
// hisoblanadi: «ko'cha» kabi mashhur so'z yuz minglab qator qaytarsa ham
// masofani hammasi uchun hisoblab o'tirmaymiz.
const geoTail = `
SELECT id, kind, class, subclass, name, near,
       ST_Y(geom) AS lat, ST_X(geom) AS lng, west, south, east, north,
       ts + rank * 0.3 + CASE
            WHEN $4::float8 IS NULL OR $5::float8 IS NULL THEN 0.0
            ELSE 12.0 / (1.0 + ST_Distance(geom::geography,
                     ST_SetSRID(ST_MakePoint($5::float8, $4::float8), 4326)::geography) / 25000.0)
       END AS score
FROM cand
ORDER BY score DESC, name
LIMIT $3`

// buildGeoSQL — so'rov matni va parametrlar. Parametrlar tartibi:
// $1 normallashgan matn, $2 so'zlar, $3 limit, $4 kenglik, $5 uzunlik,
// $6.. har bir so'z (alohida `LIKE` sharti uchun).
//
// Foydalanuvchi matni SQL'ga YOPISHTIRILMAYDI: faqat `$n` o'rinbosarlari
// (soni so'zlar sonidan, ya'ni ≤ maxTokens) matnga qo'shiladi.
func buildGeoSQL(norm string, toks []string, limit int, bias *Point) (string, []any) {
	var lat, lng *float64
	if bias != nil {
		lat, lng = &bias.Lat, &bias.Lng
	}
	args := []any{norm, toks, limit, lat, lng}

	if utf8.RuneCountInString(norm) < 3 || (len(toks) == 1 && genericWords[toks[0]]) {
		return "WITH cand AS (" + candShort + ")" + geoTail, args
	}

	conds := make([]string, len(toks))
	for i, t := range toks {
		args = append(args, t)
		conds[i] = fmt.Sprintf("g.search LIKE '%%' || $%d || '%%'", len(args))
	}
	cand := fmt.Sprintf(candFull, strings.Join(conds, " AND "))
	return "WITH cand AS (" + cand + ")" + geoTail, args
}

func searchGeo(ctx context.Context, q querier, norm string, toks []string, limit int, bias *Point) ([]Match, error) {
	sql, args := buildGeoSQL(norm, toks, limit, bias)
	return scanGeo(ctx, q, sql, args, limit)
}

// searchGeoFuzzy — imlo xatosi uchun: so'z o'xshashligi chegarasi pasaytiriladi.
// `SET LOCAL` faqat shu tranzaksiyaga ta'sir qiladi.
func (p *Pool) searchGeoFuzzy(ctx context.Context, norm string, toks []string, limit int, bias *Point) ([]Match, error) {
	// Qisqa (1–2 harf) yoki umumiy yakka so'zda o'xshashlik ma'nosiz — faqat prefiks.
	if utf8.RuneCountInString(norm) < 3 || (len(toks) == 1 && genericWords[toks[0]]) {
		return nil, nil
	}
	tx, err := p.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, "SET LOCAL pg_trgm.word_similarity_threshold = "+fuzzyThreshold); err != nil {
		return nil, err
	}
	return searchGeo(ctx, tx, norm, toks, limit, bias)
}

func scanGeo(ctx context.Context, q querier, sql string, args []any, limit int) ([]Match, error) {
	rows, err := q.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Match, 0, limit)
	for rows.Next() {
		var (
			id                     int64
			kind, class, sub, name string
			near                   *string
			la, ln                 float64
			w, s, e, n             *float64
			score                  float64
		)
		if err := rows.Scan(&id, &kind, &class, &sub, &name, &near, &la, &ln, &w, &s, &e, &n, &score); err != nil {
			return nil, err
		}
		m := Match{
			ID: "g" + strconv.FormatInt(id, 10), Type: kind, Name: name, Score: score,
			Label: Label(kind, class, sub), Lat: &la, Lng: &ln,
		}
		if near != nil {
			m.Near = *near
		}
		if w != nil && s != nil && e != nil && n != nil {
			m.BBox = &[4]float64{*w, *s, *e, *n}
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// mergeMatches — `extra` dan `base` da ALLAQACHON bor natijalarni tashlab qo'shadi.
func mergeMatches(base, extra []Match) []Match {
	seen := make(map[string]bool, len(base))
	for _, m := range base {
		seen[m.ID] = true
	}
	for _, m := range extra {
		if !seen[m.ID] {
			base = append(base, m)
		}
	}
	return base
}
