/**
 * Multi-hop swap route discovery and ranking for the Shell DEX swap flow.
 */

import type { SupportedChainId } from '@/config/chains';
import {
  type Token,
  getToken,
  getTokenAddress,
  getTokensForChain,
  tokens,
} from '@/config/tokens';

export interface RouteHop {
  inputToken: Token;
  outputToken: Token;
  inputAddress: string;
  outputAddress: string;
  routerContract?: string;
  provider: string;
  callData?: string;
  estimatedOutput: string;
  estimatedGas: string;
  fees: {
    amount: string;
    percentage: number;
  };
}

export interface SwapRoute {
  id: string;
  provider: string;
  hops: RouteHop[];
  inputToken: Token;
  outputToken: Token;
  inputAmount: string;
  expectedOutput: string;
  minReceived: string;
  estimatedTotalGas: string;
  estimatedTotalFees: string;
  totalFeePercentage: number;
  priceImpact: number;
  routePath: string[];
  routeString: string;
  executionType: 'direct' | 'multicall' | 'sequential';
  rank: number;
  swapContract?: string;
  callData?: string;
  isSimulated?: boolean;
}

export interface RouteFilterOptions {
  maxHops?: number;
  maxImpact?: number;
  preferCheapestGas?: boolean;
  preferBestOutput?: boolean;
  excludeRouters?: string[];
}

export interface DiscoverRoutesOptions {
  swapContract?: string;
  callData?: string;
  estimatedGas?: string;
  outputAmount?: string;
  minReceived?: string;
  fees?: {
    total?: string;
    percentage?: number;
  };
  priceImpact?: number;
  provider?: string;
  useFixtureRoutes?: boolean;
  tradeType?: 'exactIn' | 'exactOut';
}

type RouteLike = Record<string, unknown>;

const DEFAULT_DIRECT_GAS = 140000;
const DEFAULT_HOP_GAS = 90000;
const INTERMEDIARY_PRIORITY = ['usdc', 'usdt', 'dai', 'eth', 'arb', 'shell'];

export function discoverMultiHopRoutes(
  apiRoutes: unknown[],
  inputToken: Token,
  outputToken: Token,
  inputAmount: string,
  chainId: SupportedChainId,
  options: DiscoverRoutesOptions = {}
): SwapRoute[] {
  const rawRoutes = Array.isArray(apiRoutes) ? apiRoutes : [];

  const parsedRoutes = rawRoutes
    .map((candidate, index) =>
      parseApiRoute(candidate, inputToken, outputToken, inputAmount, chainId, options, index)
    )
    .filter((route): route is SwapRoute => route !== null);

  if (parsedRoutes.length > 0) {
    return rankRoutes(parsedRoutes);
  }

  if (options.useFixtureRoutes === false) {
    return [];
  }

  return buildDeterministicFixtureRoutes(inputToken, outputToken, inputAmount, chainId, options);
}

