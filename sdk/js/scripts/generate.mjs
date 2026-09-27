// Kontraktdan (`openapi.yaml`) TypeScript tiplarini chiqaradi.
//
// ┌─ NEGA GENERATSIYA, QO'LDA EMAS ────────────────────────────────────┐
// SDK — kontrakt va hujjatdan keyingi UCHINCHI sirt. Qo'lda yozilgan
// tiplar jimgina eskirardi: 2026-09-27 da TypeScript hujjat sahifasida
// uchta endpoint uchun tip umuman yo'qligi shunday aniqlangan edi.
//
// `--check` rejimi CI uchun: fayl eskirgan bo'lsa nolga teng bo'lmagan
// kod bilan chiqadi va build to'xtaydi.
// └────────────────────────────────────────────────────────────────────┘
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const spec = resolve(root, "../../internal/httpapi/openapi.yaml");
const out = join(root, "src/generated/openapi.d.ts");
const check = process.argv.includes("--check");

if (!existsSync(spec)) {
  console.error(`kontrakt topilmadi: ${spec}`);
  process.exit(1);
}

// ⚠️ `npx` ORQALI CHAQIRILMAYDI: Windows'da u `npx.cmd` bo'lib,
// `spawnSync` uni `EINVAL` bilan rad etadi (Node 20 dagi xavfsizlik
// o'zgarishi). CLI'ning o'zini `node` bilan chaqirish platformalararo
// ishlaydi va qobiqni umuman chetlab o'tadi.
const cli = resolve(root, "node_modules/openapi-typescript/bin/cli.js");
if (!existsSync(cli)) {
  console.error("openapi-typescript o'rnatilmagan — `npm install` ishlating");
  process.exit(1);
}

// Vosita stdout'ga yozadi — natijani o'zimiz solishtiramiz.
const yangi = execFileSync(process.execPath, [cli, spec], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
});

const eski = existsSync(out) ? await readFile(out, "utf8") : "";

if (check) {
  if (eski.replace(/\r\n/g, "\n") !== yangi.replace(/\r\n/g, "\n")) {
    console.error(
      "SDK tiplari ESKIRGAN — kontrakt o'zgargan.\n" +
        "`npm run generate` ishlating va natijani commit qiling.",
    );
    process.exit(1);
  }
  console.log("SDK tiplari kontrakt bilan mos");
  process.exit(0);
}

await mkdir(dirname(out), { recursive: true });
await writeFile(out, yangi, "utf8");
console.log(`yozildi: ${out}`);
