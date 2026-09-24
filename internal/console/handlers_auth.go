package console

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math/big"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const (
	otpTTL         = 10 * time.Minute
	otpMaxAttempts = 5
	otpCooldown    = 60 * time.Second
	otpPer10Min    = 3
)

func itoa(n int) string { return strconv.Itoa(n) }

// Faqat ASCII: unicode "o'xshash" harflar (homograph) bilan hisob yaratish yo'q.
var emailRe = regexp.MustCompile(`^[a-z0-9._%+\-]{1,64}@[a-z0-9\-]+(\.[a-z0-9\-]+)+$`)
var codeRe = regexp.MustCompile(`^[0-9]{6}$`)

func normalizeEmail(raw string) (string, bool) {
	e := strings.ToLower(strings.TrimSpace(raw))
	if len(e) < 5 || len(e) > 254 || !emailRe.MatchString(e) {
		return "", false
	}
	return e, true
}

func (s *Server) otpHash(email, code string) []byte {
	return s.domainHash("otp", email+"|"+code)
}

func newCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// verifyTurnstile — sozlangan bo'lsa Cloudflare Turnstile tokenini tekshiradi (fail-closed).
func (s *Server) verifyTurnstile(ctx context.Context, token, ip string) bool {
	if s.cfg.TurnstileSecret == "" {
		return true
	}
	if token == "" || len(token) > 2048 {
		return false
	}
	form := url.Values{"secret": {s.cfg.TurnstileSecret}, "response": {token}, "remoteip": {ip}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://challenges.cloudflare.com/turnstile/v0/siteverify", strings.NewReader(form.Encode()))
	if err != nil {
		return false
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := s.http.Do(req)
	if err != nil {
		return false
	}
	defer func() { _ = resp.Body.Close() }()
	var out struct {
		Success bool `json:"success"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<16)).Decode(&out); err != nil {
		return false
	}
	return out.Success
}

// POST /api/auth/request-code — hisob bor-yo'qligidan QAT'I NAZAR bir xil javob (enumeratsiya yo'q).
func (s *Server) handleRequestCode(w http.ResponseWriter, r *http.Request, ip string) {
	var in struct {
		Email     string `json:"email"`
		Turnstile string `json:"turnstile_token"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	if !s.allowIP(w, ip, "otpreq", 5.0/3600, 5) {
		return
	}
	email, ok := normalizeEmail(in.Email)
	if !ok {
		apiError(w, http.StatusBadRequest, "invalid_email", "email noto'g'ri")
		return
	}
	if !s.verifyTurnstile(r.Context(), in.Turnstile, ip) {
		apiError(w, http.StatusBadRequest, "captcha_failed", "bot tekshiruvidan o'tilmadi")
		return
	}
	if !s.otpQuotaOK(r.Context(), w, email) {
		return
	}

	code, err := newCode()
	if err != nil {
		serverError(w, "kod yaratilmadi", err)
		return
	}
	if err := s.store.CreateOTP(r.Context(), email, s.otpHash(email, code), s.now().Add(otpTTL)); err != nil {
		serverError(w, "kod saqlanmadi", err)
		return
	}
	if err := s.mail.SendLoginCode(r.Context(), email, code); err != nil {
		slog.Error("kirish kodi yuborilmadi", "err", err)
		apiError(w, http.StatusServiceUnavailable, "email_failed", "email yuborib bo'lmadi, keyinroq urinib ko'ring")
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]any{"status": "sent", "expires_in": int(otpTTL.Seconds())})
}

// otpQuotaOK — bitta emailga: 60 s oraliq va 10 daqiqada 3 tadan ko'p emas (spam/bombardimon himoyasi).
func (s *Server) otpQuotaOK(ctx context.Context, w http.ResponseWriter, email string) bool {
	now := s.now()
	last, err := s.store.LatestOTP(ctx, email)
	if err != nil && !errors.Is(err, ErrNotFound) {
		serverError(w, "kodni o'qib bo'lmadi", err)
		return false
	}
	if err == nil && now.Sub(last.CreatedAt) < otpCooldown {
		w.Header().Set("Retry-After", itoa(int(otpCooldown.Seconds())))
		apiError(w, http.StatusTooManyRequests, "rate_limited", "kod yaqinda yuborilgan, 1 daqiqa kuting")
		return false
	}
	n, err := s.store.CountOTPsSince(ctx, email, now.Add(-10*time.Minute))
	if err != nil {
		serverError(w, "kodlarni sanab bo'lmadi", err)
		return false
	}
	if n >= otpPer10Min {
		w.Header().Set("Retry-After", "600")
		apiError(w, http.StatusTooManyRequests, "rate_limited", "juda ko'p kod so'raldi, 10 daqiqadan keyin urinib ko'ring")
		return false
	}
	return true
}

// POST /api/auth/verify
func (s *Server) handleVerify(w http.ResponseWriter, r *http.Request, ip string) {
	var in struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	if !s.allowIP(w, ip, "otpvfy", 10.0/600, 10) {
		return
	}
	email, ok := normalizeEmail(in.Email)
	if !ok || !codeRe.MatchString(in.Code) {
		apiError(w, http.StatusUnauthorized, "invalid_code", "kod noto'g'ri yoki muddati tugagan")
		return
	}
	if !s.allowIP(w, email, "otpvfy-email", 10.0/600, 10) { // email bo'yicha ham (IP almashtirib taxmin qilishga qarshi)
		return
	}
	if !s.checkOTP(r.Context(), email, in.Code) {
		apiError(w, http.StatusUnauthorized, "invalid_code", "kod noto'g'ri yoki muddati tugagan")
		return
	}

	acc, err := s.store.CreateAccount(r.Context(), email)
	if err != nil {
		serverError(w, "hisob yaratilmadi", err)
		return
	}
	token, err1 := randomToken(32)
	csrf, err2 := randomToken(32)
	if err := errors.Join(err1, err2); err != nil {
		serverError(w, "sessiya tokeni", err)
		return
	}
	ua := r.UserAgent()
	if len(ua) > 200 {
		ua = ua[:200]
	}
	now := s.now()
	if err := s.store.CreateSession(r.Context(), sessionHash(token), acc.ID, csrf,
		now.Add(sessionAbsolute), s.ipHash(ip), ua); err != nil {
		serverError(w, "sessiya saqlanmadi", err)
		return
	}
	_ = s.store.TouchLogin(r.Context(), acc.ID, now)
	rc := &reqCtx{acc: acc, ip: ip, ipHash: s.ipHash(ip)}
	s.audit(r.Context(), rc, "login", "", nil)

	s.setSessionCookie(w, token, int(sessionAbsolute.Seconds()))
	writeJSON(w, http.StatusOK, s.meView(acc, csrf))
}

// checkOTP — oxirgi kod bo'yicha tekshiradi; muvaffaqiyatda kodni ATOMIK "ishlatilgan" qiladi.
func (s *Server) checkOTP(ctx context.Context, email, code string) bool {
	o, err := s.store.LatestOTP(ctx, email)
	now := s.now()
	if err != nil || o.Consumed || !now.Before(o.ExpiresAt) || o.Attempts >= otpMaxAttempts {
		return false
	}
	if !hmac.Equal(o.CodeHash, s.otpHash(email, code)) {
		_ = s.store.BumpOTPAttempts(ctx, o.ID)
		return false
	}
	used, err := s.store.ConsumeOTP(ctx, o.ID, now)
	return err == nil && used
}

// POST /api/auth/logout
func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request, rc *reqCtx) {
	if c, err := r.Cookie(s.cookieName()); err == nil {
		_ = s.store.DeleteSession(r.Context(), sessionHash(c.Value))
	}
	s.audit(r.Context(), rc, "logout", "", nil)
	s.setSessionCookie(w, "", -1)
	w.WriteHeader(http.StatusNoContent)
}
