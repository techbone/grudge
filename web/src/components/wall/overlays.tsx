"use client";

import type * as PIXI from "pixi.js";
import { ScarArt, ScarFilterDefs } from "../scars/art";
import type { PortraitScar } from "../scars/portrait";
import { toSvg } from "../scars/to-svg";

/**
 * The same scar art as the portraits, rendered to a standalone SVG for a Wall tile texture.
 * SVG-as-image can't see page CSS variables, so font references are swapped for real names.
 */
export function overlaySvg(scars: PortraitScar[], skin?: string) {
  const markup = toSvg(
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="256" height="256">
      <ScarFilterDefs />
      {scars.map((s) => (
        <ScarArt key={s.seed} {...s} skin={skin} />
      ))}
    </svg>,
  );
  return markup
    .replace(/var\(--font-permanent-marker\)/g, "'Permanent Marker'")
    .replace(/var\(--font-bricolage\)/g, "'Bricolage Grotesque'");
}

export async function overlayTexture(P: typeof PIXI, svg: string) {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  return P.Texture.from(img);
}
