"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useState } from "react";
import { parseUnits } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { chogLabel, getChog, portraitSrc } from "@/lib/chogs";
import { PRANKS, timeAgo } from "@/lib/game";
import { ACT, grudge, topRivals, useChogLog, useChogState, useInheritance, type Entry } from "@/lib/grudge-data";
import { useChogOwner, useNow } from "@/lib/hooks";
import { fmtChog, useChogEconomy, useGrudgeTx } from "@/lib/tx";
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
  const inh = useInheritance(id, log.data);
  const handoverAt = inh.handover?.at;
  const scarsInherited = handoverAt ? state.scars.length - (state.rawScars ?? []).filter((s) => s.by !== 0 && s.at > handoverAt).length : 0;
  const dividerIndex = handoverAt ? (log.data ?? []).findIndex((e) => e.at <= handoverAt) : -1;
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

          {inh.handover && (
            <section className="relative flex flex-col gap-1 overflow-hidden rounded-2xl border-2 border-ink bg-ink p-4 text-paper">
              <span className="absolute top-3 -right-8 rotate-12 bg-accent px-10 py-0.5 font-mono text-[10px] font-bold text-ink">INHERITED</span>
              <span className="font-mono text-xs opacity-70">
                Changed hands {timeAgo(inh.handover.at, now)} · {short(inh.handover.from)} → {short(inh.handover.to)}
              </span>
              <p className="font-display text-lg leading-snug font-bold">
                The new holder inherited {scarsInherited} scar{scarsInherited === 1 ? "" : "s"} and {topRivals(id, inh.inherited).length} rival
                {topRivals(id, inh.inherited).length === 1 ? "" : "s"}. Its enemies are theirs now.
              </p>
            </section>
          )}

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

          <BountyPanel id={id} />

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
            <Fragment key={`${e.at}-${i}`}>
            {i === dividerIndex && inh.handover && (
              <li className="flex items-center gap-3 border-b-2 border-dashed border-ink py-3 font-mono text-xs">
                <span className="rounded bg-accent px-2 py-0.5 font-bold text-ink">CHANGED HANDS</span>
                <span className="text-muted">
                  {short(inh.handover.from)} → {short(inh.handover.to)} · {timeAgo(inh.handover.at, now)}. Everything below came with the Chog.
                </span>
              </li>
            )}
            <li className="flex items-center gap-4 border-b border-line py-3">
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-ink ${e.to === id && e.from !== id ? "bg-ink text-paper" : ""}`}>
                {e.act <= ACT.PAYBACK ? <PrankIcon kind={e.kind} className="size-6" /> : <span className="font-mono text-xs font-bold">{ACT_GLYPH[e.act]}</span>}
              </span>
              <span className="flex-1">
                <Line id={id} e={e} />
              </span>
              <span className="font-mono text-xs text-muted">{timeAgo(e.at, now)}</span>
            </li>
            </Fragment>
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

const BOUNTY_LOCK = 3 * 24 * 60 * 60;

/** Put $CHOG on a Chog's head. The next Chog to prank it collects, minus a burned fee. */
function BountyPanel({ id }: { id: number }) {
  const { address } = useAccount();
  const now = useNow();
  const tx = useGrudgeTx();
  const { bountyFeeBps, balance } = useChogEconomy();
  const [amount, setAmount] = useState("1000");
  const b = useReadContract({ ...grudge, functionName: "bounties", args: [BigInt(id)] });
  const [funder, open, createdAt] = b.data ? [b.data[0] as string, b.data[1] as bigint, Number(b.data[2])] : ["", 0n, 0];
  const fee = bountyFeeBps ?? 1000;
  const isFunder = !!address && funder.toLowerCase() === address.toLowerCase();
  const unlocksIn = createdAt + BOUNTY_LOCK - now;

  let wei = 0n;
  try {
    wei = parseUnits(amount || "0", 18);
  } catch {}
  const tooMuch = balance !== undefined && wei > balance;

  return (
    <section className={`flex flex-col gap-3 rounded-2xl border-2 border-ink p-4 ${open > 0n ? "bg-accent text-ink" : ""}`}>
      {open > 0n ? (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl font-extrabold">Bounty: {fmtChog(open)} $CHOG</h2>
          </div>
          <p className="text-sm font-semibold">
            The next Chog to prank it collects {fmtChog((open * BigInt(10_000 - fee)) / 10_000n)} $CHOG. {fee / 100}% is burned.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/prank?target=${id}`} className="rounded-lg border-2 border-ink bg-ink px-4 py-2 font-bold text-paper">
              Prank it to collect
            </Link>
            {isFunder &&
              (unlocksIn > 0 ? (
                <span className="font-mono text-xs">You can take it back in {Math.ceil(unlocksIn / 3600)}h if nobody collects.</span>
              ) : (
                <button
                  onClick={() => tx.send({ fn: "cancelBounty", args: [id], okText: "Bounty withdrawn." })}
                  disabled={tx.busy}
                  className="rounded-lg border-2 border-ink bg-paper px-3 py-2 text-sm font-bold disabled:opacity-50"
                >
                  Take it back
                </button>
              ))}
          </div>
        </>
      ) : (
        <>
          <h2 className="font-display text-xl font-bold">Put a bounty on it</h2>
          <p className="text-sm text-muted">Escrow $CHOG on this Chog. The next Chog to prank it collects, and {fee / 100}% is burned. You don&apos;t need a Chog to post one.</p>
          {address ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center rounded-lg border-2 border-ink font-mono">
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  inputMode="decimal"
                  aria-label="Bounty amount in $CHOG"
                  className="w-28 bg-transparent px-3 py-2 outline-none"
                />
                <span className="pr-3 text-muted">$CHOG</span>
              </span>
              <button
                onClick={() => tx.send({ fn: "postBounty", args: [id, wei], spend: wei, okText: `Bounty of ${fmtChog(wei)} $CHOG posted.` })}
                disabled={tx.busy || wei === 0n || tooMuch}
                className="rounded-lg border-2 border-ink bg-accent px-4 py-2 font-bold shadow-[3px_3px_0_0_var(--ink)] disabled:opacity-40 disabled:shadow-none"
              >
                Post bounty
              </button>
              {balance !== undefined && <span className="font-mono text-xs text-muted">you have {fmtChog(balance)}</span>}
            </div>
          ) : (
            <p className="text-sm font-semibold">Connect a wallet to post one.</p>
          )}
        </>
      )}
      {tx.status.kind !== "idle" && (
        <p role="status" className={`text-sm font-semibold ${tx.status.kind === "error" ? "text-danger" : ""}`}>
          {tx.status.text}
        </p>
      )}
    </section>
  );
}
