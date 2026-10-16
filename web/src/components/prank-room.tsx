"use client";

import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useReadContract, useReadContracts } from "wagmi";
import { injected } from "wagmi/connectors";
import { isLocal } from "@/lib/chains";
import { chogLabel, getChog, portraitSrc } from "@/lib/chogs";
import { GRUDGE_ADDRESS, isValidId, MAX_ID, MOVES_PER_DAY, PRANKS, timeAgo } from "@/lib/game";
import { grudge, topRivals, useChogLog, useChogState, useInheritance } from "@/lib/grudge-data";
import { fmtChog, useChogEconomy, useGrudgeTx, type TxStatus } from "@/lib/tx";
import { revealOnMobile, useChogOwner, useNow, useOwnedChogs } from "@/lib/hooks";
import { scarSeed } from "./scars/geometry";
import { Portrait, type PortraitScar } from "./scars/portrait";
import { DevPlayAs } from "./dev-play-as";
import { PrankIcon } from "./prank-icons";
import { short } from "./site-header";

const card = "rounded-2xl border-2 border-ink bg-paper shadow-[6px_6px_0_0_var(--ink)]";

export function PrankRoom({ initialTarget }: { initialTarget?: number }) {
  const { address, isConnected } = useAccount();
  if (!GRUDGE_ADDRESS) {
    return <p className="p-8 font-mono text-sm">NEXT_PUBLIC_GRUDGE_ADDRESS is not set. Run scripts/dev-chain.sh.</p>;
  }
  return isConnected && address ? <Room address={address} initialTarget={initialTarget} /> : <Lobby />;
}

// ───────────────────────── lobby: attract loop + connect ─────────────────────────

function Lobby() {
  const { connect } = useConnect();
  const [demo, setDemo] = useState({ id: 1, scars: [] as PortraitScar[], scene: null as PortraitScar | null, step: 0 });

  useEffect(() => {
    if (demo.scene) return;
    const t = setTimeout(() => {
      setDemo((d) => {
        if (d.step >= 4) return { id: 1 + Math.floor(Math.random() * MAX_ID), scars: [], scene: null, step: 0 };
        const kinds = [3, 0, 4, 1];
        return { ...d, scene: { kind: kinds[d.step], seed: Math.floor(Math.random() * 2 ** 31), by: 1 + Math.floor(Math.random() * MAX_ID), heavy: d.step === 3 } };
      });
    }, demo.step === 0 ? 600 : 1400);
    return () => clearTimeout(t);
  }, [demo.scene, demo.step]);

  return (
    <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 sm:px-8 lg:grid-cols-[minmax(0,480px)_1fr]">
      <Portrait
        id={demo.id}
        skin={getChog(demo.id)?.traits.Skin}
        scars={demo.scars}
        scene={demo.scene}
        onSceneDone={() => setDemo((d) => ({ ...d, scars: [...d.scars, d.scene!], scene: null, step: d.step + 1 }))}
        className={card}
      />
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-6xl">
          Prank a Chog.
          <br />
          It never washes off.
        </h1>
        <ul className="flex flex-col gap-2 text-lg">
          <li>Three moves a day, aimed at any of the 1,969 Chogs.</li>
          <li>Every prank lands onchain and sticks to the target&apos;s face.</li>
          <li>Victims get one payback that hits twice as hard.</li>
          <li>Sell your Chog and the buyer inherits its enemies.</li>
        </ul>
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => connect({ connector: injected() })}
            className="rounded-xl border-[3px] border-ink bg-accent px-6 py-3 font-display text-xl font-extrabold shadow-[4px_4px_0_0_var(--ink)] transition-all hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            Connect wallet
          </button>
          <Link href="/studio" className="font-semibold underline decoration-2 underline-offset-4">
            No Chog? Try the studio
          </Link>
        </div>
        {isLocal && <DevPlayAs />}
      </div>
    </div>
  );
}

// ───────────────────────── the room ─────────────────────────

