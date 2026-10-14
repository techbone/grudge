import { cacheLife } from "next/cache";
import { createPublicClient, http, parseAbiItem, type Address } from "viem";

// Chog Genesis transfers since Grudge went live, for the "changed hands" banner.
// Monad's main public RPC caps eth_getLogs at 100 blocks; rpc2 allows 10,000, so we scan in
// 10k windows once and then only the new blocks. On mainnet the scan result sits in the shared
// remote cache, so cold serverless instances answer from it instead of rescanning.

const isLocal = process.env.NEXT_PUBLIC_CHAIN === "local";
const RPC = process.env.LOGS_RPC_URL || (isLocal ? "http://127.0.0.1:8545" : "https://rpc2.monad.xyz");
const CHOG: Address = "0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763";
const GRUDGE = process.env.NEXT_PUBLIC_GRUDGE_ADDRESS as Address | undefined;
const MAINNET_DEPLOY_BLOCK = 113_083_995n;
const WINDOW = 10_000n;
const PARALLEL = 10;
const transfer = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)");

const client = createPublicClient({ transport: http(RPC) });

type Move = { block: string; from: Address; to: Address };
const state = {
  from: null as bigint | null,
  upTo: 0n,
  byToken: new Map<number, Move[]>(),
  blockTime: new Map<string, number>(),
  syncing: null as Promise<void> | null,
  lastSync: 0,
};

/** First block where the Grudge contract has code (binary search; local fork only). */
async function deployBlock(): Promise<bigint> {
  if (!isLocal || !GRUDGE) return MAINNET_DEPLOY_BLOCK;
  let lo = 0n;
  let hi = await client.getBlockNumber();
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    const code = await client.getCode({ address: GRUDGE, blockNumber: mid }).catch(() => undefined);
    if (code && code !== "0x") hi = mid;
    else lo = mid + 1n;
  }
  return lo;
}

async function sync() {
  if (state.from === null) {
    state.from = await deployBlock();
    state.upTo = state.from - 1n;
  }
  const head = await client.getBlockNumber();
  const windows: [bigint, bigint][] = [];
  for (let s = state.upTo + 1n; s <= head; s += WINDOW) windows.push([s, s + WINDOW - 1n > head ? head : s + WINDOW - 1n]);
  for (let i = 0; i < windows.length; i += PARALLEL) {
    const batch = windows.slice(i, i + PARALLEL);
    const results = await Promise.all(batch.map(([fromBlock, toBlock]) => client.getLogs({ address: CHOG, event: transfer, fromBlock, toBlock })));
    for (const logs of results) {
      for (const l of logs) {
        const id = Number(l.args.tokenId);
        const list = state.byToken.get(id) ?? [];
        list.push({ block: l.blockNumber.toString(), from: l.args.from!, to: l.args.to! });
        state.byToken.set(id, list);
      }
    }
    state.upTo = batch[batch.length - 1][1];
  }
  state.lastSync = Date.now();
}

type Snapshot = { from: string; upTo: string; byToken: Record<string, Move[]> };

function snapshot(): Snapshot {
  return { from: String(state.from), upTo: String(state.upTo), byToken: Object.fromEntries(state.byToken) };
}

async function sharedTransfers(): Promise<Snapshot> {
  "use cache: remote";
  cacheLife({ stale: 30, revalidate: 60, expire: 86_400 });
  await sync();
  return snapshot();
}

async function localTransfers(): Promise<Snapshot> {
  if (Date.now() - state.lastSync > 2_000) {
    state.syncing ??= sync().finally(() => (state.syncing = null));
    await state.syncing;
  }
  return snapshot();
}

export async function GET(_req: Request, ctx: RouteContext<"/api/transfers/[id]">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1 || id > 1969) return Response.json({ error: "bad id" }, { status: 400 });
  try {
    const snap = isLocal ? await localTransfers() : await sharedTransfers();
    const moves = snap.byToken[String(id)] ?? [];
    const out = await Promise.all(
      moves.map(async (m) => {
        let at = state.blockTime.get(m.block);
        if (at === undefined) {
          at = Number((await client.getBlock({ blockNumber: BigInt(m.block) })).timestamp);
          state.blockTime.set(m.block, at);
        }
        return { ...m, at };
      }),
    );
    return Response.json({ id, since: snap.from, scannedTo: snap.upTo, transfers: out }, { headers: { "cache-control": "public, max-age=5" } });
  } catch (e) {
    return Response.json({ error: (e as Error).message.split("\n")[0] }, { status: 502 });
  }
}
