-- ═══════════════════════════════════════════════════════════════════
-- Yuboruvchi rol: INSERT huquqi USTUN darajasida cheklanadi
--
-- 0007 da `ondexmap_submit` ga butun jadvalga INSERT berilgan edi. Bu
-- yuboruvchiga moderatsiya ustunlarini ham yozish imkonini berardi:
--   • `status = 'approved'`  — o'zini "tasdiqlangan" deb belgilash;
--   • `created_at`           — soatlik chegarani aldash uchun eski sana;
--   • `reviewed_by`, `place_id`, `review_note` — soxta moderatsiya izi.
-- Xaritaga baribir tushmaydi (jonli `places` ga faqat admin yozadi), lekin
-- navbat va audit ma'lumoti yuboruvchi qo'lida bo'lmasligi kerak.
--
-- Endi yuboruvchi faqat TAKLIF MAZMUNI ustunlarini yoza oladi; qolganlari
-- (status = 'pending', created_at = now(), ...) baza standartidan keladi.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

REVOKE INSERT ON place_submissions FROM ondexmap_submit;
GRANT INSERT (id, kind, name, category, description, phone, hours, street, house,
              geom, photo_count, submitter_hint)
    ON place_submissions TO ondexmap_submit;

INSERT INTO schema_migrations (version) VALUES ('0008_places_submit_columns')
    ON CONFLICT (version) DO NOTHING;

COMMIT;
