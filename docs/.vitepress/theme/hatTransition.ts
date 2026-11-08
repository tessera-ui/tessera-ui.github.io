import { HAT_OUTLINE, HAT_TILE_PATH, hatTiling, type Hat } from "./home/hat";

type Rgb = [number, number, number];

interface Look {
  grout: string;
  tile: Rgb;
  jitter: number;
}

// Matches the homepage tiling (HatField) so the switch reads as the same mosaic.
const LOOKS: Record<"dark" | "light", Look> = {
  dark: { grout: "#06080f", tile: [13, 17, 31], jitter: 7 },
  light: { grout: "#dce1ed", tile: [245, 246, 251], jitter: 6 },
};
const ACCENT_FROM: Rgb = [99, 102, 241];
const ACCENT_TO: Rgb = [34, 211, 238];

// Timeline, in milliseconds.
// Short per-tile animations keep few tiles moving in any one frame.
const COVER_SPREAD = 380; // last tile starts popping in
const RAGGED = 70; // per-tile delay noise that makes the edge follow the hats
const POP = 170; // one tile's pop-in
const GLOW = 150; // accent cooling to the tile colour
const GROUT = 100; // grout fading in, ending when the last tile settles
const HOLD = 70; // settled mosaic before the site switches underneath
const REVEAL_SPREAD = 320;
const FADE = 170;
const SHADES = 8; // precomputed colour steps from accent to tile
const HAT_WIDTH = 76; // CSS px; a little larger than the homepage tiles

let hats: Hat[] | null = null;
let roundedPath: Path2D | null = null;
let movingPath: Path2D | null = null;

/** Builds the tiling ahead of time so the first switch starts immediately. */
export function prepareHatTransition() {
  hats ??= hatTiling(4);
  // Settled tiles use the rounded mosaic outline. Moving tiles use the plain
  // polygon, inset to match: it fills several times faster and the corners
  // are not visible while a tile pops or dissolves.
  roundedPath ??= new Path2D(HAT_TILE_PATH);
  if (!movingPath) {
    const n = HAT_OUTLINE.length;
    const cx = HAT_OUTLINE.reduce((s, p) => s + p.x, 0) / n;
    const cy = HAT_OUTLINE.reduce((s, p) => s + p.y, 0) / n;
    movingPath = new Path2D();
    HAT_OUTLINE.forEach((p, i) => {
      const px = cx + (p.x - cx) * 0.95;
      const py = cy + (p.y - cy) * 0.95;
      if (i) movingPath!.lineTo(px, py);
      else movingPath!.moveTo(px, py);
    });
    movingPath.closePath();
  }
}

