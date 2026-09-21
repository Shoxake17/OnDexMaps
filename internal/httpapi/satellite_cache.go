package httpapi

import (
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"sync"
	"sync/atomic"
)

// Sun'iy yo'ldosh tile'lari uchun DISK keshi.
//
// ┌─ NEGA KERAK ───────────────────────────────────────────────────────
// Provayder (Esri) bepul chegara beradi — oyiga ~2 mln tile. Keshsiz
// har bir foydalanuvchi, har bir ochilishda o'sha tile'ni QAYTADAN
// so'raydi: bir kishi bitta shaharni aylanib chiqsa ~500 tile, ya'ni
// chegara bir necha ming seansdayoq tugaydi. Tasvir esa O'ZGARMAYDI —
// sun'iy yo'ldosh qatlami yiliga bir marta yangilanadi.
//
// Shu sababli har bir tile provayderdan BIR MARTA olinadi va diskda
// qoladi. Ikkinchi so'rovdan boshlab provayderga umuman chiqilmaydi.
// Qo'shimcha foyda: kesh javobi ~1 ms, tashqi so'rov ~200 ms.
// └──────────────────────────────────────────────────────────────────
//
// ┌─ NEGA OLDINDAN YUKLANMAYDI (butun O'zbekiston) ────────────────────
// "Butun mamlakatni oldindan yuklab qo'yamiz" ishlamaydi: O'zbekiston
// ~449 000 km², z18 da bitta tile ~150×150 m — ya'ni ~20 MILLIARD
// tile, petabaytlarcha joy va bepul chegaradan 10 000 barobar ko'p
// so'rov.
//
// Shuning uchun kesh HUDUD bo'yicha cheklanmagan (butun mamlakat
// ochiq), lekin TALAB bo'yicha to'ladi: foydalanuvchi qaragan joy
// diskda qoladi. Amalda bu bir xil natija beradi — odamlar mamlakatning
// hamma kvadrat metriga emas, shahar va yo'llarga qaraydi.
// └──────────────────────────────────────────────────────────────────

// tileCache — oddiy fayl keshi: `<dir>/<z>/<x>/<y>`.
//
// Kesh — OPTIMIZATSIYA, ishonchlilik manbasi emas. Shu sababli bu
// yerdagi HAR QANDAY xato jimgina yutiladi va tile baribir
// provayderdan beriladi: diskda joy tugashi yoki papkaga yozish
// huquqi yo'qligi xaritani O'CHIRIB QO'YMASLIGI kerak.
type tileCache struct {
	dir      string
	maxBytes int64

	// size — diskdagi taxminiy hajm. "Taxminiy", chunki u startdagi
	// hisobdan boshlanadi va keyin faqat o'zimiz yozgan/o'chirgan
	// fayllar bo'yicha yangilanadi. Tozalash uchun shu aniqlik yetarli.
	size atomic.Int64

	// sweeping — bir vaqtda BITTA tozalash. Usiz chegara oshgan
	// paytda har bir so'rov o'z tozalashini boshlab yuborardi va
	// ular bir-birining fayllarini o'chirib, diskni ham, protsessorni
	// ham bekor band qilardi.
	sweeping atomic.Bool

	// mu — bitta tile uchun bir vaqtda bitta yozuv.
	mu sync.Mutex
}

// newTileCache — papkani tayyorlaydi. Xato bo'lsa `nil` qaytaradi va
// chaqiruvchi keshsiz davom etadi.
func newTileCache(dir string, maxMB int) *tileCache {
	if dir == "" || maxMB <= 0 {
		return nil
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		slog.Warn("sun'iy yo'ldosh keshi yoqilmadi", "dir", dir, "err", err)
		return nil
	}
	c := &tileCache{dir: dir, maxBytes: int64(maxMB) << 20}

	// Mavjud hajmni fonda hisoblaymiz: kesh katta bo'lsa bu bir necha
	// soniya olishi mumkin va server ishga tushishini kechiktirmasligi
	// kerak.
	go func() {
		var total int64
		_ = filepath.WalkDir(c.dir, func(_ string, d os.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return nil //nolint:nilerr // o'qib bo'lmagan fayl shunchaki hisobga kirmaydi
			}
			if fi, err := d.Info(); err == nil {
				total += fi.Size()
			}
			return nil
		})
		c.size.Store(total)
		slog.Info("sun'iy yo'ldosh keshi", "dir", c.dir,
			"hajm_mb", total>>20, "chegara_mb", c.maxBytes>>20)
		c.sweepIfNeeded()
	}()

	return c
}

// path — tile fayli. `z`, `x`, `y` chaqiruvchida ALLAQACHON son
// sifatida tekshirilgan, shuning uchun bu yerda yo'ldan chiqish
// (`../`) mumkin emas.
func (c *tileCache) path(z, x, y int) string {
	return filepath.Join(c.dir,
		strconv.Itoa(z), strconv.Itoa(x), strconv.Itoa(y))
}

