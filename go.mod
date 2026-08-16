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

// ── TASHQI BOG'LIQLIK YO'Q ───────────────────────────────────────────
// Bosqich 1 ataylab faqat standart kutubxonada. Natijasi: `go test ./...`
// internetsiz, birinchi daqiqadanoq ishlaydi va supply-chain yuzasi nol.
//
// `pgx` 2-bosqichda (sxema va migratsiya bilan birga) qo'shiladi.
