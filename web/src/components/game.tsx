"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAccount, useConnect, useDisconnect, usePublicClient, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { injected } from "wagmi/connectors";
import { isLocal } from "@/lib/chains";
import { explainError, GRUDGE_ADDRESS, isValidId, MOVES_PER_DAY, PRANKS, timeAgo } from "@/lib/game";
import { grudgeAbi } from "@/lib/grudge-abi";
import { useChogOwner, useNow, useOwnedChogs } from "@/lib/hooks";
import { DevPlayAs } from "./dev-play-as";

const grudge = { address: GRUDGE_ADDRESS!, abi: grudgeAbi } as const;

type Scar = { by: number; kind: number; heavy: boolean; at: number };

function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function Game() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  if (!GRUDGE_ADDRESS) {
    return <p className="p-8 font-mono text-sm">NEXT_PUBLIC_GRUDGE_ADDRESS is not set. Run scripts/dev-chain.sh.</p>;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-6 sm:px-8">
      <header className="flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-black tracking-tight">GRUDGE</h1>
          <span className="font-mono text-xs text-muted">{isLocal ? "local fork" : "monad"}</span>
        </div>
        {isConnected && address ? (
          <button onClick={() => disconnect()} className="font-mono text-sm text-muted hover:text-ink">
            {short(address)} · disconnect
          </button>
        ) : null}
      </header>

      {!isConnected || !address ? (
        <section className="flex max-w-xl flex-col gap-4">
          <p className="text-lg">
            Chogs prank other Chogs. Every prank sticks to the target&apos;s face, and the victim gets one payback
            that hits harder.
          </p>
          <button
            onClick={() => connect({ connector: injected() })}
            className="self-start rounded-md bg-ink px-4 py-2 font-semibold text-paper hover:opacity-90"
          >
            Connect wallet
          </button>
          {isLocal && <DevPlayAs />}
        </section>
      ) : (
        <Board address={address} />
      )}
    </div>
  );
}