function Room({ address, initialTarget }: { address: `0x${string}`; initialTarget?: number }) {
  const qc = useQueryClient();
  const tx = useGrudgeTx();
  const stage = useRef<HTMLDivElement>(null);
  const status = tx.status;
  const economy = useChogEconomy();
  const owned = useOwnedChogs(address);
  const [picked, setPicked] = useState<number>();
  const mine = picked !== undefined && owned.data?.includes(picked) ? picked : owned.data?.[0];
  const [targetText, setTargetText] = useState(initialTarget ? String(initialTarget) : "");
  const target = Number(targetText);
  const hasTarget = isValidId(target);
  const [kind, setKind] = useState(0);
  const [scene, setScene] = useState<PortraitScar | null>(null);

  const me = useChogState(mine);
  const victim = useChogState(hasTarget ? target : undefined);
  const victimOwner = useChogOwner(hasTarget ? target : undefined);
  const busy = tx.busy || !!scene;
  const bounty = useReadContract({ ...grudge, functionName: "bounties", args: [BigInt(hasTarget ? target : 1)], query: { enabled: hasTarget } });
  const bountyAmount = hasTarget && bounty.data ? (bounty.data[1] as bigint) : 0n;
  const ownsTarget = hasTarget && !!owned.data?.includes(target);

  function randomVictim() {
    let id = 0;
    do id = 1 + Math.floor(Math.random() * MAX_ID);
    while (owned.data?.includes(id) || id === mine);
    setTargetText(String(id));
  }

  async function act(fn: "prank" | "payback", from: number, to: number, k: number) {
    const okText = fn === "payback" ? `Paid back ${chogLabel(to)}.` : `${PRANKS[k].name} landed on ${chogLabel(to)}.`;
    // Refresh after the scene, so the stored scar doesn't appear under the animation.
    const at = await tx.send({ fn, args: [from, to, k], okText: bountyAmount > 0n ? `${okText} Bounty collected.` : okText, refresh: false });
    // Same seed the permanent scar will use, so the animation settles into it seamlessly.
    if (at !== null) revealOnMobile(stage.current);
    if (at !== null) setScene({ kind: k, by: from, heavy: fn === "payback", seed: scarSeed(from, k, at, to) });
  }

  async function onSceneDone() {
    await qc.invalidateQueries();
    setScene(null);
  }

  const left = me.movesLeft ?? MOVES_PER_DAY;
  const canPrank = !!mine && hasTarget && target !== mine && !ownsTarget && left > 0 && !busy;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-8">
      {/* your crew */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold">Your crew</h2>
          {owned.data && <span className="font-mono text-xs text-muted">{owned.data.length} Chog{owned.data.length === 1 ? "" : "s"}</span>}
        </div>
        {owned.isLoading && <p className="text-sm text-muted">Finding your Chogs among all 1,969…</p>}
        {owned.isError && <p className="text-sm text-danger">Couldn&apos;t read ownership. Refresh to retry.</p>}
        {owned.data?.length === 0 && (
          <p className="text-sm text-muted">
            This wallet holds no Chog Genesis. Grab one on{" "}
            <a className="underline" href="https://opensea.io/collection/chog-genesis" target="_blank" rel="noreferrer">
              OpenSea
            </a>{" "}
            or try the <Link href="/studio" className="underline">studio</Link>.
          </p>
        )}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {owned.data?.map((id) => (
            <button
              key={id}
              onClick={() => setPicked(id)}
              className={`group relative shrink-0 overflow-hidden rounded-xl border-2 transition-transform ${mine === id ? "-translate-y-1 border-ink shadow-[3px_3px_0_0_var(--ink)]" : "border-line hover:border-ink"}`}
            >
              <Image src={portraitSrc(id)} alt={chogLabel(id)} width={84} height={84} className="block" />
              <span className="absolute inset-x-0 bottom-0 bg-ink/85 py-0.5 text-center font-mono text-[10px] text-paper">#{id}</span>
            </button>
          ))}
        </div>
      </section>

      {mine !== undefined && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,640px)_400px] lg:justify-between">
          {/* the stage: the victim */}
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Victim
                <span className="flex items-center rounded-lg border-2 border-ink bg-paper font-mono">
                  <span className="pl-3 text-muted">#</span>
                  <input
                    value={targetText}
                    onChange={(e) => setTargetText(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    inputMode="numeric"
                    placeholder="1–1969"
                    className="w-24 bg-transparent px-2 py-2 outline-none"
                    disabled={busy}
                  />
                </span>
              </label>
              <button onClick={randomVictim} disabled={busy} className="rounded-lg border-2 border-ink px-4 py-2 font-semibold hover:bg-ink hover:text-paper disabled:opacity-40">
                Random victim
              </button>
              {hasTarget && (
                <Link href={`/chog/${target}`} className="ml-auto text-sm font-semibold underline decoration-2 underline-offset-4">
                  Rap sheet
                </Link>
              )}
            </div>

            {hasTarget ? (
              <div ref={stage} className="relative scroll-mt-20">
                <Portrait id={target} skin={getChog(target)?.traits.Skin} scars={victim.scars} scene={scene} onSceneDone={onSceneDone} className={card} />
                <div className="pointer-events-none absolute top-4 left-4 flex flex-col items-start gap-2">
                  <span className="rounded-md bg-ink px-2.5 py-1 font-display text-lg font-bold text-paper">{chogLabel(target)}</span>
                  {victimOwner.data && <span className="rounded bg-paper/90 px-2 py-0.5 font-mono text-xs">held by {short(victimOwner.data)}</span>}
                </div>
                {bountyAmount > 0n && (
                  <div className="pointer-events-none absolute top-4 right-4 rotate-3 rounded-lg border-2 border-ink bg-accent px-3 py-1.5 text-center shadow-[3px_3px_0_0_var(--ink)]">
                    <span className="block font-display text-sm font-extrabold">BOUNTY</span>
                    <span className="block font-mono text-xs font-bold">{fmtChog(bountyAmount)} $CHOG</span>
                  </div>
                )}
                {status.kind === "pending" && (
                  <div className="absolute inset-x-0 bottom-6 flex justify-center">
                    <span className="animate-pulse rounded-full bg-ink px-4 py-2 font-mono text-sm text-paper">{status.text}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className={`${card} flex aspect-square flex-col items-center justify-center gap-4 border-dashed p-8 text-center shadow-none`}>
                <p className="font-display text-3xl font-bold">Pick a victim</p>
                <p className="max-w-xs text-muted">Type any Chog id, or let fate decide.</p>
                <button onClick={randomVictim} className="rounded-lg border-2 border-ink bg-accent px-5 py-2 font-bold">
                  Random victim
                </button>
              </div>
            )}
          </section>

          {/* the controls: you */}
          <aside className="flex flex-col gap-6">
            <div className={`${card} flex items-center gap-4 p-4`}>
              <Image src={portraitSrc(mine)} alt="" width={88} height={88} className="rounded-lg border-2 border-ink" />
              <div className="flex flex-1 flex-col gap-1">
                <span className="font-display text-xl font-bold">{chogLabel(mine)}</span>
                <span className="flex items-center gap-1.5" aria-label={`${left} moves left today`}>
                  {Array.from({ length: MOVES_PER_DAY }, (_, i) => (
                    <span key={i} className={`size-3.5 rounded-full border-2 border-ink ${i < left ? "bg-accent" : "bg-transparent"}`} />
                  ))}
                  <span className="ml-1 font-mono text-xs text-muted">{left} moves left today</span>
                </span>
                {me.stats && (
                  <span className="font-mono text-xs text-muted">
                    {me.stats.landed} landed · {me.stats.received} taken · {me.stats.notoriety} notoriety
                  </span>
                )}
                {economy.balance !== undefined && <span className="font-mono text-xs text-muted">{fmtChog(economy.balance)} $CHOG</span>}
              </div>
            </div>

            <Inherited mine={mine} address={address} />

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-display text-lg font-bold">Pick your move</legend>
              {PRANKS.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setKind(i)}
                  disabled={busy}
                  className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                    kind === i ? "translate-x-1 border-ink bg-ink text-paper" : "border-line hover:border-ink"
                  }`}
                >
                  <PrankIcon kind={i} />
                  <span className="flex flex-col">
                    <span className="font-bold">{p.name}</span>
                    <span className={`text-sm ${kind === i ? "opacity-70" : "text-muted"}`}>{p.line}</span>
                  </span>
                </button>
              ))}
            </fieldset>

            <button
              onClick={() => act("prank", mine, target, kind)}
              disabled={!canPrank}
              className="rounded-2xl border-[3px] border-ink bg-accent px-6 py-5 font-display text-3xl font-extrabold shadow-[6px_6px_0_0_var(--ink)] transition-all hover:-translate-y-0.5 active:translate-x-1.5 active:translate-y-1.5 active:shadow-none disabled:translate-x-0 disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none"
            >
              {busy ? "…" : hasTarget ? `PRANK #${target}` : "PRANK"}
            </button>
            {ownsTarget && <p className="text-sm text-danger">That one&apos;s in your own wallet. Pick someone else.</p>}
            {left === 0 && <p className="text-sm text-muted">Out of moves today. Paybacks are still free.</p>}
            {status.kind !== "idle" && status.kind !== "pending" && (
              <p role="status" className={`text-sm font-semibold ${status.kind === "error" ? "text-danger" : "text-ok"}`}>
                {status.text}
              </p>
            )}

            <Incoming
              mine={mine}
              rawScars={me.rawScars}
              disabled={busy}
              onPayback={(attacker) => {
                setTargetText(String(attacker));
                void act("payback", mine, attacker, kind);
              }}
            />
            <Beefs mine={mine} disabled={busy} />
          </aside>
        </div>
      )}
    </div>
  );
}

