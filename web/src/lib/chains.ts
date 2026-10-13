import { defineChain } from "viem";

const multicall3 = { address: "0xcA11bde05977b3631167028862bE2a173976CA11" as const };

export const monad = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://rpc.monad.xyz"] } },
  blockExplorers: { default: { name: "MonadScan", url: "https://monadscan.com" } },
  contracts: { multicall3 },
});

/** Anvil fork of Monad mainnet, see scripts/dev-chain.sh. */
export const monadLocal = defineChain({
  id: 31337,
  name: "Monad (local fork)",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
  contracts: { multicall3 },
  testnet: true,
});

export const isLocal = process.env.NEXT_PUBLIC_CHAIN === "local";
export const activeChain = isLocal ? monadLocal : monad;
