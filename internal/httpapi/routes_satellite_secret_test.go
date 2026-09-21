package httpapi

import (
	"net/http/httptest"
	"strings"
	"testing"
)

// API kalit xato matniga (va shu bilan LOGGA) tushmasligi shart.
//
// Bu haqiqatan yuz bergan: `http.Client.Do` xatosi to'liq manzilni, ya'ni
// `?token=KEY` ni ham yozadi va u `slog.Warn` orqali log fayliga tushgan.
func TestSatelliteErrorsNeverContainUpstreamURL(t *testing.T) {
	const secret = "SUPER-SECRET-KEY-123"

	// 1) Ulanib bo'lmaydigan manba: server yopilgan — `connection refused`.
	dead := httptest.NewServer(nil)
	deadURL := dead.URL
	dead.Close()

	cfg := baseCfg()
	cfg.SatelliteURL = deadURL + "/tile/{z}/{y}/{x}?token=" + secret
	s := New(cfg, nil)

	req := httptest.NewRequest("GET", "/tiles/satellite/1/1/1", nil)
	upstream := tileURL(cfg.SatelliteURL, 1, 1, 1)
	_, _, err := s.fetchSatelliteTile(req, upstream)
	if err == nil {
		t.Fatal("yopiq manbadan xato kutilgan edi")
	}
	if strings.Contains(err.Error(), secret) || strings.Contains(err.Error(), "token=") {
		t.Errorf("xato matnida kalit bor: %v", err)
	}

	// 2) Yaroqsiz manzil (`NewRequest` xatosi ham manzilni yozadi).
	cfg2 := baseCfg()
	cfg2.SatelliteURL = "http://exa mple.com/{z}?token=" + secret // probel — parse xatosi
	s2 := New(cfg2, nil)
	_, _, err = s2.fetchSatelliteTile(req, tileURL(cfg2.SatelliteURL, 1, 1, 1))
	if err == nil {
		t.Fatal("yaroqsiz manzildan xato kutilgan edi")
	}
	if strings.Contains(err.Error(), secret) {
		t.Errorf("parse xatosida kalit bor: %v", err)
	}
}
