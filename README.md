# Grudge

Chogs prank other Chogs onchain. Every prank leaves a scar on the target's art, beefs escalate token to token, and buyers inherit the enemies.

Built for [Chogathon 2026](https://chogathon.chog.xyz) on Monad, using the [Chog Genesis](https://monadscan.com/address/0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763) collection.

Work in progress. See [ARCHITECTURE.md](ARCHITECTURE.md) for the design and milestones.

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
