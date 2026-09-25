import { A, C, Callout, Code, H2, P, PrevNext, Tabs } from "@/components/docs/parts";

export const metadata = {
  title: "API'ni ulash: Vue — OnDexMap",
  description: "OnDexMap xaritasini Vue 3 ilovasida ulash: onMounted, tozalash va Nuxt.",
};

export default function ConnectVuePage() {
  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-3xl font-bold">API&apos;ni ulash: Vue</h1>

      <P>
        Vue 3&apos;da xarita <C>onMounted</C> ichida yaratiladi (shunda DOM element mavjud bo&apos;ladi) va{" "}
        <C>onBeforeUnmount</C> da tozalanadi.
      </P>

      <H2 id="component">Komponent</H2>
      <Tabs
        files={[
          {
            name: "OnDexMap.vue",
            code: `<script setup>
import { onMounted, onBeforeUnmount, ref, shallowRef } from "vue";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

maplibregl.addProtocol("pmtiles", new Protocol().tile);

const props = defineProps({
  center: { type: Array, default: () => [71.2394, 41.0004] },
  zoom: { type: Number, default: 13 },
});

const container = ref(null);
// shallowRef — xarita obyekti reaktiv proksiga o'ralmasin (ichki
// holati juda katta, kuzatish keraksiz va sekinlashtiradi)
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
.ondex-map {
  width: 100%;
  height: 400px;
}
</style>`,
          },
          {
            name: "App.vue",
            code: `<script setup>
import OnDexMap from "./OnDexMap.vue";
</script>

<template>
  <main>
    <h1>Xarita</h1>
    <OnDexMap :center="[69.2401, 41.2995]" :zoom="12" />
  </main>
</template>`,
          },
        ]}
      />

      <Callout kind="warn">
        <p>
          Xaritani oddiy <C>ref()</C> ga solmang — Vue uni chuqur reaktiv proksiga o&apos;raydi va
          MapLibre&apos;ning ichki obyektlari buziladi (xarita sekinlashadi yoki xato beradi).{" "}
          <C>shallowRef()</C> ishlating.
        </p>
      </Callout>

      <H2 id="nuxt">Nuxt</H2>
      <P>
        Nuxt server tomonda ham render qiladi, kutubxona esa <C>window</C> ga tayanadi. Komponentni faqat
        klientda ko&apos;rsating:
      </P>
      <Code lang="vue">{`<template>
  <ClientOnly>
    <OnDexMap />
    <template #fallback>
      <div style="height: 400px">Xarita yuklanmoqda…</div>
    </template>
  </ClientOnly>
</template>`}</Code>

      <P>
        Qat&apos;iy CSP ishlatayotgan bo&apos;lsangiz —{" "}
        <A href="/docs/js/connect/csp">CSP bilan ulash</A> sahifasiga qarang.
      </P>

      <PrevNext current="/docs/js/connect/vue" />
    </div>
  );
}
