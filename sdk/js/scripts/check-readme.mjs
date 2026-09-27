// README'dagi kod misollarini TypeScript kompilyatori bilan tekshiradi.
//
// ┌─ NEGA ─────────────────────────────────────────────────────────────┐
// Hujjatdagi misol — eng ko'p o'qiladigan kod, lekin hech qachon
// ishga tushirilmaydi. 2026-09-27 da aynan shu README'da
// `r.routes[0].distance` yozilgan edi; kontraktda maydon nomi
// `distance_m`. Odam o'qib nusxalasa `undefined` olardi.
//
// Bu skript misollarni SDK'ning HAQIQIY tiplariga qarshi kompilyatsiya
// qiladi, ya'ni maydon nomi o'zgarsa README yiqiladi.
//
// ┌─ QANDAY ───────────────────────────────────────────────────────────┐
// README misollari o'zaro bog'liq: `const ondex` bir blokda yaratiladi
// va o'ndan keyingi barcha bloklarda ishlatiladi. Shuning uchun ular
// BITTA modulga birlashtiriladi:
//
//   • `import` qatorlari yuqoriga chiqariladi (ular funksiya ichida
//     turolmaydi);
//   • qolgan kod bitta `async` funksiya tanasiga tushadi, chunki
//     misollarda `await` ishlatiladi;
//   • README'da ataylab aniqlanmagan nomlar (`chizish`) prelude'da
//     e'lon qilinadi.
//
// Tekshiruvdan chetda qoladigan blok oldidan `<!-- kod-tekshirilmaydi -->`
// yoziladi — to'liq bo'lmagan qism uchun.
// └────────────────────────────────────────────────────────────────────┘
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const readme = join(root, "README.md");
const ish = join(root, ".readme-check");

const matn = await readFile(readme, "utf8");

const bloklar = [];
const re = /(<!--\s*kod-tekshirilmaydi\s*-->\s*\n)?```(?:js|ts|javascript|typescript)\n([\s\S]*?)```/g;
for (const m of matn.matchAll(re)) {
  if (m[1]) continue; // ataylab chetlatilgan
  bloklar.push(m[2]);
}

if (bloklar.length === 0) {
  console.error("README'da tekshiriladigan kod bloki topilmadi — regex buzilganmi?");
  process.exit(1);
}

// Importlarni tanadan ajratamiz. CSS importi (`maplibre-gl/dist/…css`)
// tip tizimida ma'noga ega emas — u tashlab yuboriladi.
const importlar = new Set();
const tana = [];
for (const [i, kod] of bloklar.entries()) {
  const qatorlar = [];
  for (const q of kod.split("\n")) {
    if (/^\s*import\s/.test(q)) {
      if (!/\.css"/.test(q)) importlar.add(q.trim());
      continue;
    }
    qatorlar.push(q);
  }
  // Bloklar BITTA ko'lamda birlashtiriladi: README'ni odam ham
  // shunday o'qiydi — `const map` va `const ondex` bir marta
  // yaratiladi va keyingi bo'limlarda ishlatiladi.
  //
  // Demak har bir `const` nomi README bo'ylab NOYOB bo'lishi kerak.
  // Bu cheklov emas, yaxshilanish: `const r` o'rniga `const topilgan`
  // yozilgani o'quvchiga ham foydali.
  tana.push(`  // ── README blok ${i + 1} ──`, ...qatorlar);
}

await rm(ish, { recursive: true, force: true });
await mkdir(ish, { recursive: true });

// `maplibre-gl` va `pmtiles` — `peerDependencies`, lekin ular
// `devDependencies` da ham bor, ataylab: misollar HAQIQIY maplibre
// tiplariga qarshi tekshirilsin.
//
// Soxta (`any`) e'lon yetarli emasligi sinovda ko'rindi: `createMap`
// chaqiruvchining `Map` turini qaytaradi, `any` bilan esa bu xulosa
// buzilib, `map.on(…)` hujjatda ishlagandek ko'rinardi — yoki
// aksincha, ishlaydigan kod xato deb belgilanardi.

await writeFile(
  join(ish, "misollar.ts"),
  [
    "// AVTOMATIK YARATILGAN — README.md dan. Qo'lda tahrirlamang.",
    ...importlar,
    "",
    "// README'da ataylab aniqlanmagan yordamchi nomlar:",
    "declare function chizish(features: unknown): void;",
    "",
    "export async function misollar() {",
    ...tana,
    "}",
  ].join("\n"),
  "utf8",
);

await writeFile(
  join(ish, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: [],
        lib: ["ES2022", "DOM"],
        baseUrl: ".",
        // Misollarda `@ondexmap/sdk` yoziladi — o'quvchi ko'radigan
        // AYNAN shu nom tekshirilishi kerak, `../src` emas.
        paths: { "@ondexmap/sdk": ["../src/index.ts"] },
        allowImportingTsExtensions: true,
      },
      include: ["*.ts", "*.d.ts"],
    },
    null,
    2,
  ),
  "utf8",
);

const tsc = resolve(root, "node_modules/typescript/bin/tsc");
if (!existsSync(tsc)) {
  console.error("typescript o'rnatilmagan — `npm install` ishlating");
  process.exit(1);
}

try {
  execFileSync(process.execPath, [tsc, "-p", join(ish, "tsconfig.json")], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  });
} catch (e) {
  console.error("README misollari kompilyatsiya bo'lmadi:\n");
  console.error((e.stdout ?? "") + (e.stderr ?? ""));
  console.error("\nBirlashtirilgan fayl: .readme-check/misollar.ts");
  process.exit(1);
}

await rm(ish, { recursive: true, force: true });
console.log(`README: ${bloklar.length} ta kod bloki kompilyatsiya bo'ldi`);
