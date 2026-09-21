package httpapi

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
	"time"

	"ondexmap/internal/places"
	"ondexmap/internal/storage"
)

// Ob'ekt qabul qilish chegaralari.
const (
	// maxSubmitBody — butun so'rov tanasi. Brauzer rasmni ~300 KB gacha
	// kichraytirib yuboradi, shuning uchun odatdagi so'rov < 1.5 MB; bu chegara
	// brauzersiz mijozlar uchun yuqori to'siq.
	maxSubmitBody = 16 << 20
	// maxDataField — JSON maydoni: matn maydonlari yig'indisi ~2 KB.
	maxDataField = 16 << 10
	// maxParts — so'rovdagi bo'laklar soni (1 JSON + rasmlar + zaxira).
	maxParts = places.MaxPhotos + 4

	// maxSubmissionsPerHour — bitta yuboruvchidan soatiga.
	maxSubmissionsPerHour = 8
	// maxPendingTotal — navbat shundan oshsa yangi taklif qabul qilinmaydi.
	// Eng yomon holat xotirasi: 500 × 4 rasm × ~0.7 MB ≈ 1.4 GB. Ko'p IP'dan
	// (botnet) kelgan hujum soatlik chegarani aylanib o'tishi mumkin, lekin
	// bazani shu chegaradan ortiq to'ldira olmaydi.
	maxPendingTotal = 500

	// Yuborish uchun alohida, QATTIQ chegara: bitta so'rov rasm dekodlash va
	// bazaga yozishni ishga tushiradi — qidiruvdan ancha qimmat.
	submitRateBurst  = 3
	submitRatePerSec = 1.0 / 20

	// maxBBoxSpan — `GET /v1/places` uchun to'rtburchak tomoni (daraja).
	// Chegarasiz bitta so'rov butun jadvalni tortib olardi.
	maxBBoxSpan = 1.5
)

// placeSubmitter — karantinga yozuvchi (test uchun almashtiriladi).
type placeSubmitter interface {
	Submit(ctx context.Context, in storage.Submission) error
	RecentCount(ctx context.Context, hint string) (int, error)
	PendingTotal(ctx context.Context) (int, error)
}

// WithSubmitter — ob'ekt qabul qilishni yoqadi. `nil` bo'lsa qabul qilish
// O'CHIQ (`POST /v1/places` → 503): yozish yo'li faqat ongli ravishda ochiladi.
func (s *Server) WithSubmitter(sub placeSubmitter) *Server {
	s.submit = sub
	return s
}

func (s *Server) registerPlacesRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/places/meta", s.rateLimit(s.requireScope(ScopePublic, s.handlePlacesMeta)))
	mux.HandleFunc("GET /v1/places", s.rateLimit(s.requireScope(ScopePublic, s.handlePlaces)))
	mux.HandleFunc("GET /v1/places/{id}", s.rateLimit(s.requireScope(ScopePublic, s.handlePlace)))
	mux.HandleFunc("GET /v1/places/{id}/photos/{n}", s.rateLimit(s.requireScope(ScopePublic, s.handlePlacePhoto)))
	mux.HandleFunc("POST /v1/places", s.submitLimit(s.requireScope(ScopePublic, s.handleSubmitPlace)))
}

// submitLimit — POST /v1/places uchun qattiq rate limit.
func (s *Server) submitLimit(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.submitLimiter.allow(s.clientIP(r)) {
			w.Header().Set("Retry-After", "20")
			httpError(w, http.StatusTooManyRequests, "juda tez-tez yuborilmoqda, birozdan keyin urinib ko'ring")
			return
		}
		next(w, r)
	}
}

// ── O'qish ───────────────────────────────────────────────────────────

