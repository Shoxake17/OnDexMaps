package storage

import (
	"regexp"
	"strings"
	"testing"
)

// SQL'dagi eng katta `$n` soni berilgan parametrlar soniga TENG bo'lishi shart.
// Nomuvofiqlik PostgreSQL'da faqat ish vaqtida ("could not determine data
// type of parameter $N") chiqadi — ya'ni foydalanuvchi ko'rgandan keyin.
func TestBuildGeoSQLPlaceholdersMatchArgs(t *testing.T) {
	re := regexp.MustCompile(`\$(\d+)`)
	cases := []struct {
		name string
		norm string
		toks []string
	}{
		{"bitta so'z", "toshkent", []string{"toshkent"}},
		{"ko'p so'z", "amir temur kochasi", []string{"amir", "temur", "kochasi"}},
		{"qisqa", "to", []string{"to"}},
		{"umumiy yakka so'z", "kocha", []string{"kocha"}},
		{"olti so'z", "a b c d e f", []string{"a", "b", "c", "d", "e", "f"}},
	}
	for _, c := range cases {
		sql, args := buildGeoSQL(c.norm, c.toks, 10, &Point{Lat: 41, Lng: 71})
		maxN := 0
		for _, m := range re.FindAllStringSubmatch(sql, -1) {
			n := 0
			for _, ch := range m[1] {
				n = n*10 + int(ch-'0')
			}
			if n > maxN {
				maxN = n
			}
		}
		if maxN != len(args) {
			t.Errorf("%s: SQL'da $%d gacha o'rinbosar bor, lekin parametr %d ta", c.name, maxN, len(args))
		}
	}
}

// Foydalanuvchi matni SQL matniga YOPISHTIRILMASLIGI kerak — faqat `$n`.
func TestBuildGeoSQLNeverInlinesUserText(t *testing.T) {
	evil := "x'; DROP TABLE geo_names; --"
	sql, args := buildGeoSQL(evil, []string{evil, "toshkent"}, 10, nil)
	if strings.Contains(sql, "DROP") || strings.Contains(sql, evil) {
		t.Fatalf("foydalanuvchi matni SQL ichiga tushdi:\n%s", sql)
	}
	found := false
	for _, a := range args {
		if s, ok := a.(string); ok && s == evil {
			found = true
		}
	}
	if !found {
		t.Error("matn parametr sifatida uzatilmadi")
	}
}

// Har so'z ALOHIDA shart bo'lishi kerak (indeks BitmapAnd qilishi uchun).
func TestBuildGeoSQLOneConditionPerToken(t *testing.T) {
	sql, args := buildGeoSQL("amir temur kochasi", []string{"amir", "temur", "kochasi"}, 10, nil)
	// So'zlar uchun parametrlar $6, $7, $8 (birinchi beshtasi asosiy).
	for _, p := range []string{"$6", "$7", "$8"} {
		if !strings.Contains(sql, "g.search LIKE '%' || "+p+" || '%'") {
			t.Errorf("%s uchun alohida LIKE sharti yo'q", p)
		}
	}
	if strings.Contains(sql, "$9") {
		t.Error("3 so'zdan ortiq parametr paydo bo'ldi")
	}
	if len(args) != 5+3 {
		t.Errorf("parametrlar: 5 asosiy + 3 so'z = 8, olingan %d", len(args))
	}
}

// Qisqa va umumiy yakka so'z trigram yo'liga TUSHMASLIGI kerak.
func TestShortAndGenericUsePrefixPath(t *testing.T) {
	for _, tc := range []struct {
		norm string
		toks []string
	}{
		{"to", []string{"to"}},
		{"kocha", []string{"kocha"}},
		{"mahallasi", []string{"mahallasi"}},
	} {
		sql, _ := buildGeoSQL(tc.norm, tc.toks, 10, nil)
		if strings.Contains(sql, "%>") {
			t.Errorf("%q: trigram yo'liga tushdi (sekin bo'lardi)", tc.norm)
		}
	}
	// Umumiy so'z boshqa so'z bilan birga — oddiy yo'l.
	sql, _ := buildGeoSQL("amir kocha", []string{"amir", "kocha"}, 10, nil)
	if !strings.Contains(sql, "%>") {
		t.Error("ikki so'zli so'rov to'liq yo'lga tushishi kerak")
	}
}

func TestNeedsFuzzy(t *testing.T) {
	good := []Match{{Score: 95}}
	weak := []Match{{Score: 46}, {Score: 45}, {Score: 44}}

	if !needsFuzzy(nil, nil) {
		t.Error("natija yo'q — imlo xatosi ehtimoli bor")
	}
	if needsFuzzy(good, []Match{{Score: 120}, {Score: 90}}) {
		t.Error("yaxshi natija bor — noaniq qidiruv keraksiz")
	}
	// Asosiy holat: 3 ta ZAIF natija ham "yetarli" hisoblanmasligi kerak.
	if !needsFuzzy(weak, nil) {
		t.Error("faqat zaif natijalar — imlo xatosi uchun qayta qidirilishi kerak")
	}
	// Mahalla (legacy) yaxshi mos kelsa yetarli.
	if needsFuzzy(weak, []Match{{Score: 125}, {Score: 80}, {Score: 75}}) {
		t.Error("mahalla aniq mos — qayta qidirish kerak emas")
	}
}

func TestMergeMatchesSkipsDuplicates(t *testing.T) {
	base := []Match{{ID: "g1"}, {ID: "g2"}}
	got := mergeMatches(base, []Match{{ID: "g2"}, {ID: "g3"}})
	if len(got) != 3 || got[2].ID != "g3" {
		t.Errorf("birlashtirish: %+v", got)
	}
}

func TestLabels(t *testing.T) {
	cases := []struct{ kind, class, sub, want string }{
		{"city", "place", "city", "Shahar"},
		{"suburb", "place", "neighbourhood", "Mahalla"},
		{"village", "place", "village", "Qishloq"},
		{"street", "highway", "residential", "Ko'cha"},
		{"street", "highway", "footway", "Piyodalar yo'li"},
		{"street", "place", "square", "Maydon"},
		{"water", "waterway", "river", "Daryo"},
		{"water", "waterway", "canal", "Kanal"},
		{"poi", "amenity", "school", "Maktab"},
		{"poi", "amenity", "mosque", "Masjid"},
		{"poi", "railway", "station", "Temir yo'l bekati"},
		{"address", "addr", "housenumber", "Manzil"},
		// Ro'yxatda yo'q teg — INGLIZCHA xom qiymat emas, umumiy yorliq.
		{"poi", "shop", "hairdresser_supply_xyz", "Do'kon"},
		{"poi", "unknown_key", "x", "Joy"},
	}
	for _, c := range cases {
		if got := Label(c.kind, c.class, c.sub); got != c.want {
			t.Errorf("Label(%s,%s,%s) = %q, kutilgan %q", c.kind, c.class, c.sub, got, c.want)
		}
	}
	// Hech qachon bo'sh yorliq bo'lmasligi kerak (ro'yxatda bo'sh joy chiqmasin).
	for _, k := range []string{"region", "district", "city", "town", "village", "hamlet", "suburb",
		"locality", "street", "water", "poi", "building", "address"} {
		if Label(k, "", "") == "" {
			t.Errorf("%s uchun yorliq bo'sh", k)
		}
	}
}
