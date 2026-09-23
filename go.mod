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
// Ikkita to'g'ridan-to'g'ri bog'liqlik: `pgx` (PostgreSQL drayveri) va
// `aws-sdk-go-v2` (Cloudflare R2 — S3-mos ombor, rasm saqlash uchun).
// Qolganlari ularning o'z bog'liqliklari.
//
// Har bir yangi bog'liqlik — supply-chain hujum yuzasi. Marshrutlovchi,
// konfiguratsiya kutubxonasi va validatsiya freymvorki ATAYLAB
// qo'shilmagan: `net/http` ning `ServeMux` i (Go 1.22+) metod va
// yo'l shablonlarini o'zi qo'llab-quvvatlaydi.
//
// `aws-sdk-go-v2` ATAYLAB ChustApp'da ALLAQACHON ishlatilayotgan xuddi
// shu versiya bilan qo'shilgan (`internal/images/r2.go`) — versiya
// tanlashda taxmin qilinmagan, sinovdan o'tgan juftlik takrorlangan.

require (
	github.com/aws/aws-sdk-go-v2 v1.43.0
	github.com/aws/aws-sdk-go-v2/config v1.32.31
	github.com/aws/aws-sdk-go-v2/credentials v1.19.30
	github.com/aws/aws-sdk-go-v2/service/s3 v1.106.0
	github.com/jackc/pgx/v5 v5.10.0
)

require (
	github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.20 // indirect
	github.com/aws/aws-sdk-go-v2/feature/ec2/imds v1.18.31 // indirect
	github.com/aws/aws-sdk-go-v2/internal/configsources v1.4.31 // indirect
	github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.7.31 // indirect
	github.com/aws/aws-sdk-go-v2/internal/v4a v1.4.32 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.13.19 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/checksum v1.9.24 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.13.31 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/s3shared v1.19.32 // indirect
	github.com/aws/aws-sdk-go-v2/service/signin v1.5.0 // indirect
	github.com/aws/aws-sdk-go-v2/service/sso v1.33.0 // indirect
	github.com/aws/aws-sdk-go-v2/service/ssooidc v1.38.0 // indirect
	github.com/aws/aws-sdk-go-v2/service/sts v1.45.0 // indirect
	github.com/aws/smithy-go v1.28.1 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	golang.org/x/sync v0.21.0 // indirect
	golang.org/x/text v0.39.0 // indirect
)
