package storage

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"time"

	"ondexmap/internal/places"
)

// ═══════════════════════════════════════════════════════════════════
// KARANTINGA YOZUVCHI
//
// Ommaviy API'ning YAGONA yozish yo'li. Ataylab `*Pool` EMAS, alohida tor
// tur: uni ushlab turgan kod (HTTP ishlovchilari) faqat quyidagi uch
// amalni chaqira oladi — o'zboshimchalik bilan SQL yubora olmaydi.
//
// Bazadagi `ondexmap_submit` roli ham xuddi shuni majburlaydi
// (`migrations/0007_places.sql`): faqat `place_submissions` va
// `place_submission_photos` ga INSERT, jonli `places` ga umuman tegolmaydi.
// Ya'ni kod ham, baza ham, ikkalasi ham mustaqil ravishda cheklaydi.
// ═══════════════════════════════════════════════════════════════════

// Submitter — karantinga yozuvchi ulanish.
type Submitter struct{ pool *Pool }

// OpenSubmitter — `SUBMIT_DATABASE_URL` (`ondexmap_submit` roli) bilan ulanadi.
// Hovuz ataylab KICHIK: ommaviy yozish yo'li bazani band qilib qo'ymasin.
func OpenSubmitter(ctx context.Context, dsn string) (*Submitter, error) {
	p, err := newPoolOpts(ctx, dsn, false, 3, "ondexmap-api-submit")
	if err != nil {
		return nil, err
	}
	return &Submitter{pool: p}, nil
}

// Close — hovuzni yopadi.
func (s *Submitter) Close() {
	if s != nil && s.pool != nil {
		s.pool.Close()
	}
}

// Submission — karantinga yoziladigan taklif. `Clean` allaqachon
// `places.Validate` dan, `Photos` esa `places.NormalizePhoto` dan o'tgan.
type Submission struct {
	places.Clean
	Photos [][]byte
	// Hint — yuboruvchining qo'pol belgisi (IP'ning HMAC'i). XOM IP emas.
	Hint string
}

// ErrQueueFull — moderatsiya navbati to'lgan.
var ErrQueueFull = errors.New("moderatsiya navbati to'lgan")

// Submit — taklifni karantinga yozadi (taklif + rasmlar BITTA tranzaksiyada:
// rasmlarsiz yarim taklif qolmaydi).
func (s *Submitter) Submit(ctx context.Context, in Submission) error {
	if in.Hint == "" || len(in.Photos) > places.MaxPhotos {
		return ErrInvalidInput
	}
	id, err := newUUID()
	if err != nil {
		return errQuery
	}

	ctx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return errQuery
	}
	defer tx.Rollback(ctx) //nolint:errcheck // Commit'dan keyin no-op

	const ins = `
INSERT INTO place_submissions
    (id, kind, name, category, description, phone, hours, street, house,
     geom, photo_count, submitter_hint)
VALUES ($1, $2, NULLIF($3,''), NULLIF($4,''), NULLIF($5,''), NULLIF($6,''),
        NULLIF($7,''), NULLIF($8,''), NULLIF($9,''),
        ST_SetSRID(ST_MakePoint($10, $11), 4326)::geography, $12, $13)`
	if _, err := tx.Exec(ctx, ins, id, in.Kind, in.Name, in.Category, in.Description,
		in.Phone, in.Hours, in.Street, in.House, in.Lng, in.Lat,
		len(in.Photos), in.Hint); err != nil {
		return errQuery
	}
	for i, data := range in.Photos {
		if _, err := tx.Exec(ctx,
			`INSERT INTO place_submission_photos (submission_id, pos, data) VALUES ($1, $2, $3)`,
			id, i, data); err != nil {
			return errQuery
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return errQuery
	}
	return nil
}

// RecentCount — shu yuboruvchidan oxirgi soatdagi takliflar soni.
//
// Xotiradagi rate limit'ga QO'SHIMCHA qatlam: u server qayta ishga tushganda
// nolga qaytadi, bu esa BAZADA — spam yuboruvchi qayta ishga tushishni
// kutib o'tira olmaydi.
func (s *Submitter) RecentCount(ctx context.Context, hint string) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()
	var n int
	if err := s.pool.QueryRow(ctx, `
SELECT count(*) FROM place_submissions
WHERE submitter_hint = $1 AND created_at > now() - interval '1 hour'`, hint).Scan(&n); err != nil {
		return 0, errQuery
	}
	return n, nil
}

// PendingTotal — tekshirilmagan takliflarning umumiy soni. Navbat
// chegaradan oshsa yangi taklif qabul qilinmaydi: moderatsiya ulgurmasa,
// bazani cheksiz to'ldirib bo'lmasin.
func (s *Submitter) PendingTotal(ctx context.Context) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()
	var n int
	if err := s.pool.QueryRow(ctx,
		`SELECT count(*) FROM place_submissions WHERE status = 'pending'`).Scan(&n); err != nil {
		return 0, errQuery
	}
	return n, nil
}

// newUUID — tasodifiy UUID v4 (kriptografik manbadan). Tashqi kutubxonasiz:
// loyiha bog'liqliklarni minimal saqlaydi.
func newUUID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	b[6] = b[6]&0x0f | 0x40 // versiya 4
	b[8] = b[8]&0x3f | 0x80 // variant
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:]), nil
}
