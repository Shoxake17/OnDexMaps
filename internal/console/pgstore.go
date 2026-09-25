package console

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"ondexmap/internal/devplatform"
	"ondexmap/internal/storage"
)

// PGStore — Store'ning PostgreSQL amalga oshirishi (`ondexmap_console` roli).
// Barcha so'rovlar parametrli; ustun grantlari migrations/0012 da.
type PGStore struct{ pool *storage.Pool }

// NewPGStore — pool `storage.OpenConsole` dan.
func NewPGStore(pool *storage.Pool) *PGStore { return &PGStore{pool: pool} }

const dbTimeout = 5 * time.Second

func tctx(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, dbTimeout)
}

// isUnique — UNIQUE buzilishi (23505).
func isUnique(err error) bool {
	var pe *pgconn.PgError
	return errors.As(err, &pe) && pe.Code == "23505"
}

const accountCols = `a.id, a.email, COALESCE(a.name,''), a.status = 'suspended', a.subscription, a.is_ecosystem,
       a.subscription_since, a.created_at,
       EXISTS (SELECT 1 FROM billing_invoices i WHERE i.account_id = a.id AND i.status = 'open'
               AND i.due_at < now() - make_interval(secs => $2))`

func (s *PGStore) scanAccount(row pgx.Row) (*Account, error) {
	var a Account
	err := row.Scan(&a.ID, &a.Email, &a.Name, &a.Suspended, &a.Subscription, &a.Ecosystem,
		&a.SubscriptionSince, &a.CreatedAt, &a.Overdue)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &a, err
}

func (s *PGStore) AccountByEmail(ctx context.Context, email string) (*Account, error) {
	ctx, cancel := tctx(ctx)
	defer cancel()
	return s.scanAccount(s.pool.QueryRow(ctx,
		`SELECT `+accountCols+` FROM dev_accounts a WHERE a.email = $1`, email, devplatform.OverdueGrace.Seconds()))
}

func (s *PGStore) AccountByID(ctx context.Context, id string) (*Account, error) {
	ctx, cancel := tctx(ctx)
	defer cancel()
	return s.scanAccount(s.pool.QueryRow(ctx,
		`SELECT `+accountCols+` FROM dev_accounts a WHERE a.id = $1`, id, devplatform.OverdueGrace.Seconds()))
}

func (s *PGStore) CreateAccount(ctx context.Context, email string) (*Account, error) {
	ctx, cancel := tctx(ctx)
	defer cancel()
	if _, err := s.pool.Exec(ctx,
		`INSERT INTO dev_accounts (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`, email); err != nil {
		return nil, err
	}
	return s.AccountByEmail(ctx, email)
}

func (s *PGStore) UpdateName(ctx context.Context, id, name string) error {
	ctx, cancel := tctx(ctx)
	defer cancel()
	_, err := s.pool.Exec(ctx, `UPDATE dev_accounts SET name = NULLIF($2,'') WHERE id = $1`, id, name)
	return err
}

func (s *PGStore) TouchLogin(ctx context.Context, id string, at time.Time) error {
	ctx, cancel := tctx(ctx)
	defer cancel()
	_, err := s.pool.Exec(ctx, `UPDATE dev_accounts SET last_login_at = $2 WHERE id = $1`, id, at)
	return err
}

// ── OTP ──

func (s *PGStore) CreateOTP(ctx context.Context, email string, hash []byte, expires time.Time) error {
	ctx, cancel := tctx(ctx)
	defer cancel()
	_, err := s.pool.Exec(ctx,
		`INSERT INTO dev_otps (email, code_hash, expires_at) VALUES ($1, $2, $3)`, email, hash, expires)
	return err
}

