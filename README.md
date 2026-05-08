# shell-dex

Minimal bootstrap for the Shell DEX submodule.

## Scope

This repository starts as a lightweight frontend/bootstrap workspace for the future Shell DEX product surface. It intentionally does **not** ship the full trading stack in the first commit; the goal is to provide:

- a standalone repository under `ShellDAO/shell-dex`
- a local development fork workflow via `LucienSong/shell-dex`
- a runnable web app skeleton for iterative feature work
- a dedicated `agents/` directory for AI-agent-specific assets

## M1 — Wallet Connect & Network Support

The first development milestone (`M1`) includes:

### Supported Networks

- **Arbitrum One** (chainId: 42161)
- **Shell Testnet** (chainId: 10)

### M1 Features

✅ **Implemented:**
- Wallet connection via MetaMask and WalletConnect
- Network switching and detection
- Custom chain (Shell Testnet) support with automatic `wallet_addEthereumChain` prompts
- Chain status and RPC connectivity display
- Extensible DEX UI skeleton

🟡 **Planned (M2/M3):**
- Token selection and swap routing
- Transaction signing and execution
- Liquidity management
- Bridge functionality

### Environment Configuration

Create a `.env.local` file for local development (`.env.example` shows required variables):

```bash
# Required for WalletConnect support
# Get your project ID from: https://cloud.walletconnect.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

## Local development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

### Testing Wallet Connection

1. Install **MetaMask** or **WalletConnect-compatible wallet** extension
2. Create or import an account
3. Open http://localhost:3000
4. Click "Connect Wallet"
5. Select a connector (MetaMask, WalletConnect, etc.)
6. Approve the connection in your wallet
7. Use the network switcher to select Arbitrum One or Shell Testnet

### Shell Testnet Setup

The first time you switch to Shell Testnet from a connected wallet:

1. Click "Network" selector → choose "Shell Testnet"
2. Your wallet will prompt: "Allow this site to add a network?"
3. Confirm to add Shell Testnet (chainId 10, `https://rpc.testnet.shell.network`)

## Scripts

- `npm run dev` — start local development server (http://localhost:3000)
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run typecheck` — TypeScript no-emit validation

## Repository conventions

- Application code lives in `app/`
- Component code lives in `src/components/`
- Configuration (chains, wagmi setup) lives in `src/config/` and `src/lib/`
- Shared agent assets must live in `agents/`
- Root workspace mirror lives in `workspace/projects/shell-dex/` in the parent `shell-dev` repository

## Architecture Notes

### Client-Side Only (M1)

All wallet interaction is client-side to avoid server component conflicts with browser APIs. The root layout uses `WagmiProviderWrapper` (a "use client" component) to provide wagmi context to the entire app.

### Extensibility

- **Adding Chains:** Define new chains in `src/config/chains.ts` and wagmi config in `src/lib/wagmi.ts`
- **Token Lists:** Can be added to `src/config/` and consumed by the token selector (planned M2)
- **RPC URLs:** Public RPCs are used by default; can be overridden via environment variables for production deploys

