package storage

// Label — natijaning o'zbekcha turi: «Ko'cha», «Maktab», «Shahar».
//
// Qidiruv ro'yxatida nomning yonida ko'rinadi. Foydalanuvchi bir xil nomli
// ikki natijani («Navoiy» — shahar yoki ko'cha?) shu yorliq va yaqin joy
// nomi bilan ajratadi.
//
// Nomlar OSM teglaridan (`class`/`subclass`) keladi. Ro'yxatda yo'q qiymat
// UMUMIY yorliqqa tushadi (`«Joy»`) — ingliz tilidagi xom teg («hairdresser»)
// foydalanuvchiga ko'rsatilmaydi.
func Label(kind, class, subclass string) string {
	switch kind {
	case "region":
		return "Viloyat"
	case "district":
		return "Tuman"
	case "city":
		return "Shahar"
	case "town":
		return "Shaharcha"
	case "village", "hamlet":
		return "Qishloq"
	case "suburb":
		return "Mahalla"
	case "locality":
		return "Joy"
	case "building":
		return "Bino"
	case "address":
		return "Manzil"
	case "street":
		return streetLabel(subclass)
	case "water":
		return waterLabel(class, subclass)
	}
	// poi
	if l, ok := poiLabels[class+":"+subclass]; ok {
		return l
	}
	if l, ok := classLabels[class]; ok {
		return l
	}
	return "Joy"
}

func streetLabel(sub string) string {
	switch sub {
	case "square":
		return "Maydon"
	case "motorway", "motorway_link", "trunk", "trunk_link":
		return "Avtomagistral"
	case "footway", "pedestrian", "steps", "path":
		return "Piyodalar yo'li"
	case "cycleway":
		return "Velosiped yo'li"
	case "track":
		return "Dala yo'li"
	case "service":
		return "Xizmat yo'li"
	}
	return "Ko'cha"
}

func waterLabel(class, sub string) string {
	switch sub {
	case "river":
		return "Daryo"
	case "stream", "brook":
		return "Soy"
	case "canal":
		return "Kanal"
	case "drain", "ditch":
		return "Ariq"
	case "water", "lake", "reservoir", "pond":
		return "Ko'l"
	case "spring":
		return "Buloq"
	case "riverbank":
		return "Daryo"
	}
	return "Suv"
}

