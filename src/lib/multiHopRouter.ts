/**
 * Multi-hop swap route discovery and ranking for M4.
 * 
 * Handles:
 * - Multiple alternative routes detection
 * - Route ranking by gas cost, price impact, output amount
 * - Route parsing and hop-by-hop details
 * - Filter for best routes based on user preferences
 */

import { Token, getTokenAddress } from '@/config/tokens';
import { SupportedChainId } from '@/config/chains';

/**
 * Represents a single hop in a swap route.
 */
export interface RouteHop {
  inputToken: Token;
  outputToken: Token;
  inputAddress: string;
  outputAddress: string;
  routerContract: string;
  callData: string;
  estimatedOutput: string;
  estimatedGas: string;
  fees: {
    amount: string;
    percentage: number;
  };
}

/**
 * Represents a complete multi-hop swap route.
 */
export interface SwapRoute {
  hops: RouteHop[];
  inputToken: Token;
  outputToken: Token;
  inputAmount: string;
  expectedOutput: string;
  estimatedTotalGas: string;
  estimatedTotalFees: string;
  priceImpact: number;
  routeString: string; // e.g., "ETH → USDC → DAI"
  executionType: 'direct' | 'multicall' | 'sequential';
  rank: number; // Lower is better
}

/**
 * Filter criteria for route selection.
 */
export interface RouteFilterOptions {
  maxHops?: number;
  maxImpact?: number; // 0-100
  preferCheapestGas?: boolean;
  preferBestOutput?: boolean;
  excludeRouters?: string[];
}

/**
 * Discover multi-hop routes from routing API response.
 * 
 * Assumes the routing API returns a list of possible routes.
 * This function parses, validates, and ranks them.
 * 
 * @param apiRoutes Raw routes from routing API
 * @param inputToken Starting token
 * @param outputToken Target token
 * @param inputAmount Amount to swap
 * @param chainId EVM chain ID
 * @returns Sorted array of SwapRoute objects
 */
export function discoverMultiHopRoutes(
  apiRoutes: any[],
  inputToken: Token,
  outputToken: Token,
  inputAmount: string,
  chainId: SupportedChainId
): SwapRoute[] {
  if (!apiRoutes || apiRoutes.length === 0) {
    // Fallback to single-hop direct route if API returns nothing
    return [buildDirectRoute(inputToken, outputToken, inputAmount, chainId)];
  }

  const routes: SwapRoute[] = apiRoutes
    .map((apiRoute, index) => parseApiRoute(apiRoute, inputToken, outputToken, inputAmount, chainId, index))
    .filter((route): route is SwapRoute => route !== null)
    .sort((a, b) => a.rank - b.rank); // Sort by rank (lower is better)

  return routes;
}

/**
 * Parse a single route from the API response.
 */
function parseApiRoute(
  apiRoute: any,
  inputToken: Token,
  outputToken: Token,
  inputAmount: string,
  chainId: SupportedChainId,
  index: number
): SwapRoute | null {
  try {
    // Validate route structure
    if (!apiRoute.path || !apiRoute.output) {
      return null;
    }

    // Parse hops from path
    const hops = parseHops(apiRoute.path, apiRoute.callData, chainId);
    if (hops.length === 0) {
      return null;
    }

    // Calculate route metrics
    const totalGas = calculateTotalGas(hops);
    const totalFees = calculateTotalFees(hops);
    const routeString = generateRouteString(hops);
    const priceImpact = calculatePriceImpact(
      inputAmount,
      apiRoute.output,
      inputToken.decimals,
      outputToken.decimals
    );

    // Calculate ranking score (lower is better)
    const rank = calculateRouteRank(
      parseInt(totalGas),
      priceImpact,
      hops.length,
      index
    );

    return {
      hops,
      inputToken,
      outputToken,
      inputAmount,
      expectedOutput: apiRoute.output,
      estimatedTotalGas: totalGas,
      estimatedTotalFees: totalFees,
      priceImpact,
      routeString,
      executionType: determineExecutionType(hops.length),
      rank,
    };
  } catch (error) {
    console.error('Failed to parse route:', error);
    return null;
  }
}

/**
 * Build a direct (single-hop) route.
 */
function buildDirectRoute(
  inputToken: Token,
  outputToken: Token,
  inputAmount: string,
  chainId: SupportedChainId
): SwapRoute {
  const inputAddr = getTokenAddress(inputToken.id, chainId) || '';
  const outputAddr = getTokenAddress(outputToken.id, chainId) || '';

  return {
    hops: [
      {
        inputToken,
        outputToken,
        inputAddress: inputAddr,
        outputAddress: outputAddr,
        routerContract: process.env.NEXT_PUBLIC_SHELL_DEX_ROUTER_ADDRESS || '',
        callData: '0x',
        estimatedOutput: inputAmount, // Placeholder
        estimatedGas: '100000',
        fees: { amount: '0', percentage: 0.3 },
      },
    ],
    inputToken,
    outputToken,
    inputAmount,
    expectedOutput: inputAmount,
    estimatedTotalGas: '100000',
    estimatedTotalFees: '0',
    priceImpact: 0.3,
    routeString: `${inputToken.symbol} → ${outputToken.symbol}`,
    executionType: 'direct',
    rank: 0,
  };
}

