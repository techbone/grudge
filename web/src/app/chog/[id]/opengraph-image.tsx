import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { createPublicClient, http, type Address } from "viem";
import { scarSeed } from "@/components/scars/geometry";
import { grudgeAbi } from "@/lib/grudge-abi";
import { getChog } from "@/lib/chogs";
import { scarsSvg } from "@/lib/server/scars-svg";

export const alt = "A Chog's face, with every scar Grudge has left on it";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const isLocal = process.env.NEXT_PUBLIC_CHAIN === "local";
const RPC = isLocal ? "http://127.0.0.1:8545" : process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://rpc.monad.xyz";
const GRUDGE = process.env.NEXT_PUBLIC_GRUDGE_ADDRESS as Address | undefined;
const SITE = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : `http://localhost:${process.env.PORT || 3000}`;

const fonts = Promise.all([
  readFile(join(process.cwd(), "assets/fonts/bricolage-800.ttf")),
  readFile(join(process.cwd(), "assets/fonts/mono.ttf")),
]);

type RawScar = { by: number; kind: number; heavy: boolean; at: number };
type Stats = { landed: number; received: number; notoriety: number };

async function chainState(id: number) {
  if (!GRUDGE) return { scars: [] as RawScar[], stats: undefined };
  const client = createPublicClient({ transport: http(RPC) });
  try {
    const [scars, stats] = await Promise.all([
      client.readContract({ address: GRUDGE, abi: grudgeAbi, functionName: "scars", args: [id] }) as Promise<readonly RawScar[]>,
      client.readContract({ address: GRUDGE, abi: grudgeAbi, functionName: "stats", args: [id] }) as Promise<Stats>,
    ]);
    return { scars: [...scars], stats };
  } catch {
    return { scars: [] as RawScar[], stats: undefined };
  }
}

/** Portrait with its scars baked in, as a PNG data URI (Satori can't draw SVG filters itself). */
async function scarredPortrait(id: number, scars: RawScar[]) {
  const art = await fetch(`${SITE}/chogs/384/${id}.webp`).then((r) => r.arrayBuffer());
  const list = scars
    .filter((s) => s.by !== 0)
    .sort((a, b) => a.at - b.at)
    .map((s) => ({ kind: s.kind, by: s.by, heavy: s.heavy, seed: scarSeed(s.by, s.kind, s.at, id) }));
  let img = sharp(Buffer.from(art)).resize(560, 560);
  if (list.length) {
    const overlay = await sharp(Buffer.from(scarsSvg(list, getChog(id)?.traits.Skin, 560))).png().toBuffer();
    img = img.composite([{ input: overlay }]);
  }
  return `data:image/png;base64,${(await img.png().toBuffer()).toString("base64")}`;
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const id = Math.min(1969, Math.max(1, Number((await params).id) || 1));
  const name = getChog(id)?.name ?? `Chog #${id}`;
  const [{ scars, stats }, [display, mono]] = await Promise.all([chainState(id), fonts]);
  const portrait = await scarredPortrait(id, scars);
  const taken = stats?.received ?? 0;
  const line = taken > 0 ? `${taken} scar${taken === 1 ? "" : "s"} and counting.` : "Clean face. For now.";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#151412", color: "#f6f1e7", padding: 35, gap: 48, fontFamily: "Bricolage" }}>
        <div style={{ display: "flex", border: "6px solid #f6f1e7", borderRadius: 24, overflow: "hidden", width: 560, height: 560, flexShrink: 0 }}>
          <img src={portrait} width={560} height={560} alt="" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, gap: 18 }}>
          <div style={{ fontFamily: "Mono", fontSize: 22, opacity: 0.6, display: "flex" }}>TOKEN {id} · CHOG GENESIS</div>
          <div style={{ fontSize: 84, lineHeight: 1, display: "flex" }}>{name}</div>
          <div style={{ fontSize: 40, color: "#ff5a1f", display: "flex" }}>{line}</div>
          <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
            {[
              ["LANDED", stats?.landed ?? 0],
              ["TAKEN", taken],
              ["NOTORIETY", stats?.notoriety ?? 0],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", flexDirection: "column", border: "3px solid #f6f1e7", borderRadius: 14, padding: "10px 18px", minWidth: 150 }}>
                <span style={{ fontFamily: "Mono", fontSize: 16, opacity: 0.6 }}>{k}</span>
                <span style={{ fontSize: 52 }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 26, fontSize: 24 }}>
            <span style={{ display: "flex", background: "#ff5a1f", color: "#151412", padding: "6px 14px", borderRadius: 8 }}>GRUDGE</span>
            <span style={{ display: "flex", marginLeft: 14, opacity: 0.8 }}>Chogs prank Chogs. Onchain.</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Bricolage", data: display, style: "normal", weight: 800 },
        { name: "Mono", data: mono, style: "normal", weight: 500 },
      ],
    },
  );
}
