package geoindex

import (
	"bufio"
	"errors"
	"fmt"
	"os"

	"ondexmap/internal/osmpbf"
)

// Row — indeksga kiradigan bitta nomli obyekt.
//
// Chiziqli obyektlar (ko'cha, daryo) uchun har bir OSM yo'li ALOHIDA Row:
// ularni bitta natijaga birlashtirish bazada (DBSCAN bilan) bajariladi.
type Row struct {
	OSMType  string // "n" | "w" | "r"
	OSMID    int64
	Kind     string
	Class    string
	Subclass string
	Name     string // ko'rsatiladigan nom
	Alt      string // boshqa yozilishlar (faqat qidiruv uchun)
	Lon, Lat float64
	// Chegara (faqat yo'l va maydonlar uchun).
	HasBBox    bool
	W, S, E, N float64
	Linear     bool
}

// Stats — tur bo'yicha sonlar (hisobot uchun).
type Stats struct {
	ByKind          map[string]int
	NodesScanned    int
	WaysScanned     int
	RelsScanned     int
	SkippedNoCoords int // koordinatasi topilmagan yo'l/relyatsiya
	SkippedRelNoPos int // markaz tuguni (admin_centre/label) yo'q relyatsiya
}

// maxRows — xavfsizlik chegarasi: butun sayyora fayli tasodifan berilsa
// xotira to'lib ketmasligi uchun. O'zbekiston uchun ~o'nlab-yuz minglar.
const maxRows = 4_000_000

// pendingWay — birinchi o'tishda topilgan, koordinatasi hali yo'q obyekt.
type pendingWay struct {
	Row
	refs []int64 // koordinatasi kerak tugunlar
}

