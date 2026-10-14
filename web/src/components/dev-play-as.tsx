"use client";

import { useEffect, useRef, useState } from "react";
import { encodeAbiParameters, keccak256, pad, parseUnits, toHex } from "viem";
import { useAccount, usePublicClient, useConnect } from "wagmi";
import { mock } from "wagmi/connectors";
import { monadLocal } from "@/lib/chains";
import { CHOG_ADDRESS, CHOG_TOKEN_ADDRESS, chogOwnerAbi, isValidId } from "@/lib/game";

async function anvil(method: string, params: unknown[]) {
  const res = await fetch(monadLocal.rpcUrls.default.http[0], {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

const KEY = "grudge:dev-holder";

/** Impersonate a holder on anvil, top them up with gas and 10,000 test $CHOG. */
async function impersonate(holder: `0x${string}`) {
  await anvil("anvil_impersonateAccount", [holder]);
  await anvil("anvil_setBalance", [holder, "0x8AC7230489E80000"]); // 10 MON for gas
  // balances live in storage slot 0 of the token; only top up if they're running low
  const slot = keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [holder, 0n]));
  const current = BigInt(await anvil("eth_getStorageAt", [CHOG_TOKEN_ADDRESS, slot, "latest"]));
  if (current < parseUnits("1000", 18)) await anvil("anvil_setStorageAt", [CHOG_TOKEN_ADDRESS, slot, pad(toHex(parseUnits("10000", 18)))]);
}

export function forgetDevHolder() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}

/** Local fork only: after a reload or a typed URL, reconnect as the holder you were playing. */
export function DevAutoReconnect() {
  const { isConnected } = useAccount();
  const { connectAsync } = useConnect();
  const tried = useRef(false);
  useEffect(() => {
    if (isConnected || tried.current) return;
    tried.current = true;
    let holder: string | null = null;
    try {
      holder = window.localStorage.getItem(KEY);
    } catch {}
    if (!holder) return;
    impersonate(holder as `0x${string}`)
      .then(() => connectAsync({ connector: mock({ accounts: [holder as `0x${string}`] }) }))
      .catch(() => forgetDevHolder());
  }, [isConnected, connectAsync]);
  return null;
}

/**
 * Local fork only: act as whoever holds Chog #N on mainnet. Anvil impersonates the
 * holder (and tops them up with gas and test $CHOG), so transactions go through without
 * their key. Never rendered on mainnet.
 */
export function DevPlayAs() {
  const client = usePublicClient();
  const { connectAsync } = useConnect();
  const [id, setId] = useState("1");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function go() {
    const n = Number(id);
    if (!isValidId(n) || !client) return setError("Pick an id from 1 to 1969.");
    setBusy(true);
    setError(undefined);
    try {
      const holder = await client.readContract({
        address: CHOG_ADDRESS,
        abi: chogOwnerAbi,
        functionName: "ownerOf",
        args: [BigInt(n)],
      });
      await impersonate(holder);
      await connectAsync({ connector: mock({ accounts: [holder] }) });
      try {
        window.localStorage.setItem(KEY, holder);
      } catch {}
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-line p-3">
      <p className="font-mono text-xs uppercase tracking-wider text-muted">Local fork · dev only</p>
      <div className="flex items-center gap-2">
        <label htmlFor="play-as" className="text-sm">
          Play as the holder of Chog #
        </label>
        <input
          id="play-as"
          value={id}
          onChange={(e) => setId(e.target.value)}
          inputMode="numeric"
          className="w-20 rounded border border-line bg-transparent px-2 py-1 font-mono text-sm"
        />
        <button
          onClick={go}
          disabled={busy}
          className="rounded border border-line px-3 py-1 text-sm hover:bg-ink hover:text-paper disabled:opacity-50"
        >
          {busy ? "…" : "Go"}
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
