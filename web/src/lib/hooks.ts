"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { CHOG_ADDRESS, chogOwnerAbi, MAX_ID } from "./game";

const CHUNK = 400;

/**
 * Chog Genesis isn't ERC721Enumerable, so we find a wallet's Chogs by reading ownerOf for
 * every id through Multicall3 (5 calls for the whole collection).
 */
export function useOwnedChogs(owner: Address | undefined) {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["owned-chogs", owner],
    enabled: !!owner && !!client,
    staleTime: 60_000,
    queryFn: async () => {
      const ids = Array.from({ length: MAX_ID }, (_, i) => i + 1);
      const owned: number[] = [];
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const res = await client!.multicall({
          allowFailure: true,
          contracts: slice.map((id) => ({
            address: CHOG_ADDRESS,
            abi: chogOwnerAbi,
            functionName: "ownerOf" as const,
            args: [BigInt(id)] as const,
          })),
        });
        res.forEach((r, j) => {
          if (r.status === "success" && (r.result as Address).toLowerCase() === owner!.toLowerCase()) {
            owned.push(slice[j]);
          }
        });
      }
      return owned;
    },
  });
}

export function useChogOwner(id: number | undefined) {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["chog-owner", id],
    enabled: !!id && !!client,
    queryFn: () =>
      client!.readContract({
        address: CHOG_ADDRESS,
        abi: chogOwnerAbi,
        functionName: "ownerOf",
        args: [BigInt(id!)],
      }),
  });
}

/** Unix seconds, refreshed every `intervalMs`, so render stays pure. */
export function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
