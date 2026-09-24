package console

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"
)

// Mailer — bir martalik kodni email orqali yuboradi.
type Mailer interface {
	SendLoginCode(ctx context.Context, to, code string) error
}

// ResendMailer — Resend HTTP API (Gmail SMTP spamga tushardi: memory/email-resend-smtp).
type ResendMailer struct {
	apiKey, from string
	client       *http.Client
	url          string
}

// NewResendMailer — `from` masalan `OnDex <no-reply@ondex.uz>`.
func NewResendMailer(apiKey, from string) *ResendMailer {
	return &ResendMailer{apiKey: apiKey, from: from, url: "https://api.resend.com/emails",
		client: &http.Client{Timeout: 8 * time.Second}}
}

func (m *ResendMailer) SendLoginCode(ctx context.Context, to, code string) error {
	body, err := json.Marshal(map[string]any{
		"from":    m.from,
		"to":      []string{to},
		"subject": "OnDex Console kirish kodi: " + code,
		"text": fmt.Sprintf("OnDex Console kirish kodingiz: %s\n\nKod 10 daqiqa amal qiladi. "+
			"Agar siz so'ramagan bo'lsangiz, bu xatni e'tiborsiz qoldiring va HECH KIMGA kodni aytmang.", code),
	})
	if err != nil {
		return err
	}
	//nolint:gosec // G704: SSRF emas — `m.url` konstruktorda sobit (api.resend.com); so'rovdan kelmaydi.
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, m.url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+m.apiKey)
	req.Header.Set("Content-Type", "application/json")
	//nolint:gosec // G704: yuqoridagi izohga qarang — `req` sobit manzildan qurilgan.
	resp, err := m.client.Do(req)
	if err != nil {
		return errors.New("email yuborilmadi (tarmoq)") // xom xato URL/sarlavha sizdirmasin
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode/100 != 2 {
		return fmt.Errorf("email yuborilmadi (resend status %d)", resp.StatusCode)
	}
	return nil
}

// LogMailer — FAQAT dev: kodni logga yozadi. Production'da config RESEND_API_KEY ni majburiy qiladi.
type LogMailer struct{}

func (LogMailer) SendLoginCode(_ context.Context, to, code string) error {
	slog.Warn("DEV: kirish kodi (email yuborilmadi)", "to", to, "code", code)
	return nil
}
