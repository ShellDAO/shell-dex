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

## M2 — Token Selection & Swap Routing

The second milestone (`M2`) builds on M1's foundation with swap functionality:

### M2 Features

✅ **Implemented:**
- Token selection UI with dropdowns for both input and output tokens
- Real-time quote fetching with mock routing data (0.3% fee model)
- Swap direction toggle (prevents duplicate token selection)
- Quote details: fees, price impact, minimum received amount
- Quote refresh control with auto-refresh on amount change (500ms debounce)
- Comprehensive error handling: route failures, network errors, validation
- Toast notification system for user feedback
- Automatic state reset on network switch
- Fixture-based routing for UI/UX validation (M3 will integrate real API)

🟡 **Planned (M3+):**
- Real Shell DEX routing API integration
- Transaction signing and submission
- Approval flows for ERC20 tokens
- Slippage tolerance settings
- Multi-hop route discovery
- Gas estimation and optimization

### Token Support (M2)

Supported tokens on each chain:

**Arbitrum One (42161):**
- ETH (native)
- USDC, USDT, DAI (stablecoins)
- ARB (governance token)
- SHELL (placeholder)

**Shell Testnet (10):**
- ETH (native)
- USDC, USDT, DAI (placeholder addresses)
- ARB, SHELL (placeholder addresses)

Token addresses on Shell Testnet are placeholders and will be updated as on-chain contracts are deployed.

### Testing M2 Locally

1. Start the dev server: `npm run dev`
2. Connect wallet and switch to Arbitrum One or Shell Testnet
3. In the Swap panel:
   - Select "From" token (e.g., ETH)
   - Enter an amount
   - Select "To" token (e.g., USDC)
   - Click "Refresh Quote" to fetch pricing
   - View quote details (fees, impact, min. received)
   - Quote expires after 30 seconds; refresh to update

M2 uses fixture data (0.3% fee) to test the UI flow. Real routing will integrate with Shell DEX API in M3.

## M3 — Transaction Execution & Signing

The third milestone (`M3`) brings full trading functionality with transaction execution:

### M3 Features

✅ **Implemented:**
- Real Shell DEX routing API integration (fallback to fixtures for testing)
- Token allowance checking and ERC20 approval flows
- Transaction building with slippage tolerance
- Swap execution state machine (approval → swap → confirmation)
- Slippage tolerance configuration (0-50%, default 0.5%)
- Gas estimation display
- Transaction status monitoring with TX hash tracking
- Receipt modal with block explorer links
- Retry logic for failed transactions

🟡 **Planned (M4+):**
- Multi-hop route discovery and UI display
- Advanced gas optimization strategies
- Bridge functionality
- Limit orders and conditional execution

### Testing M3 Locally

1. Start the dev server: `npm run dev`
2. Connect wallet and switch to Arbitrum One or Shell Testnet
3. In the Swap panel:
   - Select "From" and "To" tokens
   - Enter an amount
   - Click "Refresh Quote" to fetch pricing
   - Adjust slippage tolerance if needed (default 0.5%)
   - Click "Swap" to initiate the transaction
   - Approve token if required (displays as separate step)
   - Monitor transaction status in real-time
   - View receipt with explorer link after confirmation

### M3 Execution Flow

```
1. Quote Fetch
   ↓
2. User Reviews Quote
   ↓
3. Check Token Allowance
   ├─ If insufficient: Request Approval TX
   │  └─ Wait for Approval Confirmation
   ├─ Else: Skip to Swap
   ↓
4. Build Swap Transaction
   ├─ Apply slippage tolerance
   ├─ Validate transaction parameters
   ├─ Calculate minimum output
   ↓
5. Submit Swap Transaction
   ├─ User signs in wallet
   ├─ TX pending on chain
   ↓
6. Wait for Confirmation
   └─ Display receipt with TX hash and explorer link
```

### Slippage Tolerance

