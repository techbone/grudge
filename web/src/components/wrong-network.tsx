"use client";

import { useState } from "react";
import { activeChain } from "@/lib/chains";
import { useWrongChain } from "@/lib/tx";

/** Strip under the header when the wallet is on another chain. */
export function WrongNetwork() {
  const { wrong, switching, switchToMonad } = useWrongChain();
  const [error, setError] = useState<string>();
  if (!wrong) return null;
  return (
    <div role="alert" className="border-b-2 border-ink bg-accent text-ink">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2 sm:px-8">
        <span className="font-semibold">Your wallet is on another network. Grudge runs on {activeChain.name}.</span>
        <button
          onClick={() => switchToMonad().then(() => setError(undefined), (e: Error) => setError(e.message.split("\n")[0]))}
          disabled={switching}
          className="rounded-md border-2 border-ink bg-paper px-3 py-1 text-sm font-bold disabled:opacity-50"
        >
          {switching ? "Check your wallet…" : `Switch to ${activeChain.name}`}
        </button>
        {error && <span className="text-sm">{error}</span>}
      </div>
    </div>
  );
}
