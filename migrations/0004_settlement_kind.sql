-- ═══════════════════════════════════════════════════════════════════
-- AHOLI PUNKTI TURI: mahalla / qishloq / daha
--
-- NEGA KERAK: `mahallas` jadvali shu paytgacha faqat SHAHAR ichidagi
-- mahallalar uchun edi. Chust TUMANIDAGI qishloqlar uchun esa umuman
-- joy yo'q edi.
--
-- NEGA ALOHIDA JADVAL EMAS: qishloq ham, mahalla ham bir xil
-- geometriyaga (chegara + markaz), bir xil qidiruvga va bir xil
-- "bu nuqta qayerda?" mantig'iga ega. Ikki jadval qilinsa har bir
-- so'rov UNION bo'lib, indekslar ikkilanib, `street_mahallas` kabi
-- bog'lovchi jadvallar ham ikkilanardi. Bitta jadval + `kind`
-- ustuni — soddaroq va tezroq.
--
-- NEGA HOZIR: hozir 21 ta yozuv bor. Keyinroq mingta yozuv
-- bo'lganda ustun qo'shish va ma'lumotni qayta taqsimlash ancha
-- qimmatga tushadi.
--
-- ⚠️ `city` ustuni O'ZGARMAYDI: u aholi punkti QAYSI shahar/tumanga
-- tegishli ekanini bildiradi, `kind` esa uning TURINI. Ikkalasi
-- boshqa savolga javob beradi.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE mahallas
    ADD COLUMN kind TEXT NOT NULL DEFAULT 'mahalla';

-- Ruxsat etilgan turlar ATAYLAB qisqa ro'yxat: yangi tur kerak
-- bo'lsa migratsiya bilan ochiq qo'shiladi. Erkin matn qoldirilsa
-- vaqt o'tib "qishloq", "Qishloq", "qishlok" kabi variantlar
-- to'planib, filtrlash ishonchsiz bo'lib qolardi.
ALTER TABLE mahallas
    ADD CONSTRAINT mahallas_kind_check
    CHECK (kind IN ('mahalla', 'qishloq', 'daha'));

-- Turlar bo'yicha filtr (xaritada "faqat qishloqlar" kabi so'rov).
CREATE INDEX mahallas_kind_idx ON mahallas (kind);

COMMENT ON COLUMN mahallas.kind IS
    'Aholi punkti turi: mahalla (shahar ichida), qishloq (tumanda), daha (yirik mahalla guruhi)';

-- Migratsiya hisobi. Bu qator avval YO'Q edi: 0001-0003 o'zini yozadi, 0004 esa
-- yozmasdi va cmd/migrate uni har safar qayta qo'llashga urinib, ustun
-- allaqachon bor deb yiqilardi (2026-09-20 da aniqlangan).
INSERT INTO schema_migrations (version) VALUES ('0004_settlement_kind')
    ON CONFLICT (version) DO NOTHING;

COMMIT;
