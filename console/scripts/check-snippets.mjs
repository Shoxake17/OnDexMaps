// Hujjatlardagi HAR BIR kod namunasini sintaksis jihatdan tekshiradi.
//
// ┌─ NEGA BU KERAK ───────────────────────────────────────────────────┐
// Hujjat sahifalaridagi kod oddiy satr — TypeScript uni ko'rmaydi va
// ESLint ham tekshirmaydi. Shuning uchun u jimgina buzilishi mumkin.
// Haqiqiy misol (2026-09-27): xato kodlari sahifasida `ko'rsat(...)`
// yozilgan edi — o'zbekcha apostrof tufayli bu YAROQSIZ JavaScript va
// ko'chirib qo'ygan dasturchi `SyntaxError` olardi.
//
// Bu skript kodni TypeScript parseri bilan o'qiydi va sintaksis
// xatosini topsa CI'ni to'xtatadi.
// └───────────────────────────────────────────────────────────────────┘
//
// Ishlatish:  node scripts/check-snippets.mjs
import { readdir, readFile } from "node:fs/promises";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ILDIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "app", "docs");

/** JS bo'lmagan namunalar — sintaksis tekshiruvi ma'nosiz. */
const OTKAZ = new Set([
  "terminal", "bash", "sh", "json", "yaml", "text", "http", "env", "html", "csp",
]);

async function sahifalar(dir) {
  const chiq = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) chiq.push(...(await sahifalar(p)));
    else if (e.name === "page.tsx") chiq.push(p);
  }
  return chiq;
}

/** Shablon satrining yopuvchi backtick'ini topadi (`${…}` ni hisoblab). */
function yopuvchi(matn, boshlanish) {
  let chuqur = 0;
  for (let i = boshlanish; i < matn.length; i++) {
    if (matn[i] === "\\") { i++; continue; }
    if (matn[i] === "$" && matn[i + 1] === "{") { chuqur++; i++; continue; }
    if (matn[i] === "}" && chuqur > 0) { chuqur--; continue; }
    if (matn[i] === "`" && chuqur === 0) return i;
  }
  return matn.length;
}

/** `<Tabs files={[{name, lang, code}]}/>` va `<Code lang>{`…`}</Code>`. */
function bloklar(matn) {
  const chiq = [];
  for (const [re, nomOl] of [
    [/name:\s*"([^"]+)"(?:,\s*lang:\s*"([^"]+)")?,\s*\n?\s*code:\s*`/g, (m) => [m[1], m[2] ?? ""]],
    [/<Code\s+lang="([^"]+)"\s*>\{`/g, (m) => ["<Code>", m[1]]],
  ]) {
    let m;
    while ((m = re.exec(matn))) {
      const oxir = yopuvchi(matn, re.lastIndex);
      const [nom, lang] = nomOl(m);
      chiq.push({ nom, lang, kod: matn.slice(re.lastIndex, oxir) });
      re.lastIndex = oxir + 1;
    }
  }
  return chiq;
}

/** `.tsx` shablon satri ichidagi ekranlashni ochadi. */
const ekranOch = (s) => s
  .replace(/\\`/g, "`")
  .replace(/\\\$\{/g, "${")
  .replace(/\\\\/g, "\\");

/** Fayl nomidan tilni chamalaydi. */
function tilni(nom, lang) {
  if (lang) return lang.toLowerCase();
  const n = nom.toLowerCase();
  for (const [ken, t] of [[".tsx", "tsx"], [".ts", "ts"], [".jsx", "jsx"],
    [".vue", "vue"], [".js", "js"], [".html", "html"]]) {
    if (n.endsWith(ken)) return t;
  }
  return "";
}

const xatolar = [];
let tekshirilgan = 0;

for (const f of await sahifalar(ILDIZ)) {
  const matn = await readFile(f, "utf8");
  for (const b of bloklar(matn)) {
    const lang = tilni(b.nom, b.lang);
    if (lang === "" || OTKAZ.has(lang)) continue;

    let kod = ekranOch(b.kod);

    // To'liq HTML hujjati — sintaksis tekshiruvidan tashqarida.
    if (/^\s*(<!DOCTYPE|<html|<head|<body)/i.test(kod)) continue;

    // `<script>` yoki Vue `<script setup>` ichidagi kodni olamiz.
    const sc = kod.match(/<script(?:\s+setup)?>([\s\S]*?)<\/script>/);
    if (sc) kod = sc[1];
    else if (/<template>/.test(kod)) continue;

    // Uch nuqta TO'LDIRUVCHI o'rnida bo'lsa (`source: "…"`,
    // `paint: { … }`) — bu ataylab to'liq bo'lmagan namuna.
    if (/:\s*"…"|\{\s*…\s*\}|\(\s*…\s*\)/.test(kod)) continue;

    const jsx = lang === "jsx" || lang === "tsx";
    const tipli = lang === "ts" || lang === "tsx";
    const sf = ts.createSourceFile(
      "namuna." + (tipli ? (jsx ? "tsx" : "ts") : (jsx ? "jsx" : "js")),
      kod, ts.ScriptTarget.ESNext, true,
      jsx ? ts.ScriptKind.TSX : tipli ? ts.ScriptKind.TS : ts.ScriptKind.JS,
    );
    tekshirilgan++;

    for (const d of sf.parseDiagnostics ?? []) {
      const { line } = sf.getLineAndCharacterOfPosition(d.start);
      xatolar.push(`${relative(process.cwd(), f)}  [${b.nom}]  ${line + 1}-qator: ` +
        ts.flattenDiagnosticMessageText(d.messageText, " "));
    }
  }
}

if (xatolar.length) {
  console.error("Hujjatdagi kod namunalarida sintaksis xatosi bor:\n");
  for (const x of xatolar) console.error("  " + x);
  console.error(`\n${xatolar.length} ta xato (${tekshirilgan} blok tekshirildi).`);
  process.exit(1);
}

console.log(`check-snippets: ${tekshirilgan} ta kod namunasi tekshirildi — sintaksis toza`);
