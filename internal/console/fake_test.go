package console

import (
	"context"
	"strconv"
	"sync"
	"time"
)

// memStore — Store'ning xotiradagi nusxasi (testlar uchun).
type memStore struct {
	mu       sync.Mutex
	seq      int
	accounts map[string]*Account
	otps     map[string][]*OTP
	otpEmail map[int64]string
	sessions map[string]*Session
	keys     map[string]*Key
	keyOwner map[string]string
	keyHash  map[string][]byte
	usage    []UsageDay
	invoices map[string][]Invoice
	subReqs  map[string]int
	audits   []string
	nextOTP  int64
}

func newMemStore() *memStore {
	return &memStore{accounts: map[string]*Account{}, otps: map[string][]*OTP{}, otpEmail: map[int64]string{},
		sessions: map[string]*Session{}, keys: map[string]*Key{}, keyOwner: map[string]string{},
		keyHash: map[string][]byte{}, invoices: map[string][]Invoice{}, subReqs: map[string]int{}}
}

func (m *memStore) id(prefix string) string { m.seq++; return prefix + strconv.Itoa(m.seq) }

func (m *memStore) AccountByEmail(_ context.Context, email string) (*Account, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, a := range m.accounts {
		if a.Email == email {
			c := *a
			return &c, nil
		}
	}
	return nil, ErrNotFound
}

func (m *memStore) CreateAccount(ctx context.Context, email string) (*Account, error) {
	if a, err := m.AccountByEmail(ctx, email); err == nil {
		return a, nil
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	a := &Account{ID: m.id("acc"), Email: email, CreatedAt: time.Now()}
	m.accounts[a.ID] = a
	c := *a
	return &c, nil
}

func (m *memStore) AccountByID(_ context.Context, id string) (*Account, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if a, ok := m.accounts[id]; ok {
		c := *a
		return &c, nil
	}
	return nil, ErrNotFound
}

func (m *memStore) UpdateName(_ context.Context, id, name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.accounts[id].Name = name
	return nil
}
func (m *memStore) TouchLogin(context.Context, string, time.Time) error { return nil }

func (m *memStore) CreateOTP(_ context.Context, email string, hash []byte, exp time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.nextOTP++
	o := &OTP{ID: m.nextOTP, CodeHash: hash, ExpiresAt: exp, CreatedAt: time.Now()}
	m.otps[email] = append(m.otps[email], o)
	m.otpEmail[o.ID] = email
	return nil
}

func (m *memStore) LatestOTP(_ context.Context, email string) (*OTP, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	l := m.otps[email]
	if len(l) == 0 {
		return nil, ErrNotFound
	}
	c := *l[len(l)-1]
	return &c, nil
}

func (m *memStore) CountOTPsSince(_ context.Context, email string, since time.Time) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	n := 0
	for _, o := range m.otps[email] {
		if !o.CreatedAt.Before(since) {
			n++
		}
	}
	return n, nil
}

func (m *memStore) find(id int64) *OTP {
	for _, o := range m.otps[m.otpEmail[id]] {
		if o.ID == id {
			return o
		}
	}
	return nil
}

func (m *memStore) BumpOTPAttempts(_ context.Context, id int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.find(id).Attempts++
	return nil
}

func (m *memStore) ConsumeOTP(_ context.Context, id int64, _ time.Time) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	o := m.find(id)
	if o.Consumed {
		return false, nil
	}
	o.Consumed = true
	return true, nil
}

func (m *memStore) CreateSession(_ context.Context, h []byte, acc, csrf string, exp time.Time, _, _ string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sessions[string(h)] = &Session{AccountID: acc, CSRF: csrf, CreatedAt: time.Now(), ExpiresAt: exp, LastSeen: time.Now()}
	return nil
}

func (m *memStore) SessionByHash(_ context.Context, h []byte) (*Session, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if s, ok := m.sessions[string(h)]; ok {
		c := *s
		return &c, nil
	}
	return nil, ErrNotFound
}

