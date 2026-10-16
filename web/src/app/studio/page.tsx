"use client";

import { useRef, useState } from "react";
import { Portrait, type PortraitScar } from "@/components/scars/portrait";
import { chogLabel } from "@/lib/chogs";
import { revealOnMobile } from "@/lib/hooks";
import { MAX_ID, PRANKS } from "@/lib/game";

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

/** Scene studio: play every prank on any Chog. Doubles as the judge-friendly preview. */
export default function Studio() {
  const [id, setId] = useState(1);
  // what's typed in the box; only a valid id (1-1969) changes the Chog, so you can clear and retype freely
  const [draft, setDraft] = useState("1");
  const [kind, setKind] = useState(0);
  const [heavy, setHeavy] = useState(false);
  const [scars, setScars] = useState<PortraitScar[]>([]);
  const [scene, setScene] = useState<PortraitScar | null>(null);
  const stage = useRef<HTMLDivElement>(null);

  function pick(n: number) {
    const next = ((((n - 1) % MAX_ID) + MAX_ID) % MAX_ID) + 1; // wraps: 1969 → 1 and 1 → 1969
    if (next !== id) setScars([]);
    setId(next);
    setDraft(String(next));
  }

  function fire() {
    if (scene) return;
    revealOnMobile(stage.current);
    setScene({ kind, heavy, seed: randomSeed(), by: 1 + Math.floor(Math.random() * 1969) });
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8 sm:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Prank studio</h1>
        <p className="text-muted">Try every prank on any Chog. Nothing here touches the chain.</p>
      </header>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,520px)_1fr]">
        <div ref={stage} className="scroll-mt-20">
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
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">
              {chogLabel(id)} <span className="font-mono text-muted">· token {id} of {MAX_ID}</span>
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => pick(id - 1)}
                aria-label="Previous Chog"
                className="size-11 rounded-lg border-2 border-ink font-display text-3xl leading-none font-bold hover:bg-ink hover:text-paper active:translate-y-0.5"
              >
                ‹
              </button>
              <label className="flex h-11 items-center rounded-lg border-2 border-ink font-mono">
                <span className="pl-3 text-muted">#</span>
                <input
                  value={draft}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  aria-label="Chog number, 1 to 1969"
                  onChange={(e) => {
                    const t = e.target.value.replace(/\D/g, "").slice(0, 4);
                    const n = Number(t);
                    if (n > MAX_ID) return; // ignore a keystroke that would pass 1969
                    setDraft(t);
                    if (n >= 1 && n !== id) {
                      setId(n);
                      setScars([]);
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  onBlur={() => setDraft(String(id))}
                  className="w-20 bg-transparent px-2 text-lg outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => pick(id + 1)}
                aria-label="Next Chog"
                className="size-11 rounded-lg border-2 border-ink font-display text-3xl leading-none font-bold hover:bg-ink hover:text-paper active:translate-y-0.5"
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => pick(1 + Math.floor(Math.random() * MAX_ID))}
                className="h-11 rounded-lg border-2 border-ink px-4 font-semibold hover:bg-ink hover:text-paper active:translate-y-0.5"
              >
                Random Chog
              </button>
            </div>
          </div>

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
