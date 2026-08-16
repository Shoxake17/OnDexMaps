module ondexmap

// PATCH versiyasi ATAYLAB aniq ko'rsatilgan (1.26 emas).
//
// ChustApp'da bu dars qimmatga tushgan: `go 1.25.0` turganda CI
// `setup-go` ga 1.25 ning ENG BIRINCHI relizini o'rnatardi —
// o'nlab xavfsizlik patchisiz. `govulncheck` shunda standart
// kutubxonaning o'zida 23 ta CVE topgan edi.
//
// Yangi CVE chiqqanda bu raqamni oshiring.
go 1.26.5

// ── BOG'LIQLIKLAR ATAYLAB KAM ────────────────────────────────────────
// Yagona to'g'ridan-to'g'ri bog'liqlik — `pgx` (PostgreSQL drayveri).
// Qolganlari uning o'z bog'liqliklari.
//
// Har bir yangi bog'liqlik — supply-chain hujum yuzasi. Marshrutlovchi,
// konfiguratsiya kutubxonasi va validatsiya freymvorki ATAYLAB
// qo'shilmagan: `net/http` ning `ServeMux` i (Go 1.22+) metod va
// yo'l shablonlarini o'zi qo'llab-quvvatlaydi.

require (
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/pgx/v5 v5.10.0 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	golang.org/x/sync v0.17.0 // indirect
	golang.org/x/text v0.29.0 // indirect
)
