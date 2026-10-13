"use client";

import { useState } from "react";
import { Portrait, type PortraitScar } from "@/components/scars/portrait";
import { PRANKS } from "@/lib/game";
import { setMuted, useMuted } from "@/lib/sfx";

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

/** Scene studio: play every prank on any Chog. Doubles as the judge-friendly preview. */
export default function Studio() {
  const [id, setId] = useState(1);
  const [kind, setKind] = useState(0);
  const [heavy, setHeavy] = useState(false);
  const [scars, setScars] = useState<PortraitScar[]>([]);
  const [scene, setScene] = useState<PortraitScar | null>(null);
  const muted = useMuted();

  function fire() {
    if (scene) return;
    setScene({ kind, heavy, seed: randomSeed(), by: 1 + Math.floor(Math.random() * 1969) });
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8 sm:px-8">
      <header className="flex items-baseline justify-between border-b-2 border-ink pb-4">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Prank studio</h1>
        <button onClick={() => setMuted(!muted)} className="font-mono text-sm text-muted hover:text-ink">
          sound {muted ? "off" : "on"}
        </button>
      </header>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,520px)_1fr]">
        <Portrait
          id={id}
          scars={scars}
          scene={scene}
          onSceneDone={() => {
            setScars((s) => [...s, scene!].slice(-8));
            setScene(null);
          }}
          className="rounded-2xl border-[3px] border-ink shadow-[8px_8px_0_0_var(--ink)]"
        />

        <div className="flex flex-col gap-6">
          <label className="flex items-center gap-3 text-sm">
            Chog #
            <input
              type="number"
              min={1}
              max={1969}
              value={id}
              onChange={(e) => {
                setId(Math.min(1969, Math.max(1, Number(e.target.value) || 1)));
                setScars([]);
              }}
              className="w-24 rounded border-2 border-ink bg-transparent px-2 py-1 font-mono"
            />
          </label>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PRANKS.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setKind(i)}
                className={`rounded-lg border-2 px-3 py-3 text-left transition-transform active:translate-y-0.5 ${
                  kind === i ? "border-ink bg-ink text-paper" : "border-ink/30 hover:border-ink"
                }`}
              >
                <span className="block font-display text-lg font-bold">{p.name}</span>
                <span className={`block text-sm ${kind === i ? "opacity-70" : "text-muted"}`}>{p.line}</span>
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={heavy} onChange={(e) => setHeavy(e.target.checked)} className="size-4 accent-[var(--danger)]" />
            Payback (heavy version)
          </label>

          <div className="flex gap-3">
            <button
              onClick={fire}
              disabled={!!scene}
              className="rounded-xl border-[3px] border-ink bg-accent px-8 py-4 font-display text-2xl font-extrabold text-ink shadow-[5px_5px_0_0_var(--ink)] transition-all hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50"
            >
              {scene ? "…" : "PRANK"}
            </button>
            <button onClick={() => setScars([])} className="rounded-xl border-2 border-ink/30 px-4 font-semibold hover:border-ink">
              Clean face
            </button>
          </div>
          <p className="font-mono text-xs text-muted">{scars.length}/8 scar slots used</p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-bold">Every scar</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {PRANKS.map((p, i) => (
            <figure key={p.id} className="flex flex-col gap-2">
              <Portrait id={id} scars={[{ kind: i, seed: 1000 + i, by: 420, heavy: false }]} className="rounded-xl border-2 border-ink" />
              <figcaption className="text-sm font-semibold">{p.name}</figcaption>
            </figure>
          ))}
          {PRANKS.map((p, i) => (
            <figure key={`h-${p.id}`} className="flex flex-col gap-2">
              <Portrait id={id} scars={[{ kind: i, seed: 2000 + i, by: 69, heavy: true }]} className="rounded-xl border-2 border-ink" />
              <figcaption className="text-sm font-semibold text-danger">{p.name}, payback</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
}
