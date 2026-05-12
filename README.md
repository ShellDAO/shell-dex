# shell-dex

Shell DEX MVP frontend built with Next.js, wagmi, viem, and TanStack Query.

## MVP scope

The current app ships four wallet-driven surfaces:

- **Swap** — token selection, route-aware quoting, route selection, slippage controls, approvals, submission, and receipts
- **Pools** — liquidity pool summaries, wallet LP positions, add/remove flows, and liquidity activity
- **Portfolio** — wallet balances, pricing, LP exposure, portfolio mix, and shared activity/history
- **Bridge** — Arbitrum One ↔ Shell Testnet bridge quotes, readiness checks, staged execution, and bridge history

## Supported chains

- **Arbitrum One** (`42161`)
- **Shell Testnet** (`10`)

## Supported tokens

Current token fixtures and reads cover:

- ETH
- USDC
- USDT
- DAI
- ARB
- SHELL

Some Shell Testnet token addresses are still placeholders until final contracts are available.

## Feature notes

### Swap

- Fetches quotes from `NEXT_PUBLIC_SHELL_DEX_ROUTER_URL` when configured
- Falls back to deterministic local routes in non-production environments
- Supports direct and multi-hop route presentation
- Uses wallet-backed approvals and swap submission when the selected quote includes executable calldata
- Stores successful/failed swap receipts in the shared activity feed

### Pools

- Shows pool summaries and per-wallet LP positions
- Supports add/remove flows with simulated allowance and execution handling
- Reuses shared receipt/history plumbing so liquidity actions appear in portfolio activity

### Portfolio & activity

- Combines wallet balances and LP positions into one portfolio snapshot
- Reads balances from RPC when possible
- Falls back to deterministic wallet-linked balances when token contracts or reads are unavailable
- Persists recent swap, bridge, and liquidity history in browser `localStorage`

### Bridge

- Supports Arbitrum One ↔ Shell Testnet bridge routing
- Quotes and execution states are currently deterministic/simulated
- Tracks approval, source submission, in-transit, and delivery states
- Writes bridge results into the same shared activity/history layer used by portfolio

## Current limitations

- The app is **not production-ready**
- Wallet connection currently uses **injected wallets only**; WalletConnect is not wired in the active wagmi config
- Swap execution requires a configured router address and a quote that includes executable calldata
- Bridge execution is simulated end-to-end today
- Liquidity reads/writes are fixture-backed simulations rather than on-chain pool integrations
- Portfolio balances may fall back to deterministic simulated balances on unsupported token reads
- Shell Testnet token and contract addresses are still partly placeholder values

## Environment

Copy `.env.example` to `.env.local` and set values as needed:

```bash
cp .env.example .env.local
```

Available variables:

```bash
# Optional: live swap quote API
NEXT_PUBLIC_SHELL_DEX_ROUTER_URL=

# Optional: swap router used for executable quotes/swaps
NEXT_PUBLIC_SHELL_DEX_ROUTER_ADDRESS=

# Optional: simulated liquidity manager spender
NEXT_PUBLIC_SHELL_DEX_LIQUIDITY_MANAGER_ADDRESS=

# Optional: simulated bridge approvals/execution
NEXT_PUBLIC_STARGATE_ROUTER_ADDRESS=
NEXT_PUBLIC_STARGATE_EXECUTOR_ADDRESS=
```

If these are unset, the app uses built-in fallback values where supported.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validation scripts

- `npm run dev` — start the local Next.js app
- `npm run typecheck` — TypeScript no-emit validation
- `npm run build` — production build
- `npm run start` — serve the production build

## Local validation

Latest final-pass validation completed with:

```bash
npm run typecheck
npm run build
```

Both commands passed during this docs/validation update.
