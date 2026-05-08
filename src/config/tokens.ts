/**
 * Supported token list for shell-dex M2.
 * 
 * Defines tokens available on each supported chain (Arbitrum One, Shell Testnet).
 * Token metadata includes symbol, decimals, and chain-specific addresses.
 */

import { SupportedChainId } from './chains';

export interface Token {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  addresses: Partial<Record<SupportedChainId, string>>;
  logoUrl?: string;
}

/**
 * Base stable coins and primary assets available on multiple chains.
 */
export const tokens: Token[] = [
  {
    id: 'eth',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    addresses: {
      42161: '0x0000000000000000000000000000000000000000', // Native on Arbitrum
      10: '0x0000000000000000000000000000000000000000', // Native on Shell Testnet
    },
  },
  {
    id: 'usdc',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    addresses: {
      42161: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5F86', // Arbitrum USDC.e
      10: '0x0000000000000000000000000000000000000001', // Placeholder for Shell Testnet
    },
  },
  {
    id: 'usdt',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    addresses: {
      42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // Arbitrum USDT
      10: '0x0000000000000000000000000000000000000002', // Placeholder for Shell Testnet
    },
  },
  {
    id: 'dai',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    addresses: {
      42161: '0xDA10009e962bF30dB994f59D57b01D466185CeFF', // Arbitrum DAI
      10: '0x0000000000000000000000000000000000000003', // Placeholder for Shell Testnet
    },
  },
  {
    id: 'arb',
    symbol: 'ARB',
    name: 'Arbitrum',
    decimals: 18,
    addresses: {
      42161: '0x912CE59144191c1204E64559FE8253a0e108FF4e', // Arbitrum ARB
      10: '0x0000000000000000000000000000000000000004', // Placeholder for Shell Testnet
    },
  },
  {
    id: 'shell',
    symbol: 'SHELL',
    name: 'Shell Token',
    decimals: 18,
    addresses: {
      42161: '0x0000000000000000000000000000000000000005', // Placeholder for Arbitrum
      10: '0x0000000000000000000000000000000000000006', // Placeholder for Shell Testnet
    },
  },
];

/**
 * Map token ID to Token object for quick lookups.
 */
export const tokenMap = new Map<string, Token>(tokens.map(t => [t.id, t]));

/**
 * Get token by ID.
 */
export function getToken(tokenId: string): Token | undefined {
  return tokenMap.get(tokenId);
}

/**
 * Get token address for a specific chain.
 */
export function getTokenAddress(
  tokenId: string,
  chainId: SupportedChainId
): string | undefined {
  const token = getToken(tokenId);
  if (!token) return undefined;
  return token.addresses[chainId];
}

/**
 * Get all tokens available on a specific chain.
 */
export function getTokensForChain(chainId: SupportedChainId): Token[] {
  return tokens.filter(t => chainId in t.addresses && t.addresses[chainId]);
}

/**
 * Get common trading pairs for quick selection.
 * Format: [inputTokenId, outputTokenId]
 */
export const commonPairs: Array<[string, string]> = [
  ['eth', 'usdc'],
  ['usdc', 'usdt'],
  ['usdc', 'dai'],
  ['eth', 'usdt'],
  ['arb', 'usdc'],
  ['shell', 'usdc'],
];

/**
 * Check if a token pair is valid on a given chain.
 */
export function isPairAvailable(
  inputTokenId: string,
  outputTokenId: string,
  chainId: SupportedChainId
): boolean {
  if (inputTokenId === outputTokenId) return false;
  
  const inputAddr = getTokenAddress(inputTokenId, chainId);
  const outputAddr = getTokenAddress(outputTokenId, chainId);
  
  return !!inputAddr && !!outputAddr;
}
