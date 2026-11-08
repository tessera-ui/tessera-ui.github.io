<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useData } from "vitepress";
import { HAT_TILE_PATH, hatTiling, type Hat } from "./hat";

const props = withDefaults(
  defineProps<{
    /** Focal point of the tiling, as a fraction of the canvas size. */
    focusX?: number;
    focusY?: number;
    /** Tiling units per CSS pixel are derived from this target hat width. */
    hatWidth?: number;
  }>(),
  {
    focusX: 0.5,
    focusY: 0.5,
    hatWidth: 64,
  },
);

const { isDark } = useData();
const canvas = ref<HTMLCanvasElement>();

let hats: Hat[] | null = null;
let teardown: (() => void) | null = null;

interface Palette {
  grout: string;
  tiles: [number, number, number];
  tileJitter: number;
  odd: string;
  from: [number, number, number];
  to: [number, number, number];
  litAlpha: number;
}

const DARK: Palette = {
  grout: "#06080f",
  tiles: [13, 17, 31],
  tileJitter: 7,
  odd: "#161b3d",
  from: [99, 102, 241],
  to: [34, 211, 238],
  litAlpha: 0.9,
};

const LIGHT: Palette = {
  grout: "#dce1ed",
  tiles: [245, 246, 251],
  tileJitter: 6,
  odd: "#e8eafc",
  from: [99, 102, 241],
  to: [34, 211, 238],
  litAlpha: 0.75,
};

function mix(a: number[], b: number[], t: number) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

