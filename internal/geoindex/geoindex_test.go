package geoindex

import (
	"os"
	"sort"
	"strings"
	"testing"
)

func TestClassify(t *testing.T) {
	cases := []struct {
		name string
		tags map[string]string
		e    elemKind
		kind string
		ok   bool
	}{
		{"shahar", map[string]string{"place": "city", "name": "Toshkent"}, elemNode, KindCity, true},
		{"qishloq", map[string]string{"place": "village"}, elemNode, KindVillage, true},
		{"mahalla (suburb)", map[string]string{"place": "neighbourhood"}, elemNode, KindSuburb, true},
		{"viloyat", map[string]string{"place": "state"}, elemNode, KindRegion, true},
		{"ko'cha", map[string]string{"highway": "residential"}, elemWay, KindStreet, true},
		{"ko'cha nuqtada emas", map[string]string{"highway": "residential"}, elemNode, "", false},
		{"svetofor — joy emas", map[string]string{"highway": "traffic_signals"}, elemNode, "", false},
		{"avtobus bekati", map[string]string{"highway": "bus_stop"}, elemNode, KindPOI, true},
		{"maktab", map[string]string{"amenity": "school", "building": "yes"}, elemWay, KindPOI, true},
		{"bino (faqat building)", map[string]string{"building": "yes"}, elemWay, KindBuilding, true},
		{"building=no — bino emas", map[string]string{"building": "no"}, elemWay, "", false},
		{"daryo", map[string]string{"waterway": "river"}, elemWay, KindWater, true},
		{"ko'l", map[string]string{"natural": "water"}, elemWay, KindWater, true},
		{"temir yo'l chizig'i — joy emas", map[string]string{"railway": "rail"}, elemWay, "", false},
		{"temir yo'l bekati", map[string]string{"railway": "station"}, elemNode, KindPOI, true},
		{"daraxt — joy emas", map[string]string{"natural": "tree"}, elemNode, "", false},
		{"tuman (relyatsiya)", map[string]string{"boundary": "administrative", "admin_level": "6"}, elemRelation, KindDistrict, true},
		{"ma'muriy chegara faqat relyatsiyada", map[string]string{"boundary": "administrative", "admin_level": "6"}, elemWay, "", false},
		{"noma'lum teg", map[string]string{"foo": "bar"}, elemNode, "", false},
	}
	for _, c := range cases {
		f, ok := classify(c.tags, c.e)
		if ok != c.ok || (ok && f.kind != c.kind) {
			t.Errorf("%s: kutilgan (%q,%v), olingan (%q,%v)", c.name, c.kind, c.ok, f.kind, ok)
		}
	}
}

// Masjid `amenity=place_of_worship` emas, aniq tur bilan qidirilishi kerak.
func TestMosqueSubclass(t *testing.T) {
	f, _ := classify(map[string]string{"amenity": "place_of_worship", "building": "mosque"}, elemWay)
	if f.subclass != "mosque" {
		t.Errorf("masjid subclass = %q", f.subclass)
	}
	f, _ = classify(map[string]string{"amenity": "place_of_worship", "religion": "muslim"}, elemNode)
	if f.subclass != "mosque" {
		t.Errorf("muslim ibodatxona subclass = %q", f.subclass)
	}
}

