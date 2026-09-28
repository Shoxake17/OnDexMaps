// SDK xatti-harakatini qulflaydigan testlar.
//
// Ular `dist/` ustida ishlaydi (ya'ni AYNAN nashr qilinadigan kod
// sinaladi), shuning uchun avval `npm run build` bajarilishi kerak.
//
// ⚠️ `npm test` — `node --test`, ARGUMENTSIZ. Papka (`node --test test/`)
// yoki glob (`test/*.test.mjs`) berilmaydi: birinchisi Linux'da
// «Cannot find module» beradi, ikkinchisini Windows qobig'i
// kengaytirmaydi. Argumentsiz chaqiruv test fayllarini o'zi topadi va
// uchala platformada ham bir xil ishlaydi (CI'da 2026-09-28 da
// aniqlangan).
import { test } from "node:test";
import assert from "node:assert/strict";

const {
  clampBBox, bboxParam, createClient, createMap,
  OnDexMapError, isQuotaExceeded, isKeyProblem,
  SERVICE_AREA, REVERSE_AREA, BBOX_SPAN, GEOCODE_MAX_LIMIT,
} = await import("../dist/index.js");

/* ── bbox: eng ko'p adashtirgan joy ────────────────────────────── */

const bounds = (w, s, e, n) => ({
  getWest: () => w, getSouth: () => s, getEast: () => e, getNorth: () => n,
});

test("bbox: chegaradan chiqqan chekka QIRQILADI, so'rov yiqilmaydi", () => {
  // Shimoliy chegara 45.8; ko'rinish undan oshib ketgan.
  const b = clampBBox(bounds(58.4, 45.7, 58.5, 45.9));
  assert.ok(b, "qirqilgandan keyin to'rtburchak qolishi kerak");
  assert.equal(b.north, SERVICE_AREA.maxLat);
  assert.equal(b.west, 58.4, "ichkaridagi chekka o'zgarmaydi");
});

test("bbox: juda keng ko'rinishda null — so'rov YUBORILMAYDI", () => {
  const keng = BBOX_SPAN.free * 2;
  assert.equal(clampBBox(bounds(71, 40.8, 71 + keng, 40.8 + keng)), null);
});

// Ikki o'q ALOHIDA tekshiriladi: faqat kvadrat bilan sinalganda
// bitta o'qning tekshiruvi tushib qolsa ham testlar yashil qolardi
// (mutatsiya bilan aniqlangan).
test("bbox: faqat ENI oshsa ham null", () => {
  assert.equal(clampBBox(bounds(71, 40.8, 71 + BBOX_SPAN.free * 2, 40.85)), null);
});

test("bbox: faqat BO'YI oshsa ham null", () => {
  assert.equal(clampBBox(bounds(71, 40.8, 71.05, 40.8 + BBOX_SPAN.free * 2)), null);
});

test("bbox: chegaraning AYNAN o'zi o'tadi", () => {
  const b = clampBBox(bounds(71, 40.8, 71 + BBOX_SPAN.free, 40.8 + BBOX_SPAN.free));
  assert.ok(b, "chegaraga teng to'rtburchak rad etilmasligi kerak");
});

test("bbox: obuna tarifida o'sha ko'rinish O'TADI", () => {
  const keng = BBOX_SPAN.free * 2;
  assert.ok(clampBBox(bounds(71, 40.8, 71 + keng, 40.8 + keng), "paid"));
});

test("bbox: butunlay hudud tashqarisida null", () => {
  assert.equal(clampBBox(bounds(80, 50, 80.1, 50.1)), null);
});

test("bboxParam tartibi: g'arb,janub,sharq,shimol", () => {
  assert.equal(
    bboxParam({ west: 1, south: 2, east: 3, north: 4 }),
    "1.000000,2.000000,3.000000,4.000000",
  );
});

/* ── klient ────────────────────────────────────────────────────── */

/** So'rovlarni yozib boradigan soxta `fetch`. */
function fakeFetch(javoblar) {
  const chaqiruvlar = [];
  const f = async (url, init) => {
    chaqiruvlar.push({ url: new URL(url), init });
    const j = javoblar.shift() ?? { status: 200, body: { status: "OK" } };
    return new Response(JSON.stringify(j.body), {
      status: j.status,
      headers: { "Content-Type": "application/json", ...(j.headers ?? {}) },
    });
  };
  f.chaqiruvlar = chaqiruvlar;
  return f;
}

