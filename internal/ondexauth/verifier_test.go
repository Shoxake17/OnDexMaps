package ondexauth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestVerify(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.Path != "/v2/admin/whoami" {
			http.NotFound(w, r)
			return
		}
		switch r.Header.Get("Authorization") {
		case "Bearer yaxshi":
			_, _ = w.Write([]byte(`{"user_id":"u_admin","name":"Egasi","session_id":"s1"}`))
		case "Bearer xato5":
			w.WriteHeader(http.StatusBadGateway)
		case "Bearer yonaltir":
			http.Redirect(w, r, "https://evil.test/steal", http.StatusFound)
		default:
			w.WriteHeader(http.StatusUnauthorized)
		}
	}))
	defer srv.Close()

	v, err := New(srv.URL + "/")
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()

	a, err := v.Verify(ctx, "yaxshi")
	if err != nil || a.UserID != "u_admin" {
		t.Fatalf("haqiqiy token: %+v %v", a, err)
	}
	if _, err := v.Verify(ctx, "yaxshi"); err != nil || calls.Load() != 1 {
		t.Fatalf("kesh ishlamadi: chaqiruvlar %d, %v", calls.Load(), err)
	}
	// Kesh muddati o'tgach — qayta tekshiriladi (bekor qilish kuchga kiradi).
	base := time.Now()
	v.now = func() time.Time { return base.Add(2 * time.Minute) }
	if _, err := v.Verify(ctx, "yaxshi"); err != nil || calls.Load() != 2 {
		t.Fatalf("kesh muddati: chaqiruvlar %d", calls.Load())
	}

	for tok, want := range map[string]error{
		"soxta":    ErrUnauthorized,
		"":         ErrUnauthorized,
		"xato5":    ErrUnavailable,
		"yonaltir": ErrUnavailable, // yo'naltirishga ERGASHMAYDI
	} {
		if _, err := v.Verify(ctx, tok); !errors.Is(err, want) {
			t.Errorf("%q: %v, kutilgan %v", tok, err, want)
		}
	}

	for _, bad := range []string{"", "ftp://x", "http://user:p@host", "nohost"} {
		if _, err := New(bad); err == nil {
			t.Errorf("noto'g'ri manzil qabul qilindi: %q", bad)
		}
	}
}
