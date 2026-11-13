<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useData, withBase } from "vitepress";
import type { DemoCopy } from "./copy";

const props = defineProps<{ copy: DemoCopy }>();
const { isDark } = useData();

// `bun run demo:build` writes demo-build.json next to the built demo; without
// a build the section is left out, so the site still builds on its own.
interface DemoBuild {
  rev: string;
  hash: string;
  gzipBytes: number;
}
const build = Object.values(
  import.meta.glob<DemoBuild>("./demo-build.json", {
    eager: true,
    import: "default",
  }),
)[0];

type Phase = "idle" | "loading" | "ready" | "unsupported" | "failed";
const phase = ref<Phase>("idle");
const src = ref("");

const COMMIT = `https://github.com/tessera-ui/tessera/commit/${build?.rev}`;
const SOURCE =
  "https://github.com/tessera-ui/tessera-ui.github.io/blob/main/demo/src/app.rs";
const size = `${((build?.gzipBytes ?? 0) / 1e6).toFixed(1)} MB`;
const status = computed(
  () =>
    ({
      idle: props.copy.run(size),
      loading: props.copy.loading,
      ready: "",
      unsupported: props.copy.unsupported,
      failed: props.copy.failed,
    })[phase.value],
);

// The demo starts in the site's current theme and follows later changes
// through messages.
function start() {
  if (phase.value !== "idle" && phase.value !== "failed") return;
  phase.value = "loading";
  const theme = isDark.value ? "dark" : "light";
  src.value = withBase(`/demo/index.html?theme=${theme}&v=${build?.hash}`);
}

const frame = ref<HTMLIFrameElement>();
function sendTheme() {
  frame.value?.contentWindow?.postMessage(
    { source: "tessera-site", theme: isDark.value ? "dark" : "light" },
    location.origin,
  );
}
watch(isDark, sendTheme);

function onMessage(event: MessageEvent) {
  const data = event.data;
  if (event.origin !== location.origin || data?.source !== "tessera-demo")
    return;
  if (data.type === "ready") {
    phase.value = "ready";
    // The theme may have changed while the demo was loading.
    sendTheme();
  } else {
    phase.value = data.detail === "webgpu" ? "unsupported" : "failed";
  }
}

// Start once the section is about to scroll into view, except on metered
// connections and touch screens, where a running canvas would also capture
// the swipes that scroll the page; those start with the button.
const root = ref<HTMLElement>();
let observer: IntersectionObserver | undefined;

onMounted(() => {
  if (!build) return;
  window.addEventListener("message", onMessage);
  if (!("gpu" in navigator)) {
    phase.value = "unsupported";
    return;
  }
  const saveData = (navigator as { connection?: { saveData?: boolean } })
    .connection?.saveData;
  if (saveData || matchMedia("(pointer: coarse)").matches || !root.value)
    return;
  observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      observer?.disconnect();
      start();
    },
    { rootMargin: "200px 0px" },
  );
  observer.observe(root.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  window.removeEventListener("message", onMessage);
});
</script>

<template>
  <section v-if="build" ref="root" class="live" :class="`is-${phase}`">
    <div class="live__head">
      <p class="label">{{ copy.title }}</p>
      <a class="live__commit label" :href="COMMIT">
        tessera@{{ build.rev.slice(0, 7) }} ↗
      </a>
    </div>

    <div class="live__stage">
      <iframe
        v-if="src"
        ref="frame"
        class="live__frame"
        :src="src"
        :title="copy.frameTitle"
        allow="fullscreen"
      />
      <div class="live__poster" aria-live="polite">
        <div class="live__tiles" aria-hidden="true">
          <span v-for="i in 24" :key="i" :style="{ '--i': i }" />
        </div>
        <div v-if="phase !== 'ready'" class="live__status">
          <button
            v-if="phase === 'idle' || phase === 'failed'"
            type="button"
            class="btn"
            @click="start"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M6 4.5v11l9-5.5-9-5.5Z" />
            </svg>
            {{ status }}
          </button>
          <p v-else class="live__message">
            <span v-if="phase === 'loading'" class="live__bar" />
            {{ status }}
          </p>
          <p v-if="phase === 'failed'" class="live__message">
            {{ copy.failedHint }}
          </p>
        </div>
      </div>
    </div>

    <div class="live__foot">
      <p>{{ copy.note }}</p>
      <a class="live__source" :href="SOURCE">{{ copy.source }} ↗</a>
    </div>
  </section>
</template>
