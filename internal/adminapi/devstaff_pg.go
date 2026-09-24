package adminapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"ondexmap/internal/devplatform"
	"ondexmap/internal/storage"
)

// devStaffPG — DevStaffStore'ning baza EGASI hovuzi ustidagi amalga oshirishi.
type devStaffPG struct{ db *storage.Pool }

func newDevStaffPG(db *storage.Pool) *devStaffPG { return &devStaffPG{db: db} }

const staffTimeout = 8 * time.Second

func sctx(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, staffTimeout)
}

// likeEscape — ILIKE maxsus belgilarini oddiy belgiga aylantiradi.
func likeEscape(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

func (p *devStaffPG) ListAccounts(ctx context.Context, q string, limit int) ([]StaffAccount, error) {
	ctx, cancel := sctx(ctx)
	defer cancel()
	rows, err := p.db.Query(ctx, `
SELECT a.id, a.email, COALESCE(a.name,''), a.status, a.subscription, a.subscription_since, a.is_ecosystem,
       a.created_at, a.last_login_at,
       (SELECT count(*) FROM api_keys k WHERE k.account_id = a.id AND k.status = 'active')::int,
       COALESCE((SELECT sum(u.requests) FROM api_usage_daily u JOIN api_keys k ON k.id = u.key_id
                 WHERE k.account_id = a.id
                   AND u.day >= date_trunc('month', now() AT TIME ZONE 'UTC')::date), 0)::bigint
FROM dev_accounts a
WHERE $1 = '' OR a.email ILIKE '%' || $1 || '%'
ORDER BY a.created_at DESC LIMIT $2`, likeEscape(q), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []StaffAccount{}
	for rows.Next() {
		var a StaffAccount
		if err := rows.Scan(&a.ID, &a.Email, &a.Name, &a.Status, &a.Subscription, &a.SubscriptionSince,
			&a.Ecosystem, &a.CreatedAt, &a.LastLoginAt, &a.ActiveKeys, &a.MonthRequests); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// SetSubscription — obuna flagi. Yoqilganda birinchi hisob-faktura darhol chiqariladi;
// o'chirilganda to'lanmagan (open) hisob-fakturalar bekor qilinadi (void).
func (p *devStaffPG) SetSubscription(ctx context.Context, id string, on bool, now time.Time) error {
	ctx, cancel := sctx(ctx)
	defer cancel()
	tx, err := p.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var cur bool
	if err := tx.QueryRow(ctx, `SELECT subscription FROM dev_accounts WHERE id = $1 FOR UPDATE`, id).Scan(&cur); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrStaffNotFound
		}
		return err
	}
	if cur != on {
		if _, err := tx.Exec(ctx, `
UPDATE dev_accounts SET subscription = $2,
       subscription_since = CASE WHEN $2 THEN $3::timestamptz ELSE subscription_since END
WHERE id = $1`, id, on, now); err != nil {
			return err
		}
		if !on {
			if _, err := tx.Exec(ctx, `
UPDATE billing_invoices SET status = 'void', note = 'obuna o''chirildi'
WHERE account_id = $1 AND status = 'open'`, id); err != nil {
				return err
			}
		}
	}
	if on {
		if _, err := issueSQL(ctx, tx, now, id); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (p *devStaffPG) SetEcosystem(ctx context.Context, id string, on bool) error {
	return p.update(ctx, `UPDATE dev_accounts SET is_ecosystem = $2 WHERE id = $1`, id, on)
}

func (p *devStaffPG) SetSuspended(ctx context.Context, id string, suspended bool) error {
	status := "active"
	if suspended {
		status = "suspended"
	}
	return p.update(ctx, `UPDATE dev_accounts SET status = $2 WHERE id = $1`, id, status)
}

func (p *devStaffPG) update(ctx context.Context, sql string, args ...any) error {
	ctx, cancel := sctx(ctx)
	defer cancel()
	tag, err := p.db.Exec(ctx, sql, args...)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrStaffNotFound
	}
	return nil
}

func (p *devStaffPG) OpenRequests(ctx context.Context) ([]StaffRequest, error) {
	ctx, cancel := sctx(ctx)
	defer cancel()
	rows, err := p.db.Query(ctx, `
SELECT r.id, r.account_id, a.email, COALESCE(r.note,''), r.created_at
FROM dev_subscription_requests r JOIN dev_accounts a ON a.id = r.account_id
WHERE r.handled_at IS NULL ORDER BY r.created_at LIMIT 200`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []StaffRequest{}
	for rows.Next() {
		var r StaffRequest
		if err := rows.Scan(&r.ID, &r.AccountID, &r.Email, &r.Note, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (p *devStaffPG) HandleRequest(ctx context.Context, id int64, now time.Time) error {
	return p.update(ctx, `UPDATE dev_subscription_requests SET handled_at = $2 WHERE id = $1 AND handled_at IS NULL`, id, now)
}

func (p *devStaffPG) ListInvoices(ctx context.Context, status string, limit int) ([]StaffInvoice, error) {
	ctx, cancel := sctx(ctx)
	defer cancel()
	rows, err := p.db.Query(ctx, `
SELECT i.id, i.number, i.account_id, a.email, i.period_start::text, i.period_end::text, i.amount_uzs,
       i.status, i.due_at, i.paid_at, COALESCE(i.payment_ref,'')
FROM billing_invoices i JOIN dev_accounts a ON a.id = i.account_id
WHERE $1 = '' OR i.status = $1
ORDER BY i.issued_at DESC LIMIT $2`, status, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []StaffInvoice{}
	for rows.Next() {
		var v StaffInvoice
		if err := rows.Scan(&v.ID, &v.Number, &v.AccountID, &v.Email, &v.PeriodStart, &v.PeriodEnd,
			&v.AmountUZS, &v.Status, &v.DueAt, &v.PaidAt, &v.PaymentRef); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (p *devStaffPG) MarkPaid(ctx context.Context, invoiceID, ref string, now time.Time) error {
	return p.update(ctx, `
UPDATE billing_invoices SET status = 'paid', paid_at = $3, confirmed_by = 'staff', payment_ref = NULLIF($2,'')
WHERE id = $1 AND status = 'open'`, invoiceID, ref, now)
}

func (p *devStaffPG) VoidInvoice(ctx context.Context, invoiceID, note string) error {
	return p.update(ctx, `
UPDATE billing_invoices SET status = 'void', note = NULLIF($2,'') WHERE id = $1 AND status = 'open'`, invoiceID, note)
}

func (p *devStaffPG) RevokeKey(ctx context.Context, keyID string, now time.Time) error {
	return p.update(ctx, `UPDATE api_keys SET status = 'revoked', revoked_at = $2 WHERE id = $1 AND status = 'active'`, keyID, now)
}

// issuer — Pool va Tx uchun umumiy.
type issuer interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// IssueDueInvoices — muddati kelgan obunalar uchun hisob-faktura.
func (p *devStaffPG) IssueDueInvoices(ctx context.Context, now time.Time) (int, error) {
	ctx, cancel := sctx(ctx)
	defer cancel()
	return issueSQL(ctx, p.db, now, "")
}

// Audit — staff amali jurnali (yozilmasa amal bekor qilinmaydi, lekin log'da ko'rinadi).
func (p *devStaffPG) Audit(ctx context.Context, action, target string, detail map[string]any) {
	ctx, cancel := sctx(ctx)
	defer cancel()
	var d any
	if detail != nil {
		if b, err := json.Marshal(detail); err == nil {
			d = string(b)
		}
	}
	if _, err := p.db.Exec(ctx, `
INSERT INTO dev_audit_log (actor, action, target, detail) VALUES ('staff', $1, NULLIF($2,''), $3::jsonb)`,
		action, target, d); err != nil {
		slog.Error("staff audit yozilmadi", "action", action, "err", err)
	}
}

// issueSQL — obuna hisob-fakturalari (idempotent: UNIQUE(account_id, period_start)).
//
// Davr obuna boshlangan sanaga BOG'LANGAN (oy oxiriga emas): 28-kuni yoqilgan hisob 3 kunlik
// davr uchun to'liq narx to'lamaydi. Har hisobga bir chaqiruvda ko'pi bilan BITTA hisob-faktura
// (uzoq to'xtab qolgan ish "ommaviy qarz" yaratmaydi); ochiq (to'lanmagan) 2 ta bo'lsa yangisi
// chiqarilmaydi — qarz cheksiz to'planmaydi. Ekotizim hisoblari hisob-faktura olmaydi.
func issueSQL(ctx context.Context, db issuer, now time.Time, accountID string) (int, error) {
	tag, err := db.Exec(ctx, `
WITH nxt AS (
  SELECT a.id AS account_id,
         GREATEST(COALESCE((SELECT max(i.period_end) FROM billing_invoices i WHERE i.account_id = a.id),
                           a.subscription_since::date),
                  a.subscription_since::date) AS start
  FROM dev_accounts a
  WHERE a.subscription AND NOT a.is_ecosystem AND a.subscription_since IS NOT NULL
    AND ($3 = '' OR a.id = $3)
    AND (SELECT count(*) FROM billing_invoices i WHERE i.account_id = a.id AND i.status = 'open') < 2
)
INSERT INTO billing_invoices (account_id, period_start, period_end, amount_uzs, due_at)
SELECT account_id, start, (start + interval '1 month')::date, $1, $2::timestamptz + interval '7 days'
FROM nxt
WHERE start <= ($2::timestamptz AT TIME ZONE 'UTC')::date
ON CONFLICT (account_id, period_start) DO NOTHING`,
		devplatform.SubscriptionPriceUZS, now, accountID)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
}