// poiLabels — `class:subclass` bo'yicha aniq yorliq.
var poiLabels = map[string]string{
	"amenity:school":               "Maktab",
	"amenity:kindergarten":         "Bolalar bog'chasi",
	"amenity:university":           "Universitet",
	"amenity:college":              "Kollej",
	"amenity:hospital":             "Kasalxona",
	"amenity:clinic":               "Poliklinika",
	"amenity:pharmacy":             "Dorixona",
	"amenity:doctors":              "Shifokor",
	"amenity:dentist":              "Stomatologiya",
	"amenity:bank":                 "Bank",
	"amenity:atm":                  "Bankomat",
	"amenity:restaurant":           "Restoran",
	"amenity:cafe":                 "Kafe",
	"amenity:fast_food":            "Tezkor ovqat",
	"amenity:bar":                  "Bar",
	"amenity:pub":                  "Bar",
	"amenity:marketplace":          "Bozor",
	"amenity:fuel":                 "Yoqilg'i shoxobchasi",
	"amenity:charging_station":     "Zaryad stansiyasi",
	"amenity:place_of_worship":     "Ibodatxona",
	"amenity:mosque":               "Masjid",
	"amenity:church":               "Cherkov",
	"amenity:police":               "Politsiya",
	"amenity:fire_station":         "O't o'chirish qismi",
	"amenity:post_office":          "Pochta",
	"amenity:library":              "Kutubxona",
	"amenity:theatre":              "Teatr",
	"amenity:cinema":               "Kinoteatr",
	"amenity:townhall":             "Hokimiyat",
	"amenity:courthouse":           "Sud",
	"amenity:bus_station":          "Avtovokzal",
	"amenity:parking":              "Avtoturargoh",
	"amenity:community_centre":     "Madaniyat markazi",
	"amenity:public_bath":          "Hammom",
	"amenity:car_wash":             "Avtomoyka",
	"amenity:toilets":              "Hojatxona",
	"amenity:cemetery":             "Qabriston",
	"shop:supermarket":             "Supermarket",
	"shop:convenience":             "Do'kon",
	"shop:mall":                    "Savdo markazi",
	"shop:department_store":        "Univermag",
	"shop:bakery":                  "Novvoyxona",
	"shop:clothes":                 "Kiyim do'koni",
	"shop:car_repair":              "Avtoservis",
	"shop:hairdresser":             "Sartaroshxona",
	"shop:beauty":                  "Go'zallik saloni",
	"shop:mobile_phone":            "Telefon do'koni",
	"shop:electronics":             "Elektronika do'koni",
	"shop:butcher":                 "Go'sht do'koni",
	"shop:greengrocer":             "Meva-sabzavot",
	"shop:florist":                 "Gul do'koni",
	"shop:hardware":                "Qurilish mollari",
	"tourism:hotel":                "Mehmonxona",
	"tourism:guest_house":          "Mehmon uyi",
	"tourism:hostel":               "Xostel",
	"tourism:museum":               "Muzey",
	"tourism:attraction":           "Diqqatga sazovor joy",
	"tourism:viewpoint":            "Manzara nuqtasi",
	"tourism:gallery":              "Galereya",
	"leisure:park":                 "Bog'",
	"leisure:garden":               "Bog'",
	"leisure:stadium":              "Stadion",
	"leisure:playground":           "Bolalar maydonchasi",
	"leisure:sports_centre":        "Sport majmuasi",
	"leisure:pitch":                "Sport maydoni",
	"leisure:swimming_pool":        "Basseyn",
	"leisure:fitness_centre":       "Fitnes markazi",
	"historic:monument":            "Yodgorlik",
	"historic:memorial":            "Yodgorlik",
	"historic:ruins":               "Xarobalar",
	"historic:archaeological_site": "Arxeologik obida",
	"railway:station":              "Temir yo'l bekati",
	"railway:halt":                 "Temir yo'l bekati",
	"railway:tram_stop":            "Tramvay bekati",
	"railway:subway_entrance":      "Metro kirishi",
	"highway:bus_stop":             "Avtobus bekati",
	"aeroway:aerodrome":            "Aeroport",
	"aeroway:terminal":             "Aeroport terminali",
	"aeroway:helipad":              "Vertolyot maydoni",
	"natural:peak":                 "Cho'qqi",
	"natural:volcano":              "Vulqon",
	"natural:wood":                 "O'rmon",
	"natural:valley":               "Vodiy",
	"natural:beach":                "Plyaj",
	"landuse:cemetery":             "Qabriston",
	"landuse:retail":               "Savdo hududi",
	"landuse:industrial":           "Sanoat hududi",
	"landuse:residential":          "Turar joy hududi",
	"landuse:farmland":             "Ekin maydoni",
	"landuse:forest":               "O'rmon",
	"landuse:military":             "Harbiy hudud",
	"man_made:bridge":              "Ko'prik",
	"man_made:tower":               "Minora",
	"man_made:water_tower":         "Suv minorasi",
	"man_made:works":               "Zavod",
	"public_transport:station":     "Bekat",
	"public_transport:platform":    "Bekat",
}

// classLabels — `class` bo'yicha umumiy yorliq (aniq juftlik topilmasa).
var classLabels = map[string]string{
	"amenity":          "Muassasa",
	"shop":             "Do'kon",
	"tourism":          "Turizm",
	"leisure":          "Dam olish joyi",
	"historic":         "Tarixiy joy",
	"office":           "Idora",
	"craft":            "Ustaxona",
	"healthcare":       "Tibbiyot muassasasi",
	"emergency":        "Favqulodda xizmat",
	"man_made":         "Inshoot",
	"public_transport": "Bekat",
	"railway":          "Temir yo'l",
	"aeroway":          "Aviatsiya",
	"natural":          "Tabiat obyekti",
	"landuse":          "Hudud",
	"sport":            "Sport joyi",
	"waterway":         "Suv",
	"highway":          "Yo'l",
}

// legacyLabel — jamoa jadvalidagi (mahallas/streets) tur → yorliq.
func legacyLabel(t string) string {
	switch t {
	case "qishloq":
		return "Qishloq"
	case "daha":
		return "Daha"
	case "street":
		return "Ko'cha"
	}
	return "Mahalla"
}
