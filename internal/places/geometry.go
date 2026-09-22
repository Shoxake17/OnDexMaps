package places

import (
	"math"
	"strconv"
)

// Chiziq shaklidagi turlarning chegaralari `KindSpec.Line` da (har tur o'ziniki:
// yo'l kilometrlab, piyodalar o'tish joyi 10 m gacha). Bazadagi CHECK
// (0009/0010) biroz KENGROQ — sferoid bo'yicha uzunlik bu yerdagi sfera
// hisobidan ~0.5% farq qilishi mumkin, shunda kod qabul qilgan chiziqni baza
// rad etmaydi.
//
// Quyidagi uchta doimiy — YO'L (`road`) qoidasining nusxasi: eski kod va
// testlar shu nomlar bilan murojaat qiladi, ular `TestRoadConstantsMatchSpec`
// bilan spetsifikatsiyaga bog'langan.
const (
	// MaxLinePoints — yo'ldagi eng ko'p nuqta. Chegarasiz chiziq bitta so'rov
	// bilan bazani va moderator ekranini og'irlashtirardi.
	MaxLinePoints = 500
	// MinLineMeters / MaxLineMeters — yo'l uzunligi (metr). Juda qisqa chiziq
	// tasodifiy bosish, juda uzun — butun viloyatni "yo'l" deb chizib yuborish.
	MinLineMeters = 5.0
	MaxLineMeters = 30000.0
)

// earthRadiusM — sferik Yer radiusi (metr); haversine uchun.
const earthRadiusM = 6371008.8

// haversineM — ikki nuqta orasidagi masofa (metr). Nuqtalar [lng, lat].
func haversineM(a, b [2]float64) float64 {
	rad := math.Pi / 180
	dLat := (b[1] - a[1]) * rad
	dLng := (b[0] - a[0]) * rad
	s := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(a[1]*rad)*math.Cos(b[1]*rad)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * earthRadiusM * math.Asin(math.Min(1, math.Sqrt(s)))
}

// LineLengthMeters — chiziq uzunligi (metr), nuqtalar [lng, lat].
func LineLengthMeters(pts [][2]float64) float64 {
	var sum float64
	for i := 1; i < len(pts); i++ {
		sum += haversineM(pts[i-1], pts[i])
	}
	return sum
}

// formatMeters — chegara xabari uchun («10 m», «30 km»).
func formatMeters(m float64) string {
	if m >= 1000 {
		return strconv.FormatFloat(m/1000, 'f', -1, 64) + " km"
	}
	return strconv.FormatFloat(m, 'f', -1, 64) + " m"
}

// cleanPath — chiziqni (yo'l, o'tish joyi, to'siq) tekshiradi va tozalaydi.
//
// Har bir nuqta [lng, lat]. Tartib: nuqta soni → har bir nuqta (NaN/±Inf,
// O'zbekiston chegarasi) → ketma-ket takror nuqtalarni olib tashlash →
// uzunlik. `label` — turning nomi (xabar uchun), `rule` — shu turning
// chegarasi. Xabar bizning o'z matnimiz: kiruvchi qiymat unga qo'shilmaydi.
func cleanPath(in [][2]float64, label string, rule LineRule) ([][2]float64, error) {
	if len(in) < 2 {
		return nil, bad("«" + label + "» kamida ikki nuqtadan iborat bo'lishi kerak")
	}
	if len(in) > rule.MaxPoints {
		return nil, bad("«" + label + "» juda ko'p nuqtadan iborat")
	}
	out := make([][2]float64, 0, len(in))
	for _, p := range in {
		lng, lat := p[0], p[1]
		// NaN va ±Inf uchun oddiy `<`/`>` solishtirish `false` beradi va ularni
		// o'tkazib yuborardi — shuning uchun avval aniq tekshiriladi.
		if math.IsNaN(lat) || math.IsInf(lat, 0) || math.IsNaN(lng) || math.IsInf(lng, 0) {
			return nil, bad("«" + label + "» nuqtasi noto'g'ri")
		}
		if lat < MinLat || lat > MaxLat || lng < MinLng || lng > MaxLng {
			return nil, bad("«" + label + "» O'zbekiston hududidan tashqarida")
		}
		q := [2]float64{round6(lng), round6(lat)}
		// Aynan bir nuqtaga ketma-ket ikki marta bosish chiziqqa hech narsa
		// qo'shmaydi (va PostGIS uchun nol uzunlikli bo'lak beradi).
		if n := len(out); n > 0 && out[n-1] == q {
			continue
		}
		out = append(out, q)
	}
	if len(out) < 2 {
		return nil, bad("«" + label + "» nuqtalari bir joyda — kamida ikkita turli nuqta kerak")
	}
	length := LineLengthMeters(out)
	if length < rule.MinMeters {
		return nil, bad("«" + label + "» juda qisqa (kamida " + formatMeters(rule.MinMeters) + ")")
	}
	if length > rule.MaxMeters {
		return nil, bad("«" + label + "» juda uzun (" + formatMeters(rule.MaxMeters) + " dan oshmasligi kerak)")
	}
	return out, nil
}
