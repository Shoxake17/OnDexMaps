-- ═══════════════════════════════════════════════════════════════════════
-- geo_names.alt_norm — har bir YOZILISH alohida normallashgan
--
-- Muammo: `search` (nom + barcha yozilishlar) bitta qatorga yopishtirilgan,
-- shuning uchun qidiruv «Tashkent» yoki «Ташкент» yozilganini nomning O'ZIGA
-- aniq mos kelish deb bila olmasdi. Natijada Toshkent SHAHRI (alt: «Tashkent»,
-- «Ташкент») ro'yxatda «Tashkent» deb nomlangan qishloq va kafedan pastda
-- qolardi — eng ko'p yoziladigan so'rov aynan shu.
--
-- Yechim: yozilishlar `|` bilan ajratib saqlanadi: `|tashkent|tashkent|`.
-- Aniq mos kelishni `LIKE '%|tashkent|%'` bilan tekshirish mumkin.
--
-- `search` dan farqli bu ustun GENERATSIYA qilinmaydi: `ondex_normalize`
-- `|` ni o'chirib yuboradi va massivni qatorga aylantirish `IMMUTABLE`
-- bo'lmagani uchun generatsiyalangan ustunda ishlamaydi. Uni `cmd/osmimport`
-- to'ldiradi (jadval baribir butunlay importdan keladi, qo'lda tahrirlanmaydi).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE geo_names
    ADD COLUMN alt_norm TEXT NOT NULL DEFAULT '||';

COMMENT ON COLUMN geo_names.alt_norm IS
  'Boshqa yozilishlar, har biri normallashgan va | bilan ajratilgan: |tashkent|. Faqat cmd/osmimport yozadi.';

INSERT INTO schema_migrations (version) VALUES ('0006_geo_names_alt_norm')
    ON CONFLICT (version) DO NOTHING;

COMMIT;
