import { A, C, Callout, Code, H2, P, PageHead, PrevNext, Table, Tabs, Terminal } from "@/components/docs/parts";
import { NextMark, TsMark, VueMark } from "@/components/docs/art";

export const metadata = {
  title: "Vue integratsiyasi — OnDexMap",
  description: "OnDexMap xaritasini Vue 3 va Nuxt ilovasida ulash: onMounted, shallowRef va tozalash.",
};

export default function VuePage() {
  return (
    <div className="max-w-none">
      <PageHead
        title="Vue integratsiyasi"
        desc="Vue 3'da xarita onMounted ichida yaratiladi (shunda DOM element mavjud bo'ladi) va onBeforeUnmount da tozalanadi."
        pills={[
          { href: "#komponent", label: "Komponent", icon: <VueMark size={15} /> },
          { href: "#nuxt", label: "Nuxt", icon: <NextMark size={15} /> },
          { href: "/docs/integration/typescript", label: "TypeScript", icon: <TsMark size={15} /> },
        ]}
      />

      <H2 id="ornatish">O&apos;rnatish</H2>
      <Terminal>{`npm install maplibre-gl@4.7.1 pmtiles@3.2.1`}</Terminal>

      <H2 id="komponent">Komponent</H2>
      <Tabs
        files={[
          {
            name: "OnDexMap.vue",
            lang: "js",
            code: `<script setup>
import { onMounted, onBeforeUnmount, ref, shallowRef } from "vue";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

maplibregl.addProtocol("pmtiles", new Protocol().tile);

const props = defineProps({
  center: { type: Array, default: () => [69.2401, 41.2995] },
  zoom: { type: Number, default: 12 },
});

const container = ref(null);
// shallowRef — xarita obyekti reaktiv proksiga o'ralmasin.
const map = shallowRef(null);

onMounted(() => {
  map.value = new maplibregl.Map({
    container: container.value,
    style: "https://maps.ondex.uz/tiles/style.json",
    center: props.center,
    zoom: props.zoom,
  });
  map.value.addControl(new maplibregl.NavigationControl(), "top-right");
});

onBeforeUnmount(() => {
  map.value?.remove();
  map.value = null;
});
</script>

<template>
  <div ref="container" class="ondex-map" />
</template>

<style scoped>
.ondex-map { width: 100%; height: 400px; }
</style>`,
          },
          {
            name: "App.vue",
            lang: "js",
            code: `<script setup>
import OnDexMap from "./OnDexMap.vue";
</script>

<template>
  <main>
    <h1>Xarita</h1>
    <OnDexMap :center="[71.2394, 41.0004]" :zoom="13" />
  </main>
</template>`,
          },
        ]}
      />
      <Callout kind="warn">
        <p>
          Xarita obyekti uchun <C>shallowRef()</C> ishlatiladi. Oddiy <C>ref()</C> uni chuqur reaktiv
          proksiga o&apos;raydi, bu esa kutubxonaning ichki holatiga ta&apos;sir qiladi va xatolarga olib
          keladi.
        </p>
      </Callout>

      <H2 id="prop">Prop o&apos;zgarganda</H2>
      <P>Xaritani qayta yaratmang — uni suring:</P>
      <Code lang="js">{`import { watch } from "vue";

watch(
  () => [props.center, props.zoom],
  ([center, zoom]) => {
    map.value?.flyTo({ center, zoom });
  },
);`}</Code>
      <Table
        head={["Amal", "Metod"]}
        rows={[
          [
            "Markazni o'zgartirish",
            <>
              <C>map.value.flyTo({"{ center }"})</C>
            </>,
          ],
          [
            "Masshtabni o'zgartirish",
            <>
              <C>map.value.setZoom(zoom)</C>
            </>,
          ],
          [
            "Hududga sig'dirish",
            <>
              <C>map.value.fitBounds(bbox, {"{ padding: 40 }"})</C>
            </>,
          ],
        ]}
      />

      <H2 id="markerlar">Markerlar</H2>
      <Code lang="js">{`import { watch, onBeforeUnmount } from "vue";

let markerlar = [];

function tozala() {
  markerlar.forEach((m) => m.remove());
  markerlar = [];
}

watch(
  () => props.joylar,
  (joylar) => {
    tozala();
    if (!map.value) return;
    markerlar = joylar.map((j) =>
      new maplibregl.Marker().setLngLat([j.lng, j.lat]).addTo(map.value),
    );
  },
  { deep: true },
);

onBeforeUnmount(tozala);`}</Code>

      <H2 id="nuxt">Nuxt</H2>
      <P>
        Nuxt server tomonda ham render qiladi, kutubxona esa <C>window</C> ga tayanadi. Komponentni faqat
        klientda ko&apos;rsating:
      </P>
      <Code lang="html">{`<template>
  <ClientOnly>
    <OnDexMap />
    <template #fallback>
      <div style="height: 400px">Xarita yuklanmoqda…</div>
    </template>
  </ClientOnly>
</template>`}</Code>
      <Callout kind="note">
        <p>
          Server kaliti Nuxt&apos;ning <C>runtimeConfig</C> ichida (public emas) saqlanadi va faqat
          server route&apos;larida ishlatiladi — <A href="/docs/security/keys">API kalitlar</A>.
        </p>
      </Callout>

      <PrevNext current="/docs/integration/vue" />
    </div>
  );
}
