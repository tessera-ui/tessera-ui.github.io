/*!
 * Substitution tiling for the "hat" aperiodic monotile.
 *
 * Ported from hatviz by Craig S. Kaplan, BSD-3-Clause:
 * https://github.com/isohedral/hatviz
 * @license Copyright (c) 2023, Craig S. Kaplan. All rights reserved.
 */

export type Mat = [number, number, number, number, number, number];
export type HatLabel = "H1" | "H" | "T" | "P" | "F";

export interface Hat {
  /** Affine transform from hat space to tiling space. */
  m: Mat;
  label: HatLabel;
  /** Centroid in tiling space. */
  cx: number;
  cy: number;
}

interface Pt {
  x: number;
  y: number;
}

const HR3 = Math.sqrt(3) / 2;
const IDENT: Mat = [1, 0, 0, 0, 1, 0];

const pt = (x: number, y: number): Pt => ({ x, y });
const hexPt = (x: number, y: number) => pt(x + 0.5 * y, HR3 * y);
const padd = (p: Pt, q: Pt) => pt(p.x + q.x, p.y + q.y);
const psub = (p: Pt, q: Pt) => pt(p.x - q.x, p.y - q.y);

function inv(t: Mat): Mat {
  const det = t[0] * t[4] - t[1] * t[3];
  return [
    t[4] / det,
    -t[1] / det,
    (t[1] * t[5] - t[2] * t[4]) / det,
    -t[3] / det,
    t[0] / det,
    (t[2] * t[3] - t[0] * t[5]) / det,
  ];
}

export function mul(a: Mat, b: Mat): Mat {
  return [
    a[0] * b[0] + a[1] * b[3],
    a[0] * b[1] + a[1] * b[4],
    a[0] * b[2] + a[1] * b[5] + a[2],
    a[3] * b[0] + a[4] * b[3],
    a[3] * b[1] + a[4] * b[4],
    a[3] * b[2] + a[4] * b[5] + a[5],
  ];
}

const trot = (ang: number): Mat => {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [c, -s, 0, s, c, 0];
};
const ttrans = (tx: number, ty: number): Mat => [1, 0, tx, 0, 1, ty];
const rotAbout = (p: Pt, ang: number) =>
  mul(ttrans(p.x, p.y), mul(trot(ang), ttrans(-p.x, -p.y)));
const transPt = (m: Mat, p: Pt) =>
  pt(m[0] * p.x + m[1] * p.y + m[2], m[3] * p.x + m[4] * p.y + m[5]);
const matchSeg = (p: Pt, q: Pt): Mat => [
  q.x - p.x,
  p.y - q.y,
  p.x,
  q.y - p.y,
  q.x - p.x,
  p.y,
];
const matchTwo = (p1: Pt, q1: Pt, p2: Pt, q2: Pt) =>
  mul(matchSeg(p2, q2), inv(matchSeg(p1, q1)));

function intersect(p1: Pt, q1: Pt, p2: Pt, q2: Pt) {
  const d = (q2.y - p2.y) * (q1.x - p1.x) - (q2.x - p2.x) * (q1.y - p1.y);
  const ua =
    ((q2.x - p2.x) * (p1.y - p2.y) - (q2.y - p2.y) * (p1.x - p2.x)) / d;
  return pt(p1.x + ua * (q1.x - p1.x), p1.y + ua * (q1.y - p1.y));
}

export const HAT_OUTLINE: Pt[] = [
  hexPt(0, 0),
  hexPt(-1, -1),
  hexPt(0, -2),
  hexPt(2, -2),
  hexPt(2, -1),
  hexPt(4, -2),
  hexPt(5, -1),
  hexPt(4, 0),
  hexPt(3, 0),
  hexPt(2, 2),
  hexPt(0, 3),
  hexPt(0, 2),
  hexPt(-1, 2),
];

const HAT_CENTROID = HAT_OUTLINE.reduce(
  (acc, p) => pt(acc.x + p.x / HAT_OUTLINE.length, acc.y + p.y / HAT_OUTLINE.length),
  pt(0, 0),
);

/**
 * The hat outline in the same coordinates as `HAT_OUTLINE`, inset and with
 * rounded corners so neighbouring tiles read as mosaic pieces with grout.
 * Matches the tile used by Tessera's social preview artwork.
 */
