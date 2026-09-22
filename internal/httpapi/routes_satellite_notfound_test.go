package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// Esri (va shunga o'xshash) sun'iy yo'ldosh manbalari hamma hudud/zoomda
// tile saqlamaydi — masalan Chust kabi kichik shaharlarda kesh z17 da
// tugaydi, z18 uchun 404 qaytaradi. Bu XATO emas, shuning uchun mijozga
// 502 EMAS, 404 qaytarilishi kerak (aks holda konsol cheksiz "Bad
// Gateway" bilan to'lib, haqiqiy server nosozligidan farqlanmaydi).
func TestSatelliteUpstream404BecomesClientNotFound(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	defer upstream.Close()

	cfg := baseCfg()
	cfg.SatelliteURL = upstream.URL + "/{z}/{y}/{x}"
	h := testServer(t, cfg)

	// Chust atrofidagi haqiqiy z/x/y — O'zbekiston chegarasi ichida,
	// aks holda `tileInUzbekistan` upstream'ga umuman murojaat qilmay
	// turib 404 qaytaradi va test hech narsani tekshirmagan bo'ladi.
	w := do(h, "GET", "/tiles/satellite/18/180486/99133", "")
	if w.Code != http.StatusNotFound {
		t.Fatalf("kutilgan 404, keldi %d", w.Code)
	}
}

// Haqiqiy yuqori oqim nosozligi (500, tarmoq xatosi va h.k.) hamon 502
// bo'lib qolishi kerak — bu bizning/provayderning muammosi, "bu yerda
// tasvir yo'q" degani emas.
func TestSatelliteUpstream500StaysBadGateway(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "ichki xato", http.StatusInternalServerError)
	}))
	defer upstream.Close()

	cfg := baseCfg()
	cfg.SatelliteURL = upstream.URL + "/{z}/{y}/{x}"
	h := testServer(t, cfg)

	w := do(h, "GET", "/tiles/satellite/18/180486/99133", "")
	if w.Code != http.StatusBadGateway {
		t.Fatalf("kutilgan 502, keldi %d", w.Code)
	}
}
