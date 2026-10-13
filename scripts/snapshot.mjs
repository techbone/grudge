// Snapshots Chog Genesis metadata and art from Monad + IPFS.
//   node scripts/snapshot.mjs            # resumable; raw files cached in .cache/
// Writes:
//   web/src/data/chogs.json              id, name, traits for all 1,969 tokens
//   web/public/chogs/384/<id>.webp       portraits
//   web/public/chogs/atlas-<n>.webp      128px tiles, 16x16 per sheet, for the Wall
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "web/package.json"));
const sharp = require("sharp");
const { createPublicClient, http } = await import(require.resolve("viem"));

const RPC = process.env.MONAD_RPC_URL || "https://rpc.monad.xyz";
const CHOG = "0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763";
const MAX_ID = 1969;
const GATEWAYS = ["https://ipfs.filebase.io/ipfs/", "https://ipfs.filebase.io/ipfs/", "https://gateway.pinata.cloud/ipfs/"];
const CONCURRENCY = Number(process.env.CONCURRENCY || 8);
const TILE = 128;
const PER_ROW = 16;
const PER_SHEET = PER_ROW * PER_ROW;

const cache = join(root, ".cache/snapshot");
const out = { data: join(root, "web/src/data"), portraits: join(root, "web/public/chogs/384"), atlas: join(root, "web/public/chogs") };
for (const d of [cache, join(cache, "meta"), join(cache, "img"), ...Object.values(out)]) mkdirSync(d, { recursive: true });

const abi = [{ type: "function", name: "tokenURI", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "string" }] }];
const client = createPublicClient({
  transport: http(RPC),
  chain: { id: 143, name: "Monad", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [RPC] } }, contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } } },
});

// 1. tokenURI for every id (cached)
const uriFile = join(cache, "uris.json");
let uris = existsSync(uriFile) ? JSON.parse(readFileSync(uriFile, "utf8")) : null;
if (!uris) {
  uris = {};
  for (let i = 1; i <= MAX_ID; i += 400) {
    const ids = Array.from({ length: Math.min(400, MAX_ID + 1 - i) }, (_, j) => i + j);
    const res = await client.multicall({ contracts: ids.map((id) => ({ address: CHOG, abi, functionName: "tokenURI", args: [BigInt(id)] })) });
    res.forEach((r, j) => { if (r.status !== "success") throw new Error(`tokenURI ${ids[j]} failed`); uris[ids[j]] = r.result; });
  }
  writeFileSync(uriFile, JSON.stringify(uris));
}
console.log(`tokenURIs: ${Object.keys(uris).length}`);

async function fetchIpfs(ipfsUri, asJson) {
  const path = ipfsUri.replace("ipfs://", "");
  let last;
  for (let attempt = 0; attempt < 6; attempt++) {
    const gw = GATEWAYS[attempt % GATEWAYS.length];
    try {
      const res = await fetch(gw + path, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`${res.status} ${gw}`);
      if (asJson) return await res.json();
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) throw new Error(`tiny body from ${gw}`);
      return buf;
    } catch (e) {
      last = e;
      const wait = String(e.message).startsWith("429") ? 5000 : 1000;
      await new Promise((r) => setTimeout(r, wait * (attempt + 1)));
    }
  }
  throw last;
}

async function pool(items, fn) {
  let i = 0, done = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
      if (++done % 50 === 0) console.log(`  ${done}/${items.length}`);
    }
  });
  await Promise.all(workers);
}

// 2. metadata + art per token (cached by token id)
const ids = Array.from({ length: MAX_ID }, (_, i) => i + 1);
const failed = [];
await pool(ids, async (id) => {
  const metaPath = join(cache, "meta", `${id}.json`);
  const imgPath = join(cache, "img", `${id}.webp`);
  const portrait = join(out.portraits, `${id}.webp`);
  try {
    if (!existsSync(metaPath)) writeFileSync(metaPath, JSON.stringify(await fetchIpfs(uris[id], true)));
    const meta = JSON.parse(readFileSync(metaPath, "utf8"));
    if (!existsSync(imgPath)) writeFileSync(imgPath, await fetchIpfs(meta.image, false));
    if (!existsSync(portrait)) await sharp(imgPath).resize(384).webp({ quality: 80 }).toFile(portrait);
  } catch (e) {
    failed.push(id);
    console.log(`  ! #${id}: ${e.message}`);
  }
});
if (failed.length) {
  console.log(`${failed.length} failed, rerun to retry: ${failed.join(",")}`);
  process.exit(1);
}

// 3. chogs.json
const chogs = ids.map((id) => {
  const meta = JSON.parse(readFileSync(join(cache, "meta", `${id}.json`), "utf8"));
  const traits = Object.fromEntries((meta.attributes || []).map((a) => [a.trait_type, a.value]));
  return { id, name: meta.name, traits };
});
writeFileSync(join(out.data, "chogs.json"), JSON.stringify(chogs));
console.log(`wrote chogs.json (${chogs.length})`);

// 4. Wall atlases: sheet n holds ids [n*256+1, n*256+256], row-major
const sheets = Math.ceil(MAX_ID / PER_SHEET);
for (let n = 0; n < sheets; n++) {
  const composites = [];
  for (let k = 0; k < PER_SHEET; k++) {
    const id = n * PER_SHEET + k + 1;
    if (id > MAX_ID) break;
    const input = await sharp(join(cache, "img", `${id}.webp`)).resize(TILE).toBuffer();
    composites.push({ input, left: (k % PER_ROW) * TILE, top: Math.floor(k / PER_ROW) * TILE });
  }
  await sharp({ create: { width: TILE * PER_ROW, height: TILE * PER_ROW, channels: 3, background: "#1b1a17" } })
    .composite(composites)
    .webp({ quality: 78 })
    .toFile(join(out.atlas, `atlas-${n}.webp`));
  console.log(`atlas-${n}.webp`);
}
console.log("done");
