"use client";

import gsap from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import type * as PIXI from "pixi.js";

gsap.registerPlugin(MotionPathPlugin);

export const COLS = 45;
export const TILE = 128;
export const GAP = 12;
const STEP = TILE + GAP;
const MAX_ID = 1969;
const PER_ROW = 16;
const PER_SHEET = PER_ROW * PER_ROW;
const HIRES_AT = 1.3;

export const KIND_COLOR = [0xff2e88, 0x7c5cff, 0x8fcf3c, 0xe2321d, 0xfde047];
const INK = 0x151310;

type Px = typeof PIXI;

export function tileCenter(id: number) {
  const i = id - 1;
  return { x: (i % COLS) * STEP + TILE / 2, y: Math.floor(i / COLS) * STEP + TILE / 2 };
}

/**
 * Pixi scene for the Wall: 1,969 tiles from sprite sheets, pan/zoom camera, scar overlays,
 * and the projectile + impact animation for live pranks.
 */
export class WallScene {
  app!: PIXI.Application;
  private P: Px;
  private world!: PIXI.Container;
  private tiles: PIXI.Sprite[] = [];
  private overlays = new Map<number, PIXI.Sprite>();
  private fx!: PIXI.Container;
  private hover!: PIXI.Graphics;
  private hiRes = new Set<number>();
  private dragging = false;
  private moved = false;
  private last = { x: 0, y: 0 };
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private destroyed = false;
  /** Screen pixels covered by UI (title, Live panel, controls), kept clear by fit and flyTo. */
  insets = { top: 0, right: 0, bottom: 0, left: 0 };
  onTileClick?: (id: number) => void;
  onHover?: (id: number | null, x: number, y: number) => void;

  constructor(P: Px) {
    this.P = P;
  }

  async init(host: HTMLElement) {
    const P = this.P;
    this.app = new P.Application();
    await this.app.init({ resizeTo: host, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(2, window.devicePixelRatio || 1) });
    if (this.destroyed) {
      this.app.destroy(true);
      return;
    }
    host.appendChild(this.app.canvas);
    this.app.canvas.style.touchAction = "none";

    this.world = new P.Container();
    this.app.stage.addChild(this.world);

    // ink frames for every tile, drawn once
    const frames = new P.Graphics();
    for (let id = 1; id <= MAX_ID; id++) {
      const { x, y } = tileCenter(id);
      frames.roundRect(x - TILE / 2 - 3, y - TILE / 2 - 3, TILE + 6, TILE + 6, 10).fill(INK);
    }
    this.world.addChild(frames);

    const sheets = await Promise.all(
      Array.from({ length: Math.ceil(MAX_ID / PER_SHEET) }, (_, n) => P.Assets.load<PIXI.Texture>(`/chogs/atlas-${n}.webp`)),
    );
    for (let id = 1; id <= MAX_ID; id++) {
      const k = (id - 1) % PER_SHEET;
      const sheet = sheets[Math.floor((id - 1) / PER_SHEET)];
      const tex = new P.Texture({ source: sheet.source, frame: new P.Rectangle((k % PER_ROW) * TILE, Math.floor(k / PER_ROW) * TILE, TILE, TILE) });
      const s = new P.Sprite(tex);
      const { x, y } = tileCenter(id);
      s.anchor.set(0.5);
      s.position.set(x, y);
      s.width = s.height = TILE;
      this.world.addChild(s);
      this.tiles[id] = s;
    }

    this.hover = new P.Graphics();
    this.hover.visible = false;
    this.world.addChild(this.hover);
    this.fx = new P.Container();
    this.world.addChild(this.fx);

    this.bindInput();
    this.fit();
  }

  // ───────────── camera ─────────────

  get worldSize() {
    return { w: COLS * STEP, h: Math.ceil(MAX_ID / COLS) * STEP };
  }

  /** The part of the screen not covered by UI. */
  private get view() {
    const { width, height } = this.app.screen;
    const { top, right, bottom, left } = this.insets;
    return { x: left, y: top, w: width - left - right, h: height - top - bottom };
  }

  fit() {
    const v = this.view;
    const { w, h } = this.worldSize;
    const s = Math.min(v.w / w, v.h / h) * 0.96;
    this.world.scale.set(s);
    this.world.position.set(v.x + (v.w - w * s) / 2, v.y + (v.h - h * s) / 2);
  }

