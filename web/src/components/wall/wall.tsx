"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePublicClient } from "wagmi";
import { chogLabel, getChog, portraitSrc } from "@/lib/chogs";
import { GRUDGE_ADDRESS, PRANKS, timeAgo } from "@/lib/game";
import { ACT, grudge, toPortraitScars, useLiveLog, type Entry, type RawScar } from "@/lib/grudge-data";
import { useNow } from "@/lib/hooks";
import { sfx } from "@/lib/sfx";
import { PrankIcon } from "../prank-icons";
import { overlaySvg, overlayTexture } from "./overlays";
import type { WallScene } from "./scene";

const PAGE = 250;
const MAX_ID = 1969;
const isHit = (e: Entry) => e.act === ACT.PRANK || e.act === ACT.PAYBACK;

export function Wall() {
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<WallScene | null>(null);
  const pixiRef = useRef<typeof import("pixi.js") | null>(null);
  const overlayKeys = useRef(new Map<number, string>());
  const queue = useRef<Entry[]>([]);
  const running = useRef(false);
  const followRef = useRef(true);
  const client = usePublicClient();
  const router = useRouter();
  const now = useNow(5000);
  const { entries, fresh } = useLiveLog(60);
  const [ready, setReady] = useState(false);
  const [follow, setFollow] = useState(true);
  const [hover, setHover] = useState<{ id: number; x: number; y: number } | null>(null);
  const [total, setTotal] = useState<number>();

  useEffect(() => {
    followRef.current = follow;
  }, [follow]);

  // Boot Pixi.
  useEffect(() => {
    let scene: WallScene | null = null;
    let cancelled = false;
    (async () => {
      const [P, { WallScene }] = await Promise.all([import("pixi.js"), import("./scene")]);
      if (cancelled || !host.current) return;
      pixiRef.current = P;
      scene = new WallScene(P);
      scene.onTileClick = (id) => router.push(`/chog/${id}`);
      scene.onHover = (id, x, y) => setHover(id ? { id, x, y } : null);
      await scene.init(host.current);
      if (cancelled) return scene.destroy();
      sceneRef.current = scene;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      scene?.destroy();
      sceneRef.current = null;
    };
  }, [router]);

  // Draw a tile's scars as an overlay texture (skips if unchanged).
  async function paint(id: number, raw: readonly RawScar[]) {
    const scene = sceneRef.current, P = pixiRef.current;
    if (!scene || !P) return;
    const scars = toPortraitScars(id, raw);
    const key = scars.map((s) => s.seed).join(",");
    if (overlayKeys.current.get(id) === key) return;
    overlayKeys.current.set(id, key);
    if (!scars.length) return scene.setOverlay(id, null);
    try {
      scene.setOverlay(id, await overlayTexture(P, overlaySvg(scars, getChog(id)?.traits.Skin)));
    } catch {
      overlayKeys.current.delete(id);
    }
  }

  // Load every Chog's scars in pages, then keep them fresh.
  useEffect(() => {
    if (!ready || !client || !GRUDGE_ADDRESS) return;
    let stop = false;
    async function loadAll() {
      for (let start = 1; start <= MAX_ID && !stop; start += PAGE) {
        try {
          const [, scars] = (await client!.readContract({ ...grudge, functionName: "getChogs", args: [start, PAGE] })) as readonly [unknown, readonly (readonly RawScar[])[]];
          for (let i = 0; i < scars.length; i++) {
            const id = start + i;
            if (id > MAX_ID) break;
            if (scars[i].some((s) => s.by !== 0) || overlayKeys.current.has(id)) await paint(id, scars[i]);
          }
        } catch {}
      }
    }
    void loadAll();
    const t = setInterval(loadAll, 60_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [ready, client]);

  useEffect(() => {
    if (!client || !GRUDGE_ADDRESS) return;
    const t = setInterval(async () => {
      try {
        setTotal(Number(await client.readContract({ ...grudge, functionName: "logLength" })));
      } catch {}
    }, 3000);
    return () => clearInterval(t);
  }, [client]);

  // Play queued pranks one after another.
  async function drain() {
    if (running.current) return;
    running.current = true;
    while (queue.current.length && sceneRef.current) {
      const e = queue.current.shift()!;
      const scene = sceneRef.current;
      if (followRef.current) {
        scene.flyTo(e.to, 1.15, 0.9);
        await wait(700);
      }
      sfx.whoosh();
      await scene.launch(e.from, e.to, e.kind, e.act === ACT.PAYBACK);
      if (e.act === ACT.PAYBACK) sfx.stamp();
      else sfx.splat();
      try {
        const raw = (await client!.readContract({ ...grudge, functionName: "scars", args: [e.to] })) as readonly RawScar[];
        await paint(e.to, raw);
      } catch {}
      await wait(followRef.current ? 900 : 250);
    }
    running.current = false;
  }

  useEffect(() => {
    const hits = fresh.filter(isHit);
    if (!hits.length) return;
    queue.current.push(...hits);
    void drain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh]);

  function replay() {
    const recent = entries.filter(isHit).slice(0, 10).reverse();
    queue.current.push(...recent);
    void drain();
  }

  const feed = entries.filter((e) => e.act !== ACT.SCRUB).slice(0, 12);

  return (
    <div className="relative h-[calc(100dvh-6.5rem)] overflow-hidden bg-[radial-gradient(circle,var(--line)_1px,transparent_1px)] [background-size:22px_22px] sm:h-[calc(100dvh-4rem)]">
      <div ref={host} className="absolute inset-0" />

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="animate-pulse font-display text-2xl font-bold">Hanging 1,969 portraits…</p>
        </div>
      )}

      <div className="pointer-events-none absolute top-4 left-4 flex flex-col gap-1 sm:top-6 sm:left-6">
        <h1 className="font-display text-4xl font-extrabold tracking-tight drop-shadow-[0_2px_0_var(--paper)] sm:text-5xl">The Wall</h1>
        <p className="font-mono text-xs text-muted">
          1,969 Chogs{total !== undefined && <> · {total.toLocaleString()} things done onchain</>}
        </p>
      </div>

      <aside className="absolute top-4 right-4 hidden w-80 flex-col gap-2 rounded-2xl border-2 border-ink bg-paper/95 p-3 shadow-[5px_5px_0_0_var(--ink)] md:flex">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-display text-lg font-bold">Live</h2>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted uppercase">
            <span className="size-2 animate-pulse rounded-full bg-danger" /> onchain
          </span>
        </div>
        {feed.length === 0 ? (
          <p className="px-1 pb-2 text-sm text-muted">Quiet. Too quiet. Go start something.</p>
        ) : (
          <ul className="flex max-h-[55vh] flex-col overflow-y-auto">
            {feed.map((e, i) => (
              <li key={`${e.at}-${e.from}-${e.to}-${i}`}>
                <button onClick={() => sceneRef.current?.flyTo(e.to)} className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-2 text-left hover:bg-ink/5">
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-ink ${e.act === ACT.PAYBACK ? "bg-danger text-paper" : ""}`}>
                    {isHit(e) ? <PrankIcon kind={e.kind} className="size-5" /> : <span className="font-mono text-xs font-bold">$</span>}
                  </span>
                  <span className="min-w-0 flex-1 text-sm leading-tight">
                    <FeedLine e={e} />
                    <span className="block font-mono text-[10px] text-muted">{timeAgo(e.at, now)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-2 sm:bottom-6 sm:left-6">
        <div className="flex overflow-hidden rounded-xl border-2 border-ink bg-paper shadow-[3px_3px_0_0_var(--ink)]">
          <button aria-label="Zoom out" onClick={() => sceneRef.current?.zoomBy(0.7)} className="px-3.5 py-2 font-display text-lg font-bold hover:bg-ink hover:text-paper">
            −
          </button>
          <button onClick={() => sceneRef.current?.fit()} className="border-x-2 border-ink px-3 py-2 text-sm font-semibold hover:bg-ink hover:text-paper">
            Fit
          </button>
          <button aria-label="Zoom in" onClick={() => sceneRef.current?.zoomBy(1.4)} className="px-3.5 py-2 font-display text-lg font-bold hover:bg-ink hover:text-paper">
            +
          </button>
        </div>
        <button
          onClick={() => setFollow((f) => !f)}
          aria-pressed={follow}
          className={`rounded-xl border-2 border-ink px-3 py-2 text-sm font-semibold shadow-[3px_3px_0_0_var(--ink)] ${follow ? "bg-ink text-paper" : "bg-paper"}`}
        >
          Follow the action {follow ? "on" : "off"}
        </button>
        <button onClick={replay} disabled={!entries.some(isHit)} className="rounded-xl border-2 border-ink bg-accent px-3 py-2 text-sm font-bold shadow-[3px_3px_0_0_var(--ink)] disabled:opacity-40">
          Replay latest
        </button>
        <Link href="/prank" className="rounded-xl border-2 border-ink bg-paper px-3 py-2 text-sm font-bold shadow-[3px_3px_0_0_var(--ink)]">
          Prank someone
        </Link>
      </div>

      <p className="pointer-events-none absolute right-6 bottom-6 hidden font-mono text-[11px] text-muted lg:block">drag to pan · scroll to zoom · click a Chog</p>

      {hover && (
        <div className="pointer-events-none fixed z-40 flex items-center gap-2 rounded-xl border-2 border-ink bg-paper px-2 py-1.5 shadow-[3px_3px_0_0_var(--ink)]" style={{ left: hover.x + 16, top: hover.y + 16 }}>
          <Image src={portraitSrc(hover.id)} alt="" width={36} height={36} className="rounded-md border border-ink" />
          <span className="flex flex-col">
            <span className="text-sm font-bold">{chogLabel(hover.id)}</span>
            <span className="font-mono text-[10px] text-muted">token {hover.id} · click for rap sheet</span>
          </span>
        </div>
      )}
    </div>
  );
}

function FeedLine({ e }: { e: Entry }) {
  const name = (id: number) => <span className="font-semibold">{chogLabel(id).replace("CHOG ", "")}</span>;
  if (e.act === ACT.PRANK) return <span>{name(e.from)} hit {name(e.to)} with {PRANKS[e.kind]?.name.toLowerCase()}</span>;
  if (e.act === ACT.PAYBACK) return <span>{name(e.from)} paid back {name(e.to)}</span>;
  if (e.act === ACT.TRUCE) return <span>{name(e.from)} and {name(e.to)} called a truce</span>;
  if (e.act === ACT.BOUNTY_POSTED) return <span>Bounty posted on {name(e.to)}</span>;
  if (e.act === ACT.BOUNTY_CLAIMED) return <span>{name(e.from)} collected the bounty on {name(e.to)}</span>;
  return null;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