function Board({ address }: { address: `0x${string}` }) {
  const owned = useOwnedChogs(address);
  const [picked, setMine] = useState<number>();
  const [target, setTarget] = useState("");
  const mine = picked !== undefined && owned.data?.includes(picked) ? picked : owned.data?.[0];

  const targetId = Number(target);

  return (
    <div className="grid gap-8 lg:grid-cols-[200px_1fr_320px]">
      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted">Your Chogs</h2>
        {owned.isLoading && <p className="text-sm text-muted">Reading 1,969 Chogs…</p>}
        {owned.isError && <p className="text-sm text-danger">Couldn&apos;t read ownership. Refresh to retry.</p>}
        {owned.data?.length === 0 && <p className="text-sm text-muted">This wallet holds no Chog Genesis.</p>}
        <ul className="flex flex-wrap gap-2 lg:flex-col">
          {owned.data?.map((id) => (
            <li key={id}>
              <button
                onClick={() => setMine(id)}
                className={`w-full rounded border px-3 py-2 text-left font-mono text-sm ${
                  mine === id ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"
                }`}
              >
                #{id}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {mine !== undefined ? (
        <section className="flex flex-col gap-8">
          <PrankForm mine={mine} target={target} setTarget={setTarget} />
          <ScarList id={mine} title={`Scars on #${mine}`} mine={mine} />
        </section>
      ) : (
        <div />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted">Target</h2>
        {isValidId(targetId) ? (
          <ScarList id={targetId} title={`Chog #${targetId}`} showOwner />
        ) : (
          <p className="text-sm text-muted">Enter a target id to inspect it.</p>
        )}
      </section>
    </div>
  );
}

function useSend() {
  const client = usePublicClient();
  const qc = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const [status, setStatus] = useState<{ kind: "idle" | "pending" | "ok" | "error"; text?: string }>({ kind: "idle" });

  async function send(fn: "prank" | "payback", args: readonly [number, number, number], okText: string) {
    setStatus({ kind: "pending", text: "Confirm in wallet…" });
    try {
      const hash = await writeContractAsync({ ...grudge, functionName: fn, args });
      setStatus({ kind: "pending", text: "Landing…" });
      const receipt = await client!.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Transaction reverted.");
      setStatus({ kind: "ok", text: okText });
      await qc.invalidateQueries();
    } catch (e) {
      setStatus({ kind: "error", text: explainError(e) });
    }
  }
  return { send, status };
}

function PrankForm({ mine, target, setTarget }: { mine: number; target: string; setTarget: (v: string) => void }) {
  const [kind, setKind] = useState(0);
  const { send, status } = useSend();
  const moves = useReadContract({ ...grudge, functionName: "movesLeft", args: [mine] });
  const left = moves.data ?? MOVES_PER_DAY;
  const t = Number(target);
  const canSend = isValidId(t) && t !== mine && left > 0 && status.kind !== "pending";

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Prank as #{mine}</h2>
        <span className="font-mono text-sm" aria-label={`${left} moves left today`}>
          {Array.from({ length: MOVES_PER_DAY }, (_, i) => (i < left ? "●" : "○")).join(" ")}
          <span className="ml-2 text-muted">{left} left today</span>
        </span>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Target Chog id
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          placeholder="1–1969"
          className="w-40 rounded border border-line bg-transparent px-3 py-2 font-mono"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm">Move</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {PRANKS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setKind(i)}
              className={`rounded border px-3 py-2 text-left text-sm ${
                kind === i ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"
              }`}
            >
              <span className="block font-semibold">{p.name}</span>
              <span className={`block text-xs ${kind === i ? "opacity-70" : "text-muted"}`}>{p.line}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-4">
        <button
          onClick={() => send("prank", [mine, t, kind], `${PRANKS[kind].name} landed on #${t}.`)}
          disabled={!canSend}
          className="rounded-md bg-accent px-5 py-2 font-bold text-ink disabled:opacity-40"
        >
          Prank #{isValidId(t) ? t : "…"}
        </button>
        <Status status={status} />
      </div>
    </div>
  );
}

function ScarList({ id, title, mine, showOwner }: { id: number; title: string; mine?: number; showOwner?: boolean }) {
  const scars = useReadContract({ ...grudge, functionName: "scars", args: [id] });
  const stats = useReadContract({ ...grudge, functionName: "stats", args: [id] });
  const owner = useChogOwner(showOwner ? id : undefined);

  const list: Scar[] = ((scars.data ?? []) as readonly Scar[])
    .filter((s) => s.by !== 0)
    .sort((a, b) => b.at - a.at);

  // For our own Chog: which attackers can we still pay back?
  const attackers = [...new Set(list.map((s) => s.by))];
  const paybacks = useReadContracts({
    contracts: attackers.map((by) => ({ ...grudge, functionName: "paybackUntil" as const, args: [BigInt(id), BigInt(by)] as const })),
    query: { enabled: mine !== undefined && attackers.length > 0 },
  });
  const now = useNow();
  const open = new Set(
    attackers.filter((_, i) => {
      const r = paybacks.data?.[i];
      return r?.status === "success" && Number(r.result) >= now;
    }),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-bold">{title}</h3>
        {stats.data && (
          <span className="font-mono text-xs text-muted">
            {stats.data.landed} landed · {stats.data.received} taken · {stats.data.notoriety} notoriety
          </span>
        )}
      </div>
      {showOwner && owner.data && <p className="font-mono text-xs text-muted">held by {short(owner.data)}</p>}
      {scars.isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted">Clean face. Nobody&apos;s touched it yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded border border-line">
          {list.map((s, i) => (
            <li key={`${s.by}-${s.at}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>
                <span className="font-semibold">{PRANKS[s.kind]?.name ?? "?"}</span>
                {s.heavy && <span className="ml-2 rounded bg-danger px-1.5 py-0.5 font-mono text-[10px] text-paper">PAYBACK</span>}
                <span className="ml-2 text-muted">
                  by <span className="font-mono">#{s.by}</span> · {timeAgo(s.at, now)}
                </span>
              </span>
              {mine !== undefined && open.has(s.by) && <PaybackButton mine={mine} attacker={s.by} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PaybackButton({ mine, attacker }: { mine: number; attacker: number }) {
  const { send, status } = useSend();
  return (
    <span className="flex items-center gap-2">
      {status.kind === "error" && <span className="text-xs text-danger">{status.text}</span>}
      <button
        onClick={() => send("payback", [mine, attacker, 0], `Paid back #${attacker}.`)}
        disabled={status.kind === "pending"}
        className="rounded bg-danger px-2 py-1 font-mono text-xs font-bold text-paper disabled:opacity-50"
      >
        {status.kind === "pending" ? "…" : "PAY BACK"}
      </button>
    </span>
  );
}

function Status({ status }: { status: { kind: string; text?: string } }) {
  if (status.kind === "idle") return null;
  const color = status.kind === "error" ? "text-danger" : status.kind === "ok" ? "text-ok" : "text-muted";
  return (
    <p role="status" className={`text-sm ${color}`}>
      {status.text}
    </p>
  );
}
