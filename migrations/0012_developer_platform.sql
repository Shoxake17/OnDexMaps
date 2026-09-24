-- ═══════════════════════════════════════════════════════════════════
-- DASTURCHILAR PLATFORMASI (console.ondex.uz): hisoblar, API kalit, hisoblash, hisob-faktura
--
-- Arxitektura shartnomasi: docs/developer-platform.md
--
-- ┌─ XAVFSIZLIK MODELI (uch qatlam: kod + rol + ustun grantlari) ─────────────────┐
-- Yangi ikkita ALOHIDA rol (eng kam imtiyoz):
--
--   ondexmap_meter    — cmd/api. Kalit/hisobni O'QIYDI, faqat api_usage_daily ga YOZADI.
--                       Ommaviy API to'liq egallansa ham hujumchi: kalit yarata olmaydi,
--                       hisob/obunani o'zgartira olmaydi, faqat hisoblagichni buzadi.
--   ondexmap_console  — cmd/console. Hisob/kalit/sessiya/OTP ni boshqaradi, LEKIN
--                       `subscription`, `is_ecosystem`, `status` ustunlarini o'zgartira OLMAYDI
--                       va hisob-fakturaga yozolmaydi. Konsol to'liq buzilsa ham hujumchi
--                       o'ziga obuna yoki "bepul ekotizim" huquqini bera olmaydi.
--
-- `ondexmap_app` (ommaviy o'qish) va `ondexmap_submit` bu jadvallarni UMUMAN ko'rmaydi.
-- Obuna flagi, ekotizim belgisi va pul — FAQAT baza egasi (adminserver, staff).
--
-- Ishga tushirish: `go run ./cmd/migrate`
--   (ONDEXMAP_METER_DB_PASSWORD va ONDEXMAP_CONSOLE_DB_PASSWORD kerak).
-- └─────────────────────────────────────────────────────────────────────────────────┘
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── Rollar ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ondexmap_meter') THEN
    CREATE ROLE ondexmap_meter LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ondexmap_console') THEN
    CREATE ROLE ondexmap_console LOGIN;
  END IF;
END
$$;

ALTER ROLE ondexmap_meter   WITH PASSWORD :meter_password;
ALTER ROLE ondexmap_console WITH PASSWORD :console_password;
ALTER ROLE ondexmap_meter   NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE ondexmap_console NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

GRANT CONNECT ON DATABASE ondexmap TO ondexmap_meter, ondexmap_console;
GRANT USAGE   ON SCHEMA public     TO ondexmap_meter, ondexmap_console;
REVOKE CREATE ON SCHEMA public FROM ondexmap_meter, ondexmap_console;

-- ── Hisoblar ─────────────────────────────────────────────────────────
CREATE TABLE dev_accounts (
    id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email              TEXT NOT NULL,
    name               TEXT CHECK (name IS NULL OR char_length(name) BETWEEN 1 AND 100),
    status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    -- OBUNA FLAGI. true → oyiga 50 000 so'm (qat'iy), yuqori limit. false → bepul.
    -- Faqat staff (baza egasi) o'zgartiradi.
    subscription       BOOLEAN NOT NULL DEFAULT false,
    subscription_since TIMESTAMPTZ,
    -- OnDex ekotizimi hisobi: bepul va cheklovsiz. Faqat staff belgilaydi.
    is_ecosystem       BOOLEAN NOT NULL DEFAULT false,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at      TIMESTAMPTZ,
    CONSTRAINT dev_accounts_email_fmt CHECK (
        email = lower(email)
        AND char_length(email) BETWEEN 5 AND 254
        AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);
CREATE UNIQUE INDEX dev_accounts_email_uq ON dev_accounts (email);

-- ── Bir martalik kodlar (parolsiz kirish) ────────────────────────────
-- Kod hech qachon ochiq saqlanmaydi: HMAC-SHA256(pepper, email|kod).
CREATE TABLE dev_otps (
    id          BIGSERIAL PRIMARY KEY,
    email       TEXT NOT NULL,
    code_hash   BYTEA NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    attempts    SMALLINT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    consumed_at TIMESTAMPTZ
);
CREATE INDEX dev_otps_email_idx ON dev_otps (email, created_at DESC);

-- ── Sessiyalar ───────────────────────────────────────────────────────
-- Cookie'dagi token bazada YO'Q: faqat uning SHA-256 xeshi (baza sizsa ham sessiya o'g'irlanmaydi).
CREATE TABLE dev_sessions (
    token_hash   BYTEA PRIMARY KEY,
    account_id   TEXT NOT NULL REFERENCES dev_accounts(id) ON DELETE CASCADE,
    csrf_token   TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_hash      TEXT,
    user_agent   TEXT CHECK (user_agent IS NULL OR char_length(user_agent) <= 200)
);
CREATE INDEX dev_sessions_account_idx ON dev_sessions (account_id);
CREATE INDEX dev_sessions_expires_idx ON dev_sessions (expires_at);

-- ── API kalitlar ─────────────────────────────────────────────────────
-- Kalitning O'ZI saqlanmaydi: key_hash = HMAC-SHA256(KEY_PEPPER, kalit).
CREATE TABLE api_keys (
    id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    account_id   TEXT NOT NULL REFERENCES dev_accounts(id) ON DELETE CASCADE,
    name         TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
    kind         TEXT NOT NULL CHECK (kind IN ('server', 'browser')),
    prefix       TEXT NOT NULL CHECK (char_length(prefix) BETWEEN 8 AND 24),
    key_hash     BYTEA NOT NULL,
    -- Ruxsat etilgan API'lar (allowlist). Ro'yxatga yangi API qo'shish — ONGLI qaror
    -- (koddagi devplatform.AllAPIs bilan BIR XIL bo'lishi shart; test tekshiradi).
    apis         TEXT[] NOT NULL CHECK (
                     cardinality(apis) >= 1
                     AND apis <@ ARRAY['geocode','reverse','directions','places']::text[]),
    origins      TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(origins) <= 20),
    ips          CIDR[] NOT NULL DEFAULT '{}' CHECK (cardinality(ips) <= 50),
    status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    expires_at   TIMESTAMPTZ,            -- aylantirishdagi grace muddati
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ,
    -- Brauzer kaliti Origin ro'yxatisiz BO'LMAYDI; server kalitida Origin yo'q; IP faqat serverda.
    CONSTRAINT api_keys_browser_needs_origin CHECK (kind = 'server' OR cardinality(origins) >= 1),
    CONSTRAINT api_keys_server_no_origin     CHECK (kind = 'browser' OR cardinality(origins) = 0),
    CONSTRAINT api_keys_browser_no_ip        CHECK (kind = 'server' OR cardinality(ips) = 0)
);
CREATE UNIQUE INDEX api_keys_hash_uq ON api_keys (key_hash);
CREATE INDEX api_keys_account_idx ON api_keys (account_id);

-- ── Hisoblash: kun x kalit x API ─────────────────────────────────────
CREATE TABLE api_usage_daily (
    key_id   TEXT   NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    day      DATE   NOT NULL,   -- UTC
    api      TEXT   NOT NULL CHECK (api IN ('geocode','reverse','directions','places')),
    requests BIGINT NOT NULL DEFAULT 0 CHECK (requests >= 0),   -- HISOBLANADIGAN (2xx/3xx/404)
    errors   BIGINT NOT NULL DEFAULT 0 CHECK (errors >= 0),     -- boshqa 4xx va 5xx (hisoblanmaydi)
    PRIMARY KEY (key_id, day, api)
);
CREATE INDEX api_usage_daily_day_idx ON api_usage_daily (day);

-- ── Hisob-fakturalar ─────────────────────────────────────────────────
CREATE SEQUENCE billing_invoice_seq;
CREATE TABLE billing_invoices (
    id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    number       TEXT NOT NULL DEFAULT ('INV-' || to_char(now(), 'YYYY') || '-' ||
                                        lpad(nextval('billing_invoice_seq')::text, 6, '0')),
    account_id   TEXT NOT NULL REFERENCES dev_accounts(id) ON DELETE RESTRICT,
    period_start DATE NOT NULL,
    period_end   DATE NOT NULL,
    amount_uzs   BIGINT NOT NULL CHECK (amount_uzs >= 0),
    status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'void')),
    issued_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_at       TIMESTAMPTZ NOT NULL,
    paid_at      TIMESTAMPTZ,
    confirmed_by TEXT,
    payment_ref  TEXT CHECK (payment_ref IS NULL OR char_length(payment_ref) <= 120),
    note         TEXT CHECK (note IS NULL OR char_length(note) <= 500),
    CONSTRAINT billing_period_ok CHECK (period_end > period_start),
    CONSTRAINT billing_paid_consistent CHECK ((status = 'paid') = (paid_at IS NOT NULL)),
    UNIQUE (number),
    UNIQUE (account_id, period_start)      -- bir davr uchun ikkita hisob-faktura bo'lmaydi (idempotent)
);
CREATE INDEX billing_invoices_account_idx ON billing_invoices (account_id, period_start DESC);
CREATE INDEX billing_invoices_open_idx ON billing_invoices (due_at) WHERE status = 'open';

