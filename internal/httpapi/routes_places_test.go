package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"sync"
	"testing"

	"ondexmap/internal/places"
	"ondexmap/internal/storage"
)

// fakeSubmitter — karantin o'rniga xotira (baza kerak emas).
type fakeSubmitter struct {
	mu      sync.Mutex
	saved   []storage.Submission
	recent  int
	pending int
	err     error
}

func (f *fakeSubmitter) Submit(_ context.Context, in storage.Submission) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return f.err
	}
	f.saved = append(f.saved, in)
	return nil
}
func (f *fakeSubmitter) RecentCount(context.Context, string) (int, error) { return f.recent, nil }
func (f *fakeSubmitter) PendingTotal(context.Context) (int, error)        { return f.pending, nil }
func (f *fakeSubmitter) count() int                                       { f.mu.Lock(); defer f.mu.Unlock(); return len(f.saved) }

func jpegBytes(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{uint8(x), uint8(y), 90, 255})
		}
	}
	var b bytes.Buffer
	if err := jpeg.Encode(&b, img, nil); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

// part — nomlangan multipart bo'lagi.
type part struct {
	name string
	body []byte
}

func multipartRequest(t *testing.T, parts []part) *http.Request {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	for _, p := range parts {
		hdr := textproto.MIMEHeader{}
		hdr.Set("Content-Disposition", `form-data; name="`+p.name+`"; filename="x.bin"`)
		w, err := mw.CreatePart(hdr)
		if err != nil {
			t.Fatal(err)
		}
		_, _ = w.Write(p.body)
	}
	_ = mw.Close()
	r := httptest.NewRequest(http.MethodPost, "/v1/places", &buf)
	r.Header.Set("Content-Type", mw.FormDataContentType())
	r.Header.Set("Origin", "http://localhost:3100")
	return r
}

func dataPart(t *testing.T, v any) part {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return part{"data", b}
}

func validData() map[string]any {
	return map[string]any{
		"kind": "organization", "lat": 41.0, "lng": 71.24,
		"name": "Chust Non", "category": "Kafe",
	}
}

func submitServer(t *testing.T, f *fakeSubmitter) http.Handler {
	t.Helper()
	s := New(baseCfg(), nil)
	if f != nil {
		s.WithSubmitter(f)
	}
	return s.Handler()
}

func serve(h http.Handler, r *http.Request) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func errMsg(t *testing.T, w *httptest.ResponseRecorder) string {
	t.Helper()
	var body map[string]string
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	return body["error"]
}

func TestSubmitDisabledWithoutSubmitter(t *testing.T) {
	h := submitServer(t, nil)
	w := serve(h, multipartRequest(t, []part{dataPart(t, validData())}))
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("yuboruvchisiz 503 kutilgan, %d", w.Code)
	}
}

func TestSubmitHappyPathWritesToQuarantineOnly(t *testing.T) {
	f := &fakeSubmitter{}
	h := submitServer(t, f)
	w := serve(h, multipartRequest(t, []part{
		dataPart(t, validData()),
		{"photos", jpegBytes(t, 800, 600)},
	}))
	if w.Code != http.StatusCreated {
		t.Fatalf("201 kutilgan, %d: %s", w.Code, w.Body.String())
	}
	var body map[string]string
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	// Javob "pending" — xaritaga TO'G'RIDAN-TO'G'RI tushmaydi.
	if body["status"] != "pending" {
		t.Errorf("status %q, pending kutilgan", body["status"])
	}
	if f.count() != 1 {
		t.Fatalf("karantinga %d ta yozildi, 1 kutilgan", f.count())
	}
	got := f.saved[0]
	if got.Name != "Chust Non" || got.Kind != "organization" || len(got.Photos) != 1 {
		t.Errorf("noto'g'ri saqlandi: %+v", got.Clean)
	}
	// Hint — xom IP EMAS.
	if got.Hint == "" || strings.Contains(got.Hint, "192.0.2.1") {
		t.Errorf("hint yaroqsiz yoki xom IP: %q", got.Hint)
	}
	// Rasm qayta kodlangan JPEG.
	if _, format, err := image.DecodeConfig(bytes.NewReader(got.Photos[0])); err != nil || format != "jpeg" {
		t.Errorf("rasm JPEG emas: %v %q", err, format)
	}
}

func TestSubmitHintIsStableAndDoesNotContainIP(t *testing.T) {
	s := New(baseCfg(), nil)
	r1 := httptest.NewRequest("GET", "/", nil)
	r1.RemoteAddr = "203.0.113.7:1"
	r2 := httptest.NewRequest("GET", "/", nil)
	r2.RemoteAddr = "203.0.113.7:9999" // port boshqa, IP bir xil
	r3 := httptest.NewRequest("GET", "/", nil)
	r3.RemoteAddr = "203.0.113.8:1"
	if s.submitHint(r1) != s.submitHint(r2) {
		t.Error("bir IP uchun hint har xil")
	}
	if s.submitHint(r1) == s.submitHint(r3) {
		t.Error("turli IP uchun hint bir xil")
	}
	if strings.Contains(s.submitHint(r1), "203") {
		t.Error("hint IP'ni o'z ichiga olgan")
	}
}

