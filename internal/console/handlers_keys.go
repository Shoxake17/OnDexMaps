package console

import (
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"ondexmap/internal/devplatform"
)

// RotationGrace — eski kalit almashtirilgach shuncha vaqt ishlaydi (mijoz uzilishsiz o'tishi uchun).
const RotationGrace = 24 * time.Hour

type keyJSON struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	Kind       string     `json:"kind"`
	Prefix     string     `json:"prefix"`
	APIs       []string   `json:"apis"`
	Origins    []string   `json:"origins"`
	IPs        []string   `json:"ips"`
	Status     string     `json:"status"`
	ExpiresAt  *time.Time `json:"expires_at"`
	CreatedAt  time.Time  `json:"created_at"`
	LastUsedAt *time.Time `json:"last_used_at"`
}

func toKeyJSON(k *Key) keyJSON {
	return keyJSON{ID: k.ID, Name: k.Name, Kind: k.Kind, Prefix: k.Prefix,
		APIs: nz(k.APIs), Origins: nz(k.Origins), IPs: nz(k.IPs), Status: k.Status,
		ExpiresAt: k.ExpiresAt, CreatedAt: k.CreatedAt, LastUsedAt: k.LastUsedAt}
}

func nz(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

// keySpec — foydalanuvchi kiritgan kalit sozlamasi.
type keySpec struct {
	Name    string   `json:"name"`
	Kind    string   `json:"kind"`
	APIs    []string `json:"apis"`
	Origins []string `json:"origins"`
	IPs     []string `json:"ips"`
}

// cleanName — 1..60 belgi, boshqaruv belgilarisiz.
func cleanName(raw string) (string, bool) {
	n := strings.TrimSpace(raw)
	if c := utf8.RuneCountInString(n); c < 1 || c > 60 {
		return "", false
	}
	for _, r := range n {
		if unicode.IsControl(r) {
			return "", false
		}
	}
	return n, true
}

// normalizeSpec — kalit sozlamasini tekshiradi va normallashtiradi. Bazadagi CHECK'lar ORQA qatlam;
// bu yerda foydalanuvchiga tushunarli xato beriladi.
func normalizeSpec(in keySpec) (keySpec, error) {
	var out keySpec
	name, ok := cleanName(in.Name)
	if !ok {
		return out, errors.New("nom 1–60 belgi bo'lishi kerak")
	}
	out.Name, out.Kind = name, in.Kind
	if in.Kind != devplatform.KindServer && in.Kind != devplatform.KindBrowser {
		return out, errors.New("kind `server` yoki `browser` bo'lishi kerak")
	}
	seen := map[string]bool{}
	for _, a := range in.APIs {
		if !devplatform.IsAPI(a) {
			return out, errors.New("noma'lum API: " + a)
		}
		if !seen[a] {
			seen[a] = true
			out.APIs = append(out.APIs, a)
		}
	}
	if len(out.APIs) == 0 {
		return out, errors.New("kamida bitta API tanlang")
	}
	return normalizeRestrictions(in, out)
}

func normalizeRestrictions(in, out keySpec) (keySpec, error) {
	if in.Kind == devplatform.KindBrowser {
		if len(in.IPs) > 0 {
			return out, errors.New("brauzer kaliti IP cheklovi qabul qilmaydi; domen (Origin) ro'yxatini bering")
		}
		origins, err := devplatform.NormalizeOrigins(in.Origins)
		if err != nil {
			return out, err
		}
		if len(origins) == 0 {
			return out, errors.New("brauzer kaliti uchun kamida bitta domen (Origin) majburiy")
		}
		out.Origins = origins
		return out, nil
	}
	if len(in.Origins) > 0 {
		return out, errors.New("server kaliti domen (Origin) cheklovi qabul qilmaydi; IP ro'yxatini bering")
	}
	prefixes, err := devplatform.ParseIPList(in.IPs)
	if err != nil {
		return out, err
	}
	for _, p := range prefixes {
		out.IPs = append(out.IPs, p.String())
	}
	return out, nil
}

func (s *Server) handleListKeys(w http.ResponseWriter, r *http.Request, rc *reqCtx) {
	keys, err := s.store.ListKeys(r.Context(), rc.acc.ID)
	if err != nil {
		serverError(w, "kalitlar ro'yxati", err)
		return
	}
	out := make([]keyJSON, len(keys))
	for i := range keys {
		out[i] = toKeyJSON(&keys[i])
	}
	writeJSON(w, http.StatusOK, map[string]any{"keys": out, "max_active": maxActiveKeys, "apis": devplatform.AllAPIs})
}

func (s *Server) mintKey(accountID string, spec keySpec) (secret string, nk NewKey, err error) {
	secret, prefix, err := devplatform.GenerateKey(spec.Kind)
	if err != nil {
		return "", NewKey{}, err
	}
	return secret, NewKey{AccountID: accountID, Name: spec.Name, Kind: spec.Kind, Prefix: prefix,
		Hash: devplatform.HashKey(s.cfg.Pepper, secret), APIs: spec.APIs, Origins: spec.Origins,
		IPs: spec.IPs}, nil
}

// POST /api/keys — sir FAQAT shu javobda, bir marta.
func (s *Server) handleCreateKey(w http.ResponseWriter, r *http.Request, rc *reqCtx) {
	var in keySpec
	if !decodeJSON(w, r, &in) {
		return
	}
	if !s.allowIP(w, rc.acc.ID, "keymut", 10.0/60, 10) {
		return
	}
	spec, err := normalizeSpec(in)
	if err != nil {
		apiError(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	if !s.keyRoom(w, r, rc) {
		return
	}
	secret, nk, err := s.mintKey(rc.acc.ID, spec)
	if err != nil {
		serverError(w, "kalit yaratish", err)
		return
	}
	k, err := s.store.CreateKey(r.Context(), nk)
	if err != nil {
		serverError(w, "kalit saqlash", err)
		return
	}
	s.audit(r.Context(), rc, "key.create", k.ID, map[string]any{"kind": k.Kind, "apis": k.APIs})
	writeJSON(w, http.StatusCreated, map[string]any{"key": toKeyJSON(k), "secret": secret})
}

// keyRoom — faol kalitlar chegarasi.
func (s *Server) keyRoom(w http.ResponseWriter, r *http.Request, rc *reqCtx) bool {
	n, err := s.store.CountActiveKeys(r.Context(), rc.acc.ID)
	if err != nil {
		serverError(w, "kalitlarni sanash", err)
		return false
	}
	if n >= maxActiveKeys {
		apiError(w, http.StatusConflict, "key_limit", "faol kalitlar chegarasiga yetdingiz; keraksizini bekor qiling")
		return false
	}
	return true
}

// activeKey — hisobga tegishli FAOL kalit (boshqaning kaliti "topilmadi" — mavjudligi sizmaydi).
func (s *Server) activeKey(w http.ResponseWriter, r *http.Request, rc *reqCtx) (*Key, bool) {
	cur, err := s.store.KeyByID(r.Context(), rc.acc.ID, r.PathValue("id"))
	if errors.Is(err, ErrNotFound) || (err == nil && cur.Status != "active") {
		apiError(w, http.StatusNotFound, "not_found", "kalit topilmadi")
		return nil, false
	}
	if err != nil {
		serverError(w, "kalitni o'qish", err)
		return nil, false
	}
	return cur, true
}

// PATCH /api/keys/{id} — nom, API ro'yxati va cheklovlar (kalit turi o'zgarmaydi).
func (s *Server) handleUpdateKey(w http.ResponseWriter, r *http.Request, rc *reqCtx) {
	var in keySpec
	if !decodeJSON(w, r, &in) {
		return
	}
	if !s.allowIP(w, rc.acc.ID, "keymut", 10.0/60, 10) {
		return
	}
	cur, ok := s.activeKey(w, r, rc)
	if !ok {
		return
	}
	in.Kind = cur.Kind // tur o'zgartirilmaydi
	spec, err := normalizeSpec(in)
	if err != nil {
		apiError(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	err = s.store.UpdateKey(r.Context(), rc.acc.ID, cur.ID,
		KeyEdit{Name: spec.Name, APIs: spec.APIs, Origins: spec.Origins, IPs: spec.IPs})
	if errors.Is(err, ErrNotFound) {
		apiError(w, http.StatusNotFound, "not_found", "kalit topilmadi")
		return
	}
	if err != nil {
		serverError(w, "kalitni yangilash", err)
		return
	}
	s.audit(r.Context(), rc, "key.update", cur.ID, nil)
	k, err := s.store.KeyByID(r.Context(), rc.acc.ID, cur.ID)
	if err != nil {
		serverError(w, "kalitni o'qish", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"key": toKeyJSON(k)})
}

// POST /api/keys/{id}/rotate — yangi kalit; eskisi 24 soat ishlaydi (uzilishsiz almashtirish).
func (s *Server) handleRotateKey(w http.ResponseWriter, r *http.Request, rc *reqCtx) {
	if !s.allowIP(w, rc.acc.ID, "keymut", 10.0/60, 10) {
		return
	}
	cur, ok := s.activeKey(w, r, rc)
	if !ok || !s.keyRoom(w, r, rc) {
		return
	}
	spec := keySpec{Name: cur.Name, Kind: cur.Kind, APIs: cur.APIs, Origins: cur.Origins, IPs: cur.IPs}
	secret, nk, err := s.mintKey(rc.acc.ID, spec)
	if err != nil {
		serverError(w, "kalit yaratish", err)
		return
	}
	oldExpires := s.now().Add(RotationGrace)
	k, err := s.store.RotateKey(r.Context(), rc.acc.ID, cur.ID, nk, oldExpires)
	if errors.Is(err, ErrNotFound) {
		apiError(w, http.StatusNotFound, "not_found", "kalit topilmadi")
		return
	}
	if err != nil {
		serverError(w, "kalitni almashtirish", err)
		return
	}
	s.audit(r.Context(), rc, "key.rotate", cur.ID, map[string]any{"new_key": k.ID})
	writeJSON(w, http.StatusCreated, map[string]any{"key": toKeyJSON(k), "secret": secret, "old_key_expires_at": oldExpires})
}

// DELETE /api/keys/{id} — bekor qilish (qaytarib bo'lmaydi; hisob yuritilgani uchun yozuv qoladi).
func (s *Server) handleRevokeKey(w http.ResponseWriter, r *http.Request, rc *reqCtx) {
	id := r.PathValue("id")
	err := s.store.RevokeKey(r.Context(), rc.acc.ID, id, s.now())
	if errors.Is(err, ErrNotFound) {
		apiError(w, http.StatusNotFound, "not_found", "kalit topilmadi yoki allaqachon bekor qilingan")
		return
	}
	if err != nil {
		serverError(w, "kalitni bekor qilish", err)
		return
	}
	s.audit(r.Context(), rc, "key.revoke", id, nil)
	w.WriteHeader(http.StatusNoContent)
}