-- ── Obunaga so'rov (dasturchi yuboradi, staff ko'radi) ───────────────
CREATE TABLE dev_subscription_requests (
    id         BIGSERIAL PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES dev_accounts(id) ON DELETE CASCADE,
    note       TEXT CHECK (note IS NULL OR char_length(note) <= 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    handled_at TIMESTAMPTZ
);
CREATE INDEX dev_subscription_requests_open_idx ON dev_subscription_requests (created_at) WHERE handled_at IS NULL;

-- ── Audit jurnal (faqat qo'shiladi) ──────────────────────────────────
CREATE TABLE dev_audit_log (
    id      BIGSERIAL PRIMARY KEY,
    at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor   TEXT NOT NULL CHECK (char_length(actor) <= 80),     -- account id yoki 'staff'
    action  TEXT NOT NULL CHECK (char_length(action) <= 60),
    target  TEXT CHECK (target IS NULL OR char_length(target) <= 80),
    ip_hash TEXT,
    detail  JSONB
);
CREATE INDEX dev_audit_log_actor_idx ON dev_audit_log (actor, at DESC);

-- ═══════════════════════════════════════════════════════════════════
-- GRANTLAR
-- ═══════════════════════════════════════════════════════════════════

-- 0002 dagi ALTER DEFAULT PRIVILEGES yangi jadvalga `ondexmap_app` ga avtomatik SELECT bergan:
-- bu jadvallar (kalit xeshlari, email, sessiya!) ommaviy API'ga KO'RINMASLIGI shart.
REVOKE ALL ON dev_accounts, dev_otps, dev_sessions, api_keys, api_usage_daily,
              billing_invoices, dev_subscription_requests, dev_audit_log FROM ondexmap_app, ondexmap_submit;
REVOKE ALL ON SEQUENCE billing_invoice_seq FROM ondexmap_app, ondexmap_submit;

-- ondexmap_meter (cmd/api): o'qish + hisoblagichga yozish.
GRANT SELECT ON dev_accounts, api_keys, billing_invoices, api_usage_daily TO ondexmap_meter;
GRANT INSERT ON api_usage_daily TO ondexmap_meter;
GRANT UPDATE (requests, errors) ON api_usage_daily TO ondexmap_meter;
GRANT UPDATE (last_used_at) ON api_keys TO ondexmap_meter;

-- ondexmap_console (cmd/console): boshqaradi, lekin pul/huquq ustunlariga TEGOLMAYDI.
GRANT SELECT ON dev_accounts, api_keys, api_usage_daily, billing_invoices,
                dev_subscription_requests, dev_audit_log TO ondexmap_console;
GRANT INSERT (email) ON dev_accounts TO ondexmap_console;
GRANT UPDATE (name, last_login_at) ON dev_accounts TO ondexmap_console;   -- subscription / is_ecosystem / status YO'Q

GRANT SELECT, INSERT, DELETE ON dev_otps TO ondexmap_console;
GRANT UPDATE (attempts, consumed_at) ON dev_otps TO ondexmap_console;
GRANT USAGE ON SEQUENCE dev_otps_id_seq TO ondexmap_console;

GRANT SELECT, INSERT, DELETE ON dev_sessions TO ondexmap_console;
GRANT UPDATE (last_seen_at) ON dev_sessions TO ondexmap_console;

GRANT INSERT (account_id, name, kind, prefix, key_hash, apis, origins, ips, expires_at) ON api_keys TO ondexmap_console;
-- kind / prefix / key_hash O'ZGARMAYDI (kalit almashtirish = yangi kalit yaratish).
GRANT UPDATE (name, apis, origins, ips, status, expires_at, revoked_at) ON api_keys TO ondexmap_console;

GRANT INSERT (account_id, note) ON dev_subscription_requests TO ondexmap_console;
GRANT USAGE ON SEQUENCE dev_subscription_requests_id_seq TO ondexmap_console;

GRANT INSERT ON dev_audit_log TO ondexmap_console;
GRANT USAGE ON SEQUENCE dev_audit_log_id_seq TO ondexmap_console;

INSERT INTO schema_migrations (version) VALUES ('0012_developer_platform')
    ON CONFLICT (version) DO NOTHING;

COMMIT;
