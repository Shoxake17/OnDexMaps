// Package r2 — Cloudflare R2 (S3-mos API) orqali rasm saqlash.
//
// ┌─ NEGA BAZADA EMAS ────────────────────────────────────────────────┐
// Rasm baytlari Postgres BYTEA ustunida saqlansa, har bir yuklama
// baza hajmini (demak zaxira/replikatsiya hajmini ham) shishiradi va
// serverning o'z diskini yeydi. R2 — buning uchun maxsus, arzon va
// cheksiz kengayadigan ombor (Cloudflare'da chiquvchi trafik BEPUL).
// └───────────────────────────────────────────────────────────────────┘
//
// ┌─ NEGA "OCHIQ URL" EMAS, PROKSI ─────────────────────────────────────┐
// ChustApp'ning R2Store'idan farqli o'laroq (u yerda bucket OMMAVIY,
// chunki barcha rasm allaqachon ochiq), OnDexMap'da IKKI XIL maxfiylik
// darajasi bor: tasdiqlangan joy rasmlari ochiq, lekin KARANTINDAGI
// (hali tasdiqlanmagan) submission rasmlari FAQAT moderator ko'rishi
// kerak (`ONDEXMAP_ADMIN_KEY`). Bucket'ni ommaviy qilib qo'ysak, bu
// chegara yo'qoladi — kalitni (obyekt nomini) bilgan har kim karantin
// rasmini ham ko'ra oladi. Shuning uchun `Store.Download` bayt qaytaradi
// va HTTP qatlami uni o'zining mavjud avtorizatsiya tekshiruvidan
// keyin klientga uzatadi (proksi) — bucket hech qachon ochiq bo'lmaydi.
// └─────────────────────────────────────────────────────────────────────┘
package r2

import (
	"bytes"
	"context"
	"fmt"
	"io"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// Store — R2 bucket'iga kirish.
type Store struct {
	client *s3.Client
	bucket string
}

// FromConfig — sozlamadan R2 do'konini quradi. `bucket` bo'sh bo'lsa R2
// SOZLANMAGAN deb hisoblanadi va `nil, nil` qaytariladi (xato EMAS —
// chaqiruvchi buni "o'chiq" deb talqin qilishi kerak, cmd/api/cmd/admin/
// cmd/adminserver'dagi OSRM/Submitter bilan bir xil naqsh). Qolgan
// uchtasining bo'sh-emasligi `config.Load`da allaqachon tekshirilgan
// ("hammasi yoki hech qaysi biri").
func FromConfig(ctx context.Context, accountID, accessKeyID, secretAccessKey, bucket string) (*Store, error) {
	if bucket == "" {
		return nil, nil //nolint:nilnil // "sozlanmagan" holati — xato emas
	}
	return New(ctx, accountID, accessKeyID, secretAccessKey, bucket)
}

// New — accountID, kalitlar va bucket nomi bo'yicha R2 klientini tayyorlaydi.
func New(ctx context.Context, accountID, accessKeyID, secretAccessKey, bucket string) (*Store, error) {
	endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", accountID)
	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion("auto"),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKeyID, secretAccessKey, "")),
		config.WithBaseEndpoint(endpoint),
	)
	if err != nil {
		return nil, err
	}
	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.UsePathStyle = true // Cloudflare R2 uchun tavsiya etilgan rejim
	})
	return &Store{client: client, bucket: bucket}, nil
}

// Upload — rasm baytlarini berilgan kalit ostida yozadi.
func (s *Store) Upload(ctx context.Context, key string, data []byte, contentType string) error {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(s.bucket),
		Key:           aws.String(key),
		Body:          bytes.NewReader(data),
		ContentLength: aws.Int64(int64(len(data))),
		ContentType:   aws.String(contentType),
	})
	return err
}

// Download — kalit bo'yicha rasm baytlarini o'qiydi.
func (s *Store) Download(ctx context.Context, key string) ([]byte, error) {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, err
	}
	defer out.Body.Close()
	return io.ReadAll(out.Body)
}

// Delete — bitta obyektni o'chiradi. Obyekt allaqachon yo'q bo'lsa ham R2
// xato qaytarmaydi (S3 semantikasi) — chaqiruvchi "topilmadi" holatini
// alohida tekshirishi shart emas.
func (s *Store) Delete(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	return err
}

// DeleteMany — bir nechta obyektni ketma-ket o'chiradi (best-effort).
//
// Birinchi xatoda TO'XTAMAYDI — rad etilgan submission yoki o'chirilgan
// joyning 4 ta rasmidan biri o'chmay qolsa ham, qolganlari tozalanishi
// kerak. Barcha xatolar birlashtirilib qaytariladi (chaqiruvchi loglaydi,
// operatsiyani bekor qilmaydi — DB o'zgarishi allaqachon committed).
func (s *Store) DeleteMany(ctx context.Context, keys []string) error {
	var errs []error
	for _, key := range keys {
		if err := s.Delete(ctx, key); err != nil {
			errs = append(errs, fmt.Errorf("%s: %w", key, err))
		}
	}
	if len(errs) == 0 {
		return nil
	}
	msg := fmt.Sprintf("%d/%d obyekt o'chmadi:", len(errs), len(keys))
	for _, e := range errs {
		msg += " " + e.Error() + ";"
	}
	return fmt.Errorf("%s", msg)
}
