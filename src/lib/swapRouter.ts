/**
 * Shell DEX routing interface for M2/M3.
 * 
 * Provides quote fetching from a routing service with optional fixture fallback.
 * 
 * M2 Status: Uses fixture data for UI/UX validation.
 * M3 Status: Integrated with real Shell DEX routing API; fixtures available for testing.
 */

import { Token, getTokenAddress } from '@/config/tokens';
import { SupportedChainId } from '@/config/chains';
import { Quote } from '@/hooks';

/**
 * Extended quote with transaction data for M3 execution.
 */
export interface SwapQuote extends Quote {
  swapContract?: string;
  callData?: string;
  estimatedGas?: string;
}

export interface SwapRouterConfig {
  routerApiUrl?: string;
  useFixtures?: boolean;
}

let routerConfig: SwapRouterConfig = {
  useFixtures: process.env.NODE_ENV !== 'production',
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
 * M3: Real routing API support with transaction data.
 * 
 * @param inputToken The token being sold
 * @param outputToken The token being bought
 * @param inputAmount The amount of input token (as decimal string)
 * @param chainId The EVM chain ID
 * @returns Quote data including output amount, fees, route, and M3 transaction data
 */
export async function getQuote(
  inputToken: Token,
  outputToken: Token,
  inputAmount: string,
  chainId: SupportedChainId
): Promise<SwapQuote> {
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

  // Try real API first in production, fallback to fixtures
  if (routerConfig.routerApiUrl) {
    try {
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

      const data = await response.json();
      return {
        ...data,
        // Ensure all required fields are present
        inputAmount: data.inputAmount || inputAmount,
        outputAmount: data.outputAmount,
        route: data.route || [inputToken.id, outputToken.id],
        fees: data.fees || { total: '0', percentage: 0 },
        priceImpact: data.priceImpact ?? 0,
        minReceived: data.minReceived || data.outputAmount,
        expireTime: data.expireTime || Date.now() + 30000,
        // M3 transaction data
        swapContract: data.swapContract,
        callData: data.callData,
        estimatedGas: data.estimatedGas,
      };
    } catch (error) {
      // Log error but don't fail; try fixtures if available
      console.error('Shell DEX routing API error:', error);
      if (!routerConfig.useFixtures) {
        throw error;
      }
    }
  }

  // Fallback to fixtures (M2 mode or API failure)
  if (routerConfig.useFixtures) {
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 200));
    return generateFixtureQuote(inputToken, outputToken, inputAmount, chainId);
  }

  throw new Error('Router not configured: no API URL or fixtures enabled');
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
