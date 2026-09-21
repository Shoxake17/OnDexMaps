// tilesupload — `.pmtiles` faylini R2 (yoki boshqa S3-mos xotira) ga
// yuklaydi va bucket uchun CORS qoidasini o'rnatadi.
//
// ┌─ NEGA ALOHIDA VOSITA ──────────────────────────────────────────────┐
// Chust uchun tile fayli kichik (0.7 MB) va binarga kiritilgan. Butun
// mamlakat uchun u ~160 MB — binarga kiritilsa har deploy shuncha
// yukni ko'taradi va build sekinlashadi. Shuning uchun katta fayl
// statik xotirada (R2) turadi va brauzer uni TO'G'RIDAN-TO'G'RI
// o'qiydi (HTTP Range bilan, faqat kerakli baytlarni).
//
// Serverga hech narsa o'tmaydi: OnDexMap faqat `TILES_URL` ni uslub
// faylida ko'rsatadi.
// └──────────────────────────────────────────────────────────────────┘
//
// AWS SDK ATAYLAB ishlatilmadi: bitta PUT so'rovi uchun butun SDK
// bog'liqligi ortiqcha. SigV4 imzosi standart kutubxona bilan
// yoziladi (~80 qator) va loyihaning bog'liqliklari o'zgarishsiz
// qoladi.
//
// Ishlatish:
//
//	go run ./cmd/tilesupload -file D:\...\uzbekistan.pmtiles -key uzbekistan.pmtiles
//	go run ./cmd/tilesupload -cors            # bucket CORS qoidasi
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

type creds struct {
	accountID string
	accessKey string
	secretKey string
	bucket    string
}

func main() {
	file := flag.String("file", "", "yuklanadigan fayl yo'li")
	key := flag.String("key", "", "R2 dagi nomi (bo'sh bo'lsa fayl nomi)")
	cors := flag.Bool("cors", false, "faqat CORS qoidasini o'rnatish")
	envPath := flag.String("env", ".env", "sozlama fayli")
	flag.Parse()

	c := loadCreds(*envPath)

	if *cors {
		if err := putCORS(c); err != nil {
			log.Fatalf("CORS o'rnatilmadi: %v", err)
		}
		fmt.Println("CORS qoidasi o'rnatildi")
		return
	}

	if *file == "" {
		log.Fatal("-file ko'rsatilmagan")
	}
	name := *key
	if name == "" {
		parts := strings.Split(strings.ReplaceAll(*file, "\\", "/"), "/")
		name = parts[len(parts)-1]
	}

	if err := upload(c, *file, name); err != nil {
		log.Fatalf("yuklanmadi: %v", err)
	}
	fmt.Printf("yuklandi: %s\n", name)
}

// loadCreds — sozlamani muhitdan yoki `.env` dan oladi.
//
// Sir qiymatlar HECH QACHON ekranga chiqarilmaydi.
func loadCreds(envPath string) creds {
	if b, err := os.ReadFile(envPath); err == nil {
		for _, line := range strings.Split(string(b), "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			k, v, ok := strings.Cut(line, "=")
			if !ok {
				continue
			}
			k, v = strings.TrimSpace(k), strings.Trim(strings.TrimSpace(v), `"'`)
			if _, exists := os.LookupEnv(k); !exists {
				_ = os.Setenv(k, v)
			}
		}
	}

	c := creds{
		accountID: os.Getenv("R2_ACCOUNT_ID"),
		accessKey: os.Getenv("R2_ACCESS_KEY_ID"),
		secretKey: os.Getenv("R2_SECRET_ACCESS_KEY"),
		bucket:    os.Getenv("R2_BUCKET"),
	}
	for name, v := range map[string]string{
		"R2_ACCOUNT_ID": c.accountID, "R2_ACCESS_KEY_ID": c.accessKey,
		"R2_SECRET_ACCESS_KEY": c.secretKey, "R2_BUCKET": c.bucket,
	} {
		if v == "" {
			log.Fatalf("%s yo'q (%s yoki muhitda)", name, envPath)
		}
	}
	return c
}

