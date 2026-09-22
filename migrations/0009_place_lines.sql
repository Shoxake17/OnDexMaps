-- ═══════════════════════════════════════════════════════════════════
-- FOYDALANUVCHI OB'EKTLARI: CHIZIQ (YO'L) SHAKLI
--
-- Ilgari `places` va `place_submissions` faqat NUQTA (geography(Point))
-- saqlardi, shu sabab «Yo'l» ham bitta belgi bo'lib qolardi. Endi «Yo'l» turi
-- CHIZIQ (LineString): foydalanuvchi uni xaritada nuqtalar bilan chizadi.
--
-- Shakl turga bog'liq va BAZA ham buni majburlaydi (kod xato qilsa ham):
--   • road       → LINESTRING, 2..500 nuqta, uzunligi 1..40 000 m;
--   • boshqalar  → POINT.
-- (Kod chegaralari `internal/places/geometry.go` da biroz TORROQ: 5..30 000 m —
--  sferoid bo'yicha PostGIS hisobi sfera hisobidan ~0.5% farq qilishi mumkin,
--  shuning uchun kod qabul qilgan yo'lni baza rad etmaydi.)
--
-- Yozish huquqi O'ZGARMAYDI: `ondexmap_submit` faqat karantinga INSERT qiladi
-- (0008 dagi ustun ro'yxatida `geom` allaqachon bor), jonli `places` ga faqat
-- admin yozadi. Ommaviy API jonli jadvalni FAQAT o'qiydi.
--
-- ⚠️ ESKI QATOR: 0007 davrida «Yo'l» nuqta bilan yuborilgan bo'lishi mumkin
-- (`place_submissions` da tasdiqlangan bitta shunday yozuv bor). Shu sabab
-- karantin jadvalidagi cheklov `NOT VALID`: mavjud qatorlar tekshirilmaydi,
-- YANGILARI esa qat'iy tekshiriladi. Jonli `places` da eski «road» qatori yo'q.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- Ustun turi kengayadi: Point → Geometry (mavjud nuqtalar o'zgarmaydi).
ALTER TABLE places            ALTER COLUMN geom TYPE geography(Geometry, 4326);
ALTER TABLE place_submissions ALTER COLUMN geom TYPE geography(Geometry, 4326);

-- Jonli jadval: qat'iy.
ALTER TABLE places ADD CONSTRAINT places_geom_shape CHECK (
    (kind = 'road'
        AND GeometryType(geom::geometry) = 'LINESTRING'
        AND ST_NPoints(geom::geometry) BETWEEN 2 AND 500
        AND ST_Length(geom) BETWEEN 1 AND 40000)
    OR
    (kind <> 'road' AND GeometryType(geom::geometry) = 'POINT')
);

-- Karantin: yangi qatorlar uchun qat'iy, eskilari tekshirilmaydi (yuqoridagi izoh).
ALTER TABLE place_submissions ADD CONSTRAINT place_submissions_geom_shape CHECK (
    (kind = 'road'
        AND GeometryType(geom::geometry) = 'LINESTRING'
        AND ST_NPoints(geom::geometry) BETWEEN 2 AND 500
        AND ST_Length(geom) BETWEEN 1 AND 40000)
    OR
    (kind <> 'road' AND GeometryType(geom::geometry) = 'POINT')
) NOT VALID;

INSERT INTO schema_migrations (version) VALUES ('0009_place_lines')
    ON CONFLICT (version) DO NOTHING;

COMMIT;
