/* ═══════════════════════════════════════════════════════════════════
   OnDexMap — UMUMIY xarita moduli

   IKKALA sahifa ham shu fayldan foydalanadi:
     /map   (ommaviy ko'rinish)  — internal/httpapi
     /      (admin muharriri)    — internal/adminapi

   NEGA UMUMIY: ilgari xarita yaratish, 3D binolar, brend yashirish va
   qatlam tartibi ikkala sahifada ALOHIDA yozilgan edi. Bunday nusxa
   vaqt o'tib bir-biridan uzoqlashadi: bir sahifada tuzatilgan xato
   ikkinchisida qolib ketadi (masalan yorliq halosi rangi shu tarzda
   ikki marta tuzatilgan).
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  var CHUST = [71.2394, 41.0004];

  // Asos xaritalar. `satellite-streets` ATAYLAB sof sputnik emas —
  // unda ko'cha nomlari tasvir ustida chiqadi va mo'ljal olish
  // ancha oson bo'ladi.
  //
  // ESLATMA: bir muddat ikkinchi tasvir manbasi (Esri World Imagery)
  // ham bor edi — "Mapbox tasviri eskimi?" degan savolni tekshirish
  // uchun. Jonli solishtiruvda Esri Chust uchun YANGIROQ chiqmadi,
  // shuning uchun olib tashlandi: foyda bermaydigan qatlam CSP
  // ruxsatini, tashqi bog'liqlikni va litsenziya savolini bekorga
  // keltirardi.
  var STYLES = {
    streets:   "mapbox://styles/mapbox/streets-v12",
    satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  };

  var LABELS = { streets: "Xarita", satellite: "Sputnik" };

  /* ── Asos xarita almashtirgichi (Mapbox boshqaruvi) ────────────── */
  function BasemapControl(om) {
    this._om = om;
  }
  BasemapControl.prototype.onAdd = function () {
    var om = this._om;
    var box = document.createElement("div");
    box.className = "mapboxgl-ctrl om-basemap";

    Object.keys(STYLES).forEach(function (key) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = LABELS[key];
      b.dataset.mode = key;
      if (key === om.mode) b.className = "on";
      b.onclick = function () { om.setBasemap(key); };
      box.appendChild(b);
    });

    this._box = box;
    om._basemapBox = box;
    return box;
  };
  BasemapControl.prototype.onRemove = function () {
    if (this._box && this._box.parentNode) this._box.parentNode.removeChild(this._box);
  };

  /* ── Asosiy sinf ───────────────────────────────────────────────── */
  function OndexMap(opts) {
    var self = this;
    this.mode = opts.mode || "streets";
    this.pitch3d = opts.pitch3d === undefined ? 55 : opts.pitch3d;
    this.bearing3d = opts.bearing3d === undefined ? -17 : opts.bearing3d;
    // `onReady` uslub HAR SAFAR yuklanganda chaqiriladi — shu jumladan
    // sputnikka o'tilganda ham. Sabab: Mapbox uslub almashtirilganda
    // BARCHA qo'shimcha qatlamlarni o'chiradi va ularni qayta
    // qo'shish kerak. Bu — asos xarita almashtirishdagi eng ko'p
    // uchraydigan xato.
    this.onReady = opts.onReady || function () {};

    mapboxgl.accessToken = opts.token;

    this.map = new mapboxgl.Map({
      container: opts.container || "map",
      style: STYLES[this.mode],
      center: opts.center || CHUST,
      zoom: opts.zoom === undefined ? 16 : opts.zoom,
      pitch: opts.pitch === undefined ? 0 : opts.pitch,
      bearing: opts.bearing || 0,
      antialias: true,             // ekstruziya qirralari tekis chiqsin
      attributionControl: false,   // brend yashirish (CSS ham kerak)
    });

    this.map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    if (opts.basemapSwitcher !== false) {
      this.map.addControl(new BasemapControl(this), "top-right");
    }

    // `style.load` — birinchi yuklanishda HAM, uslub
    // almashtirilganda HAM ishlaydi. `load` esa faqat birinchi marta.
    this.map.on("style.load", function () {
      self._add3D();
      self.onReady(self.map, self);
    });

    if (opts.dimToggle !== false) this._addDimToggle();
  }

  /* 3D binolar.
     Qatlam YORLIQLARDAN PASTGA qo'yiladi: aks holda binolar ko'cha
     nomlarini yopib qo'yadi va xarita o'qilmay qoladi. */
  OndexMap.prototype._add3D = function () {
    var map = this.map;
    if (!map.getSource("composite")) return;      // uslubda manba yo'q — 2D qolaveradi
    if (map.getLayer("om-3d")) return;

    var layers = map.getStyle().layers || [];
    var firstLabel = null;
    for (var i = 0; i < layers.length; i++) {
      var l = layers[i];
      if (l.type === "symbol" && l.layout && l.layout["text-field"]) { firstLabel = l.id; break; }
    }

    // Sputnik rejimida binolar tasvir ustida turadi, shuning uchun
    // ular biroz shaffofroq — tomlar tasvirda ham ko'rinib tursin.
    var sat = this.mode === "satellite";

    map.addLayer({
      id: "om-3d",
      source: "composite",
      "source-layer": "building",
      filter: ["==", "extrude", "true"],
      type: "fill-extrusion",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": sat
          ? "#c9ccd2"
          : ["interpolate", ["linear"], ["get", "height"],
             0, "#e6e8ec", 20, "#d3d7de", 60, "#bcc2cc"],
        // Zoom 14 → 15.5 oralig'ida binolar silliq "o'sib chiqadi".
        "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 14, 0, 15.5, ["get", "height"]],
        "fill-extrusion-base":   ["interpolate", ["linear"], ["zoom"], 14, 0, 15.5, ["get", "min_height"]],
        "fill-extrusion-opacity": sat ? 0.7 : 0.92,
      },
    }, firstLabel || undefined);
  };

  /* Chizilgan/saqlangan qatlamlar SHU qatlamdan pastga qo'yilishi
     kerak — aks holda to'ldirish binolarni yopib qo'yadi. */
  OndexMap.prototype.beforeLayer = function () {
    return this.map.getLayer("om-3d") ? "om-3d" : undefined;
  };

  OndexMap.prototype.setBasemap = function (mode) {
    if (!STYLES[mode] || mode === this.mode) return;
    this.mode = mode;
    // Uslub almashtirilishi barcha qatlamlarni o'chiradi;
    // `style.load` hodisasi ularni qayta qo'shadi.
    this.map.setStyle(STYLES[mode]);

    if (this._basemapBox) {
      var btns = this._basemapBox.querySelectorAll("button");
      for (var i = 0; i < btns.length; i++) {
        btns[i].className = btns[i].dataset.mode === mode ? "on" : "";
      }
    }
  };

  OndexMap.prototype._addDimToggle = function () {
    var self = this;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "om-dim";
    btn.textContent = this.map.getPitch() < 10 ? "3D" : "2D";
    btn.onclick = function () {
      var flat = self.map.getPitch() < 10;
      self.map.easeTo({
        pitch: flat ? self.pitch3d : 0,
        bearing: flat ? self.bearing3d : 0,
        duration: 650,
      });
      btn.textContent = flat ? "2D" : "3D";
    };
    this.map.getContainer().appendChild(btn);
  };

  /* Bazadan kelgan matn HTML sifatida talqin qilinmasin.
     Nomlar bazadan keladi va JAMOA TAKLIFLARI ham shu yo'ldan
     o'tadi — ya'ni bu funksiya haqiqiy himoya, bezak emas. */
  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
  }

  /* Geometriyadagi barcha koordinatalarni tekis ro'yxatga aylantiradi
     (fitBounds uchun). */
  function flattenCoords(c) {
    if (!c || !c.length) return [];
    if (typeof c[0] === "number") return [c];
    return c.reduce(function (acc, x) { return acc.concat(flattenCoords(x)); }, []);
  }

  OndexMap.prototype.fitTo = function (geometry, padding) {
    var coords = flattenCoords(geometry && geometry.coordinates);
    if (!coords.length) return;
    var b = new mapboxgl.LngLatBounds(coords[0], coords[0]);
    coords.forEach(function (c) { b.extend(c); });
    this.map.fitBounds(b, { padding: padding || 80, maxZoom: 17 });
  };

  global.OndexMap = {
    create: function (opts) { return new OndexMap(opts); },
    STYLES: STYLES,
    CHUST: CHUST,
    esc: esc,
    flattenCoords: flattenCoords,
  };
})(window);
