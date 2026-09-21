// Package geoindex — OSM ma'lumotidan QIDIRUV indeksi uchun nomli obyektlarni
// ajratib oladi: aholi punktlari, ko'chalar, joylar, binolar, manzillar.
//
// Nega kerak: xarita (PMTiles) nomlarni faqat CHIZADI, ular bazada yo'q edi,
// shuning uchun qidiruv faqat mahalla jadvalini topardi. Bu paket o'sha
// xaritani yasagan OSM faylidan aynan shu nomlarni bazaga tayyorlaydi.
package geoindex

import (
	"strings"
	"unicode"
)

// Turlar — `geo_names.kind` CHECK cheklovi bilan BIR XIL bo'lishi shart
// (migrations/0005_geo_names.sql).
const (
	KindRegion   = "region"   // viloyat, respublika
	KindDistrict = "district" // tuman
	KindCity     = "city"
	KindTown     = "town"
	KindVillage  = "village"
	KindHamlet   = "hamlet"
	KindSuburb   = "suburb" // mahalla, kvartal, massiv
	KindLocality = "locality"
	KindStreet   = "street"
	KindWater    = "water"    // daryo, ariq, ko'l
	KindPOI      = "poi"      // muassasa, do'kon, bog', yodgorlik...
	KindBuilding = "building" // nomli bino
	KindAddress  = "address"  // «Navoiy ko'chasi 12»
)

// feature — tasniflash natijasi.
type feature struct {
	kind, class, subclass string
	// linear — chiziqli obyekt (ko'cha, daryo): bir nomning ko'p bo'lagi
	// bazada BITTA natijaga birlashtiriladi.
	linear bool
}

// placeKinds — `place=*` qiymatlari → tur.
var placeKinds = map[string]string{
	"city": KindCity, "town": KindTown, "village": KindVillage,
	"hamlet": KindHamlet, "isolated_dwelling": KindHamlet,
	"suburb": KindSuburb, "neighbourhood": KindSuburb, "quarter": KindSuburb,
	"borough": KindSuburb, "city_block": KindSuburb,
	"locality": KindLocality, "island": KindLocality, "islet": KindLocality,
	"state": KindRegion, "region": KindRegion, "province": KindRegion,
	"county": KindDistrict, "district": KindDistrict, "municipality": KindDistrict,
}

// poiKeys — joyni bildiruvchi teglar, USTUVORLIK tartibida: element bir nechta
// tegga ega bo'lsa (masalan `amenity=school` + `building=yes`) birinchisi
// olinadi va u to'g'ri turni belgilaydi.
var poiKeys = []string{
	"amenity", "shop", "tourism", "leisure", "historic", "office", "craft",
	"healthcare", "emergency", "man_made", "public_transport", "railway",
	"aeroway", "natural", "waterway", "landuse", "sport", "building",
}

// Bu qiymatlar joy EMAS: chiziqli infratuzilma yoki qiymatsiz belgi.
var skipValues = map[string]map[string]bool{
	// Temir yo'l CHIZIG'I nomli bo'lishi mumkin, lekin qidiriladigan joy emas;
	// bekat, bekatcha va metro kirishi esa — ha.
	"railway": {"rail": true, "abandoned": true, "disused": true, "light_rail": true,
		"narrow_gauge": true, "preserved": true, "construction": true, "proposed": true,
		"switch": true, "level_crossing": true, "crossing": true, "signal": true,
		"buffer_stop": true, "milestone": true, "subway": true, "tram": true, "platform": true},
	"natural": {"tree": true, "tree_row": true, "coastline": true, "cliff": true,
		"scree": true, "shrubbery": true, "bare_rock": true, "ridge": true, "arete": true},
	"public_transport": {"stop_position": true},
	"man_made":         {"survey_point": true, "cutline": true, "embankment": true},
	"landuse":          {"construction": true, "brownfield": true, "greenfield": true},
	"building":         {"no": true},
}

// highwaySkip — nomli bo'lsa ham ko'cha hisoblanmaydigan yo'l turlari.
var highwaySkip = map[string]bool{
	"proposed": true, "construction": true, "platform": true, "bus_stop": true,
	"crossing": true, "traffic_signals": true, "give_way": true, "stop": true,
	"turning_circle": true, "turning_loop": true, "milestone": true,
	"motorway_junction": true, "street_lamp": true, "elevator": true,
}

// elemKind — element turi.
type elemKind int

const (
	elemNode elemKind = iota
	elemWay
	elemRelation
)

