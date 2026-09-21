// OSM import vositasi — `.osm.pbf` fayldan barcha nomli obyektlarni
// (shahar, ko'cha, joy, bino, manzil) qidiruv indeksiga (`geo_names`) yuklaydi.
//
// XAVFSIZLIK: bu vosita BAZA EGASI huquqi bilan ishlaydi va ATAYLAB alohida
// binar (`geoimport`, `migrate` kabi). HTTP serveri ma'lumot yoza olmaydi.
//
// IDEMPOTENT: har ishga tushirishda jadval BUTUNLAY almashtiriladi (bitta
// tranzaksiyada), dublikat yig'ilmaydi. Xarita ma'lumoti (PMTiles) qayta
// qurilganda shu buyruqni ham qayta ishga tushiring — indeks xaritadan
// ortda qolmasligi kerak.
//
// Ishga tushirish:
//
//	go run ./cmd/osmimport -file D:\OnDexMapTiles\sources\uzbekistan.osm.pbf -dry-run
//	go run ./cmd/osmimport -file D:\OnDexMapTiles\sources\uzbekistan.osm.pbf
package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"sort"
	"time"

	"ondexmap/internal/config"
	"ondexmap/internal/geoindex"
	"ondexmap/internal/storage"
)

func main() {
	file := flag.String("file", "", "OSM .pbf fayl yo'li")
	dryRun := flag.Bool("dry-run", false, "faqat o'qish va hisobot, bazaga yozmaslik")
	flag.Parse()

	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, nil)))

	if *file == "" {
		slog.Error("foydalanish: -file=...osm.pbf [-dry-run]")
		os.Exit(1)
	}

	start := time.Now()
	rows, st, err := geoindex.Extract(*file)
	if err != nil {
		slog.Error("faylni o'qib bo'lmadi", "err", err)
		os.Exit(1)
	}
	slog.Info("fayl o'qildi",
		"vaqt", time.Since(start).Round(time.Second).String(),
		"obyektlar", len(rows), "tugun", st.NodesScanned, "yo'l", st.WaysScanned, "relyatsiya", st.RelsScanned)
	if st.SkippedNoCoords > 0 || st.SkippedRelNoPos > 0 {
		slog.Warn("ba'zilari tashlandi",
			"koordinatasiz", st.SkippedNoCoords,
			"markazsiz_relyatsiya", st.SkippedRelNoPos)
	}
	printKinds("OSM'dan (birlashtirishdan OLDIN)", st.ByKind)

	if *dryRun {
		slog.Info("dry-run: bazaga yozilmadi")
		return
	}

	cfg, err := config.Load(".env")
	if err != nil {
		slog.Error("sozlama xatosi", "err", err)
		os.Exit(1)
	}
	// ATAYLAB `DatabaseURLMigrate` (egasi): ilova roli yoza olmaydi.
	if cfg.DatabaseURLMigrate == "" {
		slog.Error("DATABASE_URL_MIGRATE yo'q — import baza egasi huquqini talab qiladi")
		os.Exit(1)
	}

	// Katta COPY va DBSCAN bir necha daqiqa olishi mumkin.
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	pool, err := storage.ReadWrite(ctx, cfg.DatabaseURLMigrate)
	if err != nil {
		slog.Error("bazaga ulanib bo'lmadi", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	t := time.Now()
	res, err := geoindex.Load(ctx, pool, rows)
	if err != nil {
		slog.Error("yuklash muvaffaqiyatsiz (eski indeks saqlandi)", "err", err)
		os.Exit(1)
	}
	slog.Info("yuklandi", "vaqt", time.Since(t).Round(time.Second).String(), "jami", res.Total)
	printKinds("BAZADA (birlashtirishdan KEYIN)", res.ByKind)
}

func printKinds(title string, m map[string]int) {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	fmt.Println(title + ":")
	for _, k := range keys {
		fmt.Printf("  %-9s %8d\n", k, m[k])
	}
}
