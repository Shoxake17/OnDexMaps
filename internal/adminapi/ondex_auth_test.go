package adminapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"ondexmap/internal/apikey"
	"ondexmap/internal/ondexauth"
)

type fakeOnDex map[string]error

func (f fakeOnDex) Verify(_ context.Context, tok string) (*ondexauth.Admin, error) {
	if err, ok := f[tok]; ok {
		if err != nil {
			return nil, err
		}
		return &ondexauth.Admin{UserID: "u_admin", SessionID: "s1"}, nil
	}
	return nil, ondexauth.ErrUnauthorized
}

// A6/138: OnDex ID admin tokeni — asosiy kirish; kalitsiz rejimda statik
// kalit umuman yo'q; OnDex ishlamasa — ruxsat YO'Q (fail closed).
func TestRequireKey_OnDexToken(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	try := func(s *Server, method string, hdr map[string]string) int {
		r := httptest.NewRequest(method, "/api/street", nil)
		for k, v := range hdr {
			r.Header.Set(k, v)
		}
		w := httptest.NewRecorder()
		s.requireKey(ok)(w, r)
		return w.Code
	}
	v := fakeOnDex{"yaxshi": nil, "ishlamayapti": ondexauth.ErrUnavailable}

	onlyOnDex := (&Server{keys: apikey.New()}).WithOnDex(v)
	for name, c := range map[string]struct {
		hdr  map[string]string
		want int
	}{
		"haqiqiy OnDex admin tokeni":         {map[string]string{"Authorization": "Bearer yaxshi"}, 204},
		"soxta token":                        {map[string]string{"Authorization": "Bearer soxta"}, 401},
		"OnDex javob bermaydi (fail closed)": {map[string]string{"Authorization": "Bearer ishlamayapti"}, 503},
		"tokensiz":                           {nil, 401},
		"kalit yo'q rejimda X-API-Key":       {map[string]string{"X-API-Key": "har-qanday"}, 401},
	} {
		if got := try(onlyOnDex, http.MethodPost, c.hdr); got != c.want {
			t.Errorf("%s: %d, kutilgan %d", name, got, c.want)
		}
	}

	// Favqulodda kalit qoldirilgan bo'lsa ham ishlaydi; OnDex tokeni ham.
	both := (&Server{keys: apikey.New("favqulodda-kalit-0123456789abcdef0123")}).WithOnDex(v)
	if got := try(both, http.MethodGet, map[string]string{"X-API-Key": "favqulodda-kalit-0123456789abcdef0123"}); got != 204 {
		t.Errorf("favqulodda kalit: %d", got)
	}
	if got := try(both, http.MethodGet, map[string]string{"Authorization": "Bearer yaxshi"}); got != 204 {
		t.Errorf("OnDex tokeni (kalit ham bor): %d", got)
	}

	// OnDex ulanmagan (lokal cmd/admin): Bearer e'tiborga olinmaydi.
	local := &Server{keys: apikey.New("lokal-sessiya-kaliti-0123456789abcdef")}
	if got := try(local, http.MethodGet, map[string]string{"Authorization": "Bearer yaxshi"}); got != 401 {
		t.Errorf("lokal rejimda Bearer: %d", got)
	}
}
