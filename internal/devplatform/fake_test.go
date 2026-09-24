package devplatform

import (
	"context"
	"net/netip"
	"sync"
	"time"
)

// fakeStore — testlar uchun xotiradagi Store.
type fakeStore struct {
	mu       sync.Mutex
	keys     map[string]*KeyRecord // hex(hash) o'rniga: string(hash)
	usage    map[string]int64      // accountID -> oy yig'indisi
	written  []UsageRow
	lookups  int
	usageErr error
	lookErr  error
	writeErr error
}

func newFakeStore() *fakeStore {
	return &fakeStore{keys: map[string]*KeyRecord{}, usage: map[string]int64{}}
}

func (f *fakeStore) add(pepper []byte, secret string, rec KeyRecord) {
	f.mu.Lock()
	defer f.mu.Unlock()
	r := rec
	f.keys[string(HashKey(pepper, secret))] = &r
}

func (f *fakeStore) LookupKey(_ context.Context, hash []byte) (*KeyRecord, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.lookups++
	if f.lookErr != nil {
		return nil, f.lookErr
	}
	r, ok := f.keys[string(hash)]
	if !ok {
		return nil, ErrNotFound
	}
	c := *r
	return &c, nil
}

func (f *fakeStore) MonthUsage(_ context.Context, accountID string, _ time.Time) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.usageErr != nil {
		return 0, f.usageErr
	}
	return f.usage[accountID], nil
}

func (f *fakeStore) WriteUsage(_ context.Context, rows []UsageRow) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.writeErr != nil {
		return f.writeErr
	}
	f.written = append(f.written, rows...)
	return nil
}

func (f *fakeStore) TouchKeys(context.Context, []string, time.Time) error { return nil }

func (f *fakeStore) lookupCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.lookups
}

// testPepper — 32+ bayt.
var testPepper = []byte("test-pepper-0123456789abcdef0123456789")

func mustKey(kind string) string {
	s, _, err := GenerateKey(kind)
	if err != nil {
		panic(err)
	}
	return s
}

func ip(s string) netip.Addr { return netip.MustParseAddr(s) }
