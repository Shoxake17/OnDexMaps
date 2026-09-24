package devplatform

import (
	"context"
	"errors"
	"net/netip"
	"time"

	"github.com/jackc/pgx/v5"

	"ondexmap/internal/storage"
)

// PGStore — Store'ning PostgreSQL amalga oshirishi. `ondexmap_meter` roli bilan ochilgan hovuz beriladi:
// u kalit/hisobni faqat O'QIYDI va faqat api_usage_daily (+ kalitning last_used_at) ga YOZADI.
type PGStore struct{ pool *storage.Pool }

// NewPGStore — pool `storage.OpenMeter` dan.
func NewPGStore(pool *storage.Pool) *PGStore { return &PGStore{pool: pool} }

const dbTimeout = 3 * time.Second

// LookupKey — kalit + hisob holati + "muddati o'tgan qarz" belgisi BITTA so'rovda.
func (s *PGStore) LookupKey(ctx context.Context, hash []byte) (*KeyRecord, error) {
	ctx, cancel := context.WithTimeout(ctx, dbTimeout)
	defer cancel()
	const q = `
SELECT k.id, k.account_id, k.kind, k.prefix, k.apis, k.origins, k.ips::text[],
       k.status = 'revoked', k.expires_at,
       a.status = 'suspended', a.subscription, a.is_ecosystem,
       EXISTS (SELECT 1 FROM billing_invoices i
               WHERE i.account_id = a.id AND i.status = 'open'
                 AND i.due_at < now() - make_interval(secs => $2)) AS overdue
FROM api_keys k
JOIN dev_accounts a ON a.id = k.account_id
WHERE k.key_hash = $1`
	var (
		r   KeyRecord
		ips []string
	)
	err := s.pool.QueryRow(ctx, q, hash, OverdueGrace.Seconds()).Scan(
		&r.ID, &r.AccountID, &r.Kind, &r.Prefix, &r.APIs, &r.Origins, &ips,
		&r.Revoked, &r.ExpiresAt,
		&r.Account.Suspended, &r.Account.Subscription, &r.Account.Ecosystem, &r.Account.Overdue)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	r.Account.ID = r.AccountID
	for _, s := range ips {
		p, err := netip.ParsePrefix(s)
		if err != nil {
			return nil, err // buzuq IP yozuvi: kalit ishlatilmaydi (fail-closed), xato ko'rinadi
		}
		r.IPs = append(r.IPs, p)
	}
	return &r, nil
}

// MonthUsage — hisobning (barcha kalitlari) oy boshidan beri hisoblangan so'rovlari.
func (s *PGStore) MonthUsage(ctx context.Context, accountID string, monthStart time.Time) (int64, error) {
	ctx, cancel := context.WithTimeout(ctx, dbTimeout)
	defer cancel()
	var n int64
	err := s.pool.QueryRow(ctx, `
SELECT COALESCE(SUM(u.requests), 0)::bigint
FROM api_usage_daily u JOIN api_keys k ON k.id = u.key_id
WHERE k.account_id = $1 AND u.day >= $2::date`, accountID, monthStart).Scan(&n)
	return n, err
}

// WriteUsage — ortirmalarni bitta paketda qo'shadi.
func (s *PGStore) WriteUsage(ctx context.Context, rows []UsageRow) error {
	if len(rows) == 0 {
		return nil
	}
	keys := make([]string, len(rows))
	days := make([]time.Time, len(rows))
	apis := make([]string, len(rows))
	reqs := make([]int64, len(rows))
	errs := make([]int64, len(rows))
	for i, r := range rows {
		keys[i], days[i], apis[i], reqs[i], errs[i] = r.KeyID, r.Day, r.API, r.Requests, r.Errors
	}
	_, err := s.pool.Exec(ctx, `
INSERT INTO api_usage_daily (key_id, day, api, requests, errors)
SELECT * FROM unnest($1::text[], $2::date[], $3::text[], $4::bigint[], $5::bigint[])
ON CONFLICT (key_id, day, api) DO UPDATE SET
    requests = api_usage_daily.requests + EXCLUDED.requests,
    errors   = api_usage_daily.errors   + EXCLUDED.errors`, keys, days, apis, reqs, errs)
	return err
}

// TouchKeys — oxirgi ishlatilgan vaqt (ko'pi bilan daqiqada bir marta: bekorga yozuv yo'q).
func (s *PGStore) TouchKeys(ctx context.Context, ids []string, at time.Time) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := s.pool.Exec(ctx, `
UPDATE api_keys SET last_used_at = $2
WHERE id = ANY($1::text[]) AND (last_used_at IS NULL OR last_used_at < $2 - interval '1 minute')`, ids, at)
	return err
}