Slippage is the acceptable price difference between the quoted output and actual execution price. M3 includes:
- **Default:** 0.5% (typical for most swaps)
- **Range:** 0-50% (slider control)
- **Applied to:** Minimum output amount is recalculated as `expectedOutput * (1 - slippageTolerance)`
- **Impact:** Allows swaps to succeed even with minor price movements

Example: If quote shows 100 USDC output with 0.5% slippage, minimum accepted is 99.5 USDC.

### Gas Estimation

M3 displays estimated gas consumption from the routing API (if available). Users can see:
- Estimated gas units required
- Approximate transaction cost
- Gas price information (subject to network conditions)

Gas estimates are indicative and may vary based on network congestion.

### Error Recovery

If a transaction fails:
1. Error message is displayed with reason (insufficient balance, slippage exceeded, etc.)
2. "Retry" button appears to attempt the transaction again
3. Users can adjust slippage or amount and resubmit
4. All state persists for retry flow

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

### Client-Side Only (M1-M2)

All wallet interaction and swap state is client-side to avoid server component conflicts with browser APIs. The root layout uses `WagmiProviderWrapper` (a "use client" component) to provide wagmi context to the entire app.

### Swap State Management (M2)

The `useSwapState()` hook manages:
- **Token Selection:** Input and output token pairs with automatic validation
- **Amount Input:** User-entered swap amount with decimal validation
- **Quote Data:** Cached quote with expiry tracking (30-second TTL)
- **Loading/Error States:** Quote fetch status and error messages

State automatically resets when the user switches networks, preventing stale quotes on different chains.

### Routing Interface (M2)

`src/lib/swapRouter.ts` provides:
- **getQuote():** Fetch quote for a token pair and amount
- **Fixture Support:** M2 uses mock quotes for testing; real API in M3
- **Error Handling:** SwapError class with recovery suggestions

Router is configurable via `NEXT_PUBLIC_SHELL_DEX_ROUTER_URL` environment variable for production API deployment.

### Error Handling (M2)

`src/lib/swapErrors.ts` provides:
- **Token Validation:** Check pair validity and prevent duplicate tokens
- **Amount Validation:** Verify decimal places and positive amounts
- **Routing Errors:** Convert API errors into user-friendly messages
- **Recovery Suggestions:** Guide users to retry actions

Toast component (`src/components/Toast.tsx`) displays non-blocking notifications for errors, successes, and warnings.

### Transaction Execution (M3)

`src/lib/tokenApproval.ts` handles:
- **Allowance Checking:** Read ERC20 allowance from chain
- **Approval Transactions:** Build and encode `approve()` calls
- **Unlimited Approvals:** Default strategy to minimize repeated approvals

`src/lib/swapTransaction.ts` provides:
- **Slippage Calculation:** Convert tolerance percentage to minimum output amount
- **Transaction Building:** Construct viem Transaction from routing quote
- **Validation:** Ensure transaction data integrity before submission

`src/hooks/useSwapExecution.ts` manages:
- **Execution State Machine:** Idle → Checking → Approving → Swapping → Success/Failed
- **Flow Orchestration:** Chains approval (if needed) → swap submission → receipt waiting
- **Retry Logic:** Users can retry failed transactions with adjusted parameters

`src/components/ReceiptModal.tsx` displays:
- **Success/Failure Status:** Clear visual feedback with color coding
- **Transaction Details:** Hash, block number, confirmations
- **Block Explorer Link:** Direct link to transaction on chain explorer
- **Amount Summary:** Input/output tokens and amounts

### Extensibility

- **Adding Chains:** Define new chains in `src/config/chains.ts` and wagmi config in `src/lib/wagmi.ts`
- **Token Lists:** Add tokens to `src/config/tokens.ts` with per-chain addresses
- **Routing:** Replace fixture data in `src/lib/swapRouter.ts` with real API calls
- **Router Address:** Configure swap contract address via `NEXT_PUBLIC_SHELL_DEX_ROUTER_ADDRESS`
- **Slippage Defaults:** Adjust default tolerance in `src/components/SwapPanel.tsx`
- **RPC URLs:** Public RPCs are used by default; can be overridden via environment variables for production deploys


