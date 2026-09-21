package httpapi

import (
	"encoding/json"
	"fmt"
	"testing"
)

// Xarita uslubi buzilsa, MapLibre uni BUTUNLAY rad etadi va xarita
// umuman chizilmaydi — oq ekran qoladi. Brauzer konsolidan tashqari
// hech qanday belgi bo'lmaydi, shuning uchun bu testlar mavjud.
//
// Bu yerdagi tekshiruvlar — bir marta HAQIQATAN yuz bergan
// nosozliklarning takrorlanmasligi uchun.

// `zoom` ifodasi FAQAT eng tashqi `interpolate`/`step` ning kirishi
// bo'la oladi.
//
// Bir marta `text-opacity` ga `["case", ..., ["interpolate", ...zoom...], 1]`
// yozilgan va MapLibre butun uslubni rad etgan: xarita oq ekranga
// aylangan, sabab esa darhol ko'rinmagan. Qoidani test qulflaydi.
func TestStyleZoomOnlyAsTopLevelInput(t *testing.T) {
	cfg := baseCfg()
	cfg.TilesURL = "https://example.test/tiles.pmtiles"
	cfg.BuildingsURL = "https://example.test/buildings.pmtiles"
	s := New(cfg, nil)

	var style struct {
		Layers []map[string]any `json:"layers"`
	}
	if err := json.Unmarshal(s.buildStyle(), &style); err != nil {
		t.Fatalf("uslub o'qilmadi: %v", err)
	}
	if len(style.Layers) == 0 {
		t.Fatal("uslubda qatlam yo'q")
	}

	for _, layer := range style.Layers {
		id, _ := layer["id"].(string)
		for _, section := range []string{"paint", "layout"} {
			props, _ := layer[section].(map[string]any)
			for prop, val := range props {
				if bad := findLooseZoom(val, true); bad != "" {
					t.Errorf("%s.%s.%s: `zoom` noto'g'ri joyda (%s).\n"+
						"  MapLibre bunday uslubni BUTUNLAY rad etadi — xarita oq qoladi.\n"+
						"  To'g'risi: `interpolate` eng tashqarida, shartlar uning natijasi ichida.",
						id, section, prop, bad)
				}
			}
		}
	}
}

// findLooseZoom — ifoda daraxtida qoidabuzar `zoom` ni qidiradi.
//
// `zoomOK` — shu tugun `interpolate`/`step` ning KIRISH slotimi.
// Bo'sh satr qaytsa — muammo yo'q.
func findLooseZoom(v any, zoomOK bool) string {
	expr, ok := v.([]any)
	if !ok || len(expr) == 0 {
		return ""
	}

	op, _ := expr[0].(string)
	if op == "zoom" {
		if zoomOK {
			return ""
		}
		return "ichki ifoda ichida"
	}

	// Qaysi bola kirish slotida ekani operatorga bog'liq:
	//   ["interpolate", <tur>, <kirish>, ...]
	//   ["step", <kirish>, ...]
	inputIdx := -1
	switch op {
	case "interpolate", "interpolate-hcl", "interpolate-lab":
		inputIdx = 2
	case "step":
		inputIdx = 1
	}

	for i := 1; i < len(expr); i++ {
		// Kirish sloti faqat ifodaning O'ZI eng tashqarida bo'lsa
		// `zoom` ga ruxsat beradi.
		childOK := zoomOK && i == inputIdx
		if bad := findLooseZoom(expr[i], childOK); bad != "" {
			return fmt.Sprintf("%s → %s", op, bad)
		}
	}
	return ""
}

// Tekshiruvchining O'ZI ishlayotganini isbotlaydi.
//
// Usiz yuqoridagi test bekorga o'tishi mumkin edi: agar `findLooseZoom`
// hech qachon hech narsa topmasa, u ham "PASS" beraveradi va biz
// himoyalanganmiz deb o'ylab yuraverardik.
func TestLooseZoomDetectorCatchesTheRealBug(t *testing.T) {
	// Xaritani oq ekranga aylantirgan AYNAN o'sha ifoda.
	broken := []any{
		"case",
		[]any{"in", []any{"get", "class"}, []any{"literal", []any{"city", "town"}}},
		[]any{"interpolate", []any{"linear"}, []any{"zoom"}, 13.0, 1.0, 15.0, 0.0},
		1.0,
	}
	if findLooseZoom(broken, true) == "" {
		t.Fatal("tekshiruvchi haqiqiy nosozlikni TOPMADI — test bekorga o'tayotgan ekan")
	}

	// To'g'ri shakl esa o'tishi kerak.
	fixed := []any{
		"interpolate", []any{"linear"}, []any{"zoom"},
		13.0, 1.0,
		15.0, []any{"case", []any{"in", []any{"get", "class"}, []any{"literal", []any{"city"}}}, 0.0, 1.0},
	}
	if bad := findLooseZoom(fixed, true); bad != "" {
		t.Errorf("to'g'ri ifoda xato deb belgilandi: %s", bad)
	}
}

// Har bir qatlam mavjud manbaga tayanishi kerak. Yo'q manbaga
// murojaat qilgan qatlam ham butun uslubni yiqitadi.
func TestStyleLayersReferenceExistingSources(t *testing.T) {
	cfg := baseCfg()
	cfg.TilesURL = "https://example.test/tiles.pmtiles"
	cfg.BuildingsURL = "https://example.test/buildings.pmtiles"
	s := New(cfg, nil)

	var style struct {
		Sources map[string]any   `json:"sources"`
		Layers  []map[string]any `json:"layers"`
	}
	if err := json.Unmarshal(s.buildStyle(), &style); err != nil {
		t.Fatalf("uslub o'qilmadi: %v", err)
	}

	for _, layer := range style.Layers {
		id, _ := layer["id"].(string)
		src, has := layer["source"].(string)
		if !has {
			continue // `background` qatlamida manba bo'lmaydi
		}
		if _, ok := style.Sources[src]; !ok {
			t.Errorf("%s: mavjud bo'lmagan manbaga tayanadi (%q)", id, src)
		}
		// Vektor manbadan o'qiydigan qatlamda `source-layer` SHART.
		if _, ok := layer["source-layer"].(string); !ok {
			t.Errorf("%s: `source-layer` yo'q", id)
		}
	}
}
