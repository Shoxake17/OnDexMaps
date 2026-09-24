// Migratsiya vositasi — `migrations/*.sql` fayllarini tartib bilan
// qo'llaydi.
//
// XAVFSIZLIK: bu vosita BAZA EGASI huquqi bilan ishlaydi, ya'ni u
// `DROP TABLE` qila oladi. Shuning uchun u ATAYLAB alohida binar:
// HTTP serveri uni hech qachon chaqirmaydi va egaviy ulanish
// internetga qaragan jarayonga umuman kirmaydi.
//
// Ishga tushirish:
//
//	go run ./cmd/migrate            # kutilayotganlarni qo'llaydi
//	go run ./cmd/migrate -status    # faqat holatni ko'rsatadi
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"ondexmap/internal/config"
	"ondexmap/internal/storage"
)

// appPasswordPattern — `:app_password` o'rniga qo'yiladigan qiymat
// uchun QAT'IY ruxsat ro'yxati.
//
// NEGA KERAK: `ALTER ROLE ... WITH PASSWORD` — DDL, va PostgreSQL
// DDL'da bog'lanuvchi parametr ($1) QO'LLAB-QUVVATLANMAYDI. Ya'ni
// qiymatni SQL matniga qo'yishdan boshqa yo'l yo'q.
//
// Shuning uchun ikki qatlamli himoya:
//  1. qiymat faqat shu belgilardan iborat bo'lishi SHART;
//  2. undan keyin ham SQL literali sifatida to'g'ri qo'shtirnoqlanadi.
//
// Apostrof bu ro'yxatda YO'Q — ya'ni SQL'dan chiqib ketish uchun
// kerak bo'lgan belgi umuman o'tmaydi.
var appPasswordPattern = regexp.MustCompile(`^[A-Za-z0-9+/=_.-]{16,128}$`)

func main() {
	statusOnly := flag.Bool("status", false, "faqat holatni ko'rsatish, o'zgartirmaslik")
	dir := flag.String("dir", "migrations", "migratsiya fayllari papkasi")
	flag.Parse()

	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, nil)))

	cfg, err := config.Load(".env")
	if err != nil {
		slog.Error("sozlama xatosi", "err", err)
		os.Exit(1)
	}

	// DIQQAT: ATAYLAB `DatabaseURLMigrate`. `DatabaseURL` (ilova roli)
	// bilan migratsiya ishlamaydi va ishlamasligi KERAK.
	dsn := cfg.DatabaseURLMigrate
	if dsn == "" {
		slog.Error("DATABASE_URL_MIGRATE yo'q — migratsiya baza egasi huquqini talab qiladi")
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	pool, err := storage.ReadWrite(ctx, dsn)
	if err != nil {
		slog.Error("bazaga ulanib bo'lmadi", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	files, err := migrationFiles(*dir)
	if err != nil {
		slog.Error("migratsiya fayllarini o'qib bo'lmadi", "err", err)
		os.Exit(1)
	}

	applied, err := appliedVersions(ctx, pool)
	if err != nil {
		slog.Error("qo'llangan migratsiyalarni o'qib bo'lmadi", "err", err)
		os.Exit(1)
	}

	var pending []string
	for _, f := range files {
		if !applied[version(f)] {
			pending = append(pending, f)
		}
	}

	if *statusOnly {
		fmt.Printf("Jami: %d ta migratsiya, qo'llangan: %d, kutilmoqda: %d\n",
			len(files), len(applied), len(pending))
		for _, f := range files {
			mark := "  "
			if applied[version(f)] {
				mark = "OK"
			}
			fmt.Printf("  [%s] %s\n", mark, version(f))
		}
		return
	}

	if len(pending) == 0 {
		slog.Info("hamma migratsiya allaqachon qo'llangan")
		return
	}

	for _, f := range pending {
		if err := apply(ctx, pool, f); err != nil {
			slog.Error("migratsiya muvaffaqiyatsiz", "fayl", version(f), "err", err)
			os.Exit(1)
		}
		slog.Info("qo'llandi", "migratsiya", version(f))
	}
	slog.Info("tayyor", "qo'llangan", len(pending))
}

func migrationFiles(dir string) ([]string, error) {
	files, err := filepath.Glob(filepath.Join(dir, "*.sql"))
	if err != nil {
		return nil, err
	}
	// Nom bo'yicha tartib — shuning uchun fayllar `0001_`, `0002_`
	// kabi nolga to'ldirilgan raqam bilan boshlanishi SHART.
	sort.Strings(files)
	return files, nil
}

func version(path string) string {
	return strings.TrimSuffix(filepath.Base(path), ".sql")
}

func appliedVersions(ctx context.Context, pool *storage.Pool) (map[string]bool, error) {
	out := map[string]bool{}
	rows, err := pool.Query(ctx, `SELECT version FROM schema_migrations`)
	if err != nil {
		// Jadval hali yo'q — birinchi ishga tushirish. Bu xato emas.
		return out, nil
	}
	defer rows.Close()
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			return nil, err
		}
		out[v] = true
	}
	return out, rows.Err()
}

func apply(ctx context.Context, pool *storage.Pool, path string) error {
	raw, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	sql := string(raw)

	// `:app_password` / `:submit_password` o'rniga qiymat qo'yish — faqat shu
	// ikki o'zgaruvchi qo'llab-quvvatlanadi (yuqoridagi izohga qarang).
	for _, v := range []struct{ placeholder, env, role string }{
		{":app_password", "ONDEXMAP_APP_DB_PASSWORD", "ilova"},
		{":submit_password", "ONDEXMAP_SUBMIT_DB_PASSWORD", "yuboruvchi"},
		{":meter_password", "ONDEXMAP_METER_DB_PASSWORD", "hisoblovchi (meter)"},
		{":console_password", "ONDEXMAP_CONSOLE_DB_PASSWORD", "konsol"},
	} {
		if !strings.Contains(sql, v.placeholder) {
			continue
		}
		pw := os.Getenv(v.env)
		if pw == "" {
			return errors.New(v.env + " yo'q (.env) — " + v.role + " roli parolisiz yaratilmaydi")
		}
		if !appPasswordPattern.MatchString(pw) {
			return errors.New(v.env + " ruxsat etilmagan belgi yoki uzunlikda " +
				"(16–128, faqat A-Z a-z 0-9 + / = _ . -)")
		}
		sql = strings.ReplaceAll(sql, v.placeholder, quoteLiteral(pw))
	}

	// Migratsiya fayllari o'z ichida BEGIN/COMMIT ni saqlaydi —
	// shuning uchun bu yerda qo'shimcha tranzaksiya ochilmaydi.
	// Har bir fayl o'zi atomik.
	_, err = pool.Exec(ctx, sql)
	return err
}

// quoteLiteral — SQL satr literali.
//
// Kirish allaqachon qat'iy ruxsat ro'yxatidan o'tgan (apostrof yo'q),
// lekin bu funksiya baribir to'g'ri qochirish qiladi — himoyaning
// ikkinchi qatlami.
func quoteLiteral(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "''") + "'"
}
