-- ═══════════════════════════════════════════════════════════════════════
-- GEO_NAMES — barcha nomli obyektlar uchun QIDIRUV indeksi
--
-- Muammo: xarita nomlarni faqat CHIZARDI (PMTiles ichida), bazada esa faqat
-- `mahallas` va (bo'sh) `streets` bor edi. Shu sababli qidiruv faqat
-- mahallalarni topardi — shahar, ko'cha, joy va binolar umuman yo'q edi.
--
-- Bu jadval xaritani yasagan OSM faylidan `cmd/osmimport` bilan to'ldiriladi.
-- U `mahallas`/`streets` ni ALMASHTIRMAYDI: ular jamoa kiritadigan, chegarasi
-- bor, haqiqat manbai bo'lgan ma'lumot; `geo_names` esa OSM'dan olingan,
-- qayta import qilinadigan (butunlay almashtiriladigan) indeks.
--
-- Tamoyillar (0001 bilan bir xil):
--   1. Normalizatsiya GENERATSIYA qilinadi (`ondex_normalize`): import kodi
--      uni noto'g'ri hisoblay olmaydi; kirill/lotin/apostrof bir kalitga tushadi.
--   2. CHECK cheklovlari — noto'g'ri tur bazaga kirmaydi.
--   3. Provenans — `source`.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE geo_names (
    id        BIGSERIAL PRIMARY KEY,

    -- OSM elementi (chiziqli obyektlar uchun — birlashtirilgan guruhning
    -- eng kichik `osm_id`si). Qayta importda `id` o'zgaradi, `osm_*` esa yo'q.
    osm_type  CHAR(1) NOT NULL CHECK (osm_type IN ('n', 'w', 'r')),
    osm_id    BIGINT  NOT NULL,

    -- Tur — interfeysdagi belgi, zoom va tartiblash shunga bog'liq.
    -- Ro'yxat `internal/geoindex/classify.go` dagi Kind* bilan BIR XIL.
    kind      TEXT NOT NULL CHECK (kind IN (
                  'region', 'district', 'city', 'town', 'village', 'hamlet',
                  'suburb', 'locality', 'street', 'water', 'poi', 'building',
                  'address')),
    -- OSM tegi (masalan amenity / school) — «Maktab» kabi yorliq uchun.
    class     TEXT NOT NULL DEFAULT '',
    subclass  TEXT NOT NULL DEFAULT '',

    name      TEXT NOT NULL CHECK (btrim(name) <> ''),
    -- Boshqa yozilishlar (kirill, rus, ingliz, eski nom) — faqat QIDIRUV uchun.
    alt       TEXT NOT NULL DEFAULT '',

    name_norm TEXT GENERATED ALWAYS AS (ondex_normalize(name)) STORED,
    -- Asosiy nom + barcha yozilishlar bitta kalitda: «Ташкент» ham, «Tashkent»
    -- ham, «Toshkent» ham shu qatordan topiladi.
    search    TEXT GENERATED ALWAYS AS (ondex_normalize(name || ' ' || alt)) STORED,

    geom      geometry(Point, 4326) NOT NULL,
    -- Chegara (ko'cha, bino, maydon): xarita shunga mos zoomga uchadi.
    west      DOUBLE PRECISION,
    south     DOUBLE PRECISION,
    east      DOUBLE PRECISION,
    north     DOUBLE PRECISION,

    -- Eng yaqin aholi punkti: «Ko'cha · Serob» ko'rinishidagi izoh uchun.
    near      TEXT,
    -- Tur muhimligi (0–100): «Toshkent» so'rovida shahar viloyat/ko'chadan oldin.
    rank      SMALLINT NOT NULL CHECK (rank BETWEEN 0 AND 100),

    source    TEXT NOT NULL DEFAULT 'osm' CHECK (source IN ('osm')),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Matn qidiruvi: `LIKE '%…%'` va `%>` (so'z o'xshashligi) ikkalasini ham shu
-- trigram indeksi tezlashtiradi.
CREATE INDEX geo_names_search_trgm ON geo_names USING GIN (search gin_trgm_ops);
-- Qisqa (1–2 harfli) so'rov trigramga yaramaydi — prefiks qidiruvi uchun.
CREATE INDEX geo_names_norm_prefix ON geo_names (name_norm text_pattern_ops);
CREATE INDEX geo_names_geom_gix    ON geo_names USING GIST (geom);
CREATE INDEX geo_names_kind_idx    ON geo_names (kind);

COMMENT ON TABLE geo_names IS
  'OSM dan olingan nomli obyektlar qidiruv indeksi. `cmd/osmimport` butunlay almashtiradi; qo''lda tahrirlanmaydi.';

-- API FAQAT o'qiydi (0002 dagi default privileges ham beradi — bu yerda aniq).
GRANT SELECT ON geo_names TO ondexmap_app;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON geo_names FROM ondexmap_app;

INSERT INTO schema_migrations (version) VALUES ('0005_geo_names')
    ON CONFLICT (version) DO NOTHING;

COMMIT;
