-- ═══════════════════════════════════════════════════════════════════
-- OnDexMap — boshlang'ich sxema
--
-- Tamoyillar:
--   1. PROVENANS majburiy — har qatorda `source`. Bu ustunni keyin
--      qo'shib bo'lmaydi (mavjud qatorlar uchun qiymat noma'lum
--      bo'lib qoladi), litsenziya qarori esa keyin chiqadi.
--   2. NORMALIZATSIYA generatsiya qilinadi, qo'lda yozilmaydi — import
--      kodi uni noto'g'ri hisoblab qo'ya olmaydi.
--   3. CHECK cheklovlari — noto'g'ri ma'lumot bazaga UMUMAN kirmaydi.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Migratsiya hisobi ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- Uzbek matn normalizatsiyasi
--
-- Foydalanuvchi bitta ko'cha nomini kamida to'rt xil yozadi:
--   "Navoiy ko'chasi" / "Navoiy koʻchasi" / "Navoiy kochasi" /
--   "Навоий кўчаси"
-- Hammasi bitta kalitga tushishi SHART, aks holda qidiruv ishlamaydi.
--
-- IMMUTABLE bo'lishi MAJBURIY — usiz bu funksiyani na indeksda, na
-- generatsiyalangan ustunda ishlatib bo'lmaydi.
--
-- DIQQAT: bu yerda `unaccent()` ATAYLAB ISHLATILMAGAN. U lug'atga
-- bog'liq va IMMUTABLE emas — indeksga qo'yilsa lug'at o'zgarganda
-- indeks jimgina noto'g'ri bo'lib qoladi.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION ondex_normalize(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
  SELECT btrim(regexp_replace(
    translate(
      translate(
        -- 2-qadam: ko'p harfli kirill birikmalari (bir harfli
        -- almashtirishdan OLDIN bo'lishi shart).
        replace(replace(replace(replace(replace(replace(replace(replace(
          -- 1-qadam: kichik harfga. `C.UTF-8` locale'da bu kirill
          -- uchun ham ishlaydi (sof `C` da ishlamas edi).
          lower(input),
          'ё','yo'), 'ж','j'), 'ч','ch'), 'ш','sh'),
          'щ','sh'), 'ю','yu'), 'я','ya'), 'ц','ts'),
        -- 3-qadam: bir harfli kirill → lotin.
        -- `ъ` va `ь` ning `to` da jufti yo'q — ular O'CHIRILADI.
        --
        -- DIQQAT `й` → `y` (`j` EMAS): o'zbek lotinida Навоий = Navoiy.
        -- `j` harfi `ж` ga tegishli va u yuqorida, ko'p harfli
        -- bosqichda almashtiriladi. Bu ikkisi chalkashtirilsa
        -- kirillcha qidiruv jimgina ishlamay qo'yadi.
        'абвгдезийклмнопрстуфхэўқғҳъь',
        'abvgdeziyklmnoprstufxeoqgh'
      ),
      -- 4-qadam: apostrof variantlari BUTUNLAY o'chiriladi, probelga
      -- almashtirilmaydi — "ko'cha" → "kocha" bo'lishi kerak,
      -- "ko cha" emas.
      --   U+0027 '   U+2019 '   U+02BB ʻ   U+02BC ʼ   U+0060 `   U+00B4 ´
      U&'\0027\2019\02BB\02BC\0060\00B4',
      ''
    ),
    -- 5-qadam: qolgan hamma narsa (tinish belgilari, defis, ortiqcha
    -- probel) bitta probelga.
    '[^a-z0-9]+', ' ', 'g'
  ));
$$;

COMMENT ON FUNCTION ondex_normalize(text) IS
  'Uzbek nomlarini qidiruv kalitiga keltiradi: kichik harf, kirill→lotin, apostrofsiz.';

-- ── `updated_at` ni avtomatik yangilash ──────────────────────────────
CREATE OR REPLACE FUNCTION ondex_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- MAHALLALAR
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE mahallas (
    id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

    -- Import manbasidagi barqaror kalit. Qayta import qilinganda yangi
    -- qator YARATILMAYDI, mavjudi yangilanadi (idempotent import).
    ext_key    TEXT UNIQUE,

    name       TEXT NOT NULL CHECK (btrim(name) <> ''),
    -- Generatsiyalangan: import kodi buni noto'g'ri hisoblay olmaydi
    -- va nom o'zgarganda kalit avtomatik yangilanadi.
    name_norm  TEXT GENERATED ALWAYS AS (ondex_normalize(name)) STORED,

    city       TEXT NOT NULL DEFAULT 'Chust',

    -- Markaz MAJBURIY, chegara EMAS.
    -- Sabab: mahalla nomlarini bir kunda kiritish mumkin, chegaralarini
    -- chizish esa haftalar oladi. Ikkalasini birdan talab qilsak —
    -- hech narsa boshlanmaydi.
    center     geography(Point, 4326) NOT NULL,
    geom       geography(MultiPolygon, 4326),

    source     TEXT NOT NULL CHECK (source IN ('official','survey','osm','community')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mahallas_center_gix ON mahallas USING GIST (center);
CREATE INDEX mahallas_geom_gix   ON mahallas USING GIST (geom);
CREATE INDEX mahallas_norm_trgm  ON mahallas USING GIN (name_norm gin_trgm_ops);
CREATE INDEX mahallas_source_idx ON mahallas (source);

CREATE TRIGGER mahallas_touch BEFORE UPDATE ON mahallas
    FOR EACH ROW EXECUTE FUNCTION ondex_touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- KO'CHALAR
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE streets (
    id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    ext_key    TEXT UNIQUE,

    name       TEXT NOT NULL CHECK (btrim(name) <> ''),
    name_norm  TEXT GENERATED ALWAYS AS (ondex_normalize(name)) STORED,

    kind       TEXT NOT NULL DEFAULT 'kocha'
               CHECK (kind IN ('kocha','tor_kocha','xiyobon','shox_kocha','maydon')),

    -- Geometriya ixtiyoriy: nom bugun kiritiladi, chiziq keyin.
    --
    -- ESLATMA: QGIS'da chizishda snapping va topological editing
    -- YOQILGAN bo'lsin. Hozir marshrut hisoblanmaydi, lekin keyin
    -- kerak bo'lsa topologiyasiz geometriyani QAYTA chizishga to'g'ri
    -- keladi. Yoqilgan holda chizish qo'shimcha mehnat talab qilmaydi.
    geom       geography(MultiLineString, 4326),

    source     TEXT NOT NULL CHECK (source IN ('official','survey','osm','community')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX streets_geom_gix   ON streets USING GIST (geom);
CREATE INDEX streets_norm_trgm  ON streets USING GIN (name_norm gin_trgm_ops);
CREATE INDEX streets_source_idx ON streets (source);

CREATE TRIGGER streets_touch BEFORE UPDATE ON streets
    FOR EACH ROW EXECUTE FUNCTION ondex_touch_updated_at();

-- ── Ko'cha ↔ mahalla (ko'pga-ko'p) ───────────────────────────────────
-- Bitta ko'cha bir necha mahalladan o'tadi. Massiv ustun (`TEXT[]`)
-- o'rniga alohida jadval: FOREIGN KEY yaxlitlikni BAZA darajasida
-- qo'riqlaydi — o'chirilgan mahallaga havola qolib ketmaydi.
CREATE TABLE street_mahallas (
    street_id  TEXT NOT NULL REFERENCES streets(id)  ON DELETE CASCADE,
    mahalla_id TEXT NOT NULL REFERENCES mahallas(id) ON DELETE CASCADE,
    PRIMARY KEY (street_id, mahalla_id)
);

CREATE INDEX street_mahallas_mahalla_idx ON street_mahallas (mahalla_id);

-- ═══════════════════════════════════════════════════════════════════
-- ALIASLAR — loyihaning eng katta ustunligi
--
-- Chustlik odam "Katta ko'cha" yoki eski sovet nomini aytadi, rasmiy
-- reestrda esa boshqa nom turadi. Bu bilimni na Google, na Mapbox
-- biladi — biz bilamiz.
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE street_aliases (
    id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    street_id  TEXT NOT NULL REFERENCES streets(id) ON DELETE CASCADE,

    alias      TEXT NOT NULL CHECK (btrim(alias) <> ''),
    alias_norm TEXT GENERATED ALWAYS AS (ondex_normalize(alias)) STORED,

    kind       TEXT NOT NULL DEFAULT 'xalq'
               CHECK (kind IN ('official','xalq','eski','kirill')),

    source     TEXT NOT NULL CHECK (source IN ('official','survey','osm','community')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (street_id, alias)
);

CREATE INDEX street_aliases_norm_trgm ON street_aliases USING GIN (alias_norm gin_trgm_ops);
CREATE INDEX street_aliases_street_idx ON street_aliases (street_id);

INSERT INTO schema_migrations (version) VALUES ('0001_init')
    ON CONFLICT (version) DO NOTHING;

COMMIT;
