// Package osmpbf — OpenStreetMap `.osm.pbf` faylini oqim bilan o'qiydi.
//
// ┌─ NEGA O'ZIMIZ YOZDIK ──────────────────────────────────────────────
// Tayyor kutubxonalar (`paulmach/osm`, `qedus/osmpbf`) protobuf va yana
// bir necha bog'liqlik olib keladi. Bu loyihada bog'liqlik ATAYLAB kam
// (`go.mod` ga qarang: faqat `pgx`) — har biri supply-chain hujum yuzasi.
// PBF formati esa kichik: 4 ta xabar turi, biz faqat kerakli maydonlarni
// o'qiymiz. Faqat standart kutubxona (`compress/zlib`, `encoding/binary`).
// └──────────────────────────────────────────────────────────────────
//
// Format (https://wiki.openstreetmap.org/wiki/PBF_Format):
//
//	[4 bayt: BlobHeader uzunligi] [BlobHeader] [Blob]  ... takrorlanadi
//
// Blob ichida (zlib bilan siqilgan) PrimitiveBlock: satrlar jadvali
// (`stringtable`) va elementlar guruhlari (tugun, zich tugun, yo'l, relyatsiya).
//
// XAVFSIZLIK: fayl tashqaridan kelishi mumkin, shuning uchun har bir
// o'lcham chegaralanadi — buzuq yoki zararli fayl xotirani to'ldira olmaydi.
package osmpbf

import (
	"bytes"
	"compress/zlib"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
)

// Chegaralar (PBF spetsifikatsiyasi ruxsat etganidan oshmaydi).
const (
	maxHeaderSize = 64 << 10 // BlobHeader
	maxBlobSize   = 32 << 20 // siqilgan Blob
	maxRawSize    = 64 << 20 // ochilgan ma'lumot (spetsifikatsiya: 32 MB)
)

// Tags — elementning teglari. Tegsiz element uchun `nil`.
type Tags map[string]string

// MemberType — relyatsiya a'zosining turi.
type MemberType int

const (
	NodeMember MemberType = iota
	WayMember
	RelationMember
)

// Member — relyatsiya a'zosi.
type Member struct {
	Type MemberType
	Ref  int64
	Role string
}

// Handler — o'qilgan elementlar uchun qayta chaqiruvlar.
//
// Qaysi turlar kerakligi `Want` da aytiladi: keraksiz turdagi guruhlar
// umuman dekodlanmaydi (tugunlar fayl hajmining ko'p qismi — birinchi
// o'tishda ularni o'tkazib yuborish vaqtni sezilarli qisqartiradi).
type Handler struct {
	Want struct{ Nodes, Ways, Relations bool }

	// Node — `tags` `nil` bo'lsa tugun tegsiz (faqat koordinata).
	Node func(id int64, lat, lon float64, tags Tags)
	// Way — `refs` yo'lning tugun identifikatorlari (tartib bilan).
	Way func(id int64, refs []int64, tags Tags)
	// Relation — a'zolar ro'yxati bilan.
	Relation func(id int64, members []Member, tags Tags)
}

// Scan — butun faylni o'qiydi va Handler'ni chaqiradi.
func Scan(r io.Reader, h Handler) error {
	var lenBuf [4]byte
	for {
		if _, err := io.ReadFull(r, lenBuf[:]); err != nil {
			if errors.Is(err, io.EOF) {
				return nil // toza tugash
			}
			return fmt.Errorf("blob sarlavhasi uzunligi: %w", err)
		}
		hsz := binary.BigEndian.Uint32(lenBuf[:])
		if hsz == 0 || hsz > maxHeaderSize {
			return fmt.Errorf("BlobHeader o'lchami yaroqsiz: %d", hsz)
		}
		hdr := make([]byte, hsz)
		if _, err := io.ReadFull(r, hdr); err != nil {
			return fmt.Errorf("BlobHeader: %w", err)
		}
		typ, datasize, err := parseBlobHeader(hdr)
		if err != nil {
			return err
		}
		if datasize < 0 || datasize > maxBlobSize {
			return fmt.Errorf("Blob o'lchami yaroqsiz: %d", datasize)
		}
		blob := make([]byte, datasize)
		if _, err := io.ReadFull(r, blob); err != nil {
			return fmt.Errorf("Blob: %w", err)
		}
		if typ != "OSMData" {
			continue // OSMHeader va boshqalar — kerak emas
		}
		raw, err := inflateBlob(blob)
		if err != nil {
			return err
		}
		if err := parsePrimitiveBlock(raw, &h); err != nil {
			return err
		}
	}
}

