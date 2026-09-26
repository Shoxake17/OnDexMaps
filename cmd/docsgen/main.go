// Command docsgen — `/v2` endpointlarining PARAMETR jadvallarini
// `internal/httpapi/openapi.yaml` dan TypeScript fayliga ko'chiradi.
//
// NEGA KERAK
//
// Hujjat sahifalari qo'lda yoziladi va kontraktdan jimgina ajralib ketadi.
// 2026-09-26 da aynan shunday bo'ldi. `docs_sync_test.go` javob MAYDONLARINI
// qulflaydi; bu generator esa PARAMETRLARNI umuman takrorlanmaydigan qiladi:
// sahifa endi ularni yozmaydi, import qiladi.
//
// Parametrlarda kontrakt sahifadan BOY: u chegaralarni (`minLength`,
// `minimum`, `default`, `pattern`) ham biladi. Qo'lda ko'chirilganda ular
// tushib qolardi — masalan `bbox` ning formati hech qayerda yozilmagan edi.
//
// NEGA TAVSIFLAR KO'CHIRILMAYDI
//
// Javob maydonlarining tushuntirishlari sahifalarda ATAYLAB qoladi: ular
// kontraktdagidan boy ("label — TUR NOMI, manzil emas"). Kontrakt — mashina
// uchun, sahifa — odam uchun. Ularning mosligini test tekshiradi.
//
// ISHLATISH
//
//	go run ./cmd/docsgen           — faylni qayta yozadi
//	go run ./cmd/docsgen -check    — eskirganini aytadi (CI shuni ishlatadi)
//
// YAML kutubxonasi ATAYLAB ishlatilmagan (go.mod: "bog'liqliklar ataylab
// kam") — `openapi_test.go` dagi kabi matn ustida regex. Fayl bizniki va
// formati barqaror; natija commit qilinadi, shuning uchun tahlil buzilsa
// `git diff` da darhol ko'rinadi.
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

const (
	specPath = "internal/httpapi/openapi.yaml"
	outPath  = "console/src/components/docs/generated/params.ts"
)

// endpoints — kontrakt yo'li ↔ sahifa papkasi.
var endpoints = []struct{ path, page string }{
	{"/v2/geocode", "geocode"},
	{"/v2/reverse", "reverse"},
	{"/v2/directions", "directions"},
	{"/v2/places", "places"},
	{"/v2/places/{id}", "places-by-id"},
}

type param struct {
	Name        string
	Required    bool
	Desc        string
	Constraints string
	Example     string
}

func main() {
	check := flag.Bool("check", false, "faylni yozmasdan, eskirganini tekshirish")
	flag.Parse()

	root, err := repoRoot()
	if err != nil {
		fatal(err)
	}

	raw, err := os.ReadFile(filepath.Join(root, specPath))
	if err != nil {
		fatal(err)
	}
	spec := string(raw)

	out := render(spec)
	dst := filepath.Join(root, outPath)

	if *check {
		cur, err := os.ReadFile(dst)
		if err != nil {
			fatal(fmt.Errorf("%s o'qilmadi: %w\n`go run ./cmd/docsgen` ishlating", outPath, err))
		}
		if normalize(string(cur)) != normalize(out) {
			fatal(fmt.Errorf("%s ESKIRGAN — kontrakt o'zgargan.\n`go run ./cmd/docsgen` ishlating va natijani commit qiling", outPath))
		}
		fmt.Println("docsgen: parametrlar kontrakt bilan mos")
		return
	}

	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		fatal(err)
	}
	if err := os.WriteFile(dst, []byte(out), 0o644); err != nil {
		fatal(err)
	}
	fmt.Printf("docsgen: %s yozildi\n", outPath)
}

// repoRoot — `go.mod` turgan papka (buyruq qayerdan chaqirilsa ham ishlashi uchun).
func repoRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("go.mod topilmadi")
		}
		dir = parent
	}
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, "docsgen:", err)
	os.Exit(1)
}

// normalize — qator oxiridagi farqlar taqqoslashga xalaqit bermasin.
func normalize(s string) string {
	return strings.ReplaceAll(strings.TrimSpace(s), "\r\n", "\n")
}

// ── Kontraktni o'qish ──────────────────────────────────────────────────

// block — berilgan sarlavhadan keyingi, undan CHUQURROQ yozilgan qism.
func block(src, header string) string {
	at := strings.Index(src, header)
	if at < 0 {
		return ""
	}
	body := src[at+len(header):]
	indent := len(header) - len(strings.TrimLeft(header, " \n")) - 1

	var out []string
	for _, line := range strings.Split(body, "\n") {
		if strings.TrimSpace(line) == "" {
			out = append(out, line)
			continue
		}
		if len(line)-len(strings.TrimLeft(line, " ")) <= indent {
			break
		}
		out = append(out, line)
	}
	return strings.Join(out, "\n")
}

var (
	reRef      = regexp.MustCompile(`\$ref:\s*"#/components/schemas/([A-Za-z]+)"`)
	reInline   = regexp.MustCompile(`(?m)^\s+(\w+):\s*(.+)$`)
	reSchemaAt = regexp.MustCompile(`(?m)^    ([A-Za-z][A-Za-z0-9]*):$`)
)

// scalarSchema — nomlangan sxemaning chegaralari (UzLatitude kabi).
func scalarSchema(spec, name string) map[string]string {
	at := strings.Index(spec, "\n    "+name+":\n")
	if at < 0 {
		return nil
	}
	body := spec[at+1:]
	if loc := reSchemaAt.FindStringIndex(body[1:]); loc != nil {
		body = body[:loc[0]+1]
	}
	out := map[string]string{}
	for _, m := range reInline.FindAllStringSubmatch(body, -1) {
		out[m[1]] = strings.TrimSpace(m[2])
	}
	return out
}

