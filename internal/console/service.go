package console

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"ondexmap/internal/devplatform"
)

// Sessiya muddatlari.
const (
	sessionAbsolute = 7 * 24 * time.Hour // eng ko'pi bilan
	sessionIdle     = 24 * time.Hour     // faolsizlik
	touchEvery      = 5 * time.Minute
	maxBody         = 32 << 10
	maxActiveKeys   = 10
)

// Config — konsol sozlamalari.
type Config struct {
	Pepper              []byte // KEY_PEPPER (kalit, OTP va IP xeshlari uchun; domen ajratilgan)
	Origin              string // https://console.ondex.uz — CSRF/Origin tekshiruvi
	Secure              bool   // production: __Host- cookie + HSTS
	TrustedProxies      []string
	BillingInstructions string
	TurnstileSecret     string
	Plans               devplatform.Plans
}

// Server — konsol HTTP API'si.
type Server struct {
	cfg   Config
	store Store
	mail  Mailer
	lim   *devplatform.Limiter
	now   func() time.Time
	http  *http.Client
}

// New — Server.
func New(cfg Config, store Store, mail Mailer) *Server {
	return &Server{cfg: cfg, store: store, mail: mail, lim: devplatform.NewLimiter(),
		now: time.Now, http: &http.Client{Timeout: 5 * time.Second}}
}

// Handler — barcha marshrutlar + xavfsizlik sarlavhalari.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("POST /api/auth/request-code", s.public(s.handleRequestCode))
	mux.HandleFunc("POST /api/auth/verify", s.public(s.handleVerify))
	mux.HandleFunc("POST /api/auth/logout", s.authed(s.handleLogout))
	mux.HandleFunc("GET /api/me", s.authed(s.handleMe))
	mux.HandleFunc("PATCH /api/me", s.authed(s.handleUpdateMe))
	mux.HandleFunc("GET /api/keys", s.authed(s.handleListKeys))
	mux.HandleFunc("POST /api/keys", s.authed(s.handleCreateKey))
	mux.HandleFunc("PATCH /api/keys/{id}", s.authed(s.handleUpdateKey))
	mux.HandleFunc("POST /api/keys/{id}/rotate", s.authed(s.handleRotateKey))
	mux.HandleFunc("DELETE /api/keys/{id}", s.authed(s.handleRevokeKey))
	mux.HandleFunc("GET /api/usage", s.authed(s.handleUsage))
	mux.HandleFunc("GET /api/billing", s.authed(s.handleBilling))
	mux.HandleFunc("POST /api/billing/subscribe-request", s.authed(s.handleSubscribeRequest))
	mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
		apiError(w, http.StatusNotFound, "not_found", "topilmadi")
	})
	return s.securityHeaders(mux)
}

func (s *Server) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		h.Set("Cross-Origin-Resource-Policy", "same-origin")
		h.Set("Cache-Control", "no-store")
		if s.cfg.Secure {
			h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		next.ServeHTTP(w, r)
	})
}

// ── javob yordamchilari ──

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func apiError(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, map[string]any{"error": map[string]string{"code": code, "message": msg}})
}

func serverError(w http.ResponseWriter, what string, err error) {
	slog.Error(what, "err", err) // haqiqiy sabab faqat logga
	apiError(w, http.StatusInternalServerError, "internal", "ichki xato")
}

// decodeJSON — qat'iy: faqat application/json, 32 KB, noma'lum maydon yo'q, ortiqcha ma'lumot yo'q.
func decodeJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	ct := strings.ToLower(strings.TrimSpace(strings.SplitN(r.Header.Get("Content-Type"), ";", 2)[0]))
	if ct != "application/json" {
		apiError(w, http.StatusUnsupportedMediaType, "unsupported_media_type", "Content-Type: application/json kerak")
		return false
	}
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBody))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		apiError(w, http.StatusBadRequest, "invalid_request", "JSON noto'g'ri")
		return false
	}
	if _, err := dec.Token(); !errors.Is(err, io.EOF) {
		apiError(w, http.StatusBadRequest, "invalid_request", "JSON noto'g'ri")
		return false
	}
	return true
}

// ── IP va xeshlar ──

func (s *Server) clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	trusted := false
	for _, p := range s.cfg.TrustedProxies {
		if p == host {
			trusted = true
			break
		}
	}
	if !trusted {
		return host
	}
	fwd := r.Header.Get("X-Forwarded-For")
	if fwd == "" {
		return host
	}
	parts := strings.Split(fwd, ",")
	return strings.TrimSpace(parts[len(parts)-1]) // eng o'ngdagisi — ishonchli proksi yozgan
}

// domainHash — HMAC(pepper, domen|qiymat): kalit/OTP/IP xeshlari bir-biridan ajratilgan.
func (s *Server) domainHash(domain, value string) []byte {
	m := hmac.New(sha256.New, s.cfg.Pepper)
	m.Write([]byte(domain + "|" + value))
	return m.Sum(nil)
}

func (s *Server) ipHash(ip string) string {
	return hex.EncodeToString(s.domainHash("ip", ip))[:16]
}

func randomToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func sessionHash(token string) []byte {
	h := sha256.Sum256([]byte(token))
	return h[:]
}

