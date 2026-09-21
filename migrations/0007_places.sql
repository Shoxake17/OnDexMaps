-- ═══════════════════════════════════════════════════════════════════
-- FOYDALANUVCHI QO'SHGAN OB'EKTLAR (tashkilot, manzil, bekat, ...)
--
-- ASOSIY QOIDA (0003 bilan bir xil): foydalanuvchi yuborgan hech narsa
-- xaritaga TO'G'RIDAN-TO'G'RI tushmaydi.
--
--   ommaviy API ──INSERT──▶ place_submissions   (karantin, pending)
--                                   │  admin ko'radi, tahrirlaydi
--                                   ▼  tasdiqlaydi (cmd/admin, lokal)
--                            places  ──SELECT──▶ ommaviy API ──▶ HAMMAGA ko'rinadi
--
-- ⚠️ YOZISH HUQUQI. 0002/0003 dagi uch qatlamli himoya SAQLANADI:
--   • `ondexmap_app` (o'qish roli) jonli jadvallarga HANUZ yoza olmaydi;
--   • karantinga yozish uchun ALOHIDA rol — `ondexmap_submit`:
--       - faqat `place_submissions` va `place_submission_photos` ga INSERT;
--       - o'qish — faqat 3 ta ustun (spamni sanash uchun), qolgani yo'q;
--       - `places` (jonli) ga umuman tegolmaydi.
--   Ya'ni yuborish yo'lini to'liq egallab olgan hujumchi ham xaritani
--   o'zgartira olmaydi: u faqat moderatsiya navbatiga axlat qo'sha oladi.
--
-- Ishga tushirish: `go run ./cmd/migrate` (ONDEXMAP_SUBMIT_DB_PASSWORD kerak).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── Karantinga yozuvchi rol ──────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ondexmap_submit') THEN
    CREATE ROLE ondexmap_submit LOGIN;
  END IF;
END
$$;

ALTER ROLE ondexmap_submit WITH PASSWORD :submit_password;
ALTER ROLE ondexmap_submit NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

GRANT CONNECT ON DATABASE ondexmap TO ondexmap_submit;
GRANT USAGE   ON SCHEMA public     TO ondexmap_submit;
REVOKE CREATE ON SCHEMA public FROM ondexmap_submit;

-- ── Jonli jadval: TASDIQLANGAN ob'ektlar ─────────────────────────────
--
-- `kind` ro'yxati `internal/places/kinds.go` bilan BIR XIL bo'lishi shart
-- (moslikni `TestMigrationKindsMatchCode` tekshiradi).
CREATE TABLE places (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

    kind        TEXT NOT NULL CHECK (kind IN (
                    'organization','address','entrance','road','barrier',
                    'stop','parking','crossing','fence','gate','other')),

    -- Chegaralar `internal/places/validate.go` dagi bilan bir xil: kod
    -- xato qilsa ham baza yaroqsiz qiymatni ushlab qoladi.
    name        TEXT CHECK (char_length(name)        BETWEEN 1 AND 120),
    category    TEXT CHECK (char_length(category)    BETWEEN 1 AND 60),
    description TEXT CHECK (char_length(description) BETWEEN 1 AND 1000),
    phone       TEXT CHECK (char_length(phone)       BETWEEN 1 AND 24),
    hours       TEXT CHECK (char_length(hours)       BETWEEN 1 AND 80),
    street      TEXT CHECK (char_length(street)      BETWEEN 1 AND 120),
    house       TEXT CHECK (char_length(house)       BETWEEN 1 AND 16),

    -- Nuqta O'zbekiston chegarasidan tashqarida bo'lolmaydi (ma'lumot
    -- zaharlanishi va noto'g'ri koordinata tizimidan himoya).
    geom        geography(Point, 4326) NOT NULL
                CHECK (geom::geometry && ST_MakeEnvelope(55.5, 37.0, 73.5, 45.8, 4326)),

    -- Provenans — bizning da'vomiz (0003 dagi qoida): admin belgilaydi.
    source      TEXT NOT NULL DEFAULT 'community'
                CHECK (source IN ('official','survey','osm','community')),

    photo_count SMALLINT NOT NULL DEFAULT 0 CHECK (photo_count BETWEEN 0 AND 4),

    -- Qidiruv: `geo_names` bilan AYNAN bir xil normalizatsiya (kirill/lotin,
    -- apostroflar bir kalitga tushadi).
    name_norm   TEXT GENERATED ALWAYS AS (ondex_normalize(coalesce(name, ''))) STORED,
    -- ⚠️ `concat_ws` IMMUTABLE emas (STABLE) — generatsiyalangan ustunda
    -- ishlamaydi ("generation expression is not immutable"). `||` esa immutable.
    search      TEXT GENERATED ALWAYS AS (ondex_normalize(
                    coalesce(name, '') || ' ' || coalesce(street, '') || ' ' || coalesce(house, ''))) STORED,

    -- Qaysi taklifdan kelgan (audit). Bir taklif ikki marta ob'ekt yaratmaydi.
    submission_id TEXT UNIQUE,
    approved_by   TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX places_geom_gix    ON places USING GIST (geom);
CREATE INDEX places_search_trgm ON places USING GIN (search gin_trgm_ops);
CREATE INDEX places_created_idx ON places (created_at DESC);

-- Rasmlar (tasdiqlangan). Baytlar `internal/places.NormalizePhoto` dan
-- o'tgan JPEG — EXIF yo'q, o'lcham cheklangan.
CREATE TABLE place_photos (
    place_id     TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    pos          SMALLINT NOT NULL CHECK (pos BETWEEN 0 AND 3),
    content_type TEXT NOT NULL DEFAULT 'image/jpeg' CHECK (content_type = 'image/jpeg'),
    data         BYTEA NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 1500000),
    PRIMARY KEY (place_id, pos)
);

-- ── Karantin: TASDIQLANMAGAN takliflar ───────────────────────────────
CREATE TABLE place_submissions (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

    kind        TEXT NOT NULL CHECK (kind IN (
                    'organization','address','entrance','road','barrier',
                    'stop','parking','crossing','fence','gate','other')),
    name        TEXT CHECK (char_length(name)        BETWEEN 1 AND 120),
    category    TEXT CHECK (char_length(category)    BETWEEN 1 AND 60),
    description TEXT CHECK (char_length(description) BETWEEN 1 AND 1000),
    phone       TEXT CHECK (char_length(phone)       BETWEEN 1 AND 24),
    hours       TEXT CHECK (char_length(hours)       BETWEEN 1 AND 80),
    street      TEXT CHECK (char_length(street)      BETWEEN 1 AND 120),
    house       TEXT CHECK (char_length(house)       BETWEEN 1 AND 16),
    geom        geography(Point, 4326) NOT NULL
                CHECK (geom::geometry && ST_MakeEnvelope(55.5, 37.0, 73.5, 45.8, 4326)),
    photo_count SMALLINT NOT NULL DEFAULT 0 CHECK (photo_count BETWEEN 0 AND 4),

    status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected')),

    -- Yuboruvchi: XOM IP SAQLANMAYDI (shaxsiy ma'lumot). Faqat HMAC —
    -- spamni guruhlash uchun barqaror, lekin IP'ga qaytarib bo'lmaydigan belgi.
    submitter_hint TEXT NOT NULL CHECK (char_length(submitter_hint) <= 64),
    -- Kelajak: ChustApp bergan shaffof ID (OnDexMap'da foydalanuvchi jadvali yo'q).
    submitted_by   TEXT CHECK (char_length(submitted_by) <= 128),

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT CHECK (char_length(review_note) <= 500),
    -- Tasdiqlanganda yaratilgan jonli ob'ekt.
    place_id    TEXT
);

CREATE INDEX place_submissions_pending_idx ON place_submissions (created_at DESC) WHERE status = 'pending';
CREATE INDEX place_submissions_hint_idx    ON place_submissions (submitter_hint, created_at DESC);

CREATE TABLE place_submission_photos (
    submission_id TEXT NOT NULL REFERENCES place_submissions(id) ON DELETE CASCADE,
    pos           SMALLINT NOT NULL CHECK (pos BETWEEN 0 AND 3),
    content_type  TEXT NOT NULL DEFAULT 'image/jpeg' CHECK (content_type = 'image/jpeg'),
    data          BYTEA NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 1500000),
    PRIMARY KEY (submission_id, pos)
);

-- Reviziya jadvali endi 'place' ni ham qabul qiladi (o'zgarishlar tarixi).
ALTER TABLE geo_revisions DROP CONSTRAINT IF EXISTS geo_revisions_target_kind_check;
ALTER TABLE geo_revisions ADD CONSTRAINT geo_revisions_target_kind_check
    CHECK (target_kind IN ('mahalla','street','alias','place'));

-- ═══════════════════════════════════════════════════════════════════
-- GRANTLAR
-- ═══════════════════════════════════════════════════════════════════

-- Ommaviy API: jonli ob'ektlarni FAQAT O'QIYDI.
REVOKE ALL ON places, place_photos FROM ondexmap_app;
GRANT SELECT ON places, place_photos TO ondexmap_app;

-- Karantin ommaviy API'ning O'QISH roliga UMUMAN ko'rinmaydi: unda hali
-- tekshirilmagan matn, rasm va yuboruvchi belgisi bor. (0002 dagi
-- `ALTER DEFAULT PRIVILEGES` yangi jadvalga avtomatik SELECT bergan edi —
-- shu yerda aniq olib tashlanadi.)
REVOKE ALL ON place_submissions, place_submission_photos FROM ondexmap_app;

-- Yuboruvchi rol: faqat INSERT + 3 ta ustunni o'qish (soatlik chegara va
-- navbat hajmini sanash uchun). `RETURNING` ishlatilmaydi — id ilovada yaratiladi.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ondexmap_submit;
GRANT INSERT ON place_submissions, place_submission_photos TO ondexmap_submit;
GRANT SELECT (submitter_hint, created_at, status) ON place_submissions TO ondexmap_submit;

INSERT INTO schema_migrations (version) VALUES ('0007_places')
    ON CONFLICT (version) DO NOTHING;

COMMIT;