func parseBlobHeader(b []byte) (typ string, datasize int, err error) {
	p := pb{b: b}
	for p.more() {
		f, wt := p.tag()
		switch {
		case f == 1 && wt == wireBytes:
			typ = string(p.bytes())
		case f == 3 && wt == wireVarint:
			datasize = int(p.varint())
		default:
			p.skip(wt)
		}
	}
	return typ, datasize, p.err
}

func inflateBlob(b []byte) ([]byte, error) {
	p := pb{b: b}
	var raw, z []byte
	for p.more() {
		f, wt := p.tag()
		switch {
		case f == 1 && wt == wireBytes:
			raw = p.bytes()
		case f == 3 && wt == wireBytes:
			z = p.bytes()
		default:
			p.skip(wt)
		}
	}
	if p.err != nil {
		return nil, p.err
	}
	if raw != nil {
		if len(raw) > maxRawSize {
			return nil, errors.New("ochilgan blob juda katta")
		}
		return raw, nil
	}
	if z == nil {
		return nil, errors.New("blob: siqilmagan ham, zlib ham yo'q (qo'llab-quvvatlanmaydigan siqish)")
	}
	zr, err := zlib.NewReader(bytes.NewReader(z))
	if err != nil {
		return nil, fmt.Errorf("zlib: %w", err)
	}
	defer func() { _ = zr.Close() }()
	// `LimitReader` +1: chegaradan oshganini aniqlash uchun.
	out, err := io.ReadAll(io.LimitReader(zr, maxRawSize+1))
	if err != nil {
		return nil, fmt.Errorf("zlib ochish: %w", err)
	}
	if len(out) > maxRawSize {
		return nil, errors.New("ochilgan blob juda katta")
	}
	return out, nil
}

// ── PrimitiveBlock ──────────────────────────────────────────────────

type block struct {
	strs      []string
	gran      int64
	latOff    int64
	lonOff    int64
	groupsRaw [][]byte
}

func parsePrimitiveBlock(b []byte, h *Handler) error {
	blk := block{gran: 100}
	p := pb{b: b}
	for p.more() {
		f, wt := p.tag()
		switch {
		case f == 1 && wt == wireBytes: // stringtable
			blk.strs = parseStringTable(p.bytes())
		case f == 2 && wt == wireBytes: // primitivegroup
			blk.groupsRaw = append(blk.groupsRaw, p.bytes())
		case f == 17 && wt == wireVarint:
			blk.gran = int64(p.varint())
		case f == 19 && wt == wireVarint:
			blk.latOff = int64(p.varint())
		case f == 20 && wt == wireVarint:
			blk.lonOff = int64(p.varint())
		default:
			p.skip(wt)
		}
	}
	if p.err != nil {
		return p.err
	}
	for _, g := range blk.groupsRaw {
		if err := parseGroup(g, &blk, h); err != nil {
			return err
		}
	}
	return nil
}

func parseStringTable(b []byte) []string {
	p := pb{b: b}
	var out []string
	for p.more() {
		f, wt := p.tag()
		if f == 1 && wt == wireBytes {
			out = append(out, string(p.bytes()))
		} else {
			p.skip(wt)
		}
	}
	return out
}

func (k *block) lat(raw int64) float64 { return 1e-9 * float64(k.latOff+k.gran*raw) }
func (k *block) lon(raw int64) float64 { return 1e-9 * float64(k.lonOff+k.gran*raw) }