export const HAT_TILE_PATH =
  "M0.12 1.41L0.12 0A0.12 0.12 0 0 0 0.06 -0.11L-1.16 -0.81A0.2 0.2 0 0 1 -1.23 -1.08L-0.99 -1.51A0.2 0.2 0 0 1 -0.82 -1.61L0.82 -1.61A0.2 0.2 0 0 1 0.99 -1.51L1.4 -0.8A0.12 0.12 0 0 0 1.56 -0.76L2.9 -1.53A0.2 0.2 0 0 1 3.1 -1.53L4.16 -0.92A0.2 0.2 0 0 1 4.23 -0.65L3.99 -0.22A0.2 0.2 0 0 1 3.82 -0.12L3 -0.12A0.12 0.12 0 0 0 2.88 0L2.88 1.55A0.2 0.2 0 0 1 2.78 1.72L1.72 2.33A0.2 0.2 0 0 1 1.45 2.26L1.11 1.67A0.12 0.12 0 0 0 1 1.61L0.32 1.61A0.2 0.2 0 0 1 0.12 1.41Z";

class HatGeom {
  constructor(readonly label: HatLabel) {}
}

class MetaTile {
  children: { t: Mat; geom: MetaTile | HatGeom }[] = [];

  constructor(public shape: Pt[]) {}

  add(t: Mat, geom: MetaTile | HatGeom) {
    this.children.push({ t, geom });
  }

  childShape(n: number) {
    return (this.children[n].geom as MetaTile).shape;
  }

  evalChild(n: number, i: number) {
    return transPt(this.children[n].t, this.childShape(n)[i]);
  }

  recentre() {
    let cx = 0;
    let cy = 0;
    for (const p of this.shape) {
      cx += p.x;
      cy += p.y;
    }
    cx /= this.shape.length;
    cy /= this.shape.length;
    this.shape = this.shape.map((p) => pt(p.x - cx, p.y - cy));
    const m = ttrans(-cx, -cy);
    for (const ch of this.children) ch.t = mul(m, ch.t);
  }
}

const H1_HAT = new HatGeom("H1");
const H_HAT = new HatGeom("H");
const T_HAT = new HatGeom("T");
const P_HAT = new HatGeom("P");
const F_HAT = new HatGeom("F");

function initialTiles(): MetaTile[] {
  const hOutline = [
    pt(0, 0),
    pt(4, 0),
    pt(4.5, HR3),
    pt(2.5, 5 * HR3),
    pt(1.5, 5 * HR3),
    pt(-0.5, HR3),
  ];
  const h = new MetaTile(hOutline);
  h.add(matchTwo(HAT_OUTLINE[5], HAT_OUTLINE[7], hOutline[5], hOutline[0]), H_HAT);
  h.add(matchTwo(HAT_OUTLINE[9], HAT_OUTLINE[11], hOutline[1], hOutline[2]), H_HAT);
  h.add(matchTwo(HAT_OUTLINE[5], HAT_OUTLINE[7], hOutline[3], hOutline[4]), H_HAT);
  h.add(
    mul(ttrans(2.5, HR3), mul([-0.5, -HR3, 0, HR3, -0.5, 0], [0.5, 0, 0, 0, -0.5, 0])),
    H1_HAT,
  );

  const t = new MetaTile([pt(0, 0), pt(3, 0), pt(1.5, 3 * HR3)]);
  t.add([0.5, 0, 0.5, 0, 0.5, HR3], T_HAT);

  const flipped = mul(
    ttrans(0, 2 * HR3),
    mul([0.5, HR3, 0, -HR3, 0.5, 0], [0.5, 0, 0, 0, 0.5, 0]),
  );

  const p = new MetaTile([pt(0, 0), pt(4, 0), pt(3, 2 * HR3), pt(-1, 2 * HR3)]);
  p.add([0.5, 0, 1.5, 0, 0.5, HR3], P_HAT);
  p.add(flipped, P_HAT);

  const f = new MetaTile([
    pt(0, 0),
    pt(3, 0),
    pt(3.5, HR3),
    pt(3, 2 * HR3),
    pt(-1, 2 * HR3),
  ]);
  f.add([0.5, 0, 1.5, 0, 0.5, HR3], F_HAT);
  f.add(flipped, F_HAT);

  return [h, t, p, f];
}

type Rule = (number | string)[];