function parseApiRoute(
  candidate: unknown,
  inputToken: Token,
  outputToken: Token,
  inputAmount: string,
  chainId: SupportedChainId,
  options: DiscoverRoutesOptions,
  index: number
): SwapRoute | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const route = candidate as RouteLike;
  const pathTokens = resolveRouteTokens(route, inputToken, outputToken, chainId);
  if (pathTokens.length < 2) {
    return null;
  }

  const hopCount = pathTokens.length - 1;
  const routeOutput = coerceAmount(
    route.output ?? route.outputAmount ?? route.expectedOutput,
    options.outputAmount ?? inputAmount
  );
  const priceImpact = coerceNumber(route.priceImpact, options.priceImpact ?? Math.max(0.15, hopCount * 0.12));
  const totalFeePercentage = coerceNumber(
    route.fees && typeof route.fees === 'object' ? (route.fees as RouteLike).percentage : undefined,
    options.fees?.percentage ?? hopCount * 0.3
  );
  const totalFees = coerceAmount(
    route.fees && typeof route.fees === 'object' ? (route.fees as RouteLike).total : undefined,
    estimateFeeAmount(inputAmount, totalFeePercentage)
  );
  const totalGas = coerceAmount(
    route.estimatedGas ?? route.gas ?? route.gasEstimate,
    String(DEFAULT_DIRECT_GAS + (hopCount - 1) * DEFAULT_HOP_GAS)
  );
  const minReceived = coerceAmount(route.minReceived, computeMinReceived(routeOutput, 0.005));
  const provider = firstString(route.provider, route.label, route.source, options.provider) ?? 'Shell Router';
  const sharedSwapContract = firstString(
    route.swapContract,
    route.routerContract,
    route.router,
    options.swapContract
  );
  const sharedCallData = firstString(route.callData, options.callData);
  const hopEntries = readArray(route.hops) ?? [];

  const perHopGasValues = splitMetricAcrossHops(totalGas, hopCount);
  const perHopFeeValues = splitDecimalAcrossHops(totalFees, hopCount);
  const perHopFeePercentages = splitNumberAcrossHops(totalFeePercentage, hopCount);
  const perHopOutputs = interpolateHopOutputs(routeOutput, pathTokens, hopCount);

  const hops: RouteHop[] = Array.from({ length: hopCount }, (_, hopIndex) => {
    const hopCandidate = hopEntries[hopIndex] ?? {};
    const input = pathTokens[hopIndex];
    const output = pathTokens[hopIndex + 1];
    const hopRoute = typeof hopCandidate === 'object' && hopCandidate ? (hopCandidate as RouteLike) : {};

    return {
      inputToken: input,
      outputToken: output,
      inputAddress: getTokenAddress(input.id, chainId) ?? '',
      outputAddress: getTokenAddress(output.id, chainId) ?? '',
      routerContract: firstString(hopRoute.routerContract, hopRoute.router, sharedSwapContract),
      provider: firstString(hopRoute.provider, provider) ?? provider,
      callData: firstString(hopRoute.callData, hopIndex === hopCount - 1 ? sharedCallData : undefined),
      estimatedOutput: coerceAmount(hopRoute.output ?? hopRoute.outputAmount, perHopOutputs[hopIndex]),
      estimatedGas: coerceAmount(hopRoute.estimatedGas ?? hopRoute.gas, perHopGasValues[hopIndex]),
      fees: {
        amount: coerceAmount(
          hopRoute.fees && typeof hopRoute.fees === 'object'
            ? (hopRoute.fees as RouteLike).amount
            : undefined,
          perHopFeeValues[hopIndex]
        ),
        percentage: coerceNumber(
          hopRoute.fees && typeof hopRoute.fees === 'object'
            ? (hopRoute.fees as RouteLike).percentage
            : undefined,
          perHopFeePercentages[hopIndex]
        ),
      },
    };
  });

  const id = firstString(route.id, route.routeId) ?? buildRouteId(pathTokens, provider, index);

  return {
    id,
    provider,
    hops,
    inputToken,
    outputToken,
    inputAmount,
    expectedOutput: routeOutput,
    minReceived,
    estimatedTotalGas: totalGas,
    estimatedTotalFees: totalFees,
    totalFeePercentage,
    priceImpact,
    routePath: pathTokens.map(token => token.id),
    routeString: generateRouteStringFromTokens(pathTokens),
    executionType: determineExecutionType(hopCount),
    rank: index,
    swapContract: sharedSwapContract,
    callData: sharedCallData,
  };
}