// handlePlacesMeta — forma qoidalari: turlar, majburiy maydonlar, turkumlar,
// chegaralar. Mijoz bularni SHU YERDAN oladi (ikki nusxa bo'lmasin), va
// `enabled` — qabul qilish yoqilganmi: o'chiq bo'lsa sahifa «Ob'ekt qo'shish»
// ni umuman ko'rsatmaydi (ishlamaydigan tugma soxta imkoniyat va'da qiladi).
func (s *Server) handlePlacesMeta(w http.ResponseWriter, r *http.Request) {
	type kindView struct {
		Key      string         `json:"key"`
		Label    string         `json:"label"`
		Allowed  []places.Field `json:"allowed"`
		Required []places.Field `json:"required"`
		AnyOf    []places.Field `json:"any_of"`
	}
	kinds := make([]kindView, len(places.Kinds))
	for i, k := range places.Kinds {
		kinds[i] = kindView{
			Key: k.Key, Label: k.Label,
			// `nil` o'rniga bo'sh massiv: mijoz `.includes` chaqirganda yiqilmasin.
			Allowed:  nonNil(k.Allowed),
			Required: nonNil(k.Required),
			AnyOf:    nonNil(k.AnyOf),
		}
	}
	w.Header().Set("Cache-Control", "public, max-age=60")
	writeJSON(w, http.StatusOK, map[string]any{
		"enabled":    s.submit != nil,
		"kinds":      kinds,
		"categories": places.Categories,
		"max_photos": places.MaxPhotos,
		"limits": map[string]int{
			"name": places.MaxName, "description": places.MaxDescription,
			"hours": places.MaxHours, "street": places.MaxStreet, "house": places.MaxHouse,
		},
	})
}

func nonNil(f []places.Field) []places.Field {
	if f == nil {
		return []places.Field{}
	}
	return f
}

// handlePlaces — ko'rinishdagi tasdiqlangan ob'ektlar (GeoJSON).
func (s *Server) handlePlaces(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Query().Get("bbox"), ",")
	if len(parts) != 4 {
		httpError(w, http.StatusBadRequest, "bbox noto'g'ri (g'arb,janub,sharq,shimol)")
		return
	}
	var v [4]float64
	for i, p := range parts {
		lo, hi := uzMinLng, uzMaxLng
		if i%2 == 1 {
			lo, hi = uzMinLat, uzMaxLat
		}
		f, ok := parseCoord(p, lo, hi)
		if !ok {
			httpError(w, http.StatusBadRequest, "bbox noto'g'ri yoki O'zbekiston tashqarisida")
			return
		}
		v[i] = f
	}
	west, south, east, north := v[0], v[1], v[2], v[3]
	if west >= east || south >= north || east-west > maxBBoxSpan || north-south > maxBBoxSpan {
		httpError(w, http.StatusBadRequest, "bbox hajmi noto'g'ri yoki juda katta")
		return
	}
	if s.db == nil {
		httpError(w, http.StatusServiceUnavailable, "baza ulanmagan")
		return
	}
	body, err := s.db.PlacesGeoJSON(r.Context(), west, south, east, north, storage.MaxPlacesPerView)
	if err != nil {
		slog.Error("ob'ektlar so'rovi xatosi", "err", err)
		httpError(w, http.StatusBadGateway, "so'rov bajarilmadi")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	// Yangi tasdiqlangan ob'ekt tez ko'rinsin: uzoq kesh yo'q.
	w.Header().Set("Cache-Control", "public, max-age=15")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}

func (s *Server) handlePlace(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !storage.ValidID(id) {
		httpError(w, http.StatusNotFound, "topilmadi")
		return
	}
	if s.db == nil {
		httpError(w, http.StatusServiceUnavailable, "baza ulanmagan")
		return
	}
	d, err := s.db.PlaceByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			httpError(w, http.StatusNotFound, "topilmadi")
			return
		}
		slog.Error("ob'ekt so'rovi xatosi", "err", err)
		httpError(w, http.StatusBadGateway, "so'rov bajarilmadi")
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=15")
	writeJSON(w, http.StatusOK, d)
}

func (s *Server) handlePlacePhoto(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	n, err := strconv.Atoi(r.PathValue("n"))
	if err != nil || !storage.ValidID(id) || n < 0 || n >= places.MaxPhotos {
		httpError(w, http.StatusNotFound, "topilmadi")
		return
	}
	if s.db == nil {
		httpError(w, http.StatusServiceUnavailable, "baza ulanmagan")
		return
	}
	data, err := s.db.PlacePhoto(r.Context(), id, n)
	if err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			httpError(w, http.StatusNotFound, "topilmadi")
			return
		}
		slog.Error("rasm so'rovi xatosi", "err", err)
		httpError(w, http.StatusBadGateway, "so'rov bajarilmadi")
		return
	}
	h := w.Header()
	// Baytlar `NormalizePhoto` dan o'tgan JPEG. `nosniff` (global) brauzerga
	// turini o'zgartirishga yo'l qo'ymaydi.
	h.Set("Content-Type", "image/jpeg")
	h.Set("Content-Length", strconv.Itoa(len(data)))
	h.Set("Cache-Control", "public, max-age=86400")
	// Rasm boshqa origin'dagi sahifada (xarita sayti) ko'rsatiladi.
	h.Set("Cross-Origin-Resource-Policy", "cross-origin")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

