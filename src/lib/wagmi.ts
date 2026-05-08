/**
 * Wagmi client configuration for shell-dex M1.
 * 
 * This module exports a pre-configured wagmi client that:
 * - Connects Arbitrum One and Shell Testnet chains
 * - Uses MetaMask and WalletConnect as connector strategies
 * - Handles custom RPC endpoints defined in chain config
 */

import { createConfig, http } from 'wagmi';
import { arbitrum } from 'wagmi/chains';
import { metaMask, walletConnect } from 'wagmi/connectors';
import { arbitrumOne, shellTestnet } from '@/config/chains';

/**
 * Define a wagmi-compatible chain config for Shell Testnet (custom chain).
 * wagmi's built-in arbitrum chain is used for Arbitrum One.
 */
const shellTestnetWagmiChain = {
  id: shellTestnet.id,
  name: shellTestnet.name,
  nativeCurrency: shellTestnet.nativeCurrency,
  rpcUrls: {
    default: {
      http: shellTestnet.rpcUrls.default.http,
    },
    public: {
      http: shellTestnet.rpcUrls.public.http,
    },
  },
} as const;

/**
 * Wagmi configuration with Arbitrum and Shell Testnet support.
 */
export const wagmiConfig = createConfig({
  chains: [arbitrum, shellTestnetWagmiChain] as const,
  connectors: [
    metaMask(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
    }),
  ],
  transports: {
    [arbitrum.id]: http(arbitrumOne.rpcUrls.default.http[0]),
    [shellTestnetWagmiChain.id]: http(shellTestnet.rpcUrls.default.http[0]),
  },
});