func TestPickNames(t *testing.T) {
	// Kirill `name` bor, lotin `name:uz` bor — ko'rsatiladigani lotin, kirill esa
	// QIDIRUV uchun saqlanadi (foydalanuvchi kirillcha yozsa ham topilsin).
	d, alt := pickNames(map[string]string{
		"name": "Ташкент", "name:uz": "Toshkent", "name:ru": "Ташкент", "name:en": "Tashkent",
	})
	if d != "Toshkent" {
		t.Errorf("display = %q", d)
	}
	for _, want := range []string{"Ташкент", "Tashkent"} {
		if !strings.Contains(alt, want) {
			t.Errorf("alt %q ichida %q yo'q", alt, want)
		}
	}
	if strings.Contains(alt, "Toshkent") {
		t.Errorf("display alt'da takrorlanmasligi kerak: %q", alt)
	}

	// Faqat kirill bo'lsa — kirill ko'rsatiladi.
	if d, _ := pickNames(map[string]string{"name": "Навоий"}); d != "Навоий" {
		t.Errorf("faqat kirill: display = %q", d)
	}
	// Nom yo'q — bo'sh.
	if d, _ := pickNames(map[string]string{"highway": "residential"}); d != "" {
		t.Errorf("nomsiz element nom oldi: %q", d)
	}
	// `;` bilan ajratilgan bir nechta nom.
	_, alt = pickNames(map[string]string{"name": "A", "alt_name": "B;C"})
	if !strings.Contains(alt, "B") || !strings.Contains(alt, "C") {
		t.Errorf("alt_name bo'linmadi: %q", alt)
	}
}

// Boshqaruv belgilari import faylini buzmasligi kerak (TSV/COPY).
func TestNamesAreCleaned(t *testing.T) {
	d, _ := pickNames(map[string]string{"name": "Ko'cha\tbir\nikki"})
	if strings.ContainsAny(d, "\t\n\r") {
		t.Errorf("boshqaruv belgisi qoldi: %q", d)
	}
}

func TestAddressName(t *testing.T) {
	if got := addressName(map[string]string{"addr:street": "Navoiy ko'chasi", "addr:housenumber": "12"}); got != "Navoiy ko'chasi 12" {
		t.Errorf("manzil: %q", got)
	}
	if got := addressName(map[string]string{"addr:housenumber": "12"}); got != "" {
		t.Errorf("ko'chasiz manzil yaratildi: %q", got)
	}
}

// Nomli, lekin joy tegi yo'q element — nomi bo'lmasa ham manzili bo'lsa indekslanadi.
func TestBuildRowAddressFallback(t *testing.T) {
	r, ok := buildRow(map[string]string{"addr:street": "Amir Temur", "addr:housenumber": "5"}, elemWay)
	if !ok || r.Kind != KindAddress || r.Name != "Amir Temur 5" {
		t.Errorf("manzil qatori: %+v ok=%v", r, ok)
	}
}

// Haqiqiy fayl: `OSM_PBF=...` berilsa. Hisobot chiqaradi va asosiy nomlar
// topilishini tekshiradi — bu import to'g'ri ishlaganining eng ishonchli isboti.
func TestExtractRealFile(t *testing.T) {
	path := os.Getenv("OSM_PBF")
	if path == "" {
		t.Skip("OSM_PBF berilmagan")
	}
	rows, st, err := Extract(path)
	if err != nil {
		t.Fatal(err)
	}
	kinds := make([]string, 0, len(st.ByKind))
	for k := range st.ByKind {
		kinds = append(kinds, k)
	}
	sort.Strings(kinds)
	for _, k := range kinds {
		t.Logf("  %-9s %7d", k, st.ByKind[k])
	}
	t.Logf("jami=%d  tugun=%d yo'l=%d rel=%d  koordinatasiz=%d  markazsiz-rel=%d",
		len(rows), st.NodesScanned, st.WaysScanned, st.RelsScanned, st.SkippedNoCoords, st.SkippedRelNoPos)

	// Har xil tur uchun namuna.
	want := map[string]bool{"Toshkent": false, "Samarqand": false, "Chust": false, "Namangan": false}
	for _, r := range rows {
		if _, ok := want[r.Name]; ok && (r.Kind == KindCity || r.Kind == KindTown) {
			want[r.Name] = true
		}
	}
	for n, found := range want {
		if !found {
			t.Errorf("%q shahar sifatida topilmadi", n)
		}
	}
	if st.ByKind[KindStreet] < 1000 {
		t.Errorf("ko'chalar juda kam: %d", st.ByKind[KindStreet])
	}
}