// ── Yozish (karantinga) ──────────────────────────────────────────────

// submitHint — yuboruvchining qo'pol belgisi: IP'ning HMAC'i. Xom IP hech
// qayerga yozilmaydi; sir bo'lmasa xeshdan IP'ni tiklash oson bo'lardi.
func (s *Server) submitHint(r *http.Request) string {
	secret := s.cfg.SubmitHintSecret
	if secret == "" {
		// Faqat dev: prod'da sir bo'lmasa server ishga tushmaydi (config).
		secret = "ondexmap-dev-hint-secret"
	}
	m := hmac.New(sha256.New, []byte(secret))
	m.Write([]byte(s.clientIP(r)))
	return hex.EncodeToString(m.Sum(nil))[:32]
}

// handleSubmitPlace — yangi ob'ektni KARANTINGA yozadi.
//
// Xaritaga hech narsa tushmaydi: taklif `place_submissions` ga yoziladi va
// admin tasdiqlagach hamma uchun ko'rinadi.
func (s *Server) handleSubmitPlace(w http.ResponseWriter, r *http.Request) {
	if s.submit == nil {
		httpError(w, http.StatusServiceUnavailable, "ob'ekt qabul qilish hozircha yoqilmagan")
		return
	}

	mediaType, params, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "multipart/form-data" || params["boundary"] == "" {
		httpError(w, http.StatusUnsupportedMediaType, "so'rov multipart/form-data bo'lishi kerak")
		return
	}

	// Sekin mobil tarmoqda 16 MB gacha yuklash standart 15 s dan uzoq
	// bo'lishi mumkin: shu so'rovga muddat uzaytiriladi (boshqalarga emas).
	rc := http.NewResponseController(w)
	_ = rc.SetReadDeadline(time.Now().Add(90 * time.Second))
	_ = rc.SetWriteDeadline(time.Now().Add(120 * time.Second))
	r.Body = http.MaxBytesReader(w, r.Body, maxSubmitBody)

	in, raw, perr := readSubmission(multipart.NewReader(r.Body, params["boundary"]))
	if perr != nil {
		writeSubmitParseError(w, perr)
		return
	}

	// Asalari: bot to'ldirgan. Muvaffaqiyat ko'rinishida javob beramiz (botga
	// "rad etildi" deb bildirmaymiz), lekin hech narsa saqlanmaydi.
	if in.IsBot() {
		writeJSON(w, http.StatusCreated, map[string]string{"status": "pending"})
		return
	}

	// Avval ARZON tekshiruv: yaroqsiz so'rov rasm dekodlashgacha yetib bormasin.
	clean, err := places.Validate(in)
	if err != nil {
		var ve *places.ValidationError
		if errors.As(err, &ve) {
			httpError(w, http.StatusBadRequest, ve.Msg)
			return
		}
		httpError(w, http.StatusBadRequest, "ma'lumot yaroqsiz")
		return
	}

	ctx := r.Context()
	hint := s.submitHint(r)

	n, err := s.submit.RecentCount(ctx, hint)
	if err != nil {
		slog.Error("takliflar sonini o'qib bo'lmadi", "err", err)
		httpError(w, http.StatusBadGateway, "saqlab bo'lmadi")
		return
	}
	if n >= maxSubmissionsPerHour {
		w.Header().Set("Retry-After", "600")
		httpError(w, http.StatusTooManyRequests, "soatiga "+strconv.Itoa(maxSubmissionsPerHour)+" tadan ko'p ob'ekt yuborib bo'lmaydi")
		return
	}
	pending, err := s.submit.PendingTotal(ctx)
	if err != nil {
		slog.Error("navbat hajmini o'qib bo'lmadi", "err", err)
		httpError(w, http.StatusBadGateway, "saqlab bo'lmadi")
		return
	}
	if pending >= maxPendingTotal {
		w.Header().Set("Retry-After", "3600")
		httpError(w, http.StatusServiceUnavailable, "hozir juda ko'p taklif tekshiruvni kutmoqda, keyinroq urinib ko'ring")
		return
	}

	photos := make([][]byte, 0, len(raw))
	for _, b := range raw {
		p, err := places.NormalizePhoto(ctx, b)
		if err != nil {
			if errors.Is(err, places.ErrPhoto) {
				httpError(w, http.StatusBadRequest, places.ErrPhoto.Error())
				return
			}
			httpError(w, http.StatusServiceUnavailable, "server band, keyinroq urinib ko'ring")
			return
		}
		photos = append(photos, p)
	}

	if err := s.submit.Submit(ctx, storage.Submission{Clean: clean, Photos: photos, Hint: hint}); err != nil {
		slog.Error("taklifni saqlab bo'lmadi", "err", err)
		httpError(w, http.StatusBadGateway, "saqlab bo'lmadi")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"status": "pending"})
}

