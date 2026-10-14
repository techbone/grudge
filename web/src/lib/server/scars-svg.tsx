import { ScarArt, ScarFilterDefs } from "@/components/scars/art";
import type { PortraitScar } from "@/components/scars/portrait";
import { toSvg } from "@/components/scars/to-svg";

/** Scar overlay as a standalone SVG string (server side), same art as the portraits. */
export function scarsSvg(scars: PortraitScar[], skin: string | undefined, size: number) {
  const markup = toSvg(
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width={size} height={size}>
      <ScarFilterDefs />
      {scars.map((s) => (
        <ScarArt key={s.seed} {...s} skin={skin} />
      ))}
    </svg>,
  );
  return markup.replace(/var\(--font-permanent-marker\)/g, "'Permanent Marker'").replace(/var\(--font-bricolage\)/g, "'Bricolage Grotesque'");
}
