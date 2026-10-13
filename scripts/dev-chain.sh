#!/usr/bin/env bash
# Local dev chain: forks Monad mainnet (real Chog Genesis + $CHOG) as chain 31337,
# deploys Grudge, and writes the address into web/.env.local.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.foundry/bin:$PATH"
RPC_UPSTREAM="${MONAD_RPC_URL:-https://rpc.monad.xyz}"
PORT=8545
LOCAL="http://127.0.0.1:$PORT"
# anvil's default account 0
DEPLOYER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

anvil --fork-url "$RPC_UPSTREAM" --chain-id 31337 --port "$PORT" --silent &
ANVIL_PID=$!
trap 'kill $ANVIL_PID 2>/dev/null' EXIT INT TERM

for _ in $(seq 1 30); do cast chain-id -r "$LOCAL" >/dev/null 2>&1 && break; sleep 1; done

ADDR=$(cd "$ROOT/contracts" && forge script script/Deploy.s.sol --rpc-url "$LOCAL" --broadcast \
  --private-key "$DEPLOYER_KEY" 2>&1 | sed -n 's/.*Grudge deployed at \(0x[0-9a-fA-F]*\).*/\1/p')

if [ -z "$ADDR" ]; then echo "deploy failed"; exit 1; fi

ENV="$ROOT/web/.env.local"
touch "$ENV"
grep -v '^NEXT_PUBLIC_GRUDGE_ADDRESS=\|^NEXT_PUBLIC_CHAIN=' "$ENV" > "$ENV.tmp" || true
{ cat "$ENV.tmp"; echo "NEXT_PUBLIC_CHAIN=local"; echo "NEXT_PUBLIC_GRUDGE_ADDRESS=$ADDR"; } > "$ENV"
rm -f "$ENV.tmp"

echo "Grudge on local fork: $ADDR (chain 31337, $LOCAL)"
echo "Ctrl+C to stop."
wait $ANVIL_PID