func (m *memStore) TouchSession(_ context.Context, h []byte, at time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if s, ok := m.sessions[string(h)]; ok {
		s.LastSeen = at
	}
	return nil
}

func (m *memStore) DeleteSession(_ context.Context, h []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.sessions, string(h))
	return nil
}

func (m *memStore) CountActiveKeys(_ context.Context, acc string) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	n := 0
	for id, k := range m.keys {
		if m.keyOwner[id] == acc && k.Status == "active" {
			n++
		}
	}
	return n, nil
}

func (m *memStore) ListKeys(_ context.Context, acc string) ([]Key, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []Key{}
	for id, k := range m.keys {
		if m.keyOwner[id] == acc {
			out = append(out, *k)
		}
	}
	return out, nil
}

func (m *memStore) KeyByID(_ context.Context, acc, id string) (*Key, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if k, ok := m.keys[id]; ok && m.keyOwner[id] == acc {
		c := *k
		return &c, nil
	}
	return nil, ErrNotFound
}

func (m *memStore) insertKey(k NewKey) *Key {
	nk := &Key{ID: m.id("key"), Name: k.Name, Kind: k.Kind, Prefix: k.Prefix, APIs: k.APIs, Origins: k.Origins,
		IPs: k.IPs, Status: "active", ExpiresAt: k.ExpiresAt, CreatedAt: time.Now()}
	m.keys[nk.ID], m.keyOwner[nk.ID], m.keyHash[nk.ID] = nk, k.AccountID, k.Hash
	c := *nk
	return &c
}

func (m *memStore) CreateKey(_ context.Context, k NewKey) (*Key, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.insertKey(k), nil
}

func (m *memStore) UpdateKey(_ context.Context, acc, id string, e KeyEdit) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	k, ok := m.keys[id]
	if !ok || m.keyOwner[id] != acc || k.Status != "active" {
		return ErrNotFound
	}
	k.Name, k.APIs, k.Origins, k.IPs = e.Name, e.APIs, e.Origins, e.IPs
	return nil
}

func (m *memStore) RevokeKey(_ context.Context, acc, id string, _ time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	k, ok := m.keys[id]
	if !ok || m.keyOwner[id] != acc || k.Status != "active" {
		return ErrNotFound
	}
	k.Status = "revoked"
	return nil
}

func (m *memStore) RotateKey(_ context.Context, acc, oldID string, k NewKey, oldExp time.Time) (*Key, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	old, ok := m.keys[oldID]
	if !ok || m.keyOwner[oldID] != acc || old.Status != "active" {
		return nil, ErrNotFound
	}
	old.ExpiresAt = &oldExp
	return m.insertKey(k), nil
}

func (m *memStore) UsageDaily(_ context.Context, acc string, from, to time.Time) ([]UsageDay, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []UsageDay{}
	for _, u := range m.usage {
		if m.keyOwner[u.KeyID] == acc && !u.Day.Before(from) && !u.Day.After(to) {
			out = append(out, u)
		}
	}
	return out, nil
}

func (m *memStore) Invoices(_ context.Context, acc string) ([]Invoice, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.invoices[acc], nil
}

func (m *memStore) HasOpenSubscriptionRequest(_ context.Context, acc string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.subReqs[acc] > 0, nil
}

func (m *memStore) CreateSubscriptionRequest(_ context.Context, acc, _ string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.subReqs[acc]++
	return nil
}

func (m *memStore) Audit(_ context.Context, actor, action, _, _ string, _ map[string]any) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.audits = append(m.audits, actor+":"+action)
	return nil
}

func (m *memStore) PurgeExpired(context.Context, time.Time) error { return nil }

// captureMailer — yuborilgan oxirgi kodni ushlaydi.
type captureMailer struct {
	mu    sync.Mutex
	codes map[string]string
	sent  int
}

func (c *captureMailer) SendLoginCode(_ context.Context, to, code string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.codes == nil {
		c.codes = map[string]string{}
	}
	c.codes[to] = code
	c.sent++
	return nil
}
