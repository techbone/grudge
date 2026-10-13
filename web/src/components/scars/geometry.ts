// Shared geometry for scars. Everything lives in a 1000×1000 box laid over the Chog art.
// Anchors come from sampling the collection: hats fill the top ~38%, eyes sit near
// y≈460 at x≈350 and x≈790, mouths around y≈640.

export type Pt = readonly [number, number];

export const FACE = {
  eyeL: [350, 470] as Pt,
  eyeR: [790, 455] as Pt,
  mouth: [600, 650] as Pt,
  cheekL: [290, 600] as Pt,
  cheekR: [870, 580] as Pt,
  forehead: [580, 390] as Pt,
  brimY: 400,
};

export const INK = "#151310";
export const PAPER = "#f6f1e7";
export const SPRAY = ["#ff2e88", "#b8ff2e", "#ff5a1f", "#22d3ee", "#fde047"] as const;
export const PAYBACK_RED = "#e11d2a";

/** Deterministic PRNG so a scar looks the same on every render and for every viewer. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function scarSeed(by: number, kind: number, at: number, target: number) {
  let h = 2166136261;
  for (const n of [by, kind, at, target]) {
    h ^= n;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const between = (r: () => number, lo: number, hi: number) => lo + (hi - lo) * r();
export const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];

/** Irregular blob: a closed path of `lobes` bumps around (cx, cy). */
export function blobPath(r: () => number, cx: number, cy: number, radius: number, lobes = 12, wobble = 0.35) {
  const pts: Pt[] = [];
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2;
    const rr = radius * (1 - wobble / 2 + wobble * r());
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return smoothClosed(pts);
}

/** Scalloped cloud outline around an ellipse. */
export function cloudPath(r: () => number, cx: number, cy: number, rx: number, ry: number, bumps = 9) {
  let d = "";
  for (let i = 0; i <= bumps; i++) {
    const a = (i / bumps) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    if (i === 0) d += `M${x.toFixed(1)},${y.toFixed(1)}`;
    else {
      const br = between(r, 0.42, 0.62) * ((rx + ry) / bumps) * 2.2;
      d += ` A${br.toFixed(1)},${br.toFixed(1)} 0 0 1 ${x.toFixed(1)},${y.toFixed(1)}`;
    }
  }
  return d + "Z";
}

/** Catmull-Rom through points, closed, as cubic béziers. */
export function smoothClosed(pts: Pt[]) {
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + "Z";
}

/** Torn-paper edge along the bottom of the hat region. */
export function tornPatchPath(r: () => number, brimY: number) {
  let d = `M-10,-10 L1010,-10 L1010,${brimY - 30}`;
  const steps = 22;
  for (let i = steps; i >= 0; i--) {
    const x = (i / steps) * 1020 - 10;
    const y = brimY + Math.sin(i * 0.9) * 18 + between(r, -14, 14) - (i / steps) * 40;
    d += ` L${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return d + "Z";
}

/** Skin trait → fill for drawn-on body parts (bald heads). */
export function skinColor(skin?: string) {
  const s = (skin || "").toLowerCase();
  if (s.includes("dark") || s.includes("brown") || s.includes("black")) return "#5a3b2a";
  if (s.includes("tan")) return "#c48e63";
  if (s.includes("pink")) return "#f6dfe0";
  if (s.includes("green") || s.includes("zombie")) return "#a9d28c";
  if (s.includes("blue")) return "#a7c7f2";
  if (s.includes("gold")) return "#e8c35a";
  return "#f3ead8";
}