  zoomBy(f: number, cx = this.app.screen.width / 2, cy = this.app.screen.height / 2) {
    const s0 = this.world.scale.x;
    const s1 = Math.min(3.2, Math.max(0.08, s0 * f));
    const wx = (cx - this.world.x) / s0;
    const wy = (cy - this.world.y) / s0;
    this.world.scale.set(s1);
    this.world.position.set(cx - wx * s1, cy - wy * s1);
    this.maybeHiRes();
  }

  /** Smoothly fly the camera to a tile. */
  flyTo(id: number, scale = 1.6, duration = 1.1) {
    const { x, y } = tileCenter(id);
    const v = this.view;
    const cam = { s: this.world.scale.x, x: this.world.x, y: this.world.y };
    const target = { s: scale, x: v.x + v.w / 2 - x * scale, y: v.y + v.h / 2 - y * scale };
    return gsap.to(cam, {
      s: target.s,
      x: target.x,
      y: target.y,
      duration,
      ease: "power3.inOut",
      onUpdate: () => {
        this.world.scale.set(cam.s);
        this.world.position.set(cam.x, cam.y);
      },
      onComplete: () => this.maybeHiRes(),
    });
  }

  /** When zoomed in, swap visible tiles to the 384px portraits. */
  private maybeHiRes() {
    if (this.world.scale.x < HIRES_AT) return;
    const P = this.P;
    const { width, height } = this.app.screen;
    const s = this.world.scale.x;
    const x0 = -this.world.x / s, y0 = -this.world.y / s;
    const x1 = x0 + width / s, y1 = y0 + height / s;
    for (let id = 1; id <= MAX_ID; id++) {
      if (this.hiRes.has(id)) continue;
      const { x, y } = tileCenter(id);
      if (x < x0 - TILE || x > x1 + TILE || y < y0 - TILE || y > y1 + TILE) continue;
      this.hiRes.add(id);
      P.Assets.load<PIXI.Texture>(`/chogs/384/${id}.webp`)
        .then((t) => {
          if (this.destroyed) return;
          const sp = this.tiles[id];
          sp.texture = t;
          sp.width = sp.height = TILE;
        })
        .catch(() => this.hiRes.delete(id));
    }
  }

