-- ═══════════════════════════════════════════════════════════════════
-- RASMLAR: BAZADAN (BYTEA) R2'GA (obyekt ombori)
--
-- Sabab: har bir yuklangan rasm baza hajmini (demak zaxira nusxasi va
-- replikatsiya hajmini ham) shishiradi va serverning o'z diskini yeydi.
-- Eng yomon holatda (navbat to'lgan holat) bu 1.4 GB gacha yetishi
-- mumkin edi (`internal/httpapi/routes_places.go` dagi izoh). Endi
-- rasm baytlari Cloudflare R2'da, baza esa faqat KALITNI saqlaydi.
--
-- XAVFSIZ TO'G'RIDAN-TO'G'RI O'ZGARISH (backfill YO'Q): production'da
-- ikkala jadvalda ham 0 ta qator tasdiqlangan (2026-09-23, `check-disk.sh`
-- natijasi) — mavjud rasm yo'q, ko'chirish shart emas.
--
-- `content_type` ustuni QOLDIRILADI: hozir ham yagona ruxsat etilgan
-- qiymat `image/jpeg` (`NormalizePhoto` har doim shunga normallashtiradi),
-- lekin API javobida `Content-Type` sarlavhasini shakllantirish uchun
-- hali ham kerak.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE place_photos DROP COLUMN data;
ALTER TABLE place_photos ADD COLUMN r2_key TEXT NOT NULL
    CHECK (char_length(r2_key) BETWEEN 1 AND 300);

ALTER TABLE place_submission_photos DROP COLUMN data;
ALTER TABLE place_submission_photos ADD COLUMN r2_key TEXT NOT NULL
    CHECK (char_length(r2_key) BETWEEN 1 AND 300);

INSERT INTO schema_migrations (version) VALUES ('0011_photos_to_r2')
    ON CONFLICT (version) DO NOTHING;

COMMIT;