func upload(c creds, path, key string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()

	st, err := f.Stat()
	if err != nil {
		return err
	}

	// Imzo uchun tananing SHA256 i kerak — faylni bir marta o'qib
	// hisoblaymiz, so'ng boshiga qaytamiz.
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return err
	}
	payloadHash := hex.EncodeToString(h.Sum(nil))
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		return err
	}

	fmt.Printf("yuklanmoqda: %s (%.1f MB)\n", key, float64(st.Size())/(1<<20))

	req, err := http.NewRequest(http.MethodPut,
		fmt.Sprintf("https://%s.r2.cloudflarestorage.com/%s/%s", c.accountID, c.bucket, key), f)
	if err != nil {
		return err
	}
	req.ContentLength = st.Size()
	req.Header.Set("Content-Type", "application/octet-stream")
	// Tile fayli o'zgarmaydi (yangisi boshqa nom bilan chiqadi),
	// shuning uchun uzoq kesh xavfsiz va foydali.
	req.Header.Set("Cache-Control", "public, max-age=604800")

	sign(req, c, payloadHash)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode/100 != 2 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("status %d: %s", resp.StatusCode, body)
	}
	return nil
}

// corsPolicy — brauzer tile faylini BOSHQA domendan o'qiydi, shuning
// uchun CORS shart. `Range` sarlavhasiga ruxsat MAJBURIY: usiz
// brauzer qismiy so'rov yubora olmaydi va PMTiles ishlamaydi.
const corsPolicy = `<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>Range</AllowedHeader>
    <ExposeHeader>Content-Range</ExposeHeader>
    <ExposeHeader>Content-Length</ExposeHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>86400</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>`

func putCORS(c creds) error {
	body := []byte(corsPolicy)
	sum := sha256.Sum256(body)

	req, err := http.NewRequest(http.MethodPut,
		fmt.Sprintf("https://%s.r2.cloudflarestorage.com/%s?cors", c.accountID, c.bucket),
		strings.NewReader(corsPolicy))
	if err != nil {
		return err
	}
	req.ContentLength = int64(len(body))
	req.Header.Set("Content-Type", "application/xml")
	sign(req, c, hex.EncodeToString(sum[:]))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode/100 != 2 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("status %d: %s", resp.StatusCode, b)
	}
	return nil
}

// sign — AWS Signature V4 (R2 shu protokolni qo'llaydi).
func sign(req *http.Request, c creds, payloadHash string) {
	const region, service = "auto", "s3"
	now := time.Now().UTC()
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")

	req.Header.Set("Host", req.URL.Host)
	req.Header.Set("X-Amz-Date", amzDate)
	req.Header.Set("X-Amz-Content-Sha256", payloadHash)

	// Imzolanadigan sarlavhalar — alifbo tartibida.
	var names []string
	for k := range req.Header {
		names = append(names, strings.ToLower(k))
	}
	names = append(names, "host")
	names = uniqSorted(names)

	var canonHeaders strings.Builder
	for _, n := range names {
		v := req.Header.Get(n)
		if n == "host" {
			v = req.URL.Host
		}
		canonHeaders.WriteString(n + ":" + strings.TrimSpace(v) + "\n")
	}
	signedHeaders := strings.Join(names, ";")

	canonicalReq := strings.Join([]string{
		req.Method,
		req.URL.EscapedPath(),
		req.URL.RawQuery,
		canonHeaders.String(),
		signedHeaders,
		payloadHash,
	}, "\n")

	scope := dateStamp + "/" + region + "/" + service + "/aws4_request"
	crHash := sha256.Sum256([]byte(canonicalReq))
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256", amzDate, scope, hex.EncodeToString(crHash[:]),
	}, "\n")

	kDate := hmacSHA256([]byte("AWS4"+c.secretKey), dateStamp)
	kRegion := hmacSHA256(kDate, region)
	kService := hmacSHA256(kRegion, service)
	kSigning := hmacSHA256(kService, "aws4_request")
	signature := hex.EncodeToString(hmacSHA256(kSigning, stringToSign))

	req.Header.Set("Authorization", fmt.Sprintf(
		"AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		c.accessKey, scope, signedHeaders, signature))
}

func hmacSHA256(key []byte, data string) []byte {
	m := hmac.New(sha256.New, key)
	m.Write([]byte(data))
	return m.Sum(nil)
}

func uniqSorted(in []string) []string {
	seen := map[string]bool{}
	var out []string
	for _, s := range in {
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	for i := 0; i < len(out); i++ {
		for j := i + 1; j < len(out); j++ {
			if out[j] < out[i] {
				out[i], out[j] = out[j], out[i]
			}
		}
	}
	return out
}
