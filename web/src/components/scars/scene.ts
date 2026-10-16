"use client";

import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { sfx } from "@/lib/sfx";

gsap.registerPlugin(DrawSVGPlugin, MotionPathPlugin);

type El = Element | null | undefined;

let spin = 1; // 0 when calm: tomatoes fly straight instead of tumbling

function shake(tl: gsap.core.Timeline, el: El, at: gsap.Position, power = 14) {
  if (!el) return;
  tl.to(el, { x: `random(-${power},${power})`, y: `random(-${power * 0.7},${power * 0.7})`, duration: 0.04, repeat: 7, yoyo: true, ease: "none" }, at);
  tl.set(el, { x: 0, y: 0 });
}

/**
 * Builds the animated prank on a freshly mounted <ScarArt scene /> group. Most tweens are
 * `from` tweens, so the scar ends exactly in its static, permanent pose.
 */
/**
 * `calm` is for people who asked their device to reduce motion. The prank still plays, because
 * it's the point of the app, but without screen shake, wobble or spinning.
 */
export function playScene(root: SVGGElement, kind: number, heavy: boolean, shakeTarget?: HTMLElement | null, calm = false) {
  const q = gsap.utils.selector(root);
  const tl = gsap.timeline();
  const shakeEl = calm ? null : shakeTarget;
  spin = calm ? 0 : 1;

  if (kind === 0) graffiti(tl, q, shakeEl);
  else if (kind === 1) hatSteal(tl, q, shakeEl);
  else if (kind === 2) stink(tl, q, shakeEl);
  else if (kind === 3) tomato(tl, q, shakeEl);
  else if (kind === 4) googly(tl, q, shakeEl);

  if (heavy) {
    const stamp = q('[data-a="stamp"]');
    tl.from(stamp, { scale: 3.4, opacity: 0, rotation: "-=20", duration: 0.3, ease: "power4.in", transformOrigin: "50% 50%" }, "+=0.1");
    tl.call(() => sfx.stamp());
    shake(tl, shakeEl, ">", 22);
  }
  return tl;
}

type Q = (s: string) => Element[];

function graffiti(tl: gsap.core.Timeline, q: Q, shakeEl?: HTMLElement | null) {
  const strokes = q('[data-a="stroke"]');
  const drips = q('[data-a="drip"]');
  const can = q('[data-a="can"]')[0];
  const wipe = q('[data-a="tag-wipe"]');

  tl.set(strokes, { drawSVG: "0%" });
  tl.set(drips, { scaleY: 0, transformOrigin: "50% 0%" });
  tl.set(wipe, { attr: { width: 0 } });
  tl.set(can, { opacity: 1, x: 1200, y: 200, rotation: -25 });

  tl.call(() => sfx.rattle());
  tl.to(can, { rotation: -10, duration: 0.08, repeat: 3, yoyo: true, ease: "none" });

  strokes.forEach((s, i) => {
    const len = (s as SVGPathElement).getTotalLength?.() ?? 400;
    const d = Math.min(0.85, Math.max(0.28, len / 900));
    const at = `s${i}`;
    tl.addLabel(at, i === 0 ? ">" : ">+0.05");
    tl.call(() => sfx.spray(d), [], at);
    tl.to(can, { motionPath: { path: s as SVGPathElement, align: s as SVGPathElement, alignOrigin: [0.1, 0.02] }, rotation: 0, duration: d, ease: "none" }, at);
    tl.to(s, { drawSVG: "100%", duration: d, ease: "none" }, at);
  });

  tl.to(can, { x: "+=380", y: "-=320", rotation: 50, opacity: 0, duration: 0.4, ease: "power2.in" });
  tl.call(() => sfx.spray(0.45), [], "<");
  tl.to(wipe, { attr: { width: 700 }, duration: 0.45, ease: "steps(7)" }, "<");
  tl.to(drips, { scaleY: 1, duration: 1.2, ease: "power1.in", stagger: 0.18 }, "<0.1");
  shake(tl, shakeEl, "<", 4);
}

function hatSteal(tl: gsap.core.Timeline, q: Q, shakeEl?: HTMLElement | null) {
  const hand = q('[data-a="hand"]')[0];
  const fingers = q('[data-a="fingers"]');
  const hat = q('[data-a="hatpiece"]');
  const tape = q('[data-a="tape"] rect');
  const stolen = q('[data-a="stolen"]');
  const shine = q('[data-a="shine"]');
  const ghost = q('[data-a="ghost"]');

  tl.set(hand, { opacity: 1, x: 1250, y: -320, rotation: -35 });
  tl.set(fingers, { transformOrigin: "50% 0%" });

  tl.call(() => sfx.whoosh());
  tl.to(hand, { x: 640, y: 230, rotation: 0, duration: 0.5, ease: "back.out(1.7)" });
  tl.to(fingers, { scaleY: 0.5, duration: 0.1, ease: "power2.in" });
  tl.call(() => sfx.pop());
  tl.call(() => sfx.rip(), [], "+=0.05");
  tl.to([hand, ...hat], { x: "+=16", y: "-=6", duration: 0.05, repeat: 7, yoyo: true, ease: "none" });
  tl.addLabel("yank");
  tl.call(() => sfx.whoosh(), [], "yank");
  tl.to(hand, { x: "+=420", y: "-=980", rotation: 30, duration: 0.55, ease: "power3.in" }, "yank");
  tl.to(hat, { x: "+=420", y: "-=980", rotation: 28, transformOrigin: "50% 30%", duration: 0.55, ease: "power3.in" }, "yank");
  shake(tl, shakeEl, "yank+=0.1", 8);
  tl.from(ghost, { opacity: 0, y: "+=40", duration: 0.4 }, "yank+=0.3");
  tl.from(tape, { opacity: 0, scale: 1.8, duration: 0.22, ease: "back.out(3)", stagger: 0.14, transformOrigin: "50% 50%" }, "yank+=0.45");
  tl.call(() => sfx.thud(), [], "yank+=0.5");
  tl.call(() => sfx.thud(), [], "yank+=0.64");
  tl.from(shine, { opacity: 0, scale: 0.4, transformOrigin: "50% 50%", duration: 0.25, stagger: 0.08 }, ">");
  tl.call(() => sfx.ding(), [], "<");
  tl.from(stolen, { opacity: 0, scale: 0.5, rotation: -20, transformOrigin: "0% 50%", duration: 0.4, ease: "back.out(2.2)" }, ">-0.05");
}