  private bindInput() {
    const c = this.app.canvas;
    const local = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    c.addEventListener("pointerdown", (e) => {
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, local(e));
      this.dragging = true;
      this.moved = false;
      this.last = local(e);
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    c.addEventListener("pointermove", (e) => {
      const p = local(e);
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, p);
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchDist) this.zoomBy(d / this.pinchDist, (a.x + b.x) / 2, (a.y + b.y) / 2);
        this.pinchDist = d;
        this.moved = true;
        return;
      }
      if (this.dragging) {
        const dx = p.x - this.last.x, dy = p.y - this.last.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) this.moved = true;
        this.world.position.set(this.world.x + dx, this.world.y + dy);
        this.last = p;
        this.onHover?.(null, 0, 0);
        this.hover.visible = false;
      } else {
        const id = this.hitTest(p.x, p.y);
        this.showHover(id);
        this.onHover?.(id, e.clientX, e.clientY);
      }
    });
    const up = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchDist = 0;
      if (this.pointers.size === 0) {
        if (this.dragging && !this.moved) {
          const p = local(e);
          const id = this.hitTest(p.x, p.y);
          if (id) this.onTileClick?.(id);
        }
        this.dragging = false;
        this.maybeHiRes();
      }
    };
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);
    c.addEventListener("pointerleave", () => {
      this.hover.visible = false;
      this.onHover?.(null, 0, 0);
    });
    c.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const p = { x: e.offsetX, y: e.offsetY };
        this.zoomBy(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
      },
      { passive: false },
    );
  }

  private hitTest(sx: number, sy: number) {
    const s = this.world.scale.x;
    const wx = (sx - this.world.x) / s, wy = (sy - this.world.y) / s;
    const col = Math.floor(wx / STEP), row = Math.floor(wy / STEP);
    if (col < 0 || col >= COLS || row < 0) return null;
    if (wx - col * STEP > TILE || wy - row * STEP > TILE) return null;
    const id = row * COLS + col + 1;
    return id >= 1 && id <= MAX_ID ? id : null;
  }

  private showHover(id: number | null) {
    this.hover.clear();
    if (!id) {
      this.hover.visible = false;
      return;
    }
    const { x, y } = tileCenter(id);
    this.hover.roundRect(x - TILE / 2 - 7, y - TILE / 2 - 7, TILE + 14, TILE + 14, 12).stroke({ width: 6, color: 0xff5a1f });
    this.hover.visible = true;
  }

  // ───────────── scars ─────────────

  /** Set (or clear, with null) the scar overlay texture for a tile. */
  setOverlay(id: number, tex: PIXI.Texture | null) {
    const old = this.overlays.get(id);
    if (old) {
      old.destroy();
      this.overlays.delete(id);
    }
    if (!tex) return;
    const s = new this.P.Sprite(tex);
    const { x, y } = tileCenter(id);
    s.anchor.set(0.5);
    s.position.set(x, y);
    s.width = s.height = TILE;
    this.world.addChildAt(s, this.world.getChildIndex(this.hover));
    this.overlays.set(id, s);
  }

  // ───────────── live prank animation ─────────────

  /** Projectile from attacker to victim, then impact. Resolves at impact. */
  launch(from: number, to: number, kind: number, heavy: boolean) {
    const P = this.P;
    const a = tileCenter(from);
    const b = tileCenter(to);
    const color = heavy ? 0xe11d2a : KIND_COLOR[kind] ?? 0xff5a1f;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const lift = Math.min(900, 160 + dist * 0.35);

    const ball = new P.Graphics().circle(0, 0, heavy ? 30 : 22).fill(color).stroke({ width: 6, color: INK });
    ball.position.set(a.x, a.y);
    this.fx.addChild(ball);

    const trail: PIXI.Graphics[] = [];
    const duration = Math.min(1.6, 0.55 + dist / 3500);

    return new Promise<void>((resolve) => {
      if (from === to || !from) {
        ball.destroy();
        this.impact(to, color, heavy);
        resolve();
        return;
      }
      this.pulse(from, 0.92);
      gsap.to(ball, {
        motionPath: { path: [{ x: a.x, y: a.y }, { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - lift }, { x: b.x, y: b.y }], curviness: 1.4 },
        duration,
        ease: "power1.inOut",
        onUpdate: () => {
          const dot = new P.Graphics().circle(0, 0, heavy ? 14 : 10).fill({ color, alpha: 0.7 });
          dot.position.set(ball.x, ball.y);
          this.fx.addChildAt(dot, 0);
          trail.push(dot);
          gsap.to(dot, { alpha: 0, duration: 0.5, onComplete: () => dot.destroy() });
          gsap.to(dot.scale, { x: 0.2, y: 0.2, duration: 0.5 });
        },
        onComplete: () => {
          ball.destroy();
          this.impact(to, color, heavy);
          resolve();
        },
      });
    });
  }

  private pulse(id: number, s: number) {
    const t = this.tiles[id];
    if (!t) return;
    const base = t.scale.x;
    gsap.fromTo(t.scale, { x: base * s, y: base * s }, { x: base, y: base, duration: 0.6, ease: "elastic.out(1,0.35)" });
  }

  private impact(id: number, color: number, heavy: boolean) {
    const P = this.P;
    const { x, y } = tileCenter(id);
    const t = this.tiles[id];
    if (t) {
      const base = TILE / t.texture.width;
      gsap.fromTo(t.scale, { x: base * 1.35, y: base * 0.7 }, { x: base, y: base, duration: 0.8, ease: "elastic.out(1,0.3)" });
      gsap.fromTo(t, { rotation: heavy ? -0.25 : -0.12 }, { rotation: 0, duration: 0.9, ease: "elastic.out(1,0.3)" });
    }
    const ring = new P.Graphics().circle(0, 0, TILE * 0.5).stroke({ width: 10, color });
    ring.position.set(x, y);
    this.fx.addChild(ring);
    gsap.to(ring.scale, { x: heavy ? 3.4 : 2.4, y: heavy ? 3.4 : 2.4, duration: 0.6, ease: "expo.out" });
    gsap.to(ring, { alpha: 0, duration: 0.6, ease: "power2.in", onComplete: () => ring.destroy() });

    const n = heavy ? 26 : 16;
    for (let i = 0; i < n; i++) {
      const p = new P.Graphics().circle(0, 0, 6 + Math.random() * 12).fill(i % 3 === 0 ? INK : color);
      p.position.set(x, y);
      this.fx.addChild(p);
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const d = TILE * (0.9 + Math.random() * (heavy ? 1.8 : 1.2));
      gsap.to(p, { x: x + Math.cos(ang) * d, y: y + Math.sin(ang) * d + 40, alpha: 0, duration: 0.7 + Math.random() * 0.4, ease: "expo.out", onComplete: () => p.destroy() });
    }
  }

  destroy() {
    this.destroyed = true;
    gsap.killTweensOf(this.world);
    try {
      this.app?.destroy(true, { children: true });
    } catch {}
  }
}