// get — keshdagi tile. Ikkinchi qiymat — Content-Type.
//
// ⚠️ Tur DISKDAGI BAYTLARDAN aniqlanadi, alohida saqlanmaydi. Sabab:
// ikkita fayl (tasvir + uning turi) bir-biridan ajralib qolishi mumkin,
// va buzilgan yoki yarim yozilgan fayl "rasm" deb uzatilsa brauzerda
// tushunarsiz «could not be decoded» chiqardi. Sehrli baytlar mos
// kelmasa — kesh YO'Q deb hisoblanadi va tile qaytadan olinadi.
func (c *tileCache) get(z, x, y int) ([]byte, string, bool) {
	if c == nil {
		return nil, "", false
	}
	b, err := os.ReadFile(c.path(z, x, y))
	if err != nil || len(b) == 0 {
		return nil, "", false
	}
	ct := imageContentType(b)
	if ct == "" {
		return nil, "", false
	}
	return b, ct, true
}

// put — tile'ni diskka yozadi.
//
// Yozuv ATOMAR: avval vaqtinchalik faylga, so'ng `Rename`. Aks holda
// server yozish o'rtasida to'xtasa, diskda YARIM tile qolardi va u
// keyin "tayyor" deb uzatilib, xaritada buzuq katak ko'rinardi.
func (c *tileCache) put(z, x, y int, body []byte) {
	if c == nil || imageContentType(body) == "" {
		return
	}

	dst := c.path(z, x, y)
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	tmp, err := os.CreateTemp(filepath.Dir(dst), ".tile-*")
	if err != nil {
		return
	}
	tmpName := tmp.Name()
	_, werr := tmp.Write(body)
	cerr := tmp.Close()
	if werr != nil || cerr != nil {
		_ = os.Remove(tmpName)
		return
	}

	// Eski nusxa bo'lsa, hajm hisobidan chiqaramiz — aks holda bir
	// tile qayta yozilganda hisob haqiqatdan yuqori ketib, kesh
	// vaqtidan oldin tozalanib turardi.
	var old int64
	if fi, err := os.Stat(dst); err == nil {
		old = fi.Size()
	}

	if err := os.Rename(tmpName, dst); err != nil {
		_ = os.Remove(tmpName)
		return
	}
	c.size.Add(int64(len(body)) - old)
	c.sweepIfNeeded()
}

// sweepIfNeeded — chegara oshgan bo'lsa fonda tozalaydi.
func (c *tileCache) sweepIfNeeded() {
	if c.size.Load() <= c.maxBytes || !c.sweeping.CompareAndSwap(false, true) {
		return
	}
	go func() {
		defer c.sweeping.Store(false)
		c.sweep()
	}()
}

// sweepTarget — tozalashdan keyin qoladigan ulush.
//
// Aynan chegaraga tushirilsa, keyingi yozuv darhol yana tozalashni
// boshlab yuborardi. 80% — "bir tozalash uzoqqa yetsin" degani.
const sweepTarget = 0.8

// sweep — eng ESKI fayllarni o'chiradi.
//
// Tartib `mtime` bo'yicha, `atime` emas: Windows'da oxirgi o'qish
// vaqti odatda YOZILMAYDI (NtfsDisableLastAccessUpdate standart
// holatda yoqilgan), ya'ni "oxirgi ishlatilgan" bo'yicha saralash
// tasodifiy natija berardi. Yozilgan vaqt esa doim ishonchli.
func (c *tileCache) sweep() {
	type entry struct {
		path string
		size int64
		mod  int64
	}
	var files []entry
	var total int64

	err := filepath.WalkDir(c.dir, func(p string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil //nolint:nilerr // o'qilmagan tarmoq tozalashni to'xtatmaydi
		}
		fi, err := d.Info()
		if err != nil {
			return nil //nolint:nilerr
		}
		files = append(files, entry{p, fi.Size(), fi.ModTime().UnixNano()})
		total += fi.Size()
		return nil
	})
	if err != nil {
		return
	}

	c.size.Store(total)
	target := int64(float64(c.maxBytes) * sweepTarget)
	if total <= target {
		return
	}

	sort.Slice(files, func(i, j int) bool { return files[i].mod < files[j].mod })

	removed := 0
	for _, f := range files {
		if total <= target {
			break
		}
		if err := os.Remove(f.path); err != nil {
			continue
		}
		total -= f.size
		removed++
	}
	c.size.Store(total)
	slog.Info("sun'iy yo'ldosh keshi tozalandi",
		"o'chirilgan", removed, "qolgan_mb", total>>20)
}

// imageContentType — sehrli baytlar bo'yicha rasm turi.
//
// Ro'yxat ATAYLAB tor: faqat tile provayderlari qaytaradigan uchta
// format. Noma'lum bayt ketma-ketligi "rasm emas" deb hisoblanadi va
// mijozga UMUMAN uzatilmaydi — provayderning xato sahifasi (HTML/XML)
// tasvir sifatida ketib qolmasin.
func imageContentType(b []byte) string {
	switch {
	case len(b) >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF:
		return "image/jpeg"
	case len(b) >= 8 && string(b[:8]) == "\x89PNG\r\n\x1a\n":
		return "image/png"
	case len(b) >= 12 && string(b[:4]) == "RIFF" && string(b[8:12]) == "WEBP":
		return "image/webp"
	default:
		return ""
	}
}
