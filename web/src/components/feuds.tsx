"use client";

import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { chogLabel, portraitSrc } from "@/lib/chogs";
import { ACT, useLiveLog, type Entry } from "@/lib/grudge-data";

type N = SimulationNodeDatum & { id: number; hits: number };
type L = SimulationLinkDatum<N> & { key: string; a: number; b: number; count: number; paybacks: number };

const card = "rounded-2xl border-2 border-ink bg-paper shadow-[5px_5px_0_0_var(--ink)]";

function build(entries: Entry[]) {
  const nodes = new Map<number, N>();
  const links = new Map<string, L>();
  const dealt = new Map<number, number>();
  const taken = new Map<number, number>();
  for (const e of entries) {
    if ((e.act !== ACT.PRANK && e.act !== ACT.PAYBACK) || !e.from || !e.to) continue;
    for (const id of [e.from, e.to]) {
      const n = nodes.get(id) ?? { id, hits: 0 };
      n.hits++;
      nodes.set(id, n);
    }
    const [a, b] = e.from < e.to ? [e.from, e.to] : [e.to, e.from];
    const key = `${a}-${b}`;
    const l = links.get(key) ?? { key, a, b, source: a, target: b, count: 0, paybacks: 0 };
    l.count++;
    if (e.act === ACT.PAYBACK) l.paybacks++;
    links.set(key, l);
    dealt.set(e.from, (dealt.get(e.from) ?? 0) + (e.act === ACT.PAYBACK ? 2 : 1));
    taken.set(e.to, (taken.get(e.to) ?? 0) + 1);
  }
  const rank = (m: Map<number, number>) => [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5);
  return {
    nodes: [...nodes.values()],
    links: [...links.values()],
    hottest: [...links.values()].sort((x, y) => y.count + y.paybacks - (x.count + x.paybacks)).slice(0, 5),
    wanted: rank(dealt),
    bullied: rank(taken),
  };
}

const radius = (n: N) => 20 + Math.min(n.hits, 10) * 2.6;

export function Feuds() {
  const { entries } = useLiveLog(800, 4000);
  const graph = useMemo(() => build(entries), [entries]);
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Feuds</h1>
        <p className="text-muted">Every line is a beef. It gets thicker with each hit and turns red once someone pays back.</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Graph nodes={graph.nodes} links={graph.links} />
        <aside className="flex flex-col gap-6">
          <Board title="Hottest beefs" empty="No beef yet.">
            {graph.hottest.map((l) => (
              <li key={l.key} className="flex items-center gap-2 py-2">
                <Face id={l.a} />
                <span className="font-display text-lg font-bold text-danger">⇄</span>
                <Face id={l.b} />
                <span className="ml-auto text-right font-mono text-xs">
                  {l.count} hit{l.count === 1 ? "" : "s"}
                  {l.paybacks > 0 && <span className="block text-danger">{l.paybacks} payback{l.paybacks === 1 ? "" : "s"}</span>}
                </span>
              </li>
            ))}
          </Board>
          <Board title="Most wanted" empty="Nobody yet.">
            {graph.wanted.map(([id, n], i) => <Row key={id} rank={i + 1} id={id} value={`${n} pts`} />)}
          </Board>
          <Board title="Most bullied" empty="Nobody yet.">
            {graph.bullied.map(([id, n], i) => <Row key={id} rank={i + 1} id={id} value={`${n} scar${n === 1 ? "" : "s"}`} />)}
          </Board>
        </aside>
      </div>
    </div>
  );
}

function Board({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section className={`${card} p-4`}>
      <h2 className="mb-1 font-display text-lg font-bold">{title}</h2>
      {children.length ? <ol className="divide-y divide-line">{children}</ol> : <p className="text-sm text-muted">{empty}</p>}
    </section>
  );
}

function Face({ id }: { id: number }) {
  return (
    <Link href={`/chog/${id}`} title={chogLabel(id)}>
      <Image src={portraitSrc(id)} alt={chogLabel(id)} width={36} height={36} className="rounded-md border-2 border-ink" />
    </Link>
  );
}