func (s *PGStore) LatestOTP(ctx context.Context, email string) (*OTP, error) {
	ctx, cancel := tctx(ctx)
	defer cancel()
	var o OTP
	err := s.pool.QueryRow(ctx, `
SELECT id, code_hash, expires_at, attempts, consumed_at IS NOT NULL, created_at
FROM dev_otps WHERE email = $1 ORDER BY created_at DESC, id DESC LIMIT 1`, email).
		Scan(&o.ID, &o.CodeHash, &o.ExpiresAt, &o.Attempts, &o.Consumed, &o.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &o, err
}

func (s *PGStore) CountOTPsSince(ctx context.Context, email string, since time.Time) (int, error) {
	ctx, cancel := tctx(ctx)
	defer cancel()
	var n int
	err := s.pool.QueryRow(ctx,
		`SELECT count(*) FROM dev_otps WHERE email = $1 AND created_at >= $2`, email, since).Scan(&n)
	return n, err
}

func (s *PGStore) BumpOTPAttempts(ctx context.Context, id int64) error {
	ctx, cancel := tctx(ctx)
	defer cancel()
	_, err := s.pool.Exec(ctx, `UPDATE dev_otps SET attempts = attempts + 1 WHERE id = $1`, id)
	return err
}

func (s *PGStore) ConsumeOTP(ctx context.Context, id int64, at time.Time) (bool, error) {
	ctx, cancel := tctx(ctx)
	defer cancel()
	tag, err := s.pool.Exec(ctx,
		`UPDATE dev_otps SET consumed_at = $2 WHERE id = $1 AND consumed_at IS NULL`, id, at)
	return tag.RowsAffected() == 1, err
}

// ── Sessiyalar ──

func (s *PGStore) CreateSession(ctx context.Context, tokenHash []byte, accountID, csrf string, expires time.Time, ipHash, ua string) error {
	ctx, cancel := tctx(ctx)
	defer cancel()
	_, err := s.pool.Exec(ctx, `
INSERT INTO dev_sessions (token_hash, account_id, csrf_token, expires_at, ip_hash, user_agent)
VALUES ($1, $2, $3, $4, NULLIF($5,''), NULLIF($6,''))`, tokenHash, accountID, csrf, expires, ipHash, ua)
	return err
}

func (s *PGStore) SessionByHash(ctx context.Context, tokenHash []byte) (*Session, error) {
	ctx, cancel := tctx(ctx)
	defer cancel()
	var x Session
	err := s.pool.QueryRow(ctx, `
SELECT account_id, csrf_token, created_at, expires_at, last_seen_at FROM dev_sessions WHERE token_hash = $1`, tokenHash).
		Scan(&x.AccountID, &x.CSRF, &x.CreatedAt, &x.ExpiresAt, &x.LastSeen)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &x, err
}

func (s *PGStore) TouchSession(ctx context.Context, tokenHash []byte, at time.Time) error {
	ctx, cancel := tctx(ctx)
	defer cancel()
	_, err := s.pool.Exec(ctx, `UPDATE dev_sessions SET last_seen_at = $2 WHERE token_hash = $1`, tokenHash, at)
	return err
}

func (s *PGStore) DeleteSession(ctx context.Context, tokenHash []byte) error {
	ctx, cancel := tctx(ctx)
	defer cancel()
	_, err := s.pool.Exec(ctx, `DELETE FROM dev_sessions WHERE token_hash = $1`, tokenHash)
	return err
}

// ── Kalitlar ──

const keyCols = `id, name, kind, prefix, apis, origins, ips::text[], status, expires_at, created_at, last_used_at`

func scanKey(row pgx.Row) (*Key, error) {
	var k Key
	err := row.Scan(&k.ID, &k.Name, &k.Kind, &k.Prefix, &k.APIs, &k.Origins, &k.IPs,
		&k.Status, &k.ExpiresAt, &k.CreatedAt, &k.LastUsedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &k, err
}

func (s *PGStore) CountActiveKeys(ctx context.Context, accountID string) (int, error) {
	ctx, cancel := tctx(ctx)
	defer cancel()
	var n int
	err := s.pool.QueryRow(ctx,
		`SELECT count(*) FROM api_keys WHERE account_id = $1 AND status = 'active'`, accountID).Scan(&n)
	return n, err
}

func (s *PGStore) ListKeys(ctx context.Context, accountID string) ([]Key, error) {
	ctx, cancel := tctx(ctx)
	defer cancel()
	rows, err := s.pool.Query(ctx,
		`SELECT `+keyCols+` FROM api_keys WHERE account_id = $1 ORDER BY created_at DESC LIMIT 200`, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Key{}
	for rows.Next() {
		k, err := scanKey(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *k)
	}
	return out, rows.Err()
}

func (s *PGStore) KeyByID(ctx context.Context, accountID, id string) (*Key, error) {
	ctx, cancel := tctx(ctx)
	defer cancel()
	return scanKey(s.pool.QueryRow(ctx,
		`SELECT `+keyCols+` FROM api_keys WHERE account_id = $1 AND id = $2`, accountID, id))
}

const insertKeySQL = `
INSERT INTO api_keys (account_id, name, kind, prefix, key_hash, apis, origins, ips, expires_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[]::cidr[], $9)
RETURNING ` + keyCols

func keyArgs(k NewKey) []any {
	return []any{k.AccountID, k.Name, k.Kind, k.Prefix, k.Hash, k.APIs, nonNil(k.Origins), nonNil(k.IPs), k.ExpiresAt}
}

// nonNil — pgx nil kesimni NULL deb yuboradi; ustunlar NOT NULL.
func nonNil(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

func (s *PGStore) CreateKey(ctx context.Context, k NewKey) (*Key, error) {
	ctx, cancel := tctx(ctx)
	defer cancel()
	out, err := scanKey(s.pool.QueryRow(ctx, insertKeySQL, keyArgs(k)...))
	if isUnique(err) {
		return nil, ErrConflict
	}
	return out, err
}

func (s *PGStore) UpdateKey(ctx context.Context, accountID, id string, e KeyEdit) error {
	ctx, cancel := tctx(ctx)
	defer cancel()
	tag, err := s.pool.Exec(ctx, `
UPDATE api_keys SET name = $3, apis = $4, origins = $5, ips = $6::text[]::cidr[]
WHERE account_id = $1 AND id = $2 AND status = 'active'`,
		accountID, id, e.Name, e.APIs, nonNil(e.Origins), nonNil(e.IPs))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *PGStore) RevokeKey(ctx context.Context, accountID, id string, at time.Time) error {
	ctx, cancel := tctx(ctx)
	defer cancel()
	tag, err := s.pool.Exec(ctx, `
UPDATE api_keys SET status = 'revoked', revoked_at = $3 WHERE account_id = $1 AND id = $2 AND status = 'active'`,
		accountID, id, at)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *PGStore) RotateKey(ctx context.Context, accountID, oldID string, k NewKey, oldExpires time.Time) (*Key, error) {
	ctx, cancel := tctx(ctx)
	defer cancel()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(ctx, `
UPDATE api_keys SET expires_at = LEAST(COALESCE(expires_at, $3), $3)
WHERE account_id = $1 AND id = $2 AND status = 'active'`, accountID, oldID, oldExpires)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	out, err := scanKey(tx.QueryRow(ctx, insertKeySQL, keyArgs(k)...))
	if isUnique(err) {
		return nil, ErrConflict
	}
	if err != nil {
		return nil, err
	}
	return out, tx.Commit(ctx)
}

// ── Foydalanish va hisob-faktura ──

func (s *PGStore) UsageDaily(ctx context.Context, accountID string, from, to time.Time) ([]UsageDay, error) {
	ctx, cancel := tctx(ctx)
	defer cancel()
	rows, err := s.pool.Query(ctx, `
SELECT u.day, u.key_id, u.api, u.requests, u.errors
FROM api_usage_daily u JOIN api_keys k ON k.id = u.key_id
WHERE k.account_id = $1 AND u.day >= $2::date AND u.day <= $3::date
ORDER BY u.day, u.key_id, u.api LIMIT 20000`, accountID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []UsageDay{}
	for rows.Next() {
		var u UsageDay
		if err := rows.Scan(&u.Day, &u.KeyID, &u.API, &u.Requests, &u.Errors); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (s *PGStore) Invoices(ctx context.Context, accountID string) ([]Invoice, error) {
	ctx, cancel := tctx(ctx)
	defer cancel()
	rows, err := s.pool.Query(ctx, `
SELECT id, number, period_start, period_end, amount_uzs, status, issued_at, due_at, paid_at
FROM billing_invoices WHERE account_id = $1 ORDER BY period_start DESC LIMIT 60`, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Invoice{}
	for rows.Next() {
		var i Invoice
		if err := rows.Scan(&i.ID, &i.Number, &i.PeriodStart, &i.PeriodEnd, &i.AmountUZS,
			&i.Status, &i.IssuedAt, &i.DueAt, &i.PaidAt); err != nil {
			return nil, err
		}
		out = append(out, i)
	}
	return out, rows.Err()
}

func (s *PGStore) HasOpenSubscriptionRequest(ctx context.Context, accountID string) (bool, error) {
	ctx, cancel := tctx(ctx)
	defer cancel()
	var ok bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM dev_subscription_requests WHERE account_id = $1 AND handled_at IS NULL)`,
		accountID).Scan(&ok)
	return ok, err
}

func (s *PGStore) CreateSubscriptionRequest(ctx context.Context, accountID, note string) error {
	ctx, cancel := tctx(ctx)
	defer cancel()
	_, err := s.pool.Exec(ctx,
		`INSERT INTO dev_subscription_requests (account_id, note) VALUES ($1, NULLIF($2,''))`, accountID, note)
	return err
}

// ── Audit va tozalash ──

func (s *PGStore) Audit(ctx context.Context, actor, action, target, ipHash string, detail map[string]any) error {
	ctx, cancel := tctx(ctx)
	defer cancel()
	var d any
	if detail != nil {
		b, err := json.Marshal(detail)
		if err != nil {
			return err
		}
		d = string(b)
	}
	_, err := s.pool.Exec(ctx, `
INSERT INTO dev_audit_log (actor, action, target, ip_hash, detail)
VALUES ($1, $2, NULLIF($3,''), NULLIF($4,''), $5::jsonb)`, actor, action, target, ipHash, d)
	return err
}

// PurgeExpired — muddati o'tgan sessiya va kodlarni o'chiradi (soatlik ish, cmd/console).
//
// ⚠️ `$1::timestamptz` — CAST SHART. Usiz `$1 - interval '7 days'` da Postgres
// parametr turini `interval` deb taxmin qiladi va butun so'rov
// "operator does not exist: timestamp with time zone < interval" bilan yiqiladi
// (2026-09-25 lokal sinovda aynan shu chiqdi; `devplatform.TouchKeys` da ham
// xuddi shu xato bo'lgan). Bu jimgina yuz beradi: xato faqat WARN bo'lib logga
// tushadi, tozalash esa hech qachon ishlamaydi va jadvallar shishib boraveradi.
func (s *PGStore) PurgeExpired(ctx context.Context, now time.Time) error {
	ctx, cancel := tctx(ctx)
	defer cancel()
	if _, err := s.pool.Exec(ctx, `
DELETE FROM dev_sessions
WHERE expires_at < $1::timestamptz OR last_seen_at < $1::timestamptz - interval '7 days'`, now); err != nil {
		return err
	}
	_, err := s.pool.Exec(ctx,
		`DELETE FROM dev_otps WHERE expires_at < $1::timestamptz - interval '1 day'`, now)
	return err
}
