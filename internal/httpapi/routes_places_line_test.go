package httpapi

import (
	"encoding/json"
	"math"
	"net/http"
	"strings"
	"testing"

	"ondexmap/internal/places"
)

// Yo'l (chiziq) qabul qilish: `POST /v1/places` chiziq bilan.

func roadData() map[string]any {
	return map[string]any{
		"kind": "road",
		"line": [][2]float64{{71.2400, 41.0000}, {71.2412, 41.0009}, {71.2425, 41.0016}},
		"name": "Navoiy ko'chasi", "description": "Yo'l qazilgan",
	}
}

func TestSubmitRoadLineHappyPath(t *testing.T) {
	f := &fakeSubmitter{}
	w := serve(submitServer(t, f), multipartRequest(t, []part{dataPart(t, roadData())}))
	if w.Code != http.StatusCreated {
		t.Fatalf("201 kutilgan, %d: %s", w.Code, w.Body.String())
	}
	if f.count() != 1 {
		t.Fatalf("karantinga %d ta yozildi", f.count())
	}
	got := f.saved[0].Clean
	if got.Kind != "road" || !got.IsLine() || len(got.Line) != 3 {
		t.Fatalf("yo'l chiziq bo'lib saqlanishi kerak: %+v", got)
	}
	if got.Lat != 0 || got.Lng != 0 {
		t.Errorf("chiziqda lat/lng ishlatilmaydi: %v,%v", got.Lat, got.Lng)
	}
	// Nuqtalar tartibi va [lng, lat] shakli saqlangan.
	if got.Line[0] != [2]float64{71.24, 41.0} || got.Line[2] != [2]float64{71.2425, 41.0016} {
		t.Errorf("nuqtalar buzildi: %v", got.Line)
	}
}

func TestSubmitRoadLineMaxPointsFitsDataLimit(t *testing.T) {
	// Eng ko'p nuqta (500) — brauzer 6 xonaga yaxlitlab yuboradi: 32 KB ga sig'adi.
	line := make([][2]float64, places.MaxLinePoints)
	for i := range line {
		line[i] = [2]float64{71.240000 + float64(i)*0.000010, 41.000000 + float64(i%7)*0.000010}
	}
	d := roadData()
	d["line"] = line
	f := &fakeSubmitter{}
	w := serve(submitServer(t, f), multipartRequest(t, []part{dataPart(t, d)}))
	if w.Code != http.StatusCreated {
		t.Fatalf("500 nuqtali yo'l qabul qilinishi kerak: %d %s", w.Code, w.Body.String())
	}
	if len(f.saved[0].Line) < 2 {
		t.Errorf("chiziq saqlanmadi")
	}
}

func TestSubmitRoadRejections(t *testing.T) {
	many := make([][2]float64, places.MaxLinePoints+1)
	for i := range many {
		many[i] = [2]float64{71.0 + float64(i)*0.00001, 41.0}
	}
	cases := map[string]func(d map[string]any){
		"nuqta bilan (lat/lng)":  func(d map[string]any) { delete(d, "line"); d["lat"], d["lng"] = 41.0, 71.24 },
		"ham nuqta, ham chiziq":  func(d map[string]any) { d["lat"], d["lng"] = 41.0, 71.24 },
		"chiziq yo'q":            func(d map[string]any) { delete(d, "line") },
		"bitta nuqta":            func(d map[string]any) { d["line"] = [][2]float64{{71.24, 41.0}} },
		"bir xil ikki nuqta":     func(d map[string]any) { d["line"] = [][2]float64{{71.24, 41.0}, {71.24, 41.0}} },
		"juda uzun (>30 km)":     func(d map[string]any) { d["line"] = [][2]float64{{71.0, 41.0}, {71.5, 41.0}} },
		"juda ko'p nuqta":        func(d map[string]any) { d["line"] = many },
		"hududdan tashqari":      func(d map[string]any) { d["line"] = [][2]float64{{37.6, 55.7}, {37.61, 55.71}} },
		"chiziq noto'g'ri shakl": func(d map[string]any) { d["line"] = "71.24,41.0" },
		"nuqta 3 koordinatali":   func(d map[string]any) { d["line"] = [][]float64{{71.24, 41.0, 5}, {71.25, 41.0, 5}} },
		"shlagbaumga chiziq": func(d map[string]any) {
			d["kind"] = "barrier"
			delete(d, "name")
		},
	}
	for name, mutate := range cases {
		d := roadData()
		mutate(d)
		f := &fakeSubmitter{}
		w := serve(submitServer(t, f), multipartRequest(t, []part{dataPart(t, d)}))
		if w.Code != http.StatusBadRequest {
			t.Errorf("%s: 400 kutilgan, %d: %s", name, w.Code, w.Body.String())
		}
		if f.count() != 0 {
			t.Errorf("%s: rad etilgan so'rov SAQLANDI", name)
		}
	}
}