// classify — nomli elementni tasniflaydi. `false` — qidiruv indeksiga kirmaydi.
func classify(tags map[string]string, e elemKind) (feature, bool) {
	// 1) Aholi punktlari va ma'muriy birliklar.
	if v := tags["place"]; v != "" {
		if k, ok := placeKinds[v]; ok {
			return feature{kind: k, class: "place", subclass: v}, true
		}
		if v == "square" { // maydon — ko'cha kabi qidiriladi
			return feature{kind: KindStreet, class: "place", subclass: "square"}, true
		}
	}
	if tags["boundary"] == "administrative" && e == elemRelation {
		if k := adminKind(tags["admin_level"]); k != "" {
			return feature{kind: k, class: "boundary", subclass: "admin_" + tags["admin_level"]}, true
		}
	}

	// 2) Ko'chalar (faqat yo'l; tugunda — faqat bekat).
	if h := tags["highway"]; h != "" && !highwaySkip[h] && e == elemWay {
		return feature{kind: KindStreet, class: "highway", subclass: h, linear: true}, true
	}
	if tags["highway"] == "bus_stop" && e == elemNode {
		return feature{kind: KindPOI, class: "highway", subclass: "bus_stop"}, true
	}

	// 3) Joylar, suv, binolar.
	for _, key := range poiKeys {
		v := tags[key]
		if v == "" || v == "no" || skipValues[key][v] {
			continue
		}
		f := feature{kind: KindPOI, class: key, subclass: v}
		switch {
		case key == "waterway":
			// Daryo/ariq — chiziqli, ko'p bo'lakdan iborat.
			if e == elemNode { // to'g'on, sharshara kabi nuqtalar joy sifatida qoladi
				return f, true
			}
			f.kind, f.linear = KindWater, e == elemWay
		case key == "natural" && (v == "water" || v == "spring" || v == "bay"):
			f.kind = KindWater
		case key == "building":
			f.kind = KindBuilding
		}
		// Ibodatxona: `amenity=place_of_worship` o'rniga aniq tur (masjid, cherkov).
		if key == "amenity" && v == "place_of_worship" {
			if b := tags["building"]; b == "mosque" || b == "church" || b == "cathedral" ||
				b == "synagogue" || b == "temple" {
				f.subclass = b
			} else if r := tags["religion"]; r == "muslim" {
				f.subclass = "mosque"
			}
		}
		return f, true
	}
	return feature{}, false
}

// adminKind — `admin_level` → tur. Mos kelmasa bo'sh.
func adminKind(level string) string {
	switch level {
	case "2", "3", "4":
		return KindRegion
	case "5", "6", "7", "8":
		return KindDistrict
	case "9", "10", "11":
		return KindSuburb
	}
	return ""
}

// ── Nomlar ──────────────────────────────────────────────────────────

// nameLangs — qidiruvda hisobga olinadigan `name:<til>` teglari. Ro'yxat
// ATAYLAB cheklangan: `name:etymology`, `name:left` kabi tegga o'xshash
// "nomlar" qidiruvni ifloslantirmasligi kerak.
var nameLangs = []string{"uz", "uz-Latn", "uz-Cyrl", "ru", "en", "kaa", "kk", "tg", "ky", "tk", "tr"}

var otherNameKeys = []string{"int_name", "alt_name", "old_name", "official_name", "short_name", "loc_name"}

const (
	maxNameLen = 200
	maxAltLen  = 500
)

// pickNames — ko'rsatiladigan nom va boshqa barcha yozilishlar.
//
// Ko'rsatiladigan nom LOTIN yozuvida afzal ko'riladi (interfeys lotincha):
// `name:uz` → `name:uz-Latn` → `name` → `name:en`. Lotinchasi umuman yo'q
// bo'lsa kirillcha olinadi. Qolgan yozuvlar `alt` ga tushadi va faqat
// QIDIRUVDA ishlatiladi — shu tufayli «Ташкент» yozgan odam ham «Toshkent»
// ni topadi.
func pickNames(tags map[string]string) (display, alt string) {
	ordered := []string{tags["name:uz"], tags["name:uz-Latn"], tags["name"], tags["name:en"], tags["int_name"]}

	for _, c := range ordered {
		if c = clean(c); c != "" && isLatin(c) {
			display = c
			break
		}
	}
	if display == "" {
		for _, c := range append([]string{tags["name"]}, ordered...) {
			if c = clean(c); c != "" {
				display = c
				break
			}
		}
	}
	if display == "" {
		return "", ""
	}

	seen := map[string]bool{display: true}
	var parts []string
	add := func(v string) {
		for _, s := range strings.Split(v, ";") {
			s = clean(s)
			if s != "" && !seen[s] {
				seen[s] = true
				parts = append(parts, s)
			}
		}
	}
	add(tags["name"])
	for _, l := range nameLangs {
		add(tags["name:"+l])
	}
	for _, k := range otherNameKeys {
		add(tags[k])
	}
	alt = strings.Join(parts, "; ")
	if len(alt) > maxAltLen {
		alt = alt[:maxAltLen]
		// Kesilgan baytli runa qoldirmaymiz.
		alt = strings.ToValidUTF8(alt, "")
	}
	return display, alt
}

func clean(s string) string {
	s = strings.TrimSpace(s)
	if len(s) > maxNameLen {
		return ""
	}
	// Boshqaruv belgilari (tab, yangi qator) — import faylini buzadi.
	return strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return ' '
		}
		return r
	}, s)
}

// isLatin — matnda kirill harf YO'Q va kamida bitta lotin harf bor.
func isLatin(s string) bool {
	latin := false
	for _, r := range s {
		switch {
		case unicode.Is(unicode.Cyrillic, r):
			return false
		case unicode.Is(unicode.Latin, r):
			latin = true
		}
	}
	return latin
}

// addressName — «Ko'cha nomi 12». Ko'cha yo'q bo'lsa bo'sh.
func addressName(tags map[string]string) string {
	hn := clean(tags["addr:housenumber"])
	street := clean(tags["addr:street"])
	if street == "" {
		street = clean(tags["addr:place"])
	}
	if hn == "" || street == "" {
		return ""
	}
	return street + " " + hn
}