const hash = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const css = (a: Rgb, b: Rgb, t: number) =>
  `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
// Pops slightly past full size before settling.
const easeOutBack = (t: number) => {
  const c = 1.4;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};
const easeInCubic = (t: number) => t * t * t;
const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r));

interface Tile {
  /** Device-space affine transform of the tile. */
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  cx: number;
  cy: number;
  coverAt: number;
  revealAt: number;
  spin: number;
  shades: string[];
}

/**
 * Covers the viewport with hat tiles in the target theme, spreading from
 * (x, y). Once the mosaic has settled, `apply` switches the real theme
 * underneath and the tiles dissolve to reveal it.
 */
export async function hatThemeTransition(
  x: number,
  y: number,
  toDark: boolean,
  apply: () => Promise<void>,
): Promise<void> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const layer = document.createElement("canvas");
  const lctx = layer.getContext("2d");
  if (!ctx || !lctx) return apply();
  prepareHatTransition();

  const w = innerWidth;
  const h = innerHeight;
  // The mosaic is on screen for about a second; full retina resolution costs
  // fill rate without a visible difference.
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  canvas.width = layer.width = Math.round(w * dpr);
  canvas.height = layer.height = Math.round(h * dpr);
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    zIndex: "2147483647",
    pointerEvents: "none",
  });
  document.body.appendChild(canvas);

  const rounded = roundedPath!;
  const moving = movingPath!;
  const look = LOOKS[toDark ? "dark" : "light"];
  // The level-4 tiling reliably covers ~60 units around its centre.
  const scale = Math.max(HAT_WIDTH / 3, Math.hypot(w, h) / 2 / 60);
  const k = scale * dpr;
  const ox = w / 2;
  const oy = h / 2;
  const margin = 3 * scale;
  const far = Math.max(
    Math.hypot(x, y),
    Math.hypot(w - x, y),
    Math.hypot(x, h - y),
    Math.hypot(w - x, h - y),
  );

  const tiles: Tile[] = [];
  hats!.forEach((hat, i) => {
    const px = ox + hat.cx * scale;
    const py = oy + hat.cy * scale;
    if (px < -margin || px > w + margin || py < -margin || py > h + margin)
      return;
    const near = Math.min(1, Math.hypot(px - x, py - y) / far);
    const m = hat.m;
    const j = (hash(i) - 0.5) * 2 * look.jitter;
    const base = look.tile.map((v) => v + j) as Rgb;
    const glow = ACCENT_FROM.map(
      (v, n) => v + (ACCENT_TO[n] - v) * hash(i * 7.3),
    ) as Rgb;
    tiles.push({
      a: k * m[0],
      b: k * m[3],
      c: k * m[1],
      d: k * m[4],
      e: dpr * (ox + scale * m[2]),
      f: dpr * (oy + scale * m[5]),
      cx: px * dpr,
      cy: py * dpr,
      // The wave accelerates slightly as it spreads; noise keeps the edge ragged.
      coverAt: COVER_SPREAD * near ** 0.9 + hash(i * 3.7) * RAGGED,
      revealAt: REVEAL_SPREAD * near + hash(i * 1.9) * RAGGED,
      spin: (hash(i * 5.1) - 0.5) * 0.5,
      shades: Array.from({ length: SHADES + 1 }, (_, s) =>
        css(glow, base, s / SHADES),
      ),
    });
  });

  const draw = (
    target: CanvasRenderingContext2D,
    path: Path2D,
    t: Tile,
    s: number,
    rot: number,
    fill: string,
    alpha: number,
  ) => {
    // Scale and rotate the tile about its own centre.
    const cos = Math.cos(rot) * s;
    const sin = Math.sin(rot) * s;
    const a = cos * t.a - sin * t.b;
    const b = sin * t.a + cos * t.b;
    const c = cos * t.c - sin * t.d;
    const d = sin * t.c + cos * t.d;
    const dx = t.e - t.cx;
    const dy = t.f - t.cy;
    target.setTransform(
      a,
      b,
      c,
      d,
      cos * dx - sin * dy + t.cx,
      sin * dx + cos * dy + t.cy,
    );
    target.globalAlpha = alpha;
    target.fillStyle = fill;
    target.fill(path);
  };

  // Settled tiles are baked into `layer` once instead of being redrawn every frame.
  const byCover = [...tiles].sort((p, q) => p.coverAt - q.coverAt);
  const byReveal = [...tiles].sort((p, q) => p.revealAt - q.revealAt);
  const settleTime = POP > GLOW ? POP : GLOW;
  const coverEnd = byCover[byCover.length - 1].coverAt + settleTime;

  const revealEnd = byReveal[byReveal.length - 1].revealAt + FADE;

  let baked = 0; // byCover[0..baked) are drawn into the layer
  let cut = 0; // byReveal[0..cut) have their hole cut out of the layer
  let done = 0; // byReveal[0..done) have finished fading

  const coverFrame = (t: number) => {
    while (baked < byCover.length && t >= byCover[baked].coverAt + settleTime) {
      const tile = byCover[baked++];
      draw(lctx, rounded, tile, 1, 0, tile.shades[SHADES], 1);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Grout closes the gaps between tiles as the last ones land.
    const groutAlpha = clamp01((t - coverEnd + GROUT) / GROUT);
    if (groutAlpha > 0) {
      ctx.globalAlpha = groutAlpha;
      ctx.fillStyle = look.grout;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(layer, 0, 0);
    for (let i = baked; i < byCover.length; i++) {
      const tile = byCover[i];
      const p = (t - tile.coverAt) / POP;
      if (p <= 0) break;
      const pop = clamp01(p);
      const shade = Math.round(clamp01((t - tile.coverAt) / GLOW) * SHADES);
      draw(
        ctx,
        moving,
        tile,
        0.35 + 0.65 * easeOutBack(pop),
        tile.spin * (1 - pop),
        tile.shades[shade],
        clamp01(pop * 2.5),
      );
    }
  };

  const revealFrame = (t: number) => {
    // When a tile starts to dissolve, cut it and its surrounding grout out of
    // the mosaic once; the moving copy is drawn on top until it is gone.
    lctx.globalCompositeOperation = "destination-out";
    while (cut < byReveal.length && t >= byReveal[cut].revealAt) {
      draw(lctx, moving, byReveal[cut++], 1.2, 0, "#000", 1);
    }
    lctx.globalCompositeOperation = "source-over";
    while (done < cut && t >= byReveal[done].revealAt + FADE) done++;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Fade out any grout slivers the cut-outs missed over the last frames.
    ctx.globalAlpha = 1 - clamp01((t - revealEnd + 120) / 120);
    ctx.drawImage(layer, 0, 0);
    for (let i = done; i < cut; i++) {
      const tile = byReveal[i];
      const out = easeInCubic(clamp01((t - tile.revealAt) / FADE));
      if (out >= 1) continue;
      draw(
        ctx,
        moving,
        tile,
        1 - 0.45 * out,
        -tile.spin * out,
        tile.shades[SHADES],
        1 - out,
      );
    }
  };

  try {
    let start = await nextFrame();
    for (;;) {
      const t = (await nextFrame()) - start;
      coverFrame(t);
      if (t >= coverEnd + HOLD) break;
    }
    // From here on the mosaic is static: keep the grout in the layer.
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalAlpha = 1;
    lctx.globalCompositeOperation = "destination-over";
    lctx.fillStyle = look.grout;
    lctx.fillRect(0, 0, layer.width, layer.height);
    lctx.globalCompositeOperation = "source-over";

    // The theme switch re-lays out and repaints the page. Keep the mosaic
    // still until that has landed so the reveal does not skip frames.
    await apply();
    await nextFrame();
    // Restart the clock so the reveal begins at t = 0 however long that took.
    start = await nextFrame();
    for (;;) {
      const t = (await nextFrame()) - start;
      revealFrame(t);
      if (t >= revealEnd) break;
    }
  } finally {
    canvas.remove();
  }
}