// Extract — PBF faylni ikki o'tishda o'qib, nomli obyektlarni qaytaradi.
//
// Nega ikki o'tish: PBF'da tugunlar birinchi, yo'llar keyin keladi. Yo'lning
// koordinatasi uning tugunlaridan olinadi, lekin yo'lni ko'rgunimizcha qaysi
// tugunlar kerakligini bilmaymiz. Shuning uchun:
//  1. o'tish — yo'llar va relyatsiyalar: nima kerakligini yig'amiz;
//  2. o'tish — tugunlar: nomli tugunlarni to'g'ridan-to'g'ri olamiz va
//     KERAK tugunlarning koordinatasini saqlab qo'yamiz.
//
// Xotira: faqat kerakli tugunlar saqlanadi (butun fayldagi 17 mln emas).
func Extract(path string) ([]Row, Stats, error) {
	st := Stats{ByKind: map[string]int{}}

	var ways []pendingWay
	type relInfo struct {
		Row
		centre int64 // admin_centre / label tuguni
	}
	var rels []relInfo
	need := map[int64]struct{}{}

	// ── 1-o'tish: yo'llar va relyatsiyalar ──────────────────────────
	err := scan(path, func(h *osmpbf.Handler) {
		h.Want.Ways, h.Want.Relations = true, true
		h.Way = func(id int64, refs []int64, tags osmpbf.Tags) {
			st.WaysScanned++
			if len(refs) < 1 || tags == nil {
				return
			}
			row, ok := buildRow(tags, elemWay)
			if !ok {
				return
			}
			row.OSMType, row.OSMID = "w", id
			pw := pendingWay{Row: row}
			if row.Linear {
				// Chiziq uchun 3 nuqta yetarli (boshi, o'rtasi, oxiri): butun
				// yo'lning har tugunini saqlash xotirani bekorga to'ldirardi.
				pw.refs = []int64{refs[0], refs[len(refs)/2], refs[len(refs)-1]}
			} else {
				pw.refs = append([]int64(nil), refs...)
			}
			for _, r := range pw.refs {
				need[r] = struct{}{}
			}
			ways = append(ways, pw)
		}
		h.Relation = func(id int64, members []osmpbf.Member, tags osmpbf.Tags) {
			st.RelsScanned++
			if tags == nil {
				return
			}
			row, ok := buildRow(tags, elemRelation)
			if !ok {
				return
			}
			row.OSMType, row.OSMID = "r", id
			// Relyatsiyaning o'z koordinatasi yo'q — markazi a'zolar ichida.
			var centre int64
			for _, m := range members {
				if m.Type == osmpbf.NodeMember && (m.Role == "admin_centre" || m.Role == "label") {
					centre = m.Ref
					if m.Role == "admin_centre" {
						break // admin_centre label'dan afzal
					}
				}
			}
			if centre == 0 {
				st.SkippedRelNoPos++
				return
			}
			need[centre] = struct{}{}
			rels = append(rels, relInfo{Row: row, centre: centre})
		}
	})
	if err != nil {
		return nil, st, err
	}

	// ── 2-o'tish: tugunlar ──────────────────────────────────────────
	type pt struct{ lon, lat float64 }
	coords := make(map[int64]pt, len(need))
	var out []Row

	err = scan(path, func(h *osmpbf.Handler) {
		h.Want.Nodes = true
		h.Node = func(id int64, lat, lon float64, tags osmpbf.Tags) {
			st.NodesScanned++
			if _, ok := need[id]; ok {
				coords[id] = pt{lon, lat}
			}
			if tags == nil {
				return
			}
			if row, ok := buildRow(tags, elemNode); ok {
				row.OSMType, row.OSMID = "n", id
				row.Lon, row.Lat = lon, lat
				out = append(out, row)
			}
		}
	})
	if err != nil {
		return nil, st, err
	}

	// ── Yo'llarga koordinata berish ─────────────────────────────────
	for _, w := range ways {
		row := w.Row
		var sumLon, sumLat float64
		n := 0
		for _, ref := range w.refs {
			p, ok := coords[ref]
			if !ok {
				continue
			}
			sumLon += p.lon
			sumLat += p.lat
			if !row.HasBBox {
				row.HasBBox = true
				row.W, row.E, row.S, row.N = p.lon, p.lon, p.lat, p.lat
			}
			row.W, row.E = min(row.W, p.lon), max(row.E, p.lon)
			row.S, row.N = min(row.S, p.lat), max(row.N, p.lat)
			n++
		}
		if n == 0 {
			st.SkippedNoCoords++
			continue
		}
		if row.Linear {
			// Chiziq markazi: o'rta tugun (ko'chaning O'ZIDA yotadi, o'rtacha
			// nuqta esa egri ko'chada ko'chadan tashqariga tushishi mumkin).
			if mid, ok := coords[w.refs[len(w.refs)/2]]; ok {
				row.Lon, row.Lat = mid.lon, mid.lat
			} else {
				row.Lon, row.Lat = sumLon/float64(n), sumLat/float64(n)
			}
		} else {
			row.Lon, row.Lat = sumLon/float64(n), sumLat/float64(n)
		}
		out = append(out, row)
	}
	for _, r := range rels {
		p, ok := coords[r.centre]
		if !ok {
			st.SkippedNoCoords++
			continue
		}
		row := r.Row
		row.Lon, row.Lat = p.lon, p.lat
		out = append(out, row)
	}

	if len(out) > maxRows {
		return nil, st, fmt.Errorf("juda ko'p obyekt (%d > %d) — fayl noto'g'rimi?", len(out), maxRows)
	}
	for _, r := range out {
		st.ByKind[r.Kind]++
	}
	return out, st, nil
}

// buildRow — teglardan Row quradi (koordinatasiz).
func buildRow(tags osmpbf.Tags, e elemKind) (Row, bool) {
	display, alt := pickNames(tags)
	if display != "" {
		if f, ok := classify(tags, e); ok {
			return Row{
				Kind: f.kind, Class: f.class, Subclass: f.subclass,
				Name: display, Alt: alt, Linear: f.linear,
			}, true
		}
		// Nomli, lekin joy belgisi yo'q — pastda manzil sifatida sinaymiz.
	}
	// Nomsiz, lekin manzili bor (uy raqami) — «Ko'cha 12» sifatida.
	if e != elemRelation {
		if n := addressName(tags); n != "" {
			return Row{Kind: KindAddress, Class: "addr", Subclass: "housenumber", Name: n}, true
		}
	}
	return Row{}, false
}

func scan(path string, setup func(*osmpbf.Handler)) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()

	var h osmpbf.Handler
	setup(&h)
	if !h.Want.Nodes && !h.Want.Ways && !h.Want.Relations {
		return errors.New("hech narsa so'ralmagan")
	}
	return osmpbf.Scan(bufio.NewReaderSize(f, 1<<20), h)
}