test("kalit SARLAVHADA yuboriladi, manzilda EMAS", async () => {
  const f = fakeFetch([{ status: 200, body: { status: "OK", results: [] } }]);
  await createClient({ key: "omk_s_sir", fetch: f }).geocode("Chust");

  const { url, init } = f.chaqiruvlar[0];
  assert.equal(init.headers["X-API-Key"], "omk_s_sir");
  assert.equal(url.searchParams.get("key"), null, "kalit so'rov qatorida bo'lmasligi kerak");
  assert.ok(!url.toString().includes("omk_s_sir"), "kalit manzilga tushmasligi kerak");
});

test("geocode limiti server chegarasiga qirqiladi", async () => {
  const f = fakeFetch([{ status: 200, body: { status: "OK", results: [] } }]);
  await createClient({ key: "k", fetch: f }).geocode("a", { limit: 999 });
  assert.equal(f.chaqiruvlar[0].url.searchParams.get("limit"), String(GEOCODE_MAX_LIMIT));
});

test("reverse: hudud tashqarisida so'rov YUBORILMAYDI", async () => {
  const f = fakeFetch([]);
  const c = createClient({ key: "k", fetch: f });

  assert.equal(await c.reverse(41.2995, 69.2401), null, "Toshkent hududdan tashqarida");
  assert.equal(f.chaqiruvlar.length, 0, "tarmoqqa chiqilmasligi kerak");

  await c.reverse(REVERSE_AREA.minLat + 0.1, REVERSE_AREA.minLng + 0.1);
  assert.equal(f.chaqiruvlar.length, 1, "hudud ichida so'rov ketadi");
});

test("places: keng ko'rinishda kvota sarflanmaydi", async () => {
  const f = fakeFetch([]);
  const keng = BBOX_SPAN.free * 3;
  const r = await createClient({ key: "k", fetch: f })
    .places(bounds(71, 40.8, 71 + keng, 40.8 + keng));
  assert.equal(r, null);
  assert.equal(f.chaqiruvlar.length, 0);
});

test("place(): geocode'dagi `p` prefiksi olib tashlanadi", async () => {
  const f = fakeFetch([{ status: 200, body: { status: "OK" } }]);
  const uuid = "a70e710c-d609-4865-9db4-d589ba33eb11";
  await createClient({ key: "k", fetch: f }).place("p" + uuid);
  assert.ok(f.chaqiruvlar[0].url.pathname.endsWith("/places/" + uuid));
});

test("place(): toza UUID o'zgartirilmaydi", async () => {
  const f = fakeFetch([{ status: 200, body: { status: "OK" } }]);
  const uuid = "a70e710c-d609-4865-9db4-d589ba33eb11";
  await createClient({ key: "k", fetch: f }).place(uuid);
  assert.ok(f.chaqiruvlar[0].url.pathname.endsWith("/places/" + uuid));
});

test("429: Retry-After hurmat qilinadi va qayta urinadi", async () => {
  const f = fakeFetch([
    { status: 429, body: { status: "RESOURCE_EXHAUSTED", error: { code: "rate_limited", message: "sekin" } },
      headers: { "Retry-After": "0" } },
    { status: 200, body: { status: "OK", results: [] } },
  ]);
  const r = await createClient({ key: "k", fetch: f, retries: 1 }).geocode("a");
  assert.equal(r.status, "OK");
  assert.equal(f.chaqiruvlar.length, 2, "bir marta qayta urinilishi kerak");
});

test("kvota tugaganda QAYTA URINILMAYDI", async () => {
  const f = fakeFetch([
    { status: 429, body: { status: "RESOURCE_EXHAUSTED", error: { code: "quota_exceeded", message: "tugadi" } } },
  ]);
  await assert.rejects(
    () => createClient({ key: "k", fetch: f, retries: 3 }).geocode("a"),
    (e) => isQuotaExceeded(e) && e.retryable === false,
  );
  assert.equal(f.chaqiruvlar.length, 1, "qayta urinish ma'nosiz");
});

test("kalit muammosi aniqlanadi", async () => {
  const f = fakeFetch([
    { status: 403, body: { status: "REQUEST_DENIED", error: { code: "key_restricted", message: "domen" } } },
  ]);
  await assert.rejects(
    () => createClient({ key: "k", fetch: f, retries: 0 }).geocode("a"),
    (e) => e instanceof OnDexMapError && isKeyProblem(e) && e.status === 403,
  );
});