func (k *block) str(i uint64) string {
	if i < uint64(len(k.strs)) {
		return k.strs[i]
	}
	return ""
}

// tagsOf — `keys`/`vals` (satr jadvali indekslari) dan Tags quradi.
func (k *block) tagsOf(keys, vals []uint64) Tags {
	if len(keys) == 0 || len(keys) != len(vals) {
		return nil
	}
	t := make(Tags, len(keys))
	for i := range keys {
		t[k.str(keys[i])] = k.str(vals[i])
	}
	return t
}

func parseGroup(b []byte, k *block, h *Handler) error {
	p := pb{b: b}
	for p.more() {
		f, wt := p.tag()
		switch {
		case f == 1 && wt == wireBytes && h.Want.Nodes && h.Node != nil:
			parseNode(p.bytes(), k, h)
		case f == 2 && wt == wireBytes && h.Want.Nodes && h.Node != nil:
			parseDense(p.bytes(), k, h)
		case f == 3 && wt == wireBytes && h.Want.Ways && h.Way != nil:
			parseWay(p.bytes(), k, h)
		case f == 4 && wt == wireBytes && h.Want.Relations && h.Relation != nil:
			parseRelation(p.bytes(), k, h)
		default:
			p.skip(wt)
		}
	}
	return p.err
}

func parseNode(b []byte, k *block, h *Handler) {
	p := pb{b: b}
	var id, lat, lon int64
	var keys, vals []uint64
	for p.more() {
		f, wt := p.tag()
		switch {
		case f == 1 && wt == wireVarint:
			id = unzigzag(p.varint())
		case f == 2 && wt == wireBytes:
			keys = packedUvarints(p.bytes())
		case f == 3 && wt == wireBytes:
			vals = packedUvarints(p.bytes())
		case f == 8 && wt == wireVarint:
			lat = unzigzag(p.varint())
		case f == 9 && wt == wireVarint:
			lon = unzigzag(p.varint())
		default:
			p.skip(wt)
		}
	}
	if p.err == nil {
		h.Node(id, k.lat(lat), k.lon(lon), k.tagsOf(keys, vals))
	}
}

func parseDense(b []byte, k *block, h *Handler) {
	p := pb{b: b}
	var ids, lats, lons []int64
	var kv []uint64
	for p.more() {
		f, wt := p.tag()
		switch {
		case f == 1 && wt == wireBytes:
			ids = packedSvarints(p.bytes())
		case f == 8 && wt == wireBytes:
			lats = packedSvarints(p.bytes())
		case f == 9 && wt == wireBytes:
			lons = packedSvarints(p.bytes())
		case f == 10 && wt == wireBytes:
			kv = packedUvarints(p.bytes())
		default:
			p.skip(wt) // denseinfo (5) va boshqalar
		}
	}
	if p.err != nil || len(ids) != len(lats) || len(ids) != len(lons) {
		return
	}
	var id, lat, lon int64 // delta-kodlangan — yig'iladi
	pos := 0               // keys_vals ichidagi o'rin
	for i := range ids {
		id += ids[i]
		lat += lats[i]
		lon += lons[i]

		var tags Tags
		// keys_vals: `k,v,k,v,...,0` — har tugun uchun 0 bilan tugaydi.
		// Teglar butunlay yo'q bo'lsa massiv bo'sh (nol ham yozilmaydi).
		if len(kv) > 0 {
			for pos+1 < len(kv) && kv[pos] != 0 {
				if tags == nil {
					tags = Tags{}
				}
				tags[k.str(kv[pos])] = k.str(kv[pos+1])
				pos += 2
			}
			pos++ // ajratuvchi 0
		}
		h.Node(id, k.lat(lat), k.lon(lon), tags)
	}
}

