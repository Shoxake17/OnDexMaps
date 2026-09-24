package httpapi

import (
	"net/http"
	"slices"
	"strings"

	"ondexmap/internal/devplatform"
)

// v1Guard — `/v1` ni "o'zimizniki" qilib qo'yadi (V1_FIRST_PARTY_ONLY=true bo'lganda).
//
// NEGA: tashqi dasturchilar uchun yagona eshik — `/v2` (kalit, hisoblash, chegara). `/v1` esa
// bizning sayt va ilovalarimizning ichki API'si (joy qo'shish, rasm, mahalla va h.k. ham shu yerda).
// Qo'riqchisiz `/v1` ni hamma kalitsiz ishlatib, billing tizimini aylanib o'tardi.
//
// O'TADI:
//  1. `X-API-Key` = ONDEXMAP_READ_KEY / ADMIN_KEY (ekotizim server-server);
//  2. brauzerdan: `Sec-Fetch-Site: same-origin`, yoki `Origin` / `Referer` FIRST_PARTY_ORIGINS'da.
//     (`same-site` ATAYLAB o'tmaydi: bir domenning boshqa subdomenlarida boshqa loyihalar bor.)
//
// ⚠️ HALOL CHEKLOV: `Origin`/`Sec-Fetch-*` ni brauzer soxtalashtira olmaydi, lekin `curl` bilan
// yozib yuborish mumkin. Bu qo'riqchi — CORS/brauzer orqali va tasodifiy foydalanishni to'sadi,
// kriptografik to'siq EMAS. Yozish yo'lining haqiqiy himoyasi boshqa qatlamlarda: karantin +
// moderatsiya, qattiq rate-limit, DB rollari (docs/developer-platform.md §Cheklovlar).
func (s *Server) v1Guard(next http.Handler) http.Handler {
	if !s.cfg.V1FirstPartyOnly {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/v1/") || r.Method == http.MethodOptions || s.isFirstParty(r) {
			next.ServeHTTP(w, r)
			return
		}
		httpError(w, http.StatusForbidden,
			"bu ichki API; dasturchilar uchun /v2 dan foydalaning (console.ondex.uz)")
	})
}

func (s *Server) isFirstParty(r *http.Request) bool {
	if k := r.Header.Get(apiKeyHeader); k != "" && s.auth.allow(k, ScopeRead) {
		return true
	}
	if r.Header.Get("Sec-Fetch-Site") == "same-origin" {
		return true
	}
	if o := r.Header.Get("Origin"); o != "" {
		return slices.Contains(s.cfg.FirstPartyOrigins, o)
	}
	if ref := devplatform.OriginFromReferer(r.Header.Get("Referer")); ref != "" {
		return slices.Contains(s.cfg.FirstPartyOrigins, ref)
	}
	return false
}
