/**
 * Shell DEX routing interface for M2.
 * 
 * Provides quote fetching from a routing service or fixture data.
 * 
 * M2 Status: Uses fixture data for UI/UX validation.
 * M3 Status: Will integrate actual Shell DEX routing API.
 */

import { Token, getTokenAddress } from '@/config/tokens';
import { SupportedChainId } from '@/config/chains';
import { Quote } from '@/hooks';

export interface SwapRouterConfig {
  routerApiUrl?: string;
  useFixtures?: boolean;
}

let routerConfig: SwapRouterConfig = {
  useFixtures: true,
  routerApiUrl: process.env.NEXT_PUBLIC_SHELL_DEX_ROUTER_URL,
};

/**
 * Configure router behavior.
 */
export function configureRouter(config: SwapRouterConfig) {
  routerConfig = { ...routerConfig, ...config };
}

/**
 * Generate fixture quote data for testing.
 * 
 * In M3, this will be replaced with real routing API calls.
 */
function generateFixtureQuote(
  inputToken: Token,
  outputToken: Token,
  inputAmount: string,
  chainId: SupportedChainId
): Quote {
  // Simple mock calculation: assume 1:1 base rate with 0.3% fee
  const inputNum = parseFloat(inputAmount);
  if (isNaN(inputNum) || inputNum <= 0) {
    throw new Error('Invalid input amount');
  }

  const feePercentage = 0.3;
  const feeAmount = inputNum * (feePercentage / 100);
  const outputAmount = inputNum - feeAmount;

  const outputSymbol = outputToken.symbol;
  const minReceivedPercentage = 0.95; // 5% slippage tolerance
  const minReceived = outputAmount * minReceivedPercentage;

  return {
    inputAmount,
    outputAmount: outputAmount.toFixed(outputToken.decimals),
    route: [inputToken.id, outputToken.id], // Single-hop for M2
    fees: {
      total: feeAmount.toFixed(6),
      percentage: feePercentage,
    },
    priceImpact: 0.1, // 0.1% mock impact
    minReceived: minReceived.toFixed(outputToken.decimals),
    expireTime: Date.now() + 30000, // 30 seconds
  };
}

/**
 * Fetch a swap quote from the routing service or fixtures.
 * 
 * @param inputToken The token being sold
 * @param outputToken The token being bought
 * @param inputAmount The amount of input token (as decimal string)
 * @param chainId The EVM chain ID
 * @returns Quote data including output amount, fees, and route
 */
export async function getQuote(
  inputToken: Token,
  outputToken: Token,
  inputAmount: string,
  chainId: SupportedChainId
): Promise<Quote> {
  if (!inputToken || !outputToken || !inputAmount) {
    throw new Error('Missing required parameters for quote');
  }

  if (inputToken.id === outputToken.id) {
    throw new Error('Cannot swap token for itself');
  }

  const inputAddr = getTokenAddress(inputToken.id, chainId);
  const outputAddr = getTokenAddress(outputToken.id, chainId);

  if (!inputAddr || !outputAddr) {
    throw new Error(
      `Token not available on chain ${chainId}: ${inputToken.symbol} or ${outputToken.symbol}`
    );
  }

  // Use fixtures in M2; real API in M3
  if (routerConfig.useFixtures) {
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 200));
    return generateFixtureQuote(inputToken, outputToken, inputAmount, chainId);
  }

  // TODO: Integrate real Shell DEX routing API
  if (routerConfig.routerApiUrl) {
    const response = await fetch(`${routerConfig.routerApiUrl}/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputToken: inputAddr,
        outputToken: outputAddr,
        inputAmount,
        chainId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Router API error: ${response.statusText}`);
    }

    return response.json();
  }

  throw new Error('Router not configured: no API URL or fixtures');
}

/**
 * Validate if a token pair can be swapped on a given chain.
 */
export function canSwapPair(
  inputToken: Token,
  outputToken: Token,
  chainId: SupportedChainId
): boolean {
  if (inputToken.id === outputToken.id) return false;
  
  const inputAddr = getTokenAddress(inputToken.id, chainId);
  const outputAddr = getTokenAddress(outputToken.id, chainId);
  
  return !!inputAddr && !!outputAddr;
}

/**
 * Get all supported pairs for a given chain.
 * 
 * For M2, assumes all token combinations are valid.
 * M3+ can add additional filtering based on liquidity, etc.
 */
export function getSupportedPairs(chainId: SupportedChainId) {
  // TODO: Filter by chain and liquidity once routing API available
  // For M2, all pairs are theoretically supported
  return [];
}
