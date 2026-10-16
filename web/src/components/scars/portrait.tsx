"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";
import { ScarArt } from "./art";
import { playScene } from "./scene";

export type PortraitScar = { kind: number; seed: number; by: number; heavy: boolean };

type Props = {
  id: number;
  skin?: string;
  scars: PortraitScar[];
  /** A prank to animate on top of the existing scars. */
  scene?: PortraitScar | null;
  onSceneDone?: () => void;
  className?: string;
  /** Idle animation and cursor-following googly eyes. Off for small thumbnails. */
  alive?: boolean;
};

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Portrait({ id, skin, scars, scene, onSceneDone, className = "", alive = true }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const sceneG = useRef<SVGGElement>(null);
  const doneRef = useRef(onSceneDone);
  useEffect(() => {
    doneRef.current = onSceneDone;
  }, [onSceneDone]);
  const src = `/chogs/384/${id}.webp`;

  // Idle life: buzzing flies, flapping wings, breathing clouds.
  const scarKey = scars.map((s) => s.seed).join(",");
  useEffect(() => {
    if (!alive || !svg.current || reducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<SVGGElement>('[data-idle="fly"] > g').forEach((f) => {
        gsap.to(f, { x: "random(-34,34)", y: "random(-26,26)", duration: "random(0.25,0.6)", repeat: -1, repeatRefresh: true, ease: "sine.inOut" });
      });
      gsap.to('[data-a="wing"]', { scaleY: 0.25, transformOrigin: "50% 100%", duration: 0.045, repeat: -1, yoyo: true, ease: "none" });
      gsap.utils.toArray<SVGGElement>('[data-a="cloud"]').forEach((c, i) => {
        gsap.to(c, { scale: 1.035, transformOrigin: "50% 60%", duration: 1.6 + i * 0.3, repeat: -1, yoyo: true, ease: "sine.inOut" });
      });
    }, svg);
    return () => ctx.revert();
  }, [alive, scarKey, scene]);

  // Googly pupils chase the cursor.
  useEffect(() => {
    const el = svg.current;
    if (!alive || !el) return;
    const pupils = Array.from(el.querySelectorAll<SVGGElement>('[data-scar="4"] [data-a="pupil"]'));
    if (!pupils.length) return;
    const movers = pupils.map((p) => {
      const eye = p.parentNode as SVGGElement;
      const m = eye.transform.baseVal.consolidate()?.matrix;
      const max = Number(p.dataset.r ?? 40) * 0.9;
      return {
        cx: m?.e ?? 0,
        cy: m?.f ?? 0,
        max,
        x: gsap.quickTo(p, "x", { duration: 0.6, ease: "elastic.out(1,0.35)" }),
        y: gsap.quickTo(p, "y", { duration: 0.6, ease: "elastic.out(1,0.35)" }),
      };
    });
    const onMove = (e: PointerEvent) => {
      const ctm = el.getScreenCTM();
      if (!ctm) return;
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      movers.forEach((m) => {
        const dx = pt.x - m.cx;
        const dy = pt.y - m.cy;
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(m.max, d * 0.25) / d;
        m.x(dx * k);
        m.y(dy * k);
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [alive, scarKey, scene]);

  // The prank itself.
  useEffect(() => {
    if (!scene || !sceneG.current) return;
    const ctx = gsap.context(() => {
      const tl = playScene(sceneG.current!, scene.kind, scene.heavy, wrap.current, reducedMotion());
      tl.eventCallback("onComplete", () => doneRef.current?.());
    });
    return () => ctx.revert();
  }, [scene]);

  return (
    <div ref={wrap} className={`relative aspect-square overflow-hidden ${className}`}>
      <svg ref={svg} viewBox="0 0 1000 1000" className="block h-full w-full" role="img" aria-label={`Chog #${id}`}>
        <image href={src} width={1000} height={1000} />
        {scars.map((s) => (
          <ScarArt key={s.seed} {...s} skin={skin} />
        ))}
        {scene && (
          <g ref={sceneG} key={`scene-${scene.seed}`}>
            <ScarArt {...scene} skin={skin} scene src={src} />
          </g>
        )}
      </svg>
    </div>
  );
}
