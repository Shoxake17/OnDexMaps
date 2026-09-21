package adminapi

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"ondexmap/internal/places"
	"ondexmap/internal/storage"
)

// Foydalanuvchi ob'ektlari moderatsiyasi.
//
// UI bu yerda EMAS: u ChustApp admin panelining OnDexMap bo'limida
// (`apps/admin_panel/lib/ondexmap/`), nativ Flutter ekran sifatida. Bu
// fayl faqat u chaqiradigan JSON endpointlar; ular kalit talab qiladi va
// faqat lokal (127.0.0.1) admin serverida turadi.

// reviewer — tasdiqlovchining belgisi (`geo_revisions.applied_by`). Bu vosita
// bitta lokal admin uchun; ko'p foydalanuvchili bo'lsa shu joy kengaytiriladi.
const reviewer = "local-admin"

// handlePlacesMeta — turlar va turkumlar (forma bularni serverdan oladi:
// ikki nusxa bo'lmasin).
func (s *Server) handlePlacesMeta(w http.ResponseWriter, r *http.Request) {
	type kind struct {
		Key     string         `json:"key"`
		Label   string         `json:"label"`
		Allowed []places.Field `json:"allowed"`
	}
	kinds := make([]kind, len(places.Kinds))
	for i, k := range places.Kinds {
		kinds[i] = kind{Key: k.Key, Label: k.Label, Allowed: k.Allowed}
	}
	ok(w, map[string]any{
		"kinds":      kinds,
		"categories": places.Categories,
		"max_photos": places.MaxPhotos,
	})
}

func (s *Server) handleSubmissions(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.ListSubmissions(r.Context(), r.URL.Query().Get("status"), 100)
	if err != nil {
		if errors.Is(err, storage.ErrInvalidInput) {
			fail(w, http.StatusBadRequest, "status noto'g'ri (pending | approved | rejected)")
			return
		}
		slog.Error("takliflar ro'yxati xatosi", "err", err)
		fail(w, http.StatusBadGateway, "so'rov bajarilmadi")
		return
	}
	pending, _ := s.db.PendingSubmissionCount(r.Context())
	ok(w, map[string]any{"submissions": rows, "pending": pending})
}

func (s *Server) handleSubmissionPhoto(w http.ResponseWriter, r *http.Request) {
	n, err := strconv.Atoi(r.PathValue("n"))
	if err != nil {
		fail(w, http.StatusNotFound, "topilmadi")
		return
	}
	data, err := s.db.SubmissionPhoto(r.Context(), r.PathValue("id"), n)
	if err != nil {
		fail(w, http.StatusNotFound, "topilmadi")
		return
	}
	w.Header().Set("Content-Type", "image/jpeg")
	_, _ = w.Write(data)
}

func (s *Server) handleApprove(w http.ResponseWriter, r *http.Request) {
	var in struct {
		ID         string       `json:"id"`
		Edit       places.Input `json:"edit"`
		Source     string       `json:"source"`
		KeepPhotos []int        `json:"keep_photos"`
	}
	if !decode(w, r, &in) {
		return
	}
	id, err := s.db.ApproveSubmission(r.Context(), storage.ApprovePlace{
		ID: in.ID, Reviewer: reviewer, Edit: in.Edit, Source: in.Source, KeepPhotos: in.KeepPhotos,
	})
	if err != nil {
		writeModerationErr(w, err)
		return
	}
	ok(w, map[string]string{"place_id": id})
}

func (s *Server) handleReject(w http.ResponseWriter, r *http.Request) {
	var in struct {
		ID   string `json:"id"`
		Note string `json:"note"`
	}
	if !decode(w, r, &in) {
		return
	}
	if err := s.db.RejectSubmission(r.Context(), in.ID, reviewer, in.Note); err != nil {
		writeModerationErr(w, err)
		return
	}
	ok(w, map[string]bool{"ok": true})
}

func (s *Server) handlePlacesList(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.ListPlacesAdmin(r.Context(), 100)
	if err != nil {
		slog.Error("ob'ektlar ro'yxati xatosi", "err", err)
		fail(w, http.StatusBadGateway, "so'rov bajarilmadi")
		return
	}
	ok(w, map[string]any{"places": rows})
}

func (s *Server) handlePlaceDelete(w http.ResponseWriter, r *http.Request) {
	var in struct {
		ID string `json:"id"`
	}
	if !decode(w, r, &in) {
		return
	}
	if err := s.db.DeletePlace(r.Context(), in.ID, reviewer); err != nil {
		writeModerationErr(w, err)
		return
	}
	ok(w, map[string]bool{"ok": true})
}

// writeModerationErr — moderatsiya xatosi. Tekshiruv xabarlari (bizning
// o'z matnimiz) ko'rsatiladi; baza ichki tafsiloti — yo'q.
func writeModerationErr(w http.ResponseWriter, err error) {
	var ve *places.ValidationError
	switch {
	case errors.As(err, &ve):
		fail(w, http.StatusBadRequest, ve.Msg)
	case errors.Is(err, storage.ErrNotFound):
		fail(w, http.StatusNotFound, "topilmadi")
	case errors.Is(err, storage.ErrInvalidInput):
		fail(w, http.StatusBadRequest, "so'rov yaroqsiz")
	default:
		// `ApproveSubmission` ba'zi xatolarni tayyor matn bilan qaytaradi
		// («allaqachon ko'rib chiqilgan», «source noto'g'ri»); ichki baza
		// xatosi esa `errQuery` — u ham umumiy matn.
		fail(w, http.StatusBadRequest, err.Error())
	}
}