func TestSubmitPointKindStillWorksAndRejectsLine(t *testing.T) {
	// Nuqta turi avvalgidek ishlaydi...
	f := &fakeSubmitter{}
	w := serve(submitServer(t, f), multipartRequest(t, []part{dataPart(t, validData())}))
	if w.Code != http.StatusCreated || f.saved[0].Lat != 41.0 || f.saved[0].IsLine() {
		t.Fatalf("nuqta turi buzildi: %d %s", w.Code, w.Body.String())
	}
	// ...va chiziq yuborilsa rad etiladi.
	d := validData()
	d["line"] = roadData()["line"]
	f2 := &fakeSubmitter{}
	w = serve(submitServer(t, f2), multipartRequest(t, []part{dataPart(t, d)}))
	if w.Code != http.StatusBadRequest || f2.count() != 0 {
		t.Errorf("nuqta turiga chiziq rad etilishi kerak: %d", w.Code)
	}
}

func TestSubmitRoadErrorDoesNotEchoInput(t *testing.T) {
	d := roadData()
	d["line"] = [][2]float64{{71.24, 41.0}, {math.MaxFloat64 / 1e300, 999999.5}}
	w := serve(submitServer(t, &fakeSubmitter{}), multipartRequest(t, []part{dataPart(t, d)}))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("400 kutilgan, %d", w.Code)
	}
	if msg := errMsg(t, w); strings.Contains(msg, "999999") {
		t.Errorf("xato kiruvchi qiymatni aks ettirdi: %q", msg)
	}
}

func TestPlacesMetaExposesGeometryAndLineLimits(t *testing.T) {
	w := do(submitServer(t, &fakeSubmitter{}), "GET", "/v1/places/meta", "")
	if w.Code != http.StatusOK {
		t.Fatalf("meta: %d", w.Code)
	}
	var m struct {
		Kinds []struct {
			Key      string `json:"key"`
			Label    string `json:"label"`
			Geometry string `json:"geometry"`
			Line     *struct {
				MinM      float64 `json:"min_m"`
				MaxM      float64 `json:"max_m"`
				MaxPoints int     `json:"max_points"`
			} `json:"line"`
			Allowed []string `json:"allowed"`
		} `json:"kinds"`
		Limits      map[string]int `json:"limits"`
		SocialHosts []string       `json:"social_hosts"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &m); err != nil {
		t.Fatal(err)
	}
	// Chiziq turlari: yo'l, piyodalar o'tish joyi va to'siq; qolganlari nuqta.
	lineKinds := map[string]bool{"road": true, "crossing": true, "fence": true}
	for _, k := range m.Kinds {
		want := "point"
		if lineKinds[k.Key] {
			want = "line"
		}
		if k.Geometry != want {
			t.Errorf("%s: geometry %q, %q kutilgan", k.Key, k.Geometry, want)
		}
		// Chiziq turi o'z chegarasini metada beradi, nuqta turi bermaydi.
		if lineKinds[k.Key] != (k.Line != nil) {
			t.Errorf("%s: `line` chegarasi faqat chiziq turlarida bo'lishi kerak: %+v", k.Key, k.Line)
		}
		if k.Key == "crossing" && (k.Line == nil || k.Line.MaxM != 10) {
			t.Errorf("piyodalar o'tish joyi eng ko'pi 10 m bo'lishi kerak: %+v", k.Line)
		}
		if k.Key == "gate" && k.Label != "Darvoza" {
			t.Errorf("gate yorlig'i «Darvoza» bo'lishi kerak: %q", k.Label)
		}
		if k.Key == "organization" {
			has := map[string]bool{}
			for _, f := range k.Allowed {
				has[f] = true
			}
			if !has["phone"] || !has["site"] || !has["social"] {
				t.Errorf("tashkilotda telefon, sayt va ijtimoiy tarmoq maydonlari bo'lishi kerak: %v", k.Allowed)
			}
		}
	}
	if len(m.SocialHosts) == 0 || m.Limits["site"] != places.MaxSite || m.Limits["social"] != places.MaxSocial {
		t.Errorf("meta sayt/ijtimoiy tarmoq chegaralarini va domenlar ro'yxatini berishi kerak: %v %v", m.Limits, m.SocialHosts)
	}
	if m.Limits["line_points"] != places.MaxLinePoints ||
		m.Limits["line_min_m"] != int(places.MinLineMeters) ||
		m.Limits["line_max_m"] != int(places.MaxLineMeters) {
		t.Errorf("chiziq chegaralari metada bo'lishi kerak: %v", m.Limits)
	}
}