/**
 * Parse hops from API route path.
 */
function parseHops(
  path: any,
  callDataArray: any[],
  chainId: SupportedChainId
): RouteHop[] {
  // This depends on the actual API response format
  // For now, return empty array as placeholder
  // Should be implemented based on Stargate/Shell DEX API spec
  return [];
}

/**
 * Calculate total gas for all hops.
 */
function calculateTotalGas(hops: RouteHop[]): string {
  const total = hops.reduce((sum, hop) => {
    return sum + BigInt(hop.estimatedGas || '0');
  }, BigInt(0));
  return total.toString();
}

/**
 * Calculate total fees for all hops.
 */
function calculateTotalFees(hops: RouteHop[]): string {
  const total = hops.reduce((sum, hop) => {
    return sum + parseFloat(hop.fees.amount || '0');
  }, 0);
  return total.toFixed(6);
}

/**
 * Generate human-readable route string.
 */
function generateRouteString(hops: RouteHop[]): string {
  if (hops.length === 0) return 'Unknown';
  
  const path = hops.map(hop => hop.outputToken.symbol).join(' → ');
  return hops[0].inputToken.symbol + ' → ' + path;
}

/**
 * Calculate price impact percentage.
 */
function calculatePriceImpact(
  inputAmount: string,
  outputAmount: string,
  inputDecimals: number,
  outputDecimals: number
): number {
  try {
    const input = parseFloat(inputAmount) / Math.pow(10, inputDecimals);
    const output = parseFloat(outputAmount) / Math.pow(10, outputDecimals);
    
    if (input === 0) return 0;
    
    // Simplified impact calculation
    // In production, should use actual price reference
    const impact = ((input - output) / input) * 100;
    return Math.max(0, impact);
  } catch {
    return 0;
  }
}

/**
 * Calculate route ranking score.
 * Lower score = better route.
 */
function calculateRouteRank(
  gasUsed: number,
  priceImpact: number,
  hopCount: number,
  apiOrder: number
): number {
  // Weight factors (adjust based on preference)
  const gasWeight = 0.4;
  const impactWeight = 0.4;
  const hopWeight = 0.1;
  const orderWeight = 0.1;

  const normalizedGas = Math.min(gasUsed / 500000, 1); // Normalize to 0-1
  const normalizedImpact = Math.min(priceImpact / 5, 1); // Normalize to 0-1
  const normalizedHops = (hopCount - 1) / 3; // Penalize more hops (max 4 hops = 1.0)
  const normalizedOrder = apiOrder / 10; // Prefer API order ranking

  return (
    normalizedGas * gasWeight +
    normalizedImpact * impactWeight +
    normalizedHops * hopWeight +
    normalizedOrder * orderWeight
  );
}

/**
 * Determine execution type based on hop count.
 */
function determineExecutionType(hopCount: number): 'direct' | 'multicall' | 'sequential' {
  if (hopCount === 1) return 'direct';
  if (hopCount <= 3) return 'multicall';
  return 'sequential';
}

/**
 * Filter routes based on user preferences.
 */
export function filterRoutes(
  routes: SwapRoute[],
  options: RouteFilterOptions
): SwapRoute[] {
  return routes.filter(route => {
    // Max hops filter
    if (options.maxHops && route.hops.length > options.maxHops) {
      return false;
    }

    // Max impact filter
    if (options.maxImpact && route.priceImpact > options.maxImpact) {
      return false;
    }

    // Exclude routers filter
    if (options.excludeRouters) {
      const hasExcludedRouter = route.hops.some(hop =>
        options.excludeRouters?.includes(hop.routerContract)
      );
      if (hasExcludedRouter) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Sort routes by criteria.
 */
export function sortRoutes(
  routes: SwapRoute[],
  criteria: 'bestOutput' | 'cheapestGas' | 'lowestImpact' = 'bestOutput'
): SwapRoute[] {
  const sorted = [...routes];

  switch (criteria) {
    case 'bestOutput':
      sorted.sort((a, b) => {
        const outA = BigInt(a.expectedOutput);
        const outB = BigInt(b.expectedOutput);
        return outB > outA ? 1 : -1;
      });
      break;

    case 'cheapestGas':
      sorted.sort((a, b) => {
        const gasA = BigInt(a.estimatedTotalGas);
        const gasB = BigInt(b.estimatedTotalGas);
        return gasA > gasB ? 1 : -1;
      });
      break;

    case 'lowestImpact':
      sorted.sort((a, b) => a.priceImpact - b.priceImpact);
      break;
  }

  return sorted;
}
