package places

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/jpeg"
	_ "image/png" // PNG dekoderi (`image.Decode` uchun ro'yxatdan o'tadi)
	"net/http"
)

// Rasm chegaralari.
const (
	// MaxPhotos — bitta ob'ektga eng ko'pi bilan shuncha rasm.
	MaxPhotos = 4
	// MaxRawPhotoBytes — mijozdan qabul qilinadigan bitta fayl chegarasi.
	// Brauzer yuborishdan oldin rasmni ~300 KB gacha kichraytiradi; bu
	// chegara faqat brauzersiz mijozlar uchun.
	MaxRawPhotoBytes = 6 << 20
	// MaxPixels — dekodlanadigan rasm maydoni. Xotira ~4 bayt/piksel:
	// 16 MP ≈ 64 MB. Bundan kattasi rad etiladi (dekompressiya bombasi:
	// kichik fayl ichida yuz million piksel).
	MaxPixels = 16_000_000
	// MaxSide — saqlanadigan rasmning eng uzun tomoni.
	MaxSide = 1600
	// minSide — bundan kichik rasm foydasiz (yoki piksel-izlagich).
	minSide = 48
	// goodPhotoBytes — shundan kichik natija darrov qabul qilinadi.
	goodPhotoBytes = 700 << 10
	// MaxStoredPhotoBytes — saqlanadigan rasmning qat'iy chegarasi. Bazadagi
	// CHECK (`octet_length(data) <= 1500000`) dan KICHIK bo'lishi shart.
	MaxStoredPhotoBytes = 1_400_000
)

// ErrPhoto — rasm yaroqsiz. Xabar foydalanuvchiga ko'rsatilishi MUMKIN.
var ErrPhoto = errors.New("rasm yaroqsiz (faqat JPEG yoki PNG, 16 megapikseldan kichik)")

// decodeSem — bir vaqtda dekodlanadigan rasmlar soni. Har biri o'nlab MB
// xotira oladi; chegarasiz bo'lsa parallel yuklashlar serverni xotirasiz
// qoldirardi.
var decodeSem = make(chan struct{}, 2)

// NormalizePhoto — yuklangan rasmni QAYTA YARATIB, xavfsiz JPEG qaytaradi.
//
// ┌─ NEGA QAYTA KODLANADI ─────────────────────────────────────────────
// Foydalanuvchi baytlari hech qachon o'zgarishsiz saqlanmaydi va boshqalarga
// berilmaydi:
//  1. metama'lumot (EXIF: telefon modeli, GPS joyi!) tashlanadi — odam
//     rasm bilan o'z uyi koordinatasini yuborib qo'ymasin;
//  2. "rasm + skript" (polyglot) fayllar zararsizlanadi: faqat piksellar
//     qoladi;
//  3. barcha rasm bir xil formatda (JPEG) va cheklangan o'lchamda.
//
// Format kengaytmadan yoki mijoz aytgan Content-Type'dan EMAS, baytlarning
// o'zidan aniqlanadi.
// └────────────────────────────────────────────────────────────────────
func NormalizePhoto(ctx context.Context, raw []byte) ([]byte, error) {
	if len(raw) == 0 || len(raw) > MaxRawPhotoBytes {
		return nil, ErrPhoto
	}
	switch http.DetectContentType(raw) {
	case "image/jpeg", "image/png":
	default:
		return nil, ErrPhoto
	}

	// O'lchamni FAQAT sarlavhadan o'qiymiz — piksellarni dekodlamasdan turib
	// bombani rad etish mumkin.
	cfg, _, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil {
		return nil, ErrPhoto
	}
	if cfg.Width < minSide || cfg.Height < minSide ||
		cfg.Width > 20000 || cfg.Height > 20000 ||
		cfg.Width*cfg.Height > MaxPixels {
		return nil, ErrPhoto
	}

	select {
	case decodeSem <- struct{}{}:
		defer func() { <-decodeSem }()
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	src, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, ErrPhoto
	}

	// Sifat 82 / 1600 px: fotosurat uchun ko'zga ko'rinadigan yo'qotishsiz
	// ~150–400 KB. Juda katta chiqsa (shovqinli, siqilmaydigan rasm) avval sifat,
	// keyin o'lcham tushiriladi: natija HAR DOIM baza cheklovidan (1.5 MB)
	// kichik bo'lishi shart, aks holda taklif "saqlab bo'lmadi" bilan yiqilardi.
	attempts := []struct{ side, quality int }{
		{MaxSide, 82}, {MaxSide, 68}, {1200, 60}, {900, 50},
	}
	var best []byte
	for _, a := range attempts {
		dw, dh := fit(cfg.Width, cfg.Height, a.side)
		out := resizeFlatten(src, dw, dh)
		var buf bytes.Buffer
		if err := jpeg.Encode(&buf, out, &jpeg.Options{Quality: a.quality}); err != nil {
			return nil, ErrPhoto
		}
		if buf.Len() <= goodPhotoBytes {
			return buf.Bytes(), nil
		}
		if best == nil || buf.Len() < len(best) {
			best = buf.Bytes()
		}
	}
	if len(best) > MaxStoredPhotoBytes {
		return nil, ErrPhoto
	}
	return best, nil
}

// fit — eng uzun tomoni `limit` dan oshmaydigan o'lcham (nisbat saqlanadi).
func fit(w, h, limit int) (int, int) {
	if w <= limit && h <= limit {
		return w, h
	}
	if w >= h {
		return limit, max(1, h*limit/w)
	}
	return max(1, w*limit/h), limit
}

// resizeFlatten — `src` ni (dw × dh) ga o'rtacha qiymat (box filtr) bilan
// kichraytiradi va shaffoflikni OQ FON ustiga yoyadi (JPEG'da alfa yo'q).
//
// Box filtr kichraytirishda yaxshi natija beradi (har chiqish pikseli
// manba to'rtburchagining o'rtachasi) va bilinear'dagi kabi "sakrash"
// (aliasing) bermaydi. Manba o'lchamiga chiziqli vaqt oladi.
func resizeFlatten(src image.Image, dw, dh int) *image.RGBA {
	b := src.Bounds()
	sw, sh := b.Dx(), b.Dy()
	dst := image.NewRGBA(image.Rect(0, 0, dw, dh))

	for dy := 0; dy < dh; dy++ {
		y0 := dy * sh / dh
		y1 := (dy + 1) * sh / dh
		if y1 <= y0 {
			y1 = y0 + 1
		}
		for dx := 0; dx < dw; dx++ {
			x0 := dx * sw / dw
			x1 := (dx + 1) * sw / dw
			if x1 <= x0 {
				x1 = x0 + 1
			}
			var r, g, bl, a, n uint64
			for y := y0; y < y1; y++ {
				for x := x0; x < x1; x++ {
					pr, pg, pb, pa := src.At(b.Min.X+x, b.Min.Y+y).RGBA()
					r += uint64(pr)
					g += uint64(pg)
					bl += uint64(pb)
					a += uint64(pa)
					n++
				}
			}
			// `RGBA()` — alfaga OLDINDAN ko'paytirilgan 16-bitli qiymat.
			// Oq fon ustiga: chiqish = rang + (1 − alfa) · oq.
			r, g, bl, a = r/n, g/n, bl/n, a/n
			inv := 65535 - a
			o := dst.PixOffset(dx, dy)
			dst.Pix[o+0] = uint8((r + inv) >> 8)
			dst.Pix[o+1] = uint8((g + inv) >> 8)
			dst.Pix[o+2] = uint8((bl + inv) >> 8)
			dst.Pix[o+3] = 255
		}
	}
	return dst
}