// constraints — chegaralarni odam o'qiydigan bitta satrga yig'adi.
func constraints(s map[string]string) string {
	var parts []string
	get := func(k string) string { return strings.Trim(s[k], `"'`) }

	switch {
	case s["minLength"] != "" && s["maxLength"] != "":
		parts = append(parts, get("minLength")+"–"+get("maxLength")+" belgi")
	case s["minimum"] != "" && s["maximum"] != "":
		parts = append(parts, get("minimum")+"–"+get("maximum"))
	}
	if d := get("default"); d != "" {
		parts = append(parts, "standart "+d)
	}
	if p := get("pattern"); p != "" {
		parts = append(parts, "shakl: "+p)
	}
	return strings.Join(parts, ", ")
}

// paramsFor — bitta endpointning parametrlari.
func paramsFor(spec, path string) []param {
	pathBlock := block(spec, "\n  "+path+":\n")
	if pathBlock == "" {
		fatal(fmt.Errorf("kontraktda %q yo'li yo'q", path))
	}
	params := block(pathBlock, "\n      parameters:\n")
	if params == "" {
		return nil
	}

	// `block` birinchi qatorni "\n" siz qaytaradi, shuning uchun uni
	// oldiga qo'shamiz — aks holda BIRINCHI parametr bo'linishda tushib
	// qolardi (bitta parametrli endpointlar umuman bo'sh chiqardi).
	var out []param
	for _, chunk := range strings.Split("\n"+params, "\n        - name: ")[1:] {
		lines := strings.Split(chunk, "\n")
		p := param{Name: strings.TrimSpace(lines[0])}

		p.Required = regexp.MustCompile(`(?m)^          required:\s*true`).MatchString(chunk)
		p.Desc = fieldText(chunk, "description")
		p.Example = fieldText(chunk, "example")

		// Sxema: `$ref` bo'lsa nomlangan sxemadan, aks holda joyidagi blok.
		var sc map[string]string
		if m := reRef.FindStringSubmatch(chunk); m != nil {
			sc = scalarSchema(spec, m[1])
		} else if sb := block(chunk, "\n          schema:\n"); sb != "" {
			sc = map[string]string{}
			for _, m := range reInline.FindAllStringSubmatch(sb, -1) {
				sc[m[1]] = strings.TrimSpace(m[2])
			}
		}
		p.Constraints = constraints(sc)

		out = append(out, p)
	}
	return out
}

// fieldText — `description:` yoki `example:` qiymati. Ikkala shakl
// qo'llanadi: bir qatorli va `|` bilan boshlanadigan ko'p qatorli.
func fieldText(chunk, key string) string {
	re := regexp.MustCompile(`(?m)^          ` + key + `:\s*(.*)$`)
	m := re.FindStringSubmatchIndex(chunk)
	if m == nil {
		return ""
	}
	head := strings.TrimSpace(chunk[m[2]:m[3]])
	if head != "|" && head != ">" {
		return strings.Trim(head, `"`)
	}

	var out []string
	for _, line := range strings.Split(chunk[m[1]:], "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		if len(line)-len(strings.TrimLeft(line, " ")) <= 10 {
			break
		}
		out = append(out, strings.TrimSpace(line))
	}
	return strings.Join(out, " ")
}

// ── TypeScript chiqarish ───────────────────────────────────────────────

func render(spec string) string {
	var b strings.Builder

	b.WriteString(`// ⚠️ GENERATSIYA QILINGAN FAYL — QO'LDA TAHRIRLAMANG.
//
// Manba:     internal/httpapi/openapi.yaml
// Yangilash: go run ./cmd/docsgen
// Tekshirish: go run ./cmd/docsgen -check   (CI shuni ishlatadi)
//
// Endpoint sahifalari parametrlarni SHU YERDAN oladi — shuning uchun ular
// kontraktdan ajralib keta olmaydi.

export interface SpecParam {
  name: string;
  required: boolean;
  /** Kontraktdagi tavsif. */
  desc: string;
  /** Chegaralar: "2–100 belgi", "1–25, standart 10". Bo'sh bo'lishi mumkin. */
  constraints: string;
  /** Kontraktdagi misol qiymat. Bo'sh bo'lishi mumkin. */
  example: string;
}

export const SPEC_PARAMS: Record<string, SpecParam[]> = {
`)

	pages := make([]string, 0, len(endpoints))
	byPage := map[string][]param{}
	for _, e := range endpoints {
		pages = append(pages, e.page)
		byPage[e.page] = paramsFor(spec, e.path)
	}
	sort.Strings(pages)

	for _, page := range pages {
		fmt.Fprintf(&b, "  %q: [\n", page)
		for _, p := range byPage[page] {
			// `%q` Go satri sifatida ekranlaydi; TypeScript uchun ham
			// mos (`\d` kabi ketma-ketliklar to'g'ri chiqadi). Qo'shimcha
			// ekranlash QILINMAYDI — aks holda `\\\\d` bo'lib ketardi.
			fmt.Fprintf(&b,
				"    { name: %q, required: %t, desc: %q, constraints: %q, example: %q },\n",
				p.Name, p.Required, p.Desc, p.Constraints, p.Example)
		}
		b.WriteString("  ],\n")
	}

	b.WriteString("};\n")
	return b.String()
}
