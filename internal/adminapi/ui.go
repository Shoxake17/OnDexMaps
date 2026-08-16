package adminapi

import (
	_ "embed"
	"net/http"
)

//go:embed assets/admin.html
var adminHTML []byte

// serveUI — admin sahifasi.
//
// Sahifaning O'ZI kalit talab qilmaydi (u shunchaki HTML), lekin
// undagi HAR BIR ma'lumot chaqiruvi admin kalitini talab qiladi.
// Kalitsiz sahifa ochilsa — bo'sh kirish ekrani ko'rinadi, xolos.
func (s *Server) serveUI(w http.ResponseWriter, r *http.Request) {
	// `GET /` shabloni boshqa yo'llarga ham mos keladi, shuning uchun
	// aniq tekshiruv: noma'lum yo'l 404 bo'lsin.
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(adminHTML)
}
