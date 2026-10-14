"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { usePublicClient, useReadContracts } from "wagmi";
import type { PortraitScar } from "@/components/scars/portrait";
import { scarSeed } from "@/components/scars/geometry";
import { GRUDGE_ADDRESS } from "./game";
import { grudgeAbi } from "./grudge-abi";

export const grudge = { address: GRUDGE_ADDRESS!, abi: grudgeAbi } as const;

export type Entry = { act: number; from: number; to: number; kind: number; at: number };
export type RawScar = { by: number; kind: number; heavy: boolean; at: number };

export const ACT = { PRANK: 0, PAYBACK: 1, SCRUB: 2, TRUCE: 3, BOUNTY_POSTED: 4, BOUNTY_CLAIMED: 5 } as const;

/** Onchain scars → what the portrait draws, oldest first so newer scars layer on top. */
export function toPortraitScars(target: number, scars: readonly RawScar[] | undefined): PortraitScar[] {
  return (scars ?? [])
    .filter((s) => s.by !== 0)
    .slice()
    .sort((a, b) => a.at - b.at)
    .map((s) => ({ kind: s.kind, by: s.by, heavy: s.heavy, seed: scarSeed(s.by, s.kind, s.at, target) }));
}

/** Scars, stats and moves for one Chog in a single multicall. */
export function useChogState(id: number | undefined) {
  const enabled = !!id && !!GRUDGE_ADDRESS;
  const res = useReadContracts({
    contracts: enabled
      ? [
          { ...grudge, functionName: "scars", args: [id!] },
          { ...grudge, functionName: "stats", args: [id!] },
          { ...grudge, functionName: "movesLeft", args: [id!] },
        ]
      : [],
    query: { enabled },
  });
  const [scars, stats, moves] = res.data ?? [];
  return {
    ...res,
    rawScars: scars?.status === "success" ? (scars.result as readonly RawScar[]) : undefined,
    scars: toPortraitScars(id ?? 0, scars?.status === "success" ? (scars.result as readonly RawScar[]) : undefined),
    stats: stats?.status === "success" ? stats.result : undefined,
    movesLeft: moves?.status === "success" ? Number(moves.result) : undefined,
  };
}

/** Everything done by or to a Chog, newest first (capped at the latest 200). */
export function useChogLog(id: number | undefined) {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["chog-log", id],
    enabled: !!id && !!client && !!GRUDGE_ADDRESS,
    queryFn: async () => {
      const len = Number(await client!.readContract({ ...grudge, functionName: "chogLogLength", args: [id!] }));
      const start = Math.max(0, len - 200);
      const entries = (await client!.readContract({
        ...grudge,
        functionName: "getChogLog",
        args: [id!, BigInt(start), BigInt(len - start)],
      })) as readonly Entry[];
      return [...entries].reverse();
    },
  });
}

/**
 * The global feed: polls the onchain log length and pulls only new entries. Monad blocks are
 * ~0.4s, so a 1.5s poll feels live. `fresh` holds entries that arrived since mount, for animating.
 */
export function useLiveLog(keep = 120, intervalMs = 1500) {
  const client = usePublicClient();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [fresh, setFresh] = useState<Entry[]>([]);
  const seen = useRef<number | null>(null);

  useEffect(() => {
    if (!client || !GRUDGE_ADDRESS) return;
    let stop = false;
    async function tick() {
      try {
        const len = Number(await client!.readContract({ ...grudge, functionName: "logLength" }));
        const from = seen.current === null ? Math.max(0, len - keep) : seen.current;
        if (len > from) {
          const got = (await client!.readContract({ ...grudge, functionName: "getLog", args: [BigInt(from), BigInt(len - from)] })) as readonly Entry[];
          if (stop) return;
          const isFirst = seen.current === null;
          seen.current = len;
          setEntries((prev) => [...[...got].reverse(), ...prev].slice(0, keep));
          if (!isFirst) setFresh([...got]);
        } else if (seen.current === null) {
          seen.current = len;
        }
      } catch {
        // transient RPC errors: try again next tick
      }
    }
    void tick();
    const t = setInterval(tick, intervalMs);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [client, keep, intervalMs]);

  return { entries, fresh };
}

/** Chogs this one has traded pranks with, most interactions first. */
export function topRivals(id: number, log: Entry[]) {
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
