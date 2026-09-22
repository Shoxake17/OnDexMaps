-- ═══════════════════════════════════════════════════════════════════
-- FOYDALANUVCHI OB'EKTLARI: KONTAKTLAR va YANA IKKI CHIZIQ TURI
--
-- 1) KONTAKTLAR. «Tashkilot» endi telefon bilan birga veb-sayt (`site`) va
--    ijtimoiy tarmoq akkaunti (`social`) ham saqlaydi. Bular hammaga HAVOLA
--    bo'lib ko'rinadi, shuning uchun bazada ham himoya bor: faqat `http://`
--    yoki `https://` bilan boshlanadi (`javascript:`, `data:` va h.k. saqlanmaydi)
--    va bo'sh joy yo'q. Kodda (`internal/places/contacts.go`) qat'iyroq tekshiriladi.
--    Yozish huquqi: `ondexmap_submit` yangi ustunlarga ham FAQAT INSERT qila oladi
--    (0008 dagi ustun ro'yxati kengayadi).
--
-- 2) CHIZIQ TURLARI: `road` (yo'l) ga `crossing` (piyodalar o'tish joyi, ≤10 m)
--    va `fence` (to'siq) qo'shildi — endi ular NUQTA emas, xaritada CHIZILADI.
--      • road      → LINESTRING, 2..500 nuqta, 1..40 000 m
--      • crossing  → LINESTRING, 2..4 nuqta,   1..11 m   (kod: 2..10 m)
--      • fence     → LINESTRING, 2..200 nuqta, 0.5..2 500 m (kod: 1..2 000 m)
--      • boshqalar → POINT
--    (Baza chegarasi kodnikidan biroz KENGROQ: sferoid bo'yicha uzunlik
--    sfera hisobidan ~0.5% farq qilishi mumkin, kod qabul qilganini baza rad
--    etmasin. `TestMigrationLineKindsMatchCode` kod bilan moslikni tekshiradi.)
--
-- ⚠️ ESKI QATORLAR: 0007 davrida «o'tish joyi» va «to'siq» NUQTA bo'lib
-- yuborilgan bo'lishi mumkin. Shu sabab ikkala cheklov ham `NOT VALID`:
-- mavjud qatorlar tekshirilmaydi (ular xaritada belgi bo'lib ko'rinishda
-- qoladi), YANGILARI esa qat'iy tekshiriladi.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Kontaktlar ────────────────────────────────────────────────────
ALTER TABLE places
    ADD COLUMN site   TEXT CHECK (char_length(site)   BETWEEN 1 AND 200 AND site   ~ '^https?://[^[:space:]]+$'),
    ADD COLUMN social TEXT CHECK (char_length(social) BETWEEN 1 AND 200 AND social ~ '^https?://[^[:space:]]+$');

ALTER TABLE place_submissions
    ADD COLUMN site   TEXT CHECK (char_length(site)   BETWEEN 1 AND 200 AND site   ~ '^https?://[^[:space:]]+$'),
    ADD COLUMN social TEXT CHECK (char_length(social) BETWEEN 1 AND 200 AND social ~ '^https?://[^[:space:]]+$');

GRANT INSERT (site, social) ON place_submissions TO ondexmap_submit;

-- ── 2. Shakl cheklovlari (0009 dagilar almashtiriladi) ───────────────
ALTER TABLE places            DROP CONSTRAINT places_geom_shape;
ALTER TABLE place_submissions DROP CONSTRAINT place_submissions_geom_shape;

ALTER TABLE places ADD CONSTRAINT places_geom_shape CHECK (
    (kind = 'road'
        AND GeometryType(geom::geometry) = 'LINESTRING'
        AND ST_NPoints(geom::geometry) BETWEEN 2 AND 500
        AND ST_Length(geom) BETWEEN 1 AND 40000)
    OR
    (kind = 'crossing'
        AND GeometryType(geom::geometry) = 'LINESTRING'
        AND ST_NPoints(geom::geometry) BETWEEN 2 AND 4
        AND ST_Length(geom) BETWEEN 1 AND 11)
    OR
    (kind = 'fence'
        AND GeometryType(geom::geometry) = 'LINESTRING'
        AND ST_NPoints(geom::geometry) BETWEEN 2 AND 200
        AND ST_Length(geom) BETWEEN 0.5 AND 2500)
    OR
    (kind NOT IN ('road', 'crossing', 'fence') AND GeometryType(geom::geometry) = 'POINT')
) NOT VALID;

ALTER TABLE place_submissions ADD CONSTRAINT place_submissions_geom_shape CHECK (
    (kind = 'road'
        AND GeometryType(geom::geometry) = 'LINESTRING'
        AND ST_NPoints(geom::geometry) BETWEEN 2 AND 500
        AND ST_Length(geom) BETWEEN 1 AND 40000)
    OR
    (kind = 'crossing'
        AND GeometryType(geom::geometry) = 'LINESTRING'
        AND ST_NPoints(geom::geometry) BETWEEN 2 AND 4
        AND ST_Length(geom) BETWEEN 1 AND 11)
    OR
    (kind = 'fence'
        AND GeometryType(geom::geometry) = 'LINESTRING'
        AND ST_NPoints(geom::geometry) BETWEEN 2 AND 200
        AND ST_Length(geom) BETWEEN 0.5 AND 2500)
    OR
    (kind NOT IN ('road', 'crossing', 'fence') AND GeometryType(geom::geometry) = 'POINT')
) NOT VALID;

INSERT INTO schema_migrations (version) VALUES ('0010_place_contacts_and_shapes')
    ON CONFLICT (version) DO NOTHING;

COMMIT;