// submitParseError — so'rovni o'qishdagi xato (foydalanuvchiga ko'rsatiladigan).
type submitParseError struct {
	status int
	msg    string
}

func (e *submitParseError) Error() string { return e.msg }

func writeSubmitParseError(w http.ResponseWriter, err error) {
	var pe *submitParseError
	if errors.As(err, &pe) {
		httpError(w, pe.status, pe.msg)
		return
	}
	httpError(w, http.StatusBadRequest, "so'rov yaroqsiz")
}

// readSubmission — multipart so'rovni OQIM sifatida o'qiydi.
//
// `ParseMultipartForm` ATAYLAB ishlatilmaydi: u katta qismlarni vaqtinchalik
// DISK fayliga yozadi (tizim diskida joy bo'lmasligi mumkin va hujumchi
// diskni to'ldirishi mumkin). Bu yerda hamma narsa xotirada va qat'iy
// chegaralar bilan o'qiladi.
func readSubmission(mr *multipart.Reader) (places.Input, [][]byte, error) {
	var (
		in      places.Input
		gotData bool
		raw     [][]byte
	)
	for i := 0; ; i++ {
		if i >= maxParts {
			return in, nil, &submitParseError{http.StatusBadRequest, "so'rovda ortiqcha bo'laklar bor"}
		}
		part, err := mr.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return in, nil, bodyError(err)
		}

		switch part.FormName() {
		case "data":
			if gotData {
				return in, nil, &submitParseError{http.StatusBadRequest, "«data» ikki marta yuborilgan"}
			}
			b, err := io.ReadAll(io.LimitReader(part, maxDataField+1))
			if err != nil {
				return in, nil, bodyError(err)
			}
			if len(b) > maxDataField {
				return in, nil, &submitParseError{http.StatusRequestEntityTooLarge, "ma'lumot maydoni juda katta"}
			}
			dec := json.NewDecoder(bytes.NewReader(b))
			// Noma'lum maydon RAD ETILADI: noto'g'ri yozilgan yoki qo'lda
			// yasalgan so'rov jimgina e'tiborsiz qolmasin.
			dec.DisallowUnknownFields()
			if err := dec.Decode(&in); err != nil || dec.More() {
				return in, nil, &submitParseError{http.StatusBadRequest, "ma'lumot maydoni yaroqsiz"}
			}
			gotData = true

		case "photos":
			if len(raw) >= places.MaxPhotos {
				return in, nil, &submitParseError{http.StatusBadRequest,
					"ko'pi bilan " + strconv.Itoa(places.MaxPhotos) + " ta rasm yuborish mumkin"}
			}
			b, err := io.ReadAll(io.LimitReader(part, places.MaxRawPhotoBytes+1))
			if err != nil {
				return in, nil, bodyError(err)
			}
			if len(b) > places.MaxRawPhotoBytes {
				return in, nil, &submitParseError{http.StatusRequestEntityTooLarge, "rasm juda katta"}
			}
			raw = append(raw, b)

		default:
			return in, nil, &submitParseError{http.StatusBadRequest, "noma'lum maydon"}
		}
	}
	if !gotData {
		return in, nil, &submitParseError{http.StatusBadRequest, "«data» maydoni yo'q"}
	}
	return in, raw, nil
}

// bodyError — tana o'qishdagi xatoni javobga aylantiradi. `MaxBytesReader`
// chegarasi oshsa 413, qolgani (uzilgan ulanish, buzuq chegara) 400.
func bodyError(err error) error {
	var mbe *http.MaxBytesError
	if errors.As(err, &mbe) {
		return &submitParseError{http.StatusRequestEntityTooLarge, "so'rov juda katta"}
	}
	return &submitParseError{http.StatusBadRequest, "so'rov yaroqsiz"}
}