export function buildDeterministicFixtureRoutes(
  inputToken: Token,
  outputToken: Token,
  inputAmount: string,
  chainId: SupportedChainId,
  options: DiscoverRoutesOptions = {}
): SwapRoute[] {
  const amount = parseNumericAmount(inputAmount);
  const seed = hashSeed(`${chainId}:${inputToken.id}:${outputToken.id}:${inputAmount}`);
  const availableTokens = getTokensForChain(chainId).filter(
    token => token.id !== inputToken.id && token.id !== outputToken.id
  );
  const intermediaries = INTERMEDIARY_PRIORITY.map(id => availableTokens.find(token => token.id === id))
    .filter((token): token is Token => Boolean(token))
    .slice(0, 2);

  const candidatePaths: Token[][] = [[inputToken, outputToken]];
  for (const intermediary of intermediaries) {
    candidatePaths.push([inputToken, intermediary, outputToken]);
  }

  const baseRate = 1 - ((seed % 11) + 6) / 1000;

  const routes = candidatePaths.map((pathTokens, index) => {
    const hopCount = pathTokens.length - 1;
    const isDirect = hopCount === 1;
    const routeSeed = hashSeed(`${seed}:${pathTokens.map(token => token.id).join('>')}`);
    const routeBoost = ((routeSeed % 9) - 4) / 10000;
    const effectiveRate = Math.max(baseRate + routeBoost - (hopCount - 1) * 0.0012, 0.1);
    const feePercentage = 0.3 + (hopCount - 1) * 0.08;
    const gas = String(DEFAULT_DIRECT_GAS + (hopCount - 1) * DEFAULT_HOP_GAS + (routeSeed % 9000));
    const resolvedInputAmount =
      options.tradeType === 'exactOut'
        ? formatAmount(Math.max(amount / effectiveRate, amount), inputToken.decimals)
        : inputAmount;
    const outputValue =
      options.tradeType === 'exactOut'
        ? amount
        : Math.max(amount * effectiveRate, amount * 0.9);
    const outputAmount = formatAmount(outputValue, outputToken.decimals);
    const totalFees = estimateFeeAmount(resolvedInputAmount, feePercentage);
    const minReceived =
      options.tradeType === 'exactOut'
        ? outputAmount
        : computeMinReceived(outputAmount, 0.005);
    const provider = isDirect ? 'Shell Direct' : `${pathTokens[1].symbol} relay`;
    const pathId = buildRouteId(pathTokens, provider, index);
    const hopGas = splitMetricAcrossHops(gas, hopCount);
    const hopFees = splitDecimalAcrossHops(totalFees, hopCount);
    const hopFeePercentages = splitNumberAcrossHops(feePercentage, hopCount);
    const hopOutputs = interpolateHopOutputs(outputAmount, pathTokens, hopCount);
    const simulated = !options.callData || !isDirect;

    const hops: RouteHop[] = Array.from({ length: hopCount }, (_, hopIndex) => ({
      inputToken: pathTokens[hopIndex],
      outputToken: pathTokens[hopIndex + 1],
      inputAddress: getTokenAddress(pathTokens[hopIndex].id, chainId) ?? '',
      outputAddress: getTokenAddress(pathTokens[hopIndex + 1].id, chainId) ?? '',
      routerContract: options.swapContract,
      provider,
      callData: options.callData,
      estimatedOutput: hopOutputs[hopIndex],
      estimatedGas: hopGas[hopIndex],
      fees: {
        amount: hopFees[hopIndex],
        percentage: hopFeePercentages[hopIndex],
      },
    }));

    return {
      id: pathId,
      provider,
      hops,
      inputToken,
      outputToken,
      inputAmount: resolvedInputAmount,
      expectedOutput: outputAmount,
      minReceived,
      estimatedTotalGas: gas,
      estimatedTotalFees: totalFees,
      totalFeePercentage: feePercentage,
      priceImpact: 0.18 + (hopCount - 1) * 0.09 + ((routeSeed % 7) / 100),
      routePath: pathTokens.map(token => token.id),
      routeString: generateRouteStringFromTokens(pathTokens),
      executionType: determineExecutionType(hopCount),
      rank: index,
      swapContract: options.swapContract,
      callData: options.callData,
      isSimulated: simulated,
    } satisfies SwapRoute;
  });

  return rankRoutes(routes);
}

export function filterRoutes(routes: SwapRoute[], options: RouteFilterOptions): SwapRoute[] {
  return routes.filter(route => {
    if (options.maxHops && route.hops.length > options.maxHops) {
      return false;
    }

    if (options.maxImpact && route.priceImpact > options.maxImpact) {
      return false;
    }

    if (options.excludeRouters?.length) {
      const hasExcludedRouter = route.hops.some(hop =>
        hop.routerContract ? options.excludeRouters?.includes(hop.routerContract) : false
      );
      if (hasExcludedRouter) {
        return false;
      }
    }

    return true;
  });
}

export function sortRoutes(
  routes: SwapRoute[],
  criteria: 'bestOutput' | 'cheapestGas' | 'lowestImpact' = 'bestOutput'
): SwapRoute[] {
  const sorted = [...routes];

  switch (criteria) {
    case 'cheapestGas':
      sorted.sort((a, b) => Number(a.estimatedTotalGas) - Number(b.estimatedTotalGas));
      break;
    case 'lowestImpact':
      sorted.sort((a, b) => a.priceImpact - b.priceImpact);
      break;
    case 'bestOutput':
    default:
      sorted.sort((a, b) => Number(b.expectedOutput) - Number(a.expectedOutput));
      break;
  }

  return sorted.map((route, index) => ({ ...route, rank: index }));
}

function resolveRouteTokens(
  route: RouteLike,
  inputToken: Token,
  outputToken: Token,
  chainId: SupportedChainId
): Token[] {
  const rawPath =
    readArray(route.path) ??
    readArray(route.route) ??
    readArray(route.routePath) ??
    readArray(route.tokens) ??
    readArray(route.tokenPath) ??
    (readArray(route.hops)?.flatMap((hop, index, hops) => {
      if (!hop || typeof hop !== 'object') {
        return [];
      }
      const routeHop = hop as RouteLike;
      const pieces = [routeHop.inputToken ?? routeHop.fromToken, routeHop.outputToken ?? routeHop.toToken];
      return index === 0 || index === hops.length - 1 ? pieces : [pieces[0]];
    }) ?? []);

  const resolved = rawPath
    .map(item => resolveTokenDescriptor(item, chainId))
    .filter((token): token is Token => Boolean(token));

  const normalized = [inputToken, ...resolved, outputToken].filter(
    (token, index, list) => index === 0 || list[index - 1].id !== token.id
  );

  if (normalized[0]?.id !== inputToken.id) {
    normalized.unshift(inputToken);
  }
  if (normalized[normalized.length - 1]?.id !== outputToken.id) {
    normalized.push(outputToken);
  }

  return normalized;
}

