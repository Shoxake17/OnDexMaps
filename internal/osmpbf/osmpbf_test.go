package osmpbf

import (
	"bufio"
	"os"
	"testing"
)

func TestUnzigzag(t *testing.T) {
	// Protobuf spetsifikatsiyasidagi jadval: 0→0, 1→-1, 2→1, 3→-2, 4→2.
	for in, want := range map[uint64]int64{0: 0, 1: -1, 2: 1, 3: -2, 4: 2, 4294967294: 2147483647, 4294967295: -2147483648} {
		if got := unzigzag(in); got != want {
			t.Errorf("unzigzag(%d) = %d, kutilgan %d", in, got, want)
		}
	}
}

func TestPackedVarints(t *testing.T) {
	// 300 = 0xAC 0x02, 1 = 0x01
	if got := packedUvarints([]byte{0xAC, 0x02, 0x01}); len(got) != 2 || got[0] != 300 || got[1] != 1 {
		t.Errorf("packedUvarints: %v", got)
	}
	// Kesilgan varint (oxirgi bayt davomi bor deydi) — panika bo'lmasligi kerak.
	_ = packedUvarints([]byte{0xAC})
}

// Buzuq kirish PANIKA bermasligi kerak — fayl tashqaridan kelishi mumkin.
func TestMalformedInputDoesNotPanic(t *testing.T) {
	p := pb{b: []byte{0x0A, 0xFF}} // uzunligi 255, lekin ma'lumot yo'q
	p.tag()
	if b := p.bytes(); b != nil || p.err == nil {
		t.Error("kesilgan xabar xato bermadi")
	}
}

// Haqiqiy fayl bilan tutun testi. `OSM_PBF=D:\...\uzbekistan.osm.pbf` berilsa
// ishlaydi, aks holda o'tkazib yuboriladi (CI'da katta fayl yo'q).
func TestScanRealFile(t *testing.T) {
	path := os.Getenv("OSM_PBF")
	if path == "" {
		t.Skip("OSM_PBF berilmagan")
	}
	f, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = f.Close() }()

	var nodes, tagged, ways, rels, named int
	var h Handler
	h.Want.Nodes, h.Want.Ways, h.Want.Relations = true, true, true
	h.Node = func(_ int64, lat, lon float64, tags Tags) {
		nodes++
		if lat < -90 || lat > 90 || lon < -180 || lon > 180 {
			t.Fatalf("koordinata chegaradan tashqarida: %v %v", lat, lon)
		}
		if tags != nil {
			tagged++
			if tags["name"] != "" {
				named++
			}
		}
	}
	h.Way = func(_ int64, refs []int64, _ Tags) {
		ways++
		if len(refs) > 0 && refs[0] <= 0 {
			t.Fatalf("yo'l tugun id noto'g'ri: %d", refs[0])
		}
	}
	h.Relation = func(int64, []Member, Tags) { rels++ }

	if err := Scan(bufio.NewReaderSize(f, 1<<20), h); err != nil {
		t.Fatal(err)
	}
	t.Logf("tugun=%d (tegli=%d, nomli=%d) yo'l=%d relyatsiya=%d", nodes, tagged, named, ways, rels)
	if nodes == 0 || ways == 0 || rels == 0 {
		t.Error("fayl bo'sh ko'rinadi")
	}
}