func TestSubmitHoneypotPretendsSuccessButSavesNothing(t *testing.T) {
	f := &fakeSubmitter{}
	h := submitServer(t, f)
	d := validData()
	d["website"] = "http://spam.example"
	w := serve(h, multipartRequest(t, []part{dataPart(t, d)}))
	if w.Code != http.StatusCreated {
		t.Fatalf("bot uchun 201 (o'xshatma) kutilgan, %d", w.Code)
	}
	if f.count() != 0 {
		t.Fatal("asalari to'ldirilgan so'rov SAQLANDI")
	}
}

func TestSubmitRejections(t *testing.T) {
	big := bytes.Repeat([]byte("a"), places.MaxRawPhotoBytes+10)
	cases := map[string]struct {
		parts  func(t *testing.T) []part
		status int
	}{
		"data yo'q": {func(t *testing.T) []part { return []part{{"photos", jpegBytes(t, 200, 200)}} }, 400},
		"data ikki marta": {func(t *testing.T) []part {
			return []part{dataPart(t, validData()), dataPart(t, validData())}
		}, 400},
		"noma'lum maydon nomi": {func(t *testing.T) []part {
			return []part{dataPart(t, validData()), {"admin", []byte("1")}}
		}, 400},
		"noma'lum JSON maydoni": {func(t *testing.T) []part {
			d := validData()
			d["status"] = "approved" // o'zini tasdiqlangan qilib yuborishga urinish
			return []part{dataPart(t, d)}
		}, 400},
		"buzuq JSON":    {func(t *testing.T) []part { return []part{{"data", []byte("{not json")}} }, 400},
		"JSON + axlat":  {func(t *testing.T) []part { return []part{{"data", []byte(`{"kind":"other"} {"x":1}`)}} }, 400},
		"noto'g'ri tur": {func(t *testing.T) []part { d := validData(); d["kind"] = "zavod"; return []part{dataPart(t, d)} }, 400},
		"hududdan tashqari": {func(t *testing.T) []part {
			d := validData()
			d["lat"], d["lng"] = 55.7, 37.6
			return []part{dataPart(t, d)}
		}, 400},
		"rasm emas": {func(t *testing.T) []part {
			return []part{dataPart(t, validData()), {"photos", []byte("<html><script>alert(1)</script>")}}
		}, 400},
		"5 ta rasm": {func(t *testing.T) []part {
			ps := []part{dataPart(t, validData())}
			for i := 0; i < places.MaxPhotos+1; i++ {
				ps = append(ps, part{"photos", jpegBytes(t, 100, 100)})
			}
			return ps
		}, 400},
		"juda katta rasm": {func(t *testing.T) []part {
			return []part{dataPart(t, validData()), {"photos", big}}
		}, 413},
		"juda katta data": {func(t *testing.T) []part {
			return []part{{"data", bytes.Repeat([]byte(" "), maxDataField+10)}}
		}, 413},
	}
	for name, c := range cases {
		f := &fakeSubmitter{}
		h := submitServer(t, f)
		w := serve(h, multipartRequest(t, c.parts(t)))
		if w.Code != c.status {
			t.Errorf("%s: %d kutilgan, %d: %s", name, c.status, w.Code, w.Body.String())
		}
		if f.count() != 0 {
			t.Errorf("%s: rad etilgan so'rov SAQLANDI", name)
		}
	}
}

func TestSubmitRejectsNonMultipart(t *testing.T) {
	h := submitServer(t, &fakeSubmitter{})
	r := httptest.NewRequest(http.MethodPost, "/v1/places", strings.NewReader(`{"kind":"other"}`))
	r.Header.Set("Content-Type", "application/json")
	if w := serve(h, r); w.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("415 kutilgan, %d", w.Code)
	}
}

func TestSubmitErrorMessageDoesNotEchoInput(t *testing.T) {
	h := submitServer(t, &fakeSubmitter{})
	d := validData()
	d["category"] = "<img src=x onerror=alert(1)>"
	w := serve(h, multipartRequest(t, []part{dataPart(t, d)}))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("400 kutilgan, %d", w.Code)
	}
	if strings.Contains(w.Body.String(), "<img") || strings.Contains(w.Body.String(), "alert") {
		t.Errorf("xato javobi kiruvchi matnni aks ettirdi: %s", w.Body.String())
	}
}

func TestSubmitHourlyLimit(t *testing.T) {
	f := &fakeSubmitter{recent: maxSubmissionsPerHour}
	w := serve(submitServer(t, f), multipartRequest(t, []part{dataPart(t, validData())}))
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("429 kutilgan, %d", w.Code)
	}
	if f.count() != 0 {
		t.Fatal("chegaradan oshgan so'rov saqlandi")
	}
}

func TestSubmitQueueFull(t *testing.T) {
	f := &fakeSubmitter{pending: maxPendingTotal}
	w := serve(submitServer(t, f), multipartRequest(t, []part{dataPart(t, validData())}))
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("503 kutilgan, %d", w.Code)
	}
}