function Row({ rank, id, value }: { rank: number; id: number; value: string }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="w-4 font-mono text-xs text-muted">{rank}</span>
      <Face id={id} />
      <Link href={`/chog/${id}`} className="flex-1 truncate text-sm font-semibold hover:underline">
        {chogLabel(id)}
      </Link>
      <span className="font-mono text-xs">{value}</span>
    </li>
  );
}

function Graph({ nodes, links }: { nodes: N[]; links: L[] }) {
  const router = useRouter();
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const sim = useRef<Simulation<N, L> | null>(null);
  const positions = useRef(new Map<number, { x: number; y: number }>());
  const nodeEls = useRef(new Map<number, SVGGElement>());
  const linkEls = useRef(new Map<string, SVGLineElement>());
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [hover, setHover] = useState<number | null>(null);
  const userMoved = useRef(false);
  const drag = useRef<{ id: number | null; moved: boolean; pan?: { x: number; y: number; vx: number; vy: number } }>({ id: null, moved: false });

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // (Re)build the simulation when the graph changes, keeping known nodes where they were.
  useEffect(() => {
    const ns: N[] = nodes.map((n) => ({ ...n, ...(positions.current.get(n.id) ?? { x: size.w / 2 + (Math.random() - 0.5) * 80, y: size.h / 2 + (Math.random() - 0.5) * 80 }) }));
    const ls: L[] = links.map((l) => ({ ...l, source: l.a, target: l.b }));
    const s = forceSimulation<N, L>(ns)
      .force("link", forceLink<N, L>(ls).id((d) => d.id).distance((l) => 150 - Math.min(l.count, 6) * 12).strength(0.6))
      .force("charge", forceManyBody<N>().strength(-260).distanceMax(420))
      .force("center", forceCenter(size.w / 2, size.h / 2))
      // separate rivalries are separate clusters: pull them gently together so none drift off
      .force("x", forceX<N>(size.w / 2).strength(0.07))
      .force("y", forceY<N>(size.h / 2).strength(0.07))
      .force("collide", forceCollide<N>().radius((d) => radius(d) + 8))
      .alpha(positions.current.size ? 0.4 : 1)
      .on("tick", () => {
        for (const n of ns) {
          positions.current.set(n.id, { x: n.x!, y: n.y! });
          nodeEls.current.get(n.id)?.setAttribute("transform", `translate(${n.x},${n.y})`);
        }
        for (const l of ls) {
          const el = linkEls.current.get(l.key);
          const a = l.source as N, b = l.target as N;
          if (!el) continue;
          el.setAttribute("x1", String(a.x));
          el.setAttribute("y1", String(a.y));
          el.setAttribute("x2", String(b.x));
          el.setAttribute("y2", String(b.y));
        }
      })
      .on("end", () => {
        if (userMoved.current || !ns.length) return;
        const xs = ns.map((n) => n.x!), ys = ns.map((n) => n.y!);
        const pad = 90;
        const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
        const k = Math.min(1.4, size.w / (x1 - x0), size.h / (y1 - y0));
        setView({ k, x: size.w / 2 - ((x0 + x1) / 2) * k, y: size.h / 2 - ((y0 + y1) / 2) * k });
      });
    sim.current = s;
    return () => {
      s.stop();
    };
  }, [nodes, links, size.w, size.h]);

  const neighbours = useMemo(() => {
    if (hover === null) return null;
    const set = new Set([hover]);
    for (const l of links) {
      if (l.a === hover) set.add(l.b);
      if (l.b === hover) set.add(l.a);
    }
    return set;
  }, [hover, links]);

  function toWorld(e: React.PointerEvent) {
    const r = svg.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left - view.x) / view.k, y: (e.clientY - r.top - view.y) / view.k };
  }

  function onDown(e: React.PointerEvent, id: number | null) {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { id, moved: false, pan: id === null ? { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y } : undefined };
    if (id !== null) sim.current?.alphaTarget(0.25).restart();
  }
  function onMove(e: React.PointerEvent) {
    const d = drag.current;
    if (d.id !== null) {
      const p = toWorld(e);
      const n = sim.current?.nodes().find((x) => x.id === d.id);
      if (n) {
        n.fx = p.x;
        n.fy = p.y;
        d.moved = true;
      }
    } else if (d.pan) {
      userMoved.current = true;
      setView((v) => ({ ...v, x: d.pan!.vx + e.clientX - d.pan!.x, y: d.pan!.vy + e.clientY - d.pan!.y }));
    }
  }
  function onUp() {
    const d = drag.current;
    if (d.id !== null) {
      const n = sim.current?.nodes().find((x) => x.id === d.id);
      if (n) {
        n.fx = null;
        n.fy = null;
      }
      sim.current?.alphaTarget(0);
      if (!d.moved) router.push(`/chog/${d.id}`);
    }
    drag.current = { id: null, moved: false };
  }
  function onWheel(e: React.WheelEvent) {
    userMoved.current = true;
    const r = svg.current!.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    setView((v) => {
      const k = Math.min(3, Math.max(0.3, v.k * Math.exp(-e.deltaY * 0.0015)));
      return { k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k };
    });
  }

  return (
    <div ref={wrap} className={`${card} relative h-[70vh] min-h-[480px] overflow-hidden bg-[radial-gradient(circle,var(--line)_1px,transparent_1px)] [background-size:22px_22px]`}>
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
          <p className="font-display text-3xl font-bold">No feuds yet.</p>
          <Link href="/prank" className="rounded-lg border-2 border-ink bg-accent px-4 py-2 font-bold">
            Start one
          </Link>
        </div>
      )}
      <svg ref={svg} width={size.w} height={size.h} className="block touch-none select-none" onPointerDown={(e) => onDown(e, null)} onPointerMove={onMove} onPointerUp={onUp} onWheel={onWheel}>
        <defs>
          {nodes.map((n) => (
            <clipPath key={n.id} id={`f-${n.id}`}>
              <circle r={radius(n)} />
            </clipPath>
          ))}
        </defs>
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {links.map((l) => {
            const lit = !neighbours || (neighbours.has(l.a) && neighbours.has(l.b));
            return (
              <line
                key={l.key}
                ref={(el) => {
                  if (el) linkEls.current.set(l.key, el);
                  else linkEls.current.delete(l.key);
                }}
                stroke={l.paybacks ? "var(--danger)" : "var(--ink)"}
                strokeWidth={2 + Math.min(l.count, 6) * 2}
                strokeLinecap="round"
                opacity={lit ? 0.85 : 0.12}
              />
            );
          })}
          {nodes.map((n) => {
            const r = radius(n);
            const lit = !neighbours || neighbours.has(n.id);
            return (
              <g
                key={n.id}
                ref={(el) => {
                  if (el) nodeEls.current.set(n.id, el);
                  else nodeEls.current.delete(n.id);
                }}
                className="cursor-pointer"
                opacity={lit ? 1 : 0.25}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onDown(e, n.id);
                }}
                onPointerEnter={() => setHover(n.id)}
                onPointerLeave={() => setHover(null)}
              >
                <circle r={r + 4} fill="var(--ink)" />
                <image href={portraitSrc(n.id)} x={-r} y={-r} width={r * 2} height={r * 2} clipPath={`url(#f-${n.id})`} />
                {hover === n.id && (
                  <text y={r + 22} textAnchor="middle" className="fill-ink font-display text-[13px] font-bold" paintOrder="stroke" stroke="var(--paper)" strokeWidth={4}>
                    {chogLabel(n.id)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      {nodes.length > 0 && <p className="pointer-events-none absolute bottom-3 left-4 font-mono text-[11px] text-muted">drag Chogs · drag to pan · scroll to zoom · click to open</p>}
    </div>
  );
}
