package localsession

import (
	"encoding/json"
	"os"
	"testing"
)

// Sessiya fayli yoziladi, tokeni to'yingan (kuchli) va o'chirilganda
// diskda qolmaydi.
func TestCreateWritesTokenAndRemoveDeletesIt(t *testing.T) {
	// `os.UserCacheDir` LOCALAPPDATA/XDG_CACHE_HOME ni o'qiydi — test
	// haqiqiy profilga yozmasin.
	dir := t.TempDir()
	t.Setenv("LOCALAPPDATA", dir)
	t.Setenv("XDG_CACHE_HOME", dir)

	s, err := Create("http://127.0.0.1:8091")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	// 32 bayt base64 (padding'siz) = 43 belgi. Qisqa token — taxmin
	// qilinadigan token degani.
	if len(s.Token) < 40 {
		t.Errorf("token juda qisqa: %d belgi", len(s.Token))
	}

	body, err := os.ReadFile(s.Path)
	if err != nil {
		t.Fatalf("fayl o'qilmadi: %v", err)
	}
	var got struct {
		URL   string `json:"url"`
		Token string `json:"token"`
		PID   int    `json:"pid"`
	}
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatalf("JSON buzilgan: %v", err)
	}
	if got.Token != s.Token {
		t.Error("fayldagi token qaytarilgan token bilan bir xil emas")
	}
	if got.URL != "http://127.0.0.1:8091" {
		t.Errorf("manzil yozilmagan: %q", got.URL)
	}
	if got.PID != os.Getpid() {
		t.Errorf("PID yozilmagan: %d", got.PID)
	}

	s.Remove()
	if _, err := os.Stat(s.Path); !os.IsNotExist(err) {
		t.Error("fayl o'chirilmadi — o'lgan serverning tokeni diskda qoladi")
	}
}

// Har chaqiruv YANGI token beradi.
func TestTokensAreUnique(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("LOCALAPPDATA", dir)
	t.Setenv("XDG_CACHE_HOME", dir)

	a, err := Create("http://127.0.0.1:8091")
	if err != nil {
		t.Fatal(err)
	}
	b, err := Create("http://127.0.0.1:8091")
	if err != nil {
		t.Fatal(err)
	}
	if a.Token == b.Token {
		t.Fatal("ikki sessiya bir xil token oldi")
	}
}