test("kvota sarlavhalari o'qiladi", async () => {
  const f = fakeFetch([{ status: 200, body: { status: "OK", results: [] },
    headers: { "X-Plan": "free", "X-Quota-Limit": "200000", "X-Quota-Used": "42" } }]);
  const c = createClient({ key: "k", fetch: f });
  await c.geocode("a");
  assert.deepEqual(c.quota, { plan: "free", limit: 200000, used: 42 });
});

/* ── xarita: atribut MAJBURIY ──────────────────────────────────── */

/** maplibre-gl'ning minimal soxta nusxasi. */
function fakeMapLibre() {
  const holat = { mapOpts: null, controls: [], protokollar: [] };
  class Map {
    constructor(o) { holat.mapOpts = o; }
    addControl(c, pos) { holat.controls.push({ c, pos }); }
  }
  class AttributionControl { constructor(o) { this.tur = "attrib"; this.opts = o; } }
  class NavigationControl { constructor() { this.tur = "nav"; } }
  return {
    lib: {
      Map, AttributionControl, NavigationControl,
      addProtocol: (n) => holat.protokollar.push(n),
    },
    holat,
  };
}

test("createMap: atribut compact:false bilan QO'SHILADI", () => {
  const { lib, holat } = fakeMapLibre();
  createMap({ container: "map", maplibregl: lib });

  const attrib = holat.controls.find((x) => x.c.tur === "attrib");
  assert.ok(attrib, "atribut boshqaruvi qo'shilishi kerak");
  assert.equal(attrib.c.opts.compact, false, "compact MAJBURIY false");
  assert.equal(holat.mapOpts.attributionControl, false, "standart yorliq o'chiriladi");
});

test("createMap: atributni O'CHIRIB BO'LMAYDI", () => {
  const { lib, holat } = fakeMapLibre();
  // Integrator uni o'chirishga urinadi — e'tiborga olinmasligi kerak.
  createMap({
    container: "map", maplibregl: lib,
    mapOptions: { attributionControl: { compact: true } },
  });

  const attrib = holat.controls.find((x) => x.c.tur === "attrib");
  assert.ok(attrib, "atribut baribir qo'shiladi");
  assert.equal(attrib.c.opts.compact, false);
  assert.equal(holat.mapOpts.attributionControl, false);
});

test("createMap: o'z brendi qo'shiladi, kredit saqlanadi", () => {
  const { lib, holat } = fakeMapLibre();
  createMap({ container: "map", maplibregl: lib, customAttribution: "© Men" });
  const attrib = holat.controls.find((x) => x.c.tur === "attrib");
  assert.equal(attrib.c.opts.customAttribution, "© Men");
  assert.equal(attrib.c.opts.compact, false);
});

/* Atribut `innerHTML` bilan joylashtiriladi va maplibre uni
   sanitizatsiya qilmaydi — shuning uchun SDK o'zi rad etadi. */
test("createMap: customAttribution'dagi skript RAD ETILADI", () => {
  const { lib } = fakeMapLibre();
  for (const yomon of [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<a href="javascript:alert(1)">Men</a>',
    '<details open ontoggle="alert(1)">',   // GHSA-jrc7-96c5-q579 dagi naqsh
    '<iframe src="//evil"></iframe>',
    '<span onclick="alert(1)">Men</span>',
  ]) {
    assert.throws(
      () => createMap({ container: "map", maplibregl: lib, customAttribution: yomon }),
      /customAttribution rad etildi/,
      `rad etilishi kerak edi: ${yomon}`,
    );
  }
});

test("createMap: oddiy brend va havola O'TADI", () => {
  const { lib, holat } = fakeMapLibre();
  for (const yaxshi of [
    "© Mening Kompaniyam",
    '<a href="https://misol.uz">Misol MChJ</a>',
    "<b>Misol</b> — 2026",
  ]) {
    assert.doesNotThrow(() =>
      createMap({ container: "map", maplibregl: lib, customAttribution: yaxshi }));
  }
  assert.ok(holat.controls.length > 0);
});

test("createMap: pmtiles protokoli xaritadan OLDIN ro'yxatdan o'tadi", () => {
  const { lib, holat } = fakeMapLibre();
  createMap({ container: "map", maplibregl: lib, pmtilesProtocol: () => {} });
  assert.deepEqual(holat.protokollar, ["pmtiles"]);
});