const PATCH_RULES: Rule[] = [
  ["H"],
  [0, 0, "P", 2],
  [1, 0, "H", 2],
  [2, 0, "P", 2],
  [3, 0, "H", 2],
  [4, 4, "P", 2],
  [0, 4, "F", 3],
  [2, 4, "F", 3],
  [4, 1, 3, 2, "F", 0],
  [8, 3, "H", 0],
  [9, 2, "P", 0],
  [10, 2, "H", 0],
  [11, 4, "P", 2],
  [12, 0, "H", 2],
  [13, 0, "F", 3],
  [14, 2, "F", 1],
  [15, 3, "H", 4],
  [8, 2, "F", 1],
  [17, 3, "H", 0],
  [18, 2, "P", 0],
  [19, 2, "H", 2],
  [20, 4, "F", 3],
  [20, 0, "P", 2],
  [22, 0, "H", 2],
  [23, 4, "F", 3],
  [23, 0, "F", 3],
  [16, 0, "P", 2],
  [9, 4, 0, 2, "T", 2],
  [4, 0, "F", 3],
];

function constructPatch([h, t, p, f]: MetaTile[]) {
  const shapes: Record<string, MetaTile> = { H: h, T: t, P: p, F: f };
  const ret = new MetaTile([]);

  for (const r of PATCH_RULES) {
    if (r.length === 1) {
      ret.add(IDENT, shapes[r[0] as string]);
    } else if (r.length === 4) {
      const [a, ai, kind, ki] = r as [number, number, string, number];
      const poly = ret.childShape(a);
      const m = ret.children[a].t;
      const P = transPt(m, poly[(ai + 1) % poly.length]);
      const Q = transPt(m, poly[ai]);
      const next = shapes[kind];
      const np = next.shape;
      ret.add(matchTwo(np[ki], np[(ki + 1) % np.length], P, Q), next);
    } else {
      const [a, ai, b, bi, kind, ki] = r as [number, number, number, number, string, number];
      const P = ret.evalChild(b, bi);
      const Q = ret.evalChild(a, ai);
      const next = shapes[kind];
      const np = next.shape;
      ret.add(matchTwo(np[ki], np[(ki + 1) % np.length], P, Q), next);
    }
  }

  return ret;
}

function constructMetatiles(patch: MetaTile): MetaTile[] {
  const bps1 = patch.evalChild(8, 2);
  const bps2 = patch.evalChild(21, 2);
  const rbps = transPt(rotAbout(bps1, (-2 * Math.PI) / 3), bps2);

  const p72 = patch.evalChild(7, 2);
  const p252 = patch.evalChild(25, 2);

  const llc = intersect(bps1, rbps, patch.evalChild(6, 2), p72);
  let w = psub(patch.evalChild(6, 2), llc);

  const hOutline = [llc, bps1];
  w = transPt(trot(-Math.PI / 3), w);
  hOutline.push(padd(hOutline[1], w));
  hOutline.push(patch.evalChild(14, 2));
  w = transPt(trot(-Math.PI / 3), w);
  hOutline.push(psub(hOutline[3], w));
  hOutline.push(patch.evalChild(6, 2));

  const take = (outline: Pt[], ids: number[]) => {
    const meta = new MetaTile(outline);
    for (const id of ids) meta.add(patch.children[id].t, patch.children[id].geom);
    return meta;
  };

  const h = take(hOutline, [0, 9, 16, 27, 26, 6, 1, 8, 10, 15]);
  const p = take([p72, padd(p72, psub(bps1, llc)), bps1, llc], [7, 2, 3, 4, 28]);
  const f = take(
    [
      bps2,
      patch.evalChild(24, 2),
      patch.evalChild(25, 0),
      p252,
      padd(p252, psub(llc, bps1)),
    ],
    [21, 20, 22, 23, 24, 25],
  );

  const aaa = hOutline[2];
  const bbb = padd(hOutline[1], psub(hOutline[4], hOutline[5]));
  const ccc = transPt(rotAbout(bbb, -Math.PI / 3), aaa);
  const t = take([bbb, ccc, aaa], [11]);

  for (const tile of [h, p, f, t]) tile.recentre();
  return [h, t, p, f];
}

/**
 * Builds a patch of hats by applying `levels` rounds of substitution to the
 * H metatile. Each round multiplies the hat count by roughly 6.85.
 */
export function hatTiling(levels: number): Hat[] {
  let tiles = initialTiles();
  for (let i = 0; i < levels; i++) tiles = constructMetatiles(constructPatch(tiles));

  const hats: Hat[] = [];
  const walk = (geom: MetaTile | HatGeom, m: Mat) => {
    if (geom instanceof HatGeom) {
      const c = transPt(m, HAT_CENTROID);
      hats.push({ m, label: geom.label, cx: c.x, cy: c.y });
      return;
    }
    for (const ch of geom.children) walk(ch.geom, mul(m, ch.t));
  };
  walk(tiles[0], IDENT);
  return hats;
}
