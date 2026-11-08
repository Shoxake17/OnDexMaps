// Package ondexauth — OnDex admin (OnDex ID, platform realmi) tokenini
// tekshirish: OnDexMap admin serveri uchun yagona kirish (ChustApp A6, Plane
// 138 — "bitta panel, bitta kirish").
//
// ┌─ NEGA O'ZIMIZ IMZONI TEKSHIRMAYMIZ ───────────────────────────────────┐
// Token OnDex'ning `/v2/admin/whoami` endpointida tekshiriladi: imzo
// (alohida platform kaliti), sessiya FAOLLIGI (admin chiqsa yoki bloklansa
// darhol), ikki bosqichli tasdiq (TOTP). OnDexMap kalit saqlamaydi, o'z
// admin akkauntlari yo'q. Ijobiy natija qisqa muddat (ttl) keshlanadi —
// bekor qilish shu muddat ichida kuchga kiradi.
// └───────────────────────────────────────────────────────────────────────┘
package ondexauth

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

var (
	// ErrUnauthorized — token yaroqsiz, sessiya yopilgan yoki admin emas.
	ErrUnauthorized = errors.New("ondexauth: admin tokeni qabul qilinmadi")
	// ErrUnavailable — OnDex javob bermadi (fail closed: ruxsat YO'Q).
	ErrUnavailable = errors.New("ondexauth: OnDex tekshiruvi vaqtincha ishlamayapti")
)

// Admin — tasdiqlangan OnDex admini.
type Admin struct {
	UserID    string `json:"user_id"`
	Name      string `json:"name"`
	SessionID string `json:"session_id"`
}

type entry struct {
	admin Admin
	until time.Time
}

// Verifier — `/v2/admin/whoami` klienti + qisqa kesh.
type Verifier struct {
	whoami string
	hc     *http.Client
	ttl    time.Duration
	now    func() time.Time

	mu    sync.Mutex
	cache map[[32]byte]entry
}

const maxCache = 2048

// New — `base` OnDex API manzili (masalan ichki tarmoq `http://ondex-api-1:8080`
// yoki `https://api.ondex.uz`). Faqat http/https, foydalanuvchi ma'lumotisiz.
func New(base string) (*Verifier, error) {
	u, err := url.Parse(strings.TrimRight(strings.TrimSpace(base), "/"))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.User != nil {
		return nil, fmt.Errorf("ondexauth: OnDex manzili noto'g'ri: %q", base)
	}
	return &Verifier{
		whoami: u.String() + "/v2/admin/whoami",
		hc:     &http.Client{Timeout: 5 * time.Second, CheckRedirect: noRedirect},
		ttl:    60 * time.Second,
		now:    time.Now,
		cache:  map[[32]byte]entry{},
	}, nil
}

// noRedirect — token boshqa manzilga hech qachon ergashib ketmasin.
func noRedirect(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }

// Verify — token OnDex'ning faol, TOTP bilan ochilgan admin sessiyasimi.
func (v *Verifier) Verify(ctx context.Context, token string) (*Admin, error) {
	token = strings.TrimSpace(token)
	if token == "" || len(token) > 4096 {
		return nil, ErrUnauthorized
	}
	key := sha256.Sum256([]byte(token))
	now := v.now()
	v.mu.Lock()
	if e, ok := v.cache[key]; ok && now.Before(e.until) {
		v.mu.Unlock()
		a := e.admin
		return &a, nil
	}
	v.mu.Unlock()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.whoami, nil)
	if err != nil {
		return nil, ErrUnavailable
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	res, err := v.hc.Do(req)
	if err != nil {
		return nil, ErrUnavailable
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(res.Body, 16<<10))
	switch {
	case res.StatusCode == http.StatusUnauthorized || res.StatusCode == http.StatusForbidden:
		return nil, ErrUnauthorized
	case res.StatusCode != http.StatusOK:
		return nil, ErrUnavailable
	}
	var a Admin
	if err := json.Unmarshal(body, &a); err != nil || a.UserID == "" {
		return nil, ErrUnavailable
	}
	v.mu.Lock()
	if len(v.cache) >= maxCache {
		v.cache = map[[32]byte]entry{}
	}
	v.cache[key] = entry{admin: a, until: now.Add(v.ttl)}
	v.mu.Unlock()
	return &a, nil
}
