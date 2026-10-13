// Local fork only: stages a busy prank history so the Wall and rap sheets have something to show.
// Impersonates real Chog holders on the anvil fork (scripts/dev-chain.sh must be running).
//   node scripts/seed-beef.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "web/package.json"));
const { createPublicClient, createWalletClient, http, parseAbi } = await import(require.resolve("viem"));

const RPC = "http://127.0.0.1:8545";
const CHOG = "0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763";
const env = readFileSync(join(root, "web/.env.local"), "utf8");
const GRUDGE = env.match(/NEXT_PUBLIC_GRUDGE_ADDRESS=(0x[0-9a-fA-F]{40})/)?.[1];
if (!GRUDGE) throw new Error("No NEXT_PUBLIC_GRUDGE_ADDRESS in web/.env.local");

const chain = { id: 31337, name: "fork", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [RPC] } }, contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } } };
const pub = createPublicClient({ chain, transport: http(RPC) });
const wallet = createWalletClient({ chain, transport: http(RPC) });
if ((await pub.getChainId()) !== 31337) throw new Error("Refusing to run: not the local fork");

const chogAbi = parseAbi(["function ownerOf(uint256) view returns (address)"]);
const abi = parseAbi(["function prank(uint16 from, uint16 to, uint8 kind)", "function payback(uint16 from, uint16 to, uint8 kind)", "function logLength() view returns (uint256)"]);

// deterministic picks so reruns look the same
let seed = 1337;
const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
const pick = (xs) => xs[Math.floor(rand() * xs.length)];

// spread candidates across the whole wall
const candidates = Array.from({ length: 70 }, () => 1 + Math.floor(rand() * 1969));
const owners = await pub.multicall({ contracts: candidates.map((id) => ({ address: CHOG, abi: chogAbi, functionName: "ownerOf", args: [BigInt(id)] })) });
const ownerOf = new Map();
const seenOwner = new Set();
const players = [];
candidates.forEach((id, i) => {
  const o = owners[i].result;
  if (!o || seenOwner.has(o) || players.includes(id)) return;
  seenOwner.add(o);
  ownerOf.set(id, o);
  players.push(id);
});
console.log(`${players.length} players with distinct owners`);

for (const o of seenOwner) {
  await pub.request({ method: "anvil_impersonateAccount", params: [o] });
  await pub.request({ method: "anvil_setBalance", params: [o, "0x8AC7230489E80000"] });
}

let ok = 0, skipped = 0;
async function act(fn, from, to, kind) {
  try {
    const hash = await wallet.writeContract({ account: ownerOf.get(from), address: GRUDGE, abi, functionName: fn, args: [from, to, kind] });
    await pub.waitForTransactionReceipt({ hash });
    ok++;
    console.log(`  ${fn.padEnd(7)} #${from} -> #${to} kind ${kind}`);
  } catch (e) {
    skipped++;
    console.log(`  skip ${fn} #${from} -> #${to}: ${(e.shortMessage || e.message).split("\n")[0].slice(0, 80)}`);
  }
}

const [bully, bullied, ...rest] = players;

console.log("the bully");
for (const t of rest.slice(0, 3)) await act("prank", bully, t, pick([0, 3, 4]));

console.log("the most bullied");
for (const [i, a] of rest.slice(3, 11).entries()) await act("prank", a, bullied, i % 5);

console.log("rivalries");
for (let i = 0; i < 5; i++) {
  const a = rest[11 + i * 2], b = rest[12 + i * 2];
  await act("prank", a, b, pick([0, 1, 2, 3, 4]));
  await act("payback", b, a, pick([0, 1, 2, 3, 4]));
}

console.log("the finale (what Replay latest shows)");
const finale = rest.slice(21);
for (let i = 0; i < finale.length - 1 && i < 7; i++) {
  const a = finale[i], b = finale[finale.length - 1 - i];
  await act("prank", a, b, i % 5);
  if (i % 2 === 1) await act("payback", b, a, (i + 2) % 5);
}
await act("prank", bully, bullied, 1);

console.log(`done: ${ok} actions, ${skipped} skipped, log length ${await pub.readContract({ address: GRUDGE, abi, functionName: "logLength" })}`);
