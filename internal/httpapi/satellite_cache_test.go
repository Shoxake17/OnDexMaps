package httpapi

import (
	"os"
	"path/filepath"
	"testing"
)

// Proksi FAQAT O'zbekiston ustidagi tile'ni oladi.
//
// Nega muhim: manzil ochiq (kalit serverda), ya'ni begona sayt uni
// o'z xaritasiga ulab, butun dunyo tasvirini bizning provayderdagi
// bepul chegaramiz hisobidan ko'rsatishi mumkin edi.
func TestTileBoundsGuard(t *testing.T) {
	cases := []struct {
		name    string
		z, x, y int
		want    bool
	}{
		// Chust markazi — xizmatning asosiy hududi.
		{"chust z17", 17, 91475, 49144, true},
		// Toshkent va Nukus: cheklov Chust bilan emas, BUTUN mamlakat
		// bilan bog'langanini qulflaydi.
		{"toshkent z14", 14, 11529, 6144, true},
		{"nukus z12", 12, 2806, 1541, true},
		// Mamlakatdan tashqarida — olinmasligi kerak.
		{"parij z12", 12, 2074, 1409, false},
		{"nyu-york z12", 12, 1205, 1539, false},
		// Past zoomda bitta tile mamlakatdan kattaroq — o'tishi kerak,
		// aks holda uzoqdan qaralganda ekran bo'sh qolardi.
		{"butun dunyo z0", 0, 0, 0, true},
	}
	for _, c := range cases {
		if got := tileInUzbekistan(c.z, c.x, c.y); got != c.want {
			t.Errorf("%s: kutilgan %v, olingan %v", c.name, c.want, got)
		}
	}
}

// Kesh faqat HAQIQIY rasmni saqlaydi va qaytaradi.
//
// Provayder xato holatida HTML yoki XML qaytarishi mumkin. U "tasvir"
// deb keshga tushsa, nosozlik diskda QOLIB KETARDI: brauzer har
// ochilganda «could not be decoded» berardi va sabab tashqi tomonda
// allaqachon tuzalgan bo'lsa ham xarita buzuq ko'rinaverardi.
func TestCacheRejectsNonImages(t *testing.T) {
	c := newTileCache(t.TempDir(), 16)
	if c == nil {
		t.Fatal("kesh yaratilmadi")
	}

	c.put(10, 1, 2, []byte("<html>xato</html>"))
	if _, _, ok := c.get(10, 1, 2); ok {
		t.Error("rasm bo'lmagan javob keshga tushdi")
	}

	jpeg := []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10}
	c.put(10, 1, 2, jpeg)
	body, ct, ok := c.get(10, 1, 2)
	if !ok {
		t.Fatal("JPEG keshdan o'qilmadi")
	}
	if ct != "image/jpeg" {
		t.Errorf("kutilgan image/jpeg, olingan %q", ct)
	}
	if len(body) != len(jpeg) {
		t.Errorf("kutilgan %d bayt, olingan %d", len(jpeg), len(body))
	}
}

// Diskdagi buzilgan fayl "kesh yo'q" deb hisoblanishi kerak — tile
// qaytadan olinadi va foydalanuvchi buzuq katak ko'rmaydi.
func TestCacheIgnoresCorruptFile(t *testing.T) {
	dir := t.TempDir()
	c := newTileCache(dir, 16)
	if c == nil {
		t.Fatal("kesh yaratilmadi")
	}

	p := c.path(5, 6, 7)
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, []byte("yarim yozilgan"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, _, ok := c.get(5, 6, 7); ok {
		t.Error("buzilgan fayl kesh sifatida qabul qilindi")
	}
}

// Sozlanmagan kesh — xato emas, shunchaki o'chiq holat.
//
// `nil` keshda metod chaqirilishi PANIKA bermasligi kerak: kesh
// optimizatsiya, tile'lar usiz ham berilaveradi.
func TestNilCacheIsSafe(t *testing.T) {
	var c *tileCache
	if newTileCache("", 100) != nil {
		t.Error("papkasiz kesh yaratilmasligi kerak")
	}
	if _, _, ok := c.get(1, 2, 3); ok {
		t.Error("nil keshda tile topildi")
	}
	c.put(1, 2, 3, []byte{0xFF, 0xD8, 0xFF}) // panika bermasligi kerak
}