// ── middleware ──

// reqCtx — autentifikatsiyadan o'tgan so'rov konteksti.
type reqCtx struct {
	acc    *Account
	sess   *Session
	ip     string
	ipHash string
}

func (s *Server) cookieName() string {
	if s.cfg.Secure {
		return "__Host-omk_session"
	}
	return "omk_session"
}

func (s *Server) setSessionCookie(w http.ResponseWriter, token string, maxAge int) {
	//nolint:gosec // G124: Secure=true production'da (`cfg.Secure`); faqat lokal http://localhost dev'da o'chiq.
	http.SetCookie(w, &http.Cookie{
		Name: s.cookieName(), Value: token, Path: "/", MaxAge: maxAge,
		HttpOnly: true, Secure: s.cfg.Secure, SameSite: http.SameSiteStrictMode,
	})
}

// checkOrigin — o'zgartiruvchi so'rovlar (POST/PATCH/DELETE) faqat konsol saytidan.
// CSRF himoyasining birinchi qatlami (ikkinchisi — X-CSRF-Token, sessiyaga bog'liq).
func (s *Server) checkOrigin(w http.ResponseWriter, r *http.Request) bool {
	if r.Method == http.MethodGet || r.Method == http.MethodHead {
		return true
	}
	if r.Header.Get("Origin") != s.cfg.Origin {
		apiError(w, http.StatusForbidden, "bad_origin", "so'rov konsol saytidan emas")
		return false
	}
	return true
}

func (s *Server) allowIP(w http.ResponseWriter, ip, bucket string, rps, burst float64) bool {
	if ok, wait := s.lim.Allow(bucket+":"+ip, rps, burst); !ok {
		w.Header().Set("Retry-After", itoa(int(wait.Seconds())+1))
		apiError(w, http.StatusTooManyRequests, "rate_limited", "juda ko'p so'rov, birozdan keyin urinib ko'ring")
		return false
	}
	return true
}

// public — sessiyasiz endpoint (login). Origin + IP bo'yicha umumiy chegara.
func (s *Server) public(h func(http.ResponseWriter, *http.Request, string)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.checkOrigin(w, r) {
			return
		}
		ip := s.clientIP(r)
		if !s.allowIP(w, ip, "pub", 2, 20) {
			return
		}
		h(w, r, ip)
	}
}

// authed — sessiya + CSRF talab qiladi.
func (s *Server) authed(h func(http.ResponseWriter, *http.Request, *reqCtx)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.checkOrigin(w, r) {
			return
		}
		ip := s.clientIP(r)
		if !s.allowIP(w, ip, "api", 20, 60) {
			return
		}
		rc, ok := s.session(w, r)
		if !ok {
			return
		}
		rc.ip, rc.ipHash = ip, s.ipHash(ip)
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			got := r.Header.Get("X-CSRF-Token")
			if subtle.ConstantTimeCompare([]byte(got), []byte(rc.sess.CSRF)) != 1 || got == "" {
				apiError(w, http.StatusForbidden, "bad_csrf", "CSRF tokeni noto'g'ri")
				return
			}
		}
		// To'xtatilgan hisob: faqat ko'rish va chiqish.
		if rc.acc.Suspended && r.Method != http.MethodGet && r.URL.Path != "/api/auth/logout" {
			apiError(w, http.StatusForbidden, "account_suspended", "hisob to'xtatilgan")
			return
		}
		h(w, r, rc)
	}
}

func (s *Server) session(w http.ResponseWriter, r *http.Request) (*reqCtx, bool) {
	unauth := func() (*reqCtx, bool) {
		apiError(w, http.StatusUnauthorized, "unauthenticated", "kirish talab qilinadi")
		return nil, false
	}
	c, err := r.Cookie(s.cookieName())
	if err != nil || c.Value == "" || len(c.Value) > 128 {
		return unauth()
	}
	hash := sessionHash(c.Value)
	sess, err := s.store.SessionByHash(r.Context(), hash)
	now := s.now()
	if errors.Is(err, ErrNotFound) || (err == nil && (!now.Before(sess.ExpiresAt) || now.Sub(sess.LastSeen) > sessionIdle)) {
		if err == nil {
			_ = s.store.DeleteSession(r.Context(), hash)
		}
		s.setSessionCookie(w, "", -1)
		return unauth()
	}
	if err != nil {
		serverError(w, "sessiyani o'qib bo'lmadi", err)
		return nil, false
	}
	acc, err := s.store.AccountByID(r.Context(), sess.AccountID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return unauth()
		}
		serverError(w, "hisobni o'qib bo'lmadi", err)
		return nil, false
	}
	if now.Sub(sess.LastSeen) > touchEvery {
		_ = s.store.TouchSession(r.Context(), hash, now)
	}
	return &reqCtx{acc: acc, sess: sess}, true
}

func (s *Server) audit(ctx context.Context, rc *reqCtx, action, target string, detail map[string]any) {
	if err := s.store.Audit(ctx, rc.acc.ID, action, target, rc.ipHash, detail); err != nil {
		slog.Error("audit yozilmadi", "action", action, "err", err)
	}
}
