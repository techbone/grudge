"use client";

import Image from "next/image";
import Link from "next/link";
import { useAccount, useReadContracts } from "wagmi";
import { chogLabel, getChog, portraitSrc } from "@/lib/chogs";
import { PRANKS, timeAgo } from "@/lib/game";
import { ACT, grudge, useChogLog, useChogState, type Entry } from "@/lib/grudge-data";
import { useChogOwner, useNow } from "@/lib/hooks";
import { PrankIcon } from "./prank-icons";
import { Portrait } from "./scars/portrait";
import { short } from "./site-header";

const card = "rounded-2xl border-2 border-ink bg-paper shadow-[6px_6px_0_0_var(--ink)]";
const TRAIT_ORDER = ["Tier", "Background", "Head", "Eyes", "Mouth", "Body", "Accessory", "Skin"];

export function RapSheet({ id }: { id: number }) {
  const meta = getChog(id);
  const { address } = useAccount();
  const state = useChogState(id);
  const log = useChogLog(id);
  const owner = useChogOwner(id);
  const now = useNow();
  const isMine = !!address && owner.data?.toLowerCase() === address.toLowerCase();

  const rivals = topRivals(id, log.data ?? []);
  const heats = useReadContracts({
    contracts: rivals.map((r) => ({ ...grudge, functionName: "heat" as const, args: [id, r.id] as const })),
    query: { enabled: rivals.length > 0 },
  });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-8 sm:px-8">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,560px)_1fr]">
        <Portrait id={id} skin={meta?.traits.Skin} scars={state.scars} className={card} />

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs tracking-wider text-muted uppercase">Token {id} · Chog Genesis</span>
            <h1 className="font-display text-5xl font-extrabold tracking-tight sm:text-6xl">{chogLabel(id)}</h1>
            <span className="flex items-center gap-2 font-mono text-sm text-muted">
              {owner.data ? <>held by {short(owner.data)}</> : "…"}
              {isMine && <span className="rounded bg-accent px-1.5 py-0.5 text-[11px] font-bold text-ink">YOURS</span>}
            </span>
          </div>

          <dl className="grid grid-cols-3 overflow-hidden rounded-2xl border-2 border-ink">
            {[
              ["Landed", state.stats?.landed],
              ["Taken", state.stats?.received],
              ["Notoriety", state.stats?.notoriety],
            ].map(([label, v], i) => (
              <div key={label as string} className={`flex flex-col gap-1 p-4 ${i > 0 ? "border-l-2 border-ink" : ""} ${i === 2 ? "bg-ink text-paper" : ""}`}>
                <dt className="font-mono text-[11px] tracking-wider uppercase opacity-70">{label}</dt>
                <dd className="font-display text-4xl font-extrabold tabular-nums">{v ?? "–"}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/prank?target=${id}`}
              className="rounded-xl border-[3px] border-ink bg-accent px-6 py-3 font-display text-xl font-extrabold shadow-[4px_4px_0_0_var(--ink)] transition-all hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              {isMine ? "Open the prank room" : "Prank this Chog"}
            </Link>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-bold">Rivals</h2>
            {rivals.length === 0 ? (
              <p className="text-sm text-muted">No beef yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {rivals.map((r, i) => {
                  const h = heats.data?.[i]?.status === "success" ? Number(heats.data[i].result) : 0;
                  return (
                    <li key={r.id}>
                      <Link href={`/chog/${r.id}`} className="flex items-center gap-3 rounded-xl border-2 border-line p-2 hover:border-ink">
                        <Image src={portraitSrc(r.id)} alt="" width={44} height={44} className="rounded-md border-2 border-ink" />
                        <span className="flex-1">
                          <span className="block font-bold">{chogLabel(r.id)}</span>
                          <span className="font-mono text-xs text-muted">
                            {r.dealt} dealt · {r.taken} taken
                          </span>
                        </span>
                        <span className="flex gap-1" aria-label={`heat ${h} of 3`}>
                          {[0, 1, 2].map((k) => (
                            <span key={k} className={`h-5 w-2 rounded-full border-2 border-ink ${k < h ? "bg-danger" : ""}`} />
                          ))}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {meta && Object.keys(meta.traits).length > 0 && (
            <section className="flex flex-wrap gap-2">
              {TRAIT_ORDER.filter((t) => meta.traits[t]).map((t) => (
                <span key={t} className="rounded-lg border border-line px-2.5 py-1 text-xs">
                  <span className="text-muted">{t}</span> <span className="font-semibold">{meta.traits[t]}</span>
                </span>
              ))}
            </section>
          )}
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
          <h2 className="font-display text-3xl font-extrabold">Rap sheet</h2>
          {log.data && <span className="font-mono text-xs text-muted">{log.data.length} entries</span>}
        </div>
        {log.isLoading && <p className="text-muted">Reading the record…</p>}
        {log.data?.length === 0 && <p className="text-muted">Spotless. For now.</p>}
        <ol className="flex flex-col">
          {log.data?.map((e, i) => (
            <li key={`${e.at}-${i}`} className="flex items-center gap-4 border-b border-line py-3">
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-ink ${e.to === id && e.from !== id ? "bg-ink text-paper" : ""}`}>
                {e.act <= ACT.PAYBACK ? <PrankIcon kind={e.kind} className="size-6" /> : <span className="font-mono text-xs font-bold">{ACT_GLYPH[e.act]}</span>}
              </span>
              <span className="flex-1">
                <Line id={id} e={e} />
              </span>
              <span className="font-mono text-xs text-muted">{timeAgo(e.at, now)}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

const ACT_GLYPH: Record<number, string> = { 2: "✕", 3: "=", 4: "$", 5: "$" };

function ChogLink({ id }: { id: number }) {
  return (
    <Link href={`/chog/${id}`} className="font-semibold underline decoration-2 underline-offset-2">
      {chogLabel(id)}
    </Link>
  );
}

/** One plain sentence per log entry, from this Chog's point of view. */
function Line({ id, e }: { id: number; e: Entry }) {
  const prank = PRANKS[e.kind]?.name.toLowerCase();
  const heavy = <span className="ml-1.5 rounded bg-danger px-1 py-0.5 font-mono text-[10px] text-paper align-middle">PAYBACK</span>;
  switch (e.act) {
    case ACT.PRANK:
    case ACT.PAYBACK:
      return e.from === id ? (
        <>
          Hit <ChogLink id={e.to} /> with {prank}
          {e.act === ACT.PAYBACK && heavy}
        </>
      ) : (
        <>
          <ChogLink id={e.from} /> got it with {prank}
          {e.act === ACT.PAYBACK && heavy}
        </>
      );
    case ACT.SCRUB:
      return <>Burned $CHOG to scrub a scar</>;
    case ACT.TRUCE:
      return (
        <>
          Called a truce with <ChogLink id={e.from === id ? e.to : e.from} />
        </>
      );
    case ACT.BOUNTY_POSTED:
      return <>Someone put a bounty on it</>;
    case ACT.BOUNTY_CLAIMED:
      return e.from === id ? (
        <>
          Collected the bounty on <ChogLink id={e.to} />
        </>
      ) : (
        <>
          <ChogLink id={e.from} /> collected the bounty on it
        </>
      );
    default:
      return null;
  }
}

function topRivals(id: number, log: Entry[]) {
  const m = new Map<number, { id: number; dealt: number; taken: number }>();
  for (const e of log) {
    if (e.act !== ACT.PRANK && e.act !== ACT.PAYBACK) continue;
    const other = e.from === id ? e.to : e.from;
    if (!other || other === id) continue;
    const r = m.get(other) ?? { id: other, dealt: 0, taken: 0 };
    if (e.from === id) r.dealt++;
    else r.taken++;
    m.set(other, r);
  }
  return [...m.values()].sort((a, b) => b.dealt + b.taken - (a.dealt + a.taken)).slice(0, 4);
}
