-- ═══════════════════════════════════════════════════════════════════
-- ENG KAM IMTIYOZ (least privilege)
--
-- MUAMMO: hozirgacha ilova baza EGASI (`ondexmap`) sifatida ulanardi.
-- Egaviy ulanish `DROP TABLE` qila oladi. Ya'ni API'da bitta SQL
-- inyeksiya zaifligi butun geoma'lumot bazasini o'chirib yuborishi
-- mumkin edi.
--
-- YECHIM: internetga qaragan jarayon va ma'lumot o'zgartiradigan
-- vositalar ALOHIDA rollarda ishlaydi:
--
--   ondexmap      (ega)      — migratsiya va import. FAQAT sizning
--                              mashinangizda, lokal ishlatiladi.
--   ondexmap_app  (ilova)    — HTTP API. FAQAT O'QIY OLADI.
--
-- Natija: API jarayoni buzib kirilsa ham — hatto to'liq SQL
-- inyeksiya bilan ham — geoma'lumotni O'ZGARTIRA OLMAYDI. Yozish
-- huquqi internetga umuman chiqmaydi.
--
-- Yozish kerak bo'lganda (crowdsourcing bosqichida) huquq butun
-- bazaga emas, FAQAT `contributions` jadvaliga beriladi.
--
-- Ishga tushirish:
--   psql -v app_password="'...'" -f migrations/0002_least_privilege.sql
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- Rol mavjud bo'lsa qayta yaratilmaydi (migratsiya idempotent).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ondexmap_app') THEN
    CREATE ROLE ondexmap_app LOGIN;
  END IF;
END
$$;

ALTER ROLE ondexmap_app WITH PASSWORD :app_password;

-- Ortiqcha imtiyozlar aniq bekor qilinadi. Standart holatda ular
-- yo'q, lekin bu qatorlar niyatni HUJJATLASHTIRADI va kelajakda
-- kimdir qo'shib qo'ysa qaytarib oladi.
ALTER ROLE ondexmap_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

-- ── Schema darajasi ──────────────────────────────────────────────────
GRANT CONNECT ON DATABASE ondexmap TO ondexmap_app;
GRANT USAGE   ON SCHEMA public     TO ondexmap_app;

-- KRITIK: `public` sxemasida jadval YARATISH huquqi olib tashlanadi.
-- Postgres 15 dan oldin bu huquq har kimda bor edi; yangi versiyalarda
-- yo'q, lekin aniq bekor qilish har ikkala holatda ham to'g'ri.
REVOKE CREATE ON SCHEMA public FROM ondexmap_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- ── Ma'lumot jadvallariga FAQAT O'QISH ───────────────────────────────
GRANT SELECT ON
    mahallas,
    streets,
    street_mahallas,
    street_aliases,
    schema_migrations
TO ondexmap_app;

-- PostGIS ichki jadvali — koordinata tizimlari uchun zarur.
GRANT SELECT ON spatial_ref_sys TO ondexmap_app;

-- Normalizatsiya funksiyasi qidiruvda ishlatiladi.
GRANT EXECUTE ON FUNCTION ondex_normalize(text) TO ondexmap_app;

-- ── Kelajakdagi jadvallar ham avtomatik faqat o'qish bo'lsin ─────────
-- Usiz yangi migratsiyada yaratilgan jadval ilova uchun ko'rinmasdan
-- qolardi va bu prod'da "jadval topilmadi" bo'lib chiqardi.
ALTER DEFAULT PRIVILEGES FOR ROLE ondexmap IN SCHEMA public
    GRANT SELECT ON TABLES TO ondexmap_app;

-- ── Yozish huquqi ANIQ bekor qilinadi ────────────────────────────────
-- Himoyaning ikkinchi qatlami: yuqorida faqat SELECT berilgan, lekin
-- kimdir kelajakda `GRANT ALL` yozib yuborsa, bu qatorlar niyatni
-- eslatib turadi va code review'da ko'rinadi.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM ondexmap_app;

INSERT INTO schema_migrations (version) VALUES ('0002_least_privilege')
    ON CONFLICT (version) DO NOTHING;

COMMIT;