function stink(tl: gsap.core.Timeline, q: Q, shakeEl?: HTMLElement | null) {
  const clouds = q('[data-a="cloud"]');
  const haze = q('[data-a="haze"]');
  const waves = q('[data-a="wave"]');
  const flies = q('[data-a="fly"]');

  tl.from(clouds, { scale: 0, opacity: 0, transformOrigin: "50% 60%", duration: 0.7, ease: "elastic.out(1,0.45)", stagger: 0.14 });
  clouds.forEach((_, i) => tl.call(() => sfx.puff(), [], i * 0.14));
  tl.from(haze, { opacity: 0, duration: 1 }, 0.1);
  tl.from(waves, { drawSVG: "0% 0%", duration: 0.8, stagger: 0.12, ease: "power1.inOut" }, 0.35);
  tl.from(flies, { x: () => `+=${gsap.utils.random(-700, 700)}`, y: () => `-=${gsap.utils.random(300, 700)}`, opacity: 0, duration: 1.1, ease: "power2.out", stagger: 0.15 }, 0.5);
  tl.call(() => sfx.buzz(1.6), [], 0.5);
  if (shakeEl) tl.to(shakeEl, { rotation: 1.6, duration: 0.12, repeat: 5, yoyo: true, ease: "sine.inOut" }, 0.4).set(shakeEl, { rotation: 0 });
}

function tomato(tl: gsap.core.Timeline, q: Q, shakeEl?: HTMLElement | null) {
  const t = q('[data-a="tomato"]')[0] as SVGGElement | undefined;
  const splat = q('[data-a="splat"]');
  const drops = q('[data-a="drop"]');
  const tdrips = q('[data-a="tdrip"]');
  if (!t) return;
  const tx = Number(t.dataset.tx);
  const ty = Number(t.dataset.ty);

  // Thrown from the camera: starts huge at the bottom edge and shrinks onto the face.
  tl.set(t, { opacity: 1, x: 520, y: 1180, scale: 3.4, rotation: 0, transformOrigin: "50% 50%" });
  tl.call(() => sfx.whoosh());
  tl.to(t, {
    motionPath: { path: [{ x: 520, y: 1180 }, { x: (tx + 520) / 2, y: Math.max(170, ty - 280) }, { x: tx, y: ty }], curviness: 1.1 },
    scale: 1,
    rotation: 540 * spin,
    duration: 0.6,
    ease: "power2.in",
  });
  tl.addLabel("hit");
  tl.to(t, { scaleX: 1.9, scaleY: 0.25, opacity: 0, duration: 0.07 }, "hit");
  tl.call(() => sfx.splat(), [], "hit");
  tl.from(splat, { scale: 0.12, svgOrigin: `${tx} ${ty}`, duration: 0.55, ease: "elastic.out(1,0.42)" }, "hit");
  tl.from(drops, { attr: { cx: tx, cy: ty }, opacity: 0, duration: 0.45, ease: "expo.out", stagger: 0.008 }, "hit");
  tl.from(tdrips, { scaleY: 0, transformOrigin: "50% 0%", duration: 1.8, ease: "sine.in", stagger: 0.22 }, "hit+=0.25");
  shake(tl, shakeEl, "hit", 18);
}

function googly(tl: gsap.core.Timeline, q: Q, shakeEl?: HTMLElement | null) {
  const eyes = q('[data-a="eye"]');
  const pupils = q('[data-a="pupil"]');

  tl.from(eyes, { y: "-=760", duration: 0.75, ease: "bounce.out", stagger: 0.2 });
  tl.call(() => sfx.pop(), [], 0.4);
  tl.call(() => sfx.pop(), [], 0.6);
  tl.from(eyes, { scaleY: 0.7, scaleX: 1.15, transformOrigin: "50% 100%", duration: 0.35, ease: "elastic.out(1,0.3)", stagger: 0.2 }, 0.42);
  tl.from(pupils, { x: () => `+=${gsap.utils.random(-50, 50)}`, y: "-=70", rotation: 240, duration: 1.4, ease: "elastic.out(1.2,0.22)", stagger: 0.1 }, 0.55);
  tl.call(() => sfx.boing(), [], 0.6);
  shake(tl, shakeEl, 0.42, 5);
}