function resolveTokenDescriptor(candidate: unknown, chainId: SupportedChainId): Token | undefined {
  if (!candidate) {
    return undefined;
  }

  if (typeof candidate === 'string') {
    return resolveTokenString(candidate, chainId);
  }

  if (typeof candidate === 'object') {
    const descriptor = candidate as RouteLike;
    const nestedToken = descriptor.token;
    if (nestedToken && nestedToken !== candidate) {
      return resolveTokenDescriptor(nestedToken, chainId);
    }

    return (
      resolveTokenString(firstString(descriptor.id, descriptor.tokenId, descriptor.symbol) ?? '', chainId) ??
      resolveTokenString(firstString(descriptor.address, descriptor.tokenAddress) ?? '', chainId)
    );
  }

  return undefined;
}

function resolveTokenString(value: string, chainId: SupportedChainId): Token | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.toLowerCase();
  return (
    getToken(normalized) ??
    tokens.find(token => token.symbol.toLowerCase() === normalized) ??
    tokens.find(token => (token.addresses[chainId] ?? '').toLowerCase() === normalized)
  );
}

function rankRoutes(routes: SwapRoute[]): SwapRoute[] {
  return [...routes]
    .sort((left, right) => {
      const outputDelta = Number(right.expectedOutput) - Number(left.expectedOutput);
      if (Math.abs(outputDelta) > Number.EPSILON) {
        return outputDelta;
      }

      const impactDelta = left.priceImpact - right.priceImpact;
      if (Math.abs(impactDelta) > Number.EPSILON) {
        return impactDelta;
      }

      const gasDelta = Number(left.estimatedTotalGas) - Number(right.estimatedTotalGas);
      if (gasDelta !== 0) {
        return gasDelta;
      }

      return left.hops.length - right.hops.length;
    })
    .map((route, index) => ({ ...route, rank: index }));
}

function generateRouteStringFromTokens(pathTokens: Token[]): string {
  return pathTokens.map(token => token.symbol).join(' → ');
}

function determineExecutionType(hopCount: number): 'direct' | 'multicall' | 'sequential' {
  if (hopCount <= 1) {
    return 'direct';
  }
  if (hopCount <= 3) {
    return 'multicall';
  }
  return 'sequential';
}

function estimateFeeAmount(inputAmount: string, feePercentage: number): string {
  const amount = parseNumericAmount(inputAmount);
  return (amount * (feePercentage / 100)).toFixed(6);
}

function computeMinReceived(outputAmount: string, slippageTolerance: number): string {
  const output = parseNumericAmount(outputAmount);
  const minimum = Math.max(output * (1 - slippageTolerance), 0);
  return formatAmount(minimum, inferDecimalPlaces(outputAmount));
}

function interpolateHopOutputs(totalOutput: string, pathTokens: Token[], hopCount: number): string[] {
  const total = parseNumericAmount(totalOutput);
  return Array.from({ length: hopCount }, (_, hopIndex) => {
    const progress = (hopIndex + 1) / hopCount;
    return formatAmount(total * progress, pathTokens[hopIndex + 1].decimals);
  });
}

function splitMetricAcrossHops(total: string, hopCount: number): string[] {
  const totalValue = Math.max(0, Math.round(Number(total)));
  const base = hopCount > 0 ? Math.floor(totalValue / hopCount) : totalValue;
  const remainder = hopCount > 0 ? totalValue % hopCount : 0;
  return Array.from({ length: hopCount }, (_, index) => String(base + (index < remainder ? 1 : 0)));
}

function splitDecimalAcrossHops(total: string, hopCount: number): string[] {
  const totalValue = parseNumericAmount(total);
  const share = hopCount > 0 ? totalValue / hopCount : totalValue;
  return Array.from({ length: hopCount }, () => share.toFixed(6));
}

function splitNumberAcrossHops(total: number, hopCount: number): number[] {
  const share = hopCount > 0 ? total / hopCount : total;
  return Array.from({ length: hopCount }, () => Number(share.toFixed(4)));
}

function coerceAmount(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return fallback;
}

function coerceNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return undefined;
}

function readArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function parseNumericAmount(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAmount(value: number, decimals: number): string {
  const precision = Math.min(Math.max(decimals, 2), 6);
  return value.toFixed(precision);
}

function inferDecimalPlaces(value: string): number {
  const [, fraction = ''] = value.split('.');
  return Math.max(2, Math.min(fraction.length || 6, 6));
}

function buildRouteId(pathTokens: Token[], provider: string, index: number): string {
  return `${provider.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${pathTokens
    .map(token => token.id)
    .join('-')}-${index}`;
}

function hashSeed(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}