function hash(i: number) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function start(el: HTMLCanvasElement) {
  const ctx = el.getContext("2d");
  if (!ctx) return () => {};

  hats ??= hatTiling(4);
  const tile = new Path2D(HAT_TILE_PATH);
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  // Pointer input comes from the nearest marked ancestor, so content layered
  // above the canvas does not block the light.
  const host =
    el.closest<HTMLElement>("[data-hat-host]") ?? el.parentElement ?? el;

  const base = document.createElement("canvas");
  const bctx = base.getContext("2d")!;

  let w = 0;
  let h = 0;
  let dpr = 1;
  let scale = 20;
  let ox = 0;
  let oy = 0;
  let palette = isDark.value ? DARK : LIGHT;

  // Visible tiles, in reveal order.
  let visible: Hat[] = [];
  let px = new Float32Array(0);
  let py = new Float32Array(0);
  let dist = new Float32Array(0);
  let energy = new Float32Array(0);
  let colors: string[] = [];
  let lit: string[] = [];
  let revealed = 0;

  let pointer: { x: number; y: number } | null = null;
  let ripples: { x: number; y: number; t: number }[] = [];
  let introStart = -1;
  let raf = 0;
  let last = 0;
  let nextTwinkle = 0;
  let onScreen = true;

  const setTileTransform = (c: CanvasRenderingContext2D, m: Hat["m"]) => {
    const k = scale * dpr;
    c.setTransform(
      k * m[0],
      k * m[3],
      k * m[1],
      k * m[4],
      dpr * (ox + scale * m[2]),
      dpr * (oy + scale * m[5]),
    );
  };

  const paintBase = (from: number, to: number) => {
    for (let i = from; i < to; i++) {
      setTileTransform(bctx, visible[i].m);
      bctx.fillStyle = colors[i];
      bctx.fill(tile);
    }
    bctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  const layout = () => {
    const rect = el.getBoundingClientRect();
    w = Math.max(1, rect.width);
    h = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.width = base.width = Math.round(w * dpr);
    el.height = base.height = Math.round(h * dpr);

    // A hat spans about 3 tiling units across.
    const target =
      window.innerWidth < 640 ? props.hatWidth * 0.72 : props.hatWidth;
    scale = target / 3;
    ox = w * props.focusX;
    oy = h * props.focusY;

    const margin = 3 * scale;
    visible = hats!.filter((t) => {
      const x = ox + t.cx * scale;
      const y = oy + t.cy * scale;
      return x > -margin && x < w + margin && y > -margin && y < h + margin;
    });
    visible.sort((a, b) => Math.hypot(a.cx, a.cy) - Math.hypot(b.cx, b.cy));

    const n = visible.length;
    px = new Float32Array(n);
    py = new Float32Array(n);
    dist = new Float32Array(n);
    energy = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      px[i] = ox + visible[i].cx * scale;
      py[i] = oy + visible[i].cy * scale;
      dist[i] = Math.hypot(visible[i].cx, visible[i].cy) * scale;
      // Without animation, keep a few tiles lit so the field isn't flat.
      if (reduceMotion && hash(i * 3.1) > 0.965)
        energy[i] = 0.25 + hash(i) * 0.4;
    }
    recolor();

    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.fillStyle = palette.grout;
    bctx.fillRect(0, 0, base.width, base.height);
    if (introStart < 0 || reduceMotion) {
      revealed = n;
      paintBase(0, n);
    } else {
      revealed = 0;
    }
    draw();
  };

  const recolor = () => {
    palette = isDark.value ? DARK : LIGHT;
    const n = visible.length;
    colors = new Array(n);
    lit = new Array(n);
    for (let i = 0; i < n; i++) {
      const j =
        (hash(i * 7 + Math.round(visible[i].cx * 13)) - 0.5) *
        2 *
        palette.tileJitter;
      const [r, g, b] = palette.tiles;
      colors[i] =
        visible[i].label === "H1"
          ? palette.odd
          : `rgb(${r + j},${g + j},${b + j * 1.4})`;
      // Light runs along the logo's gradient axis: indigo bottom-left, cyan top-right.
      const t = Math.min(
        1,
        Math.max(0, (px[i] / w) * 0.75 + (1 - py[i] / h) * 0.45 - 0.1),
      );
      lit[i] = `rgb(${mix(palette.from, palette.to, t).join(",")})`;
    }
  };

  const draw = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(base, 0, 0);
    ctx.globalAlpha = 1;
    for (let i = 0; i < revealed; i++) {
      const e = energy[i];
      if (e < 0.01) continue;
      setTileTransform(ctx, visible[i].m);
      ctx.globalAlpha = Math.min(1, e) * palette.litAlpha;
      ctx.fillStyle = lit[i];
      ctx.fill(tile);
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  const step = (now: number) => {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    const n = visible.length;

    if (introStart >= 0) {
      if (introStart === 0) introStart = now;
      const front = ((now - introStart) / 1000) * 1600;
      let next = revealed;
      while (next < n && dist[next] <= front) next++;
      if (next > revealed) {
        paintBase(revealed, next);
        for (let i = revealed; i < next; i++)
          energy[i] = Math.max(energy[i], 0.35 * hash(i) + 0.08);
        revealed = next;
      }
      if (revealed >= n) introStart = -1;
    }

    const decay = Math.pow(0.12, dt);
    for (let i = 0; i < revealed; i++) {
      if (energy[i] > 0.004) {
        energy[i] *= decay;
      } else energy[i] = 0;
    }

    if (pointer) {
      const radius = 150;
      for (let i = 0; i < revealed; i++) {
        const d = Math.hypot(px[i] - pointer.x, py[i] - pointer.y);
        if (d < radius) {
          const k = 1 - d / radius;
          energy[i] = Math.max(energy[i], k * k * 0.85);
        }
      }
    }

    if (ripples.length) {
      ripples = ripples.filter((r) => now - r.t < 1600);
      for (const r of ripples) {
        const age = (now - r.t) / 1000;
        const front = age * 700;
        const strength = 0.9 * (1 - age / 1.6);
        for (let i = 0; i < revealed; i++) {
          const d = Math.abs(Math.hypot(px[i] - r.x, py[i] - r.y) - front);
          if (d < 34) energy[i] = Math.max(energy[i], strength * (1 - d / 34));
        }
      }
    }

    if (revealed > 0 && now > nextTwinkle) {
      const i = Math.floor(Math.random() * revealed);
      energy[i] = Math.max(energy[i], 0.3 + Math.random() * 0.4);
      nextTwinkle = now + 90 + Math.random() * 160;
    }

    draw();
    if (onScreen && !document.hidden) schedule();
  };

  const schedule = () => {
    if (!raf && !reduceMotion) {
      raf = requestAnimationFrame(step);
    }
  };

  const local = (e: PointerEvent) => {
    const rect = el.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    pointer = local(e);
    schedule();
  };
  const onLeave = () => {
    pointer = null;
  };
  // A click on empty space sends a ring of light through the tiling.
  const onDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest("a, button, input, pre, figure"))
      return;
    ripples.push({ ...local(e), t: performance.now() });
    schedule();
  };

  const ro = new ResizeObserver(() => layout());
  const io = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen) {
      last = 0;
      schedule();
    }
  });
  const onVisibility = () => {
    if (!document.hidden) {
      last = 0;
      schedule();
    }
  };

  if (!reduceMotion) introStart = 0;
  layout();
  ro.observe(el);
  io.observe(el);
  document.addEventListener("visibilitychange", onVisibility);
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerleave", onLeave);
  host.addEventListener("pointerdown", onDown);
  const stopTheme = watch(isDark, () => {
    introStart = -1;
    layout();
  });
  schedule();

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    stopTheme();
    document.removeEventListener("visibilitychange", onVisibility);
    host.removeEventListener("pointermove", onMove);
    host.removeEventListener("pointerleave", onLeave);
    host.removeEventListener("pointerdown", onDown);
  };
}

onMounted(() => {
  if (canvas.value) teardown = start(canvas.value);
});

onBeforeUnmount(() => teardown?.());
</script>

<template>
  <canvas ref="canvas" class="hat-field" aria-hidden="true" />
</template>

<style scoped>
.hat-field {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
