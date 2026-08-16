-- ═══════════════════════════════════════════════════════════════════
-- JAMOA TAKLIFLARI VA MODERATSIYA
--
-- ASOSIY QOIDA: foydalanuvchi yuborgan hech narsa xaritaga
-- TO'G'RIDAN-TO'G'RI tushmaydi. Taklif alohida KARANTIN jadvalga
-- yoziladi va faqat admin tasdiqlagandan keyin jonli jadvalga
-- ko'chiriladi.
--
-- Bu bir vaqtda ikkita muammoni yechadi:
--   1. Mahsulot talabi — "men accept qilsamgina qo'shilsin"
--   2. Xavfsizlik — internetga qaragan API jonli geoma'lumotga
--      umuman yoza olmaydi. U faqat karantin jadvaliga INSERT
--      qila oladi (grantlar pastda).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── Takliflar (karantin) ─────────────────────────────────────────────
CREATE TABLE geo_contributions (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

    kind        TEXT NOT NULL CHECK (kind IN ('mahalla','street','alias')),
    op          TEXT NOT NULL DEFAULT 'create' CHECK (op IN ('create','update','delete')),

    -- `update`/`delete` uchun — qaysi jonli yozuvga tegishli.
    -- FOREIGN KEY ATAYLAB QO'YILMAGAN: jonli yozuv o'chirilsa ham
    -- taklif tarixi saqlanib qolishi kerak (audit).
    target_id   TEXT,

    -- Taklif mazmuni: name, kind, source, izoh va h.k.
    payload     JSONB NOT NULL,

    -- Geometriya ixtiyoriy: ommaviy foydalanuvchi odatda faqat
    -- nuqta qo'yadi va nom yozadi. Aniq chegara/chiziqni admin
    -- tasdiqlash paytida chizadi.
    geom        geography(Geometry, 4326),

    status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected')),

    -- Kim yubordi. ATAYLAB shaffof matn (opaque):
    -- OnDexMap'da foydalanuvchi jadvali YO'Q va bo'lmaydi ham —
    -- shaxsni ChustApp tasdiqlaydi va ID'ni sarlavhada uzatadi.
    -- Anonim yuborishda bu bo'sh, o'rniga `submitter_hint` qoladi.
    submitted_by   TEXT,
    -- IP xeshi yoki boshqa qo'pol belgi — spamni guruhlash uchun.
    -- Xom IP SAQLANMAYDI (shaxsiy ma'lumot).
    submitter_hint TEXT,
    submitter_note TEXT,

    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Moderatsiya navbati eng ko'p so'raladigan ko'rinish.
CREATE INDEX geo_contributions_pending_idx
    ON geo_contributions (created_at DESC)
    WHERE status = 'pending';
CREATE INDEX geo_contributions_status_idx ON geo_contributions (status, created_at DESC);
CREATE INDEX geo_contributions_geom_gix   ON geo_contributions USING GIST (geom);
CREATE INDEX geo_contributions_hint_idx   ON geo_contributions (submitter_hint, created_at DESC);

-- ── Reviziyalar (audit va ORQAGA QAYTARISH) ──────────────────────────
--
-- Bu jadvalsiz vandalizmni qaytarib bo'lmaydi. OSM ham, Wikipedia ham
-- shu darsni qattiq o'rgangan: tasdiqlangan o'zgarish ham xato
-- bo'lishi mumkin, va "oldin qanday edi?" degan savolga javob
-- bo'lmasa tuzatish imkonsiz.
CREATE TABLE geo_revisions (
    id              BIGSERIAL PRIMARY KEY,
    target_kind     TEXT NOT NULL CHECK (target_kind IN ('mahalla','street','alias')),
    target_id       TEXT NOT NULL,
    op              TEXT NOT NULL CHECK (op IN ('create','update','delete')),
    before          JSONB,
    after           JSONB,
    contribution_id TEXT REFERENCES geo_contributions(id) ON DELETE SET NULL,
    applied_by      TEXT NOT NULL,
    applied_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX geo_revisions_target_idx ON geo_revisions (target_kind, target_id, applied_at DESC);

-- ═══════════════════════════════════════════════════════════════════
-- GRANTLAR — bu bo'lim butun dizaynning yuragi
--
-- `ondexmap_app` (internetga qaragan API) endi BITTA yozish
-- huquqiga ega bo'ladi: karantin jadvaliga INSERT.
--
-- U jonli jadvallarga (mahallas, streets, street_aliases) HANUZ
-- yoza olmaydi. Ya'ni ommaviy API'ni to'liq egallab olgan hujumchi
-- ham xaritani o'zgartira olmaydi — u faqat moderatsiya navbatiga
-- axlat qo'sha oladi, va uni admin ko'radi.
--
-- UPDATE ham, DELETE ham berilmaydi: yuborilgan taklifni keyin
-- o'zgartirish yoki izini yo'qotish mumkin bo'lmasin.
-- ═══════════════════════════════════════════════════════════════════

GRANT INSERT ON geo_contributions TO ondexmap_app;

-- O'z taklifining holatini ko'rish uchun o'qish (ilova qatlami
-- faqat kerakli qatorlarni tanlaydi).
GRANT SELECT ON geo_contributions TO ondexmap_app;

-- Reviziyalar ommaviy API uchun umuman kerak emas.
REVOKE ALL ON geo_revisions FROM ondexmap_app;

-- Aniq qaytarish: jonli jadvallarga yozish huquqi berilmaganini
-- yana bir bor mustahkamlaymiz (himoyaning ikkinchi qatlami).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON mahallas, streets, street_aliases FROM ondexmap_app;
REVOKE UPDATE, DELETE, TRUNCATE ON geo_contributions FROM ondexmap_app;

INSERT INTO schema_migrations (version) VALUES ('0003_contributions')
    ON CONFLICT (version) DO NOTHING;

COMMIT;