func parseWay(b []byte, k *block, h *Handler) {
	p := pb{b: b}
	var id int64
	var keys, vals []uint64
	var refs []int64
	for p.more() {
		f, wt := p.tag()
		switch {
		case f == 1 && wt == wireVarint:
			id = int64(p.varint())
		case f == 2 && wt == wireBytes:
			keys = packedUvarints(p.bytes())
		case f == 3 && wt == wireBytes:
			vals = packedUvarints(p.bytes())
		case f == 8 && wt == wireBytes:
			refs = packedSvarints(p.bytes())
		default:
			p.skip(wt)
		}
	}
	if p.err != nil {
		return
	}
	// `refs` delta-kodlangan.
	var acc int64
	for i := range refs {
		acc += refs[i]
		refs[i] = acc
	}
	h.Way(id, refs, k.tagsOf(keys, vals))
}

func parseRelation(b []byte, k *block, h *Handler) {
	p := pb{b: b}
	var id int64
	var keys, vals, roles []uint64
	var memids []int64
	var types []uint64
	for p.more() {
		f, wt := p.tag()
		switch {
		case f == 1 && wt == wireVarint:
			id = int64(p.varint())
		case f == 2 && wt == wireBytes:
			keys = packedUvarints(p.bytes())
		case f == 3 && wt == wireBytes:
			vals = packedUvarints(p.bytes())
		case f == 8 && wt == wireBytes:
			roles = packedUvarints(p.bytes())
		case f == 9 && wt == wireBytes:
			memids = packedSvarints(p.bytes())
		case f == 10 && wt == wireBytes:
			types = packedUvarints(p.bytes())
		default:
			p.skip(wt)
		}
	}
	if p.err != nil || len(roles) != len(memids) || len(types) != len(memids) {
		return
	}
	members := make([]Member, len(memids))
	var acc int64
	for i := range memids {
		acc += memids[i]
		members[i] = Member{Type: MemberType(types[i]), Ref: acc, Role: k.str(roles[i])}
	}
	h.Relation(id, members, k.tagsOf(keys, vals))
}

// ── Protobuf simvollari ─────────────────────────────────────────────

const (
	wireVarint = 0
	wireFix64  = 1
	wireBytes  = 2
	wireFix32  = 5
)

var errTruncated = errors.New("protobuf: xabar to'liq emas")

// pb — protobuf xabarini o'qish. Xato "yopishqoq": birinchi xatodan keyin
// hamma o'qish nol qaytaradi va `err` saqlanadi.
type pb struct {
	b   []byte
	pos int
	err error
}

func (p *pb) more() bool { return p.err == nil && p.pos < len(p.b) }

func (p *pb) varint() uint64 {
	v, n := binary.Uvarint(p.b[p.pos:])
	if n <= 0 {
		p.err = errTruncated
		return 0
	}
	p.pos += n
	return v
}

func (p *pb) tag() (field int, wire int) {
	t := p.varint()
	return int(t >> 3), int(t & 7)
}

func (p *pb) bytes() []byte {
	n := p.varint()
	if p.err != nil {
		return nil
	}
	if n > uint64(len(p.b)-p.pos) {
		p.err = errTruncated
		return nil
	}
	out := p.b[p.pos : p.pos+int(n)]
	p.pos += int(n)
	return out
}

func (p *pb) skip(wire int) {
	switch wire {
	case wireVarint:
		p.varint()
	case wireFix64:
		p.advance(8)
	case wireBytes:
		p.bytes()
	case wireFix32:
		p.advance(4)
	default:
		p.err = fmt.Errorf("protobuf: noma'lum wire turi %d", wire)
	}
}

func (p *pb) advance(n int) {
	if n > len(p.b)-p.pos {
		p.err = errTruncated
		return
	}
	p.pos += n
}

func unzigzag(v uint64) int64 { return int64(v>>1) ^ -int64(v&1) }

func packedUvarints(b []byte) []uint64 {
	var out []uint64
	for len(b) > 0 {
		v, n := binary.Uvarint(b)
		if n <= 0 {
			return out
		}
		out = append(out, v)
		b = b[n:]
	}
	return out
}

func packedSvarints(b []byte) []int64 {
	var out []int64
	for len(b) > 0 {
		v, n := binary.Uvarint(b)
		if n <= 0 {
			return out
		}
		out = append(out, unzigzag(v))
		b = b[n:]
	}
	return out
}
