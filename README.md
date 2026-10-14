# Grudge

Chogs prank other Chogs onchain. Every prank leaves a scar on the target's art, beefs escalate token to token, and buyers inherit the enemies.

Built for [Chogathon 2026](https://chogathon.chog.xyz) on Monad, using the [Chog Genesis](https://monadscan.com/address/0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763) collection.

**Live:** https://grudge-taupe.vercel.app

## Try it

- **No wallet:** [`/studio`](https://grudge-taupe.vercel.app/studio). Play every prank on any of the 1,969 Chogs, including the heavy payback versions. Nothing touches the chain.
- **Watch:** [the Wall](https://grudge-taupe.vercel.app) shows every Chog live from the contract. [Feuds](https://grudge-taupe.vercel.app/feuds) maps who's beefing with whom. Every Chog has a rap sheet at `/chog/<id>`, with its own share card.
- **Play:** hold a Chog Genesis on Monad, connect, and open [`/prank`](https://grudge-taupe.vercel.app/prank).

## What's in it

- **Five pranks:** graffiti, hat steal, stink cloud, tomato, googly eyes. Each is an animated scene with sound that settles into a permanent scar on the target's art.
- **Daily limits:** 3 moves a day per Chog, and one hit per target per day.
- **Payback:** the victim gets one free payback for 3 days. It lands heavy, with a PAYBACK stamp.
- **Heat:** each beef between two Chogs runs 0–3, and cools by one level a day.
- **$CHOG burns:** scrub a scar (500), call a truce (250 each side), or post a bounty on any Chog. The next Chog to prank it collects, and 10% is burned.
- **Inheritance:** state is keyed by token id and ownership is checked onchain, so a sold Chog keeps its scars, rivals and open paybacks. Its rap sheet shows exactly what changed hands.
- **No indexer, no database:** every action is also appended to an onchain history log, which feeds the Wall, the feed, rap sheets and feuds.

## Deployment

| | Monad mainnet (chain 143) |
|---|---|
| Grudge | [`0x045b1A7f4e2e0998E12ca9c2FDcAe978Fc3A76D1`](https://monadscan.com/address/0x045b1A7f4e2e0998E12ca9c2FDcAe978Fc3A76D1) · [verified source](https://repo.sourcify.dev/contracts/full_match/143/0x045b1A7f4e2e0998E12ca9c2FDcAe978Fc3A76D1/) |
| Deployed | block 113,083,995 · tx [`0x7dca98af…`](https://monadscan.com/tx/0x7dca98afb4a76400c6361b70e4f1a09b1d56c0c8f42c2f4b85130136c92eba3e) |
| Chog Genesis | `0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763` |
| $CHOG | `0x350035555E10d9AfAF1566AaebfCeD5BA6C27777` |
| Prices | scrub 500 $CHOG · truce 250 $CHOG per side · bounty fee 10%, all burned |

See [ARCHITECTURE.md](ARCHITECTURE.md) for the design and milestones.

## Run it locally

Needs Node 20+ and [Foundry](https://getfoundry.sh).

```bash
git clone --recursive git@github.com:techbone/grudge.git && cd grudge

# 1. Local chain: forks Monad mainnet (real Chog Genesis + $CHOG), deploys Grudge,
#    writes the address into web/.env.local. Leave it running.
./scripts/dev-chain.sh

# 2. Web app
cd web && npm install && npm run dev   # http://localhost:3000
```

On the local fork you don't need to own a Chog: use **Play as the holder of Chog #N** to act as any real holder. The first load of "Your Chogs" takes about a minute while anvil pulls ownership data from mainnet, and it's instant after that.

## Contracts

```bash
cd contracts
forge test                                                                  # unit tests
forge test --fork-url https://rpc.monad.xyz --match-contract GrudgeForkTest # real Chog holders
```

After changing `Grudge.sol`, run `(cd contracts && forge build) && node scripts/export-abi.mjs` from the repo root to refresh the ABI the web app uses.