function Incoming({
  mine,
  rawScars,
  disabled,
  onPayback,
}: {
  mine: number;
  rawScars?: readonly { by: number; kind: number; heavy: boolean; at: number }[];
  disabled: boolean;
  onPayback: (attacker: number) => void;
}) {
  const now = useNow();
  const tx = useGrudgeTx();
  const { scrubPrice, balance } = useChogEconomy();
  // keep each scar's slot: scrubbing targets a slot
  const list = (rawScars ?? [])
    .map((s, slot) => ({ ...s, slot }))
    .filter((s) => s.by !== 0)
    .sort((a, b) => b.at - a.at);
  const attackers = [...new Set(list.map((s) => s.by))];
  const paybacks = useReadContracts({
    contracts: attackers.map((by) => ({ ...grudge, functionName: "paybackUntil" as const, args: [BigInt(mine), BigInt(by)] as const })),
    query: { enabled: attackers.length > 0 },
  });
  const open = new Map<number, number>();
  attackers.forEach((by, i) => {
    const r = paybacks.data?.[i];
    if (r?.status === "success" && now > 0 && Number(r.result) >= now) open.set(by, Number(r.result));
  });
  const cantAfford = scrubPrice !== undefined && balance !== undefined && balance < scrubPrice;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-lg font-bold">Done to {chogLabel(mine)}</h3>
        {list.length > 0 && <span className="font-mono text-xs text-muted">{list.length}/8 scars</span>}
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-muted">Clean face. Nobody&apos;s dared yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-xl border-2 border-ink">
          {list.map((s) => (
            <li key={`${s.slot}-${s.at}`} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <PrankIcon kind={s.kind} className="size-6 shrink-0" />
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-semibold">{PRANKS[s.kind]?.name}</span> by{" "}
                <Link href={`/chog/${s.by}`} className="font-mono underline">
                  #{s.by}
                </Link>
                {s.heavy && <span className="ml-1.5 rounded bg-danger px-1 py-0.5 font-mono text-[10px] text-paper">PAYBACK</span>}
                <span className="block font-mono text-xs text-muted">{timeAgo(s.at, now)}</span>
              </span>
              <span className="flex items-center gap-2">
                {open.has(s.by) && (
                  <button
                    onClick={() => onPayback(s.by)}
                    disabled={disabled || tx.busy}
                    className="rounded-lg border-2 border-ink bg-danger px-2.5 py-1.5 font-display text-sm font-extrabold text-paper shadow-[2px_2px_0_0_var(--ink)] disabled:opacity-40"
                  >
                    PAY BACK
                  </button>
                )}
                <button
                  onClick={() => tx.send({ fn: "scrub", args: [mine, s.slot], spend: scrubPrice, okText: `Scrubbed the ${PRANKS[s.kind]?.name.toLowerCase()} off.` })}
                  disabled={disabled || tx.busy || cantAfford || scrubPrice === undefined}
                  title={cantAfford ? `Needs ${fmtChog(scrubPrice)} $CHOG` : "Burn $CHOG to clean this scar off"}
                  className="rounded-lg border-2 border-ink px-2.5 py-1.5 text-xs font-bold hover:bg-ink hover:text-paper disabled:opacity-40"
                >
                  Scrub · {fmtChog(scrubPrice)}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <TxLine status={tx.status} />
    </section>
  );
}

/** Rivals of your Chog, with heat and the truce handshake (both sides burn $CHOG). */
function Beefs({ mine, disabled }: { mine: number; disabled: boolean }) {
  const log = useChogLog(mine);
  const tx = useGrudgeTx();
  const { trucePrice, balance } = useChogEconomy();
  const rivals = topRivals(mine, log.data ?? []);
  const reads = useReadContracts({
    contracts: rivals.flatMap((r) => [
      { ...grudge, functionName: "heat" as const, args: [mine, r.id] as const },
      { ...grudge, functionName: "truceOffered" as const, args: [BigInt(mine), BigInt(r.id)] as const },
      { ...grudge, functionName: "truceOffered" as const, args: [BigInt(r.id), BigInt(mine)] as const },
    ]),
    query: { enabled: rivals.length > 0 },
  });
  const cantAfford = trucePrice !== undefined && balance !== undefined && balance < trucePrice;

  if (!rivals.length) return null;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-lg font-bold">Beefs</h3>
        <span className="font-mono text-xs text-muted">truce: both sides burn {fmtChog(trucePrice)}</span>
      </div>
      <ul className="flex flex-col divide-y divide-line rounded-xl border-2 border-ink">
        {rivals.map((r, i) => {
          const get = (k: number) => reads.data?.[i * 3 + k];
          const heat = get(0)?.status === "success" ? Number(get(0)!.result) : 0;
          const iOffered = get(1)?.status === "success" && get(1)!.result === true;
          const theyOffered = get(2)?.status === "success" && get(2)!.result === true;
          return (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
              <Image src={portraitSrc(r.id)} alt="" width={36} height={36} className="rounded-md border-2 border-ink" />
              <span className="min-w-0 flex-1 text-sm">
                <Link href={`/chog/${r.id}`} className="font-semibold underline decoration-2 underline-offset-2">
                  {chogLabel(r.id)}
                </Link>
                <span className="block font-mono text-xs text-muted">
                  {r.dealt} dealt · {r.taken} taken
                </span>
              </span>
              <span className="flex gap-1" aria-label={`heat ${heat} of 3`}>
                {[0, 1, 2].map((k) => (
                  <span key={k} className={`h-5 w-2 rounded-full border-2 border-ink ${k < heat ? "bg-danger" : ""}`} />
                ))}
              </span>
              {theyOffered ? (
                <button
                  onClick={() => tx.send({ fn: "truce", args: [mine, r.id], spend: trucePrice, okText: `Truce with ${chogLabel(r.id)}. Beef over.` })}
                  disabled={disabled || tx.busy || cantAfford}
                  className="rounded-lg border-2 border-ink bg-ok px-2.5 py-1.5 text-xs font-bold text-paper disabled:opacity-40"
                >
                  Accept truce
                </button>
              ) : iOffered ? (
                <span className="rounded-lg border-2 border-dashed border-line px-2.5 py-1.5 text-xs text-muted">Truce offered</span>
              ) : heat > 0 ? (
                <button
                  onClick={() => tx.send({ fn: "truce", args: [mine, r.id], spend: trucePrice, okText: `Truce offered to ${chogLabel(r.id)}.` })}
                  disabled={disabled || tx.busy || cantAfford}
                  className="rounded-lg border-2 border-ink px-2.5 py-1.5 text-xs font-bold hover:bg-ink hover:text-paper disabled:opacity-40"
                >
                  Offer truce
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <TxLine status={tx.status} />
    </section>
  );
}

function TxLine({ status }: { status: TxStatus }) {
  if (status.kind === "idle") return null;
  const color = status.kind === "error" ? "text-danger" : status.kind === "ok" ? "text-ok" : "text-muted";
  return (
    <p role="status" className={`text-sm font-semibold ${color}`}>
      {status.text}
    </p>
  );
}

/** Shown when the connected wallet bought a Chog that already had history. */
function Inherited({ mine, address }: { mine: number; address: string }) {
  const log = useChogLog(mine);
  const inh = useInheritance(mine, log.data);
  if (!inh.handover || inh.handover.to.toLowerCase() !== address.toLowerCase()) return null;
  const rivals = topRivals(mine, inh.inherited).length;
  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-ink bg-ink p-4 text-paper">
      <span className="absolute top-3 -right-8 rotate-12 bg-accent px-10 py-0.5 font-mono text-[10px] font-bold text-ink">INHERITED</span>
      <p className="font-display text-lg leading-snug font-bold">
        {chogLabel(mine)} came with a past: {inh.inherited.length} recorded thing{inh.inherited.length === 1 ? "" : "s"} and {rivals} rival{rivals === 1 ? "" : "s"}.
      </p>
      <p className="text-sm opacity-80">Its enemies are yours now, and so are any paybacks it was owed.</p>
    </div>
  );
}
