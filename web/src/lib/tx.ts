"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { erc20Abi, formatUnits, type Abi } from "viem";
import { useAccount, usePublicClient, useReadContracts, useSwitchChain, useWriteContract } from "wagmi";
import { activeChain } from "./chains";
import { CHOG_TOKEN_ADDRESS, explainError, GRUDGE_ADDRESS } from "./game";
import { grudgeAbi } from "./grudge-abi";

export type TxStatus = { kind: "idle" | "pending" | "ok" | "error"; text?: string };

type GrudgeWrite = "prank" | "payback" | "scrub" | "truce" | "postBounty" | "cancelBounty";

/** Whole-token display for $CHOG amounts. */
export function fmtChog(v: bigint | undefined) {
  if (v === undefined) return "–";
  const n = Number(formatUnits(v, 18));
  return n.toLocaleString(undefined, { maximumFractionDigits: n < 10 ? 2 : 0 });
}

export function useWrongChain() {
  const { chainId, isConnected } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  return {
    wrong: isConnected && chainId !== activeChain.id,
    switching: isPending,
    switchToMonad: () => switchChainAsync({ chainId: activeChain.id }),
  };
}

/**
 * One path for every Grudge transaction: switch to Monad if needed, approve the exact $CHOG
 * burn if the allowance is short, send, wait, and refresh reads. Resolves to the block
 * timestamp of the receipt, or null on failure (the error is in `status`).
 */
export function useGrudgeTx() {
  const client = usePublicClient({ chainId: activeChain.id });
  const qc = useQueryClient();
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [status, setStatus] = useState<TxStatus>({ kind: "idle" });

  async function send(opts: { fn: GrudgeWrite; args: readonly unknown[]; spend?: bigint; okText: string; refresh?: boolean }) {
    if (!address || !client || !GRUDGE_ADDRESS) return null;
    try {
      if (chainId !== activeChain.id) {
        setStatus({ kind: "pending", text: "Switch to Monad in your wallet…" });
        await switchChainAsync({ chainId: activeChain.id });
      }
      if (opts.spend && opts.spend > 0n) {
        const allowance = await client.readContract({ address: CHOG_TOKEN_ADDRESS, abi: erc20Abi, functionName: "allowance", args: [address, GRUDGE_ADDRESS] });
        if (allowance < opts.spend) {
          setStatus({ kind: "pending", text: `Approve ${fmtChog(opts.spend)} $CHOG in your wallet…` });
          const h = await writeContractAsync({ chainId: activeChain.id, address: CHOG_TOKEN_ADDRESS, abi: erc20Abi, functionName: "approve", args: [GRUDGE_ADDRESS, opts.spend] });
          await client.waitForTransactionReceipt({ hash: h });
        }
      }
      setStatus({ kind: "pending", text: "Confirm in your wallet…" });
      const hash = await writeContractAsync({
        chainId: activeChain.id,
        address: GRUDGE_ADDRESS,
        abi: grudgeAbi as Abi,
        functionName: opts.fn,
        args: opts.args as never,
      });
      setStatus({ kind: "pending", text: "Landing…" });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Transaction reverted.");
      const block = await client.getBlock({ blockNumber: receipt.blockNumber });
      setStatus({ kind: "ok", text: opts.okText });
      if (opts.refresh !== false) await qc.invalidateQueries();
      return Number(block.timestamp);
    } catch (e) {
      setStatus({ kind: "error", text: explainError(e) });
      return null;
    }
  }

  return { send, status, setStatus, busy: status.kind === "pending" };
}

const grudge = { address: GRUDGE_ADDRESS!, abi: grudgeAbi } as const;

/** Burn prices from the contract, plus the viewer's $CHOG balance. */
export function useChogEconomy() {
  const { address } = useAccount();
  const res = useReadContracts({
    contracts: [
      { ...grudge, functionName: "scrubPrice" },
      { ...grudge, functionName: "trucePrice" },
      { ...grudge, functionName: "bountyFeeBps" },
      { address: CHOG_TOKEN_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [address ?? "0x0000000000000000000000000000000000000000"] },
    ],
    query: { enabled: !!GRUDGE_ADDRESS },
  });
  const [scrub, truce, fee, bal] = res.data ?? [];
  return {
    scrubPrice: scrub?.status === "success" ? (scrub.result as bigint) : undefined,
    trucePrice: truce?.status === "success" ? (truce.result as bigint) : undefined,
    bountyFeeBps: fee?.status === "success" ? Number(fee.result) : undefined,
    balance: address && bal?.status === "success" ? (bal.result as bigint) : undefined,
  };
}