func TestSubmitStorageFailureIsGenericError(t *testing.T) {
	f := &fakeSubmitter{err: errors.New(`pq: relation "place_submissions" does not exist`)}
	w := serve(submitServer(t, f), multipartRequest(t, []part{dataPart(t, validData())}))
	if w.Code != http.StatusBadGateway {
		t.Fatalf("502 kutilgan, %d", w.Code)
	}
	if strings.Contains(w.Body.String(), "place_submissions") || strings.Contains(w.Body.String(), "pq:") {
		t.Errorf("ichki xato tashqariga chiqdi: %s", w.Body.String())
	}
}

func TestSubmitRateLimit(t *testing.T) {
	h := submitServer(t, &fakeSubmitter{})
	blocked := false
	for i := 0; i < submitRateBurst*3; i++ {
		if serve(h, multipartRequest(t, []part{dataPart(t, validData())})).Code == http.StatusTooManyRequests {
			blocked = true
			break
		}
	}
	if !blocked {
		t.Error("yuborish rate limit'i ishlamadi")
	}
}

// ── O'qish ───────────────────────────────────────────────────────────

func TestPlacesMetaReflectsSubmitterAndListsAllKinds(t *testing.T) {
	type meta struct {
		Enabled bool `json:"enabled"`
		Kinds   []struct {
			Key      string   `json:"key"`
			Allowed  []string `json:"allowed"`
			Required []string `json:"required"`
			AnyOf    []string `json:"any_of"`
		} `json:"kinds"`
		Categories []string `json:"categories"`
		MaxPhotos  int      `json:"max_photos"`
	}
	get := func(h http.Handler) meta {
		w := do(h, "GET", "/v1/places/meta", "")
		if w.Code != http.StatusOK {
			t.Fatalf("meta: %d", w.Code)
		}
		var m meta
		if err := json.Unmarshal(w.Body.Bytes(), &m); err != nil {
			t.Fatal(err)
		}
		return m
	}
	off := get(submitServer(t, nil))
	if off.Enabled {
		t.Error("yuboruvchisiz server enabled=true dedi")
	}
	on := get(submitServer(t, &fakeSubmitter{}))
	if !on.Enabled {
		t.Error("yuboruvchi bor, lekin enabled=false")
	}
	if len(on.Kinds) != len(places.Kinds) || len(on.Categories) == 0 || on.MaxPhotos != places.MaxPhotos {
		t.Errorf("meta to'liq emas: %d tur, %d turkum, %d rasm", len(on.Kinds), len(on.Categories), on.MaxPhotos)
	}
	for _, k := range on.Kinds {
		// Mijoz `.includes` chaqiradi: `null` emas, bo'sh massiv bo'lishi shart.
		if k.Allowed == nil || k.Required == nil || k.AnyOf == nil {
			t.Errorf("%s: null massiv (mijoz yiqiladi)", k.Key)
		}
	}
}

func TestPlacesBBoxValidation(t *testing.T) {
	h := testServer(t, baseCfg())
	bad := []string{
		"",                     // yo'q
		"bbox=1,2,3",           // 3 ta
		"bbox=a,b,c,d",         // son emas
		"bbox=71,41,70,42",     // g'arb >= sharq
		"bbox=71,41,72,40",     // janub >= shimol
		"bbox=0,0,1,1",         // O'zbekistondan tashqari
		"bbox=NaN,41,72,42",    // NaN
		"bbox=60,38,72,44",     // juda katta (12° × 6°)
		"bbox=70,40,71.6,40.5", // eni 1.6° > 1.5°
	}
	for _, q := range bad {
		w := do(h, "GET", "/v1/places?"+q, "")
		if w.Code != http.StatusBadRequest {
			t.Errorf("%q: 400 kutilgan, %d", q, w.Code)
		}
	}
	// To'g'ri bbox — validatsiyadan o'tadi; baza yo'q bo'lgani uchun 503.
	if w := do(h, "GET", "/v1/places?bbox=71.2,40.9,71.3,41.1", ""); w.Code != http.StatusServiceUnavailable {
		t.Errorf("to'g'ri bbox: 503 (baza yo'q) kutilgan, %d", w.Code)
	}
}

func TestPlaceIDAndPhotoParamsValidated(t *testing.T) {
	h := testServer(t, baseCfg())
	for _, p := range []string{
		"/v1/places/not-a-uuid",
		"/v1/places/../../etc/passwd",
		"/v1/places/00000000-0000-0000-0000-000000000000/photos/9",
		"/v1/places/00000000-0000-0000-0000-000000000000/photos/-1",
		"/v1/places/00000000-0000-0000-0000-000000000000/photos/x",
		"/v1/places/'%20OR%201=1--/photos/0",
	} {
		w := do(h, "GET", p, "")
		// `..` li yo'l: ServeMux uni tozalab qayta yo'naltiradi (307) — ob'ekt handleriga umuman yetmaydi.
		if w.Code != http.StatusNotFound && w.Code != http.StatusTemporaryRedirect {
			t.Errorf("%s: 404 kutilgan, %d", p, w.Code)
		}
	}
}
