import { type Address } from 'viem';
import { chainIds, type SupportedChainId } from '@/config/chains';
import { getToken, type Token } from '@/config/tokens';
import { getTokenPrices } from '@/lib/priceOracle';
import { isNativeTokenAddress } from '@/lib/tokenApproval';

interface LiquidityPoolFixture {
  id: string;
  chainId: SupportedChainId;
  token0Id: string;
  token1Id: string;
  feeBps: number;
  reserve0: number;
  reserve1: number;
  volume24hUsd: number;
  liquidityProviderCount: number;
  strategy: string;
}

export interface LiquidityPoolSummary {
  id: string;
  chainId: SupportedChainId;
  token0: Token;
  token1: Token;
  pairLabel: string;
  feeBps: number;
  feeTierLabel: string;
  tvlUsd: number;
  volume24hUsd: number;
  aprPercent: number;
}

export interface LiquidityPoolDetail extends LiquidityPoolSummary {
  reserve0: number;
  reserve1: number;
  fees24hUsd: number;
  liquidityProviderCount: number;
  strategy: string;
}

export interface LiquidityPosition {
  id: string;
  chainId: SupportedChainId;
  owner: string;
  poolId: string;
  pairLabel: string;
  feeTierLabel: string;
  token0: Token;
  token1: Token;
  sharePercent: number;
  deposited0: number;
  deposited1: number;
  valueUsd: number;
  fees24hUsd: number;
  aprPercent: number;
  strategy: string;
}

export interface LiquidityActivity {
  id: string;
  chainId: SupportedChainId;
  owner: string;
  poolId: string;
  pairLabel: string;
  mode: 'add' | 'remove';
  token0: Token;
  token1: Token;
  token0Amount: number;
  token1Amount: number;
  sharePercentDelta: number;
  valueUsdDelta: number;
  txHash: string;
  timestamp: number;
}

export interface SimulatedAllowanceCheckResult {
  currentAllowance: bigint;
  isApprovalNeeded: boolean;
  approvalAmount: bigint;
}

export interface SimulatedLiquidityMutation {
  chainId: SupportedChainId;
  owner: string;
  poolId: string;
  mode: 'add' | 'remove';
  token0Amount: number;
  token1Amount: number;
  txHash: string;
}

interface LiquidityReadProvider {
  getPoolSummaries(chainId: SupportedChainId): Promise<LiquidityPoolSummary[]>;
  getPoolDetail(
    chainId: SupportedChainId,
    poolId: string
  ): Promise<LiquidityPoolDetail | null>;
  getUserPositions(
    chainId: SupportedChainId,
    owner: string
  ): Promise<LiquidityPosition[]>;
}

interface RuntimePoolDelta {
  reserve0Delta: number;
  reserve1Delta: number;
  liquidityProviderDelta: number;
}

interface RuntimePositionDelta {
  deposited0Delta: number;
  deposited1Delta: number;
}

const liquidityFixtures: Record<SupportedChainId, LiquidityPoolFixture[]> = {
  [chainIds.arbitrumOne]: [
    {
      id: 'arb-eth-usdc-30',
      chainId: chainIds.arbitrumOne,
      token0Id: 'eth',
      token1Id: 'usdc',
      feeBps: 30,
      reserve0: 420,
      reserve1: 1_520_000,
      volume24hUsd: 820_000,
      liquidityProviderCount: 184,
      strategy: 'Full range',
    },
    {
      id: 'arb-usdc-usdt-5',
      chainId: chainIds.arbitrumOne,
      token0Id: 'usdc',
      token1Id: 'usdt',
      feeBps: 5,
      reserve0: 710_000,
      reserve1: 695_000,
      volume24hUsd: 540_000,
      liquidityProviderCount: 142,
      strategy: 'Stable range',
    },
    {
      id: 'arb-usdc-dai-5',
      chainId: chainIds.arbitrumOne,
      token0Id: 'usdc',
      token1Id: 'dai',
      feeBps: 5,
      reserve0: 585_000,
      reserve1: 575_000,
      volume24hUsd: 410_000,
      liquidityProviderCount: 108,
      strategy: 'Stable range',
    },
    {
      id: 'arb-arb-usdc-30',
      chainId: chainIds.arbitrumOne,
      token0Id: 'arb',
      token1Id: 'usdc',
      feeBps: 30,
      reserve0: 1_850_000,
      reserve1: 880_000,
      volume24hUsd: 680_000,
      liquidityProviderCount: 97,
      strategy: 'Directional',
    },
  ],
  [chainIds.shellTestnet]: [
    {
      id: 'shell-eth-usdc-30',
      chainId: chainIds.shellTestnet,
      token0Id: 'eth',
      token1Id: 'usdc',
      feeBps: 30,
      reserve0: 84,
      reserve1: 312_000,
      volume24hUsd: 145_000,
      liquidityProviderCount: 26,
      strategy: 'Bootstrap range',
    },
    {
      id: 'shell-usdc-usdt-5',
      chainId: chainIds.shellTestnet,
      token0Id: 'usdc',
      token1Id: 'usdt',
      feeBps: 5,
      reserve0: 225_000,
      reserve1: 221_000,
      volume24hUsd: 96_000,
      liquidityProviderCount: 18,
      strategy: 'Stable range',
    },
    {
      id: 'shell-shell-usdc-30',
      chainId: chainIds.shellTestnet,
      token0Id: 'shell',
      token1Id: 'usdc',
      feeBps: 30,
      reserve0: 3_800_000,
      reserve1: 362_000,
      volume24hUsd: 112_000,
      liquidityProviderCount: 23,
      strategy: 'Bootstrap range',
    },
    {
      id: 'shell-eth-shell-100',
      chainId: chainIds.shellTestnet,
      token0Id: 'eth',
      token1Id: 'shell',
      feeBps: 100,
      reserve0: 42,
      reserve1: 1_450_000,
      volume24hUsd: 88_000,
      liquidityProviderCount: 12,
      strategy: 'Volatile range',
    },
  ],
};

const FIXTURE_LATENCY_MS = 120;
const MAX_ACTIVITY_ITEMS = 8;
const MIN_POSITION_AMOUNT = 0.000001;

const runtimePoolDeltas = new Map<string, RuntimePoolDelta>();
const runtimePositionDeltas = new Map<string, RuntimePositionDelta>();
const simulatedAllowances = new Map<string, bigint>();
const recentLiquidityActivities: LiquidityActivity[] = [];
const liquidityActivityListeners = new Set<() => void>();

function requireToken(tokenId: string): Token {
  const token = getToken(tokenId);

  if (!token) {
    throw new Error(`Unknown liquidity fixture token: ${tokenId}`);
  }

  return token;
}

function formatFeeTierLabel(feeBps: number): string {
  return `${(feeBps / 100).toFixed(2)}%`;
}

async function withFixtureLatency<T>(value: T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, FIXTURE_LATENCY_MS));
  return value;
}

function buildPositionIndexes(seed: number, poolCount: number): number[] {
  const desiredCount = Math.min(poolCount, 1 + (seed % 2));
  const indexes = new Set<number>();
  let cursor = seed % Math.max(poolCount, 1);

  while (indexes.size < desiredCount) {
    indexes.add(cursor % poolCount);
    cursor += 3;
  }

  return Array.from(indexes);
}

function getAddressSeed(address: string, chainId: SupportedChainId): number {
  const normalized = address.toLowerCase().replace(/^0x/, '');
  const chunks = [0, 8, 16, 24, 32].map((offset) => normalized.slice(offset, offset + 8));

  return chunks.reduce<number>(
    (sum, chunk) => sum + parseInt(chunk || '0', 16),
    Number(chainId)
  );
}

function getPoolKey(chainId: SupportedChainId, poolId: string): string {
  return `${chainId}:${poolId}`;
}

function getPositionKey(chainId: SupportedChainId, owner: string, poolId: string): string {
  return `${chainId}:${owner.toLowerCase()}:${poolId}`;
}

function getAllowanceKey(
  chainId: SupportedChainId,
  owner: string,
  tokenAddress: Address,
  spenderAddress: Address
): string {
  return `${chainId}:${owner.toLowerCase()}:${tokenAddress.toLowerCase()}:${spenderAddress.toLowerCase()}`;
}

function notifyLiquidityActivityListeners() {
  liquidityActivityListeners.forEach((listener) => listener());
}

function addRecentLiquidityActivity(activity: LiquidityActivity) {
  recentLiquidityActivities.unshift(activity);

  if (recentLiquidityActivities.length > MAX_ACTIVITY_ITEMS) {
    recentLiquidityActivities.length = MAX_ACTIVITY_ITEMS;
  }

  notifyLiquidityActivityListeners();
}

function mergePositionWithPool(
  pool: LiquidityPoolDetail,
  owner: string,
  deposited0: number,
  deposited1: number
): LiquidityPosition | null {
  if (deposited0 <= MIN_POSITION_AMOUNT && deposited1 <= MIN_POSITION_AMOUNT) {
    return null;
  }

  const shareFractions = [
    pool.reserve0 > 0 ? deposited0 / pool.reserve0 : 0,
    pool.reserve1 > 0 ? deposited1 / pool.reserve1 : 0,
  ].filter((value) => value > 0);

  const shareFraction = shareFractions.length
    ? shareFractions.reduce((sum, value) => sum + value, 0) / shareFractions.length
    : 0;

  return {
    id: `${owner.toLowerCase()}-${pool.id}`,
    chainId: pool.chainId,
    owner,
    poolId: pool.id,
    pairLabel: pool.pairLabel,
    feeTierLabel: pool.feeTierLabel,
    token0: pool.token0,
    token1: pool.token1,
    sharePercent: shareFraction * 100,
    deposited0,
    deposited1,
    valueUsd: pool.tvlUsd * shareFraction,
    fees24hUsd: pool.fees24hUsd * shareFraction,
    aprPercent: pool.aprPercent,
    strategy: pool.strategy,
  };
}

async function buildPoolDetails(chainId: SupportedChainId): Promise<LiquidityPoolDetail[]> {
  const fixtures = liquidityFixtures[chainId] ?? [];
  const tokens = Array.from(
    new Set(fixtures.flatMap((fixture) => [fixture.token0Id, fixture.token1Id]))
  ).map(requireToken);
  const prices = await getTokenPrices(tokens);
  const priceMap = new Map(prices.map((price) => [price.tokenId, price.priceUSD]));

  return fixtures
    .map((fixture) => {
      const token0 = requireToken(fixture.token0Id);
      const token1 = requireToken(fixture.token1Id);
      const poolDelta = runtimePoolDeltas.get(getPoolKey(chainId, fixture.id));
      const reserve0 = Math.max(fixture.reserve0 + (poolDelta?.reserve0Delta ?? 0), 0);
      const reserve1 = Math.max(fixture.reserve1 + (poolDelta?.reserve1Delta ?? 0), 0);
      const token0Price = priceMap.get(token0.id) ?? 0;
      const token1Price = priceMap.get(token1.id) ?? 0;
      const tvlUsd = reserve0 * token0Price + reserve1 * token1Price;
      const fees24hUsd = fixture.volume24hUsd * (fixture.feeBps / 10_000);
      const aprPercent = tvlUsd > 0 ? (fees24hUsd * 365 * 100) / tvlUsd : 0;

      return {
        id: fixture.id,
        chainId,
        token0,
        token1,
        pairLabel: `${token0.symbol}/${token1.symbol}`,
        feeBps: fixture.feeBps,
        feeTierLabel: formatFeeTierLabel(fixture.feeBps),
        tvlUsd,
        volume24hUsd: fixture.volume24hUsd,
        aprPercent,
        reserve0,
        reserve1,
        fees24hUsd,
        liquidityProviderCount: Math.max(
          fixture.liquidityProviderCount + (poolDelta?.liquidityProviderDelta ?? 0),
          0
        ),
        strategy: fixture.strategy,
      } satisfies LiquidityPoolDetail;
    })
    .sort((left, right) => right.tvlUsd - left.tvlUsd);
}

async function buildUserPositions(
  chainId: SupportedChainId,
  owner: string
): Promise<LiquidityPosition[]> {
  const pools = await buildPoolDetails(chainId);
  const seed = getAddressSeed(owner, chainId);
  const indexes = buildPositionIndexes(seed, pools.length);
  const positionMap = new Map<string, LiquidityPosition>();

  indexes.forEach((poolIndex, positionIndex) => {
    const pool = pools[poolIndex];
    const sharePercent = 0.12 + ((seed >> (positionIndex * 3)) % 55) / 100;
    const shareFraction = sharePercent / 100;
    const basePosition = mergePositionWithPool(
      pool,
      owner,
      pool.reserve0 * shareFraction,
      pool.reserve1 * shareFraction
    );

    if (basePosition) {
      positionMap.set(pool.id, basePosition);
    }
  });

  for (const [positionKey, delta] of runtimePositionDeltas.entries()) {
    const [deltaChainId, deltaOwner, poolId] = positionKey.split(':');

    if (Number(deltaChainId) !== chainId || deltaOwner !== owner.toLowerCase()) {
      continue;
    }

    const pool = pools.find((candidate) => candidate.id === poolId);

    if (!pool) {
      continue;
    }

    const existing = positionMap.get(poolId);
    const nextPosition = mergePositionWithPool(
      pool,
      owner,
      Math.max((existing?.deposited0 ?? 0) + delta.deposited0Delta, 0),
      Math.max((existing?.deposited1 ?? 0) + delta.deposited1Delta, 0)
    );

    if (nextPosition) {
      positionMap.set(poolId, nextPosition);
    } else {
      positionMap.delete(poolId);
    }
  }

  return Array.from(positionMap.values()).sort((left, right) => right.valueUsd - left.valueUsd);
}

function createFixtureLiquidityReadProvider(): LiquidityReadProvider {
  return {
    async getPoolSummaries(chainId) {
      const details = await buildPoolDetails(chainId);

      return withFixtureLatency(
        details.map(
          ({
            reserve0: _reserve0,
            reserve1: _reserve1,
            fees24hUsd: _fees24hUsd,
            liquidityProviderCount: _liquidityProviderCount,
            strategy: _strategy,
            ...summary
          }) => summary
        )
      );
    },

    async getPoolDetail(chainId, poolId) {
      const details = await buildPoolDetails(chainId);
      return withFixtureLatency(details.find((pool) => pool.id === poolId) ?? null);
    },

    async getUserPositions(chainId, owner) {
      return withFixtureLatency(await buildUserPositions(chainId, owner));
    },
  };
}

let liquidityReadProvider: LiquidityReadProvider = createFixtureLiquidityReadProvider();

export function configureLiquidityReadProvider(provider: LiquidityReadProvider) {
  liquidityReadProvider = provider;
}

export function getLiquidityReadProvider(): LiquidityReadProvider {
  return liquidityReadProvider;
}

export function subscribeLiquidityActivity(listener: () => void): () => void {
  liquidityActivityListeners.add(listener);

  return () => {
    liquidityActivityListeners.delete(listener);
  };
}

export function getRecentLiquidityActivities(
  chainId?: SupportedChainId,
  owner?: string
): LiquidityActivity[] {
  return recentLiquidityActivities.filter((activity) => {
    const matchesChain = !chainId || activity.chainId === chainId;
    const matchesOwner = !owner || activity.owner.toLowerCase() === owner.toLowerCase();
    return matchesChain && matchesOwner;
  });
}

export function checkSimulatedLiquidityAllowance({
  chainId,
  owner,
  tokenAddress,
  spenderAddress,
  requiredAmount,
}: {
  chainId: SupportedChainId;
  owner: string;
  tokenAddress: Address;
  spenderAddress: Address;
  requiredAmount: bigint;
}): SimulatedAllowanceCheckResult {
  if (isNativeTokenAddress(tokenAddress)) {
    return {
      currentAllowance: requiredAmount,
      isApprovalNeeded: false,
      approvalAmount: BigInt(0),
    };
  }

  const key = getAllowanceKey(chainId, owner, tokenAddress, spenderAddress);
  const currentAllowance = simulatedAllowances.get(key) ?? BigInt(0);

  return {
    currentAllowance,
    isApprovalNeeded: currentAllowance < requiredAmount,
    approvalAmount: requiredAmount,
  };
}

export function grantSimulatedLiquidityAllowance({
  chainId,
  owner,
  tokenAddress,
  spenderAddress,
  amount,
}: {
  chainId: SupportedChainId;
  owner: string;
  tokenAddress: Address;
  spenderAddress: Address;
  amount: bigint;
}) {
  if (isNativeTokenAddress(tokenAddress)) {
    return;
  }

  simulatedAllowances.set(
    getAllowanceKey(chainId, owner, tokenAddress, spenderAddress),
    amount
  );
}

export async function applySimulatedLiquidityMutation(
  mutation: SimulatedLiquidityMutation
): Promise<{ pool: LiquidityPoolDetail; position: LiquidityPosition | null; activity: LiquidityActivity }> {
  const { chainId, owner, poolId, mode, token0Amount, token1Amount, txHash } = mutation;
  const pools = await buildPoolDetails(chainId);
  const pool = pools.find((candidate) => candidate.id === poolId);

  if (!pool) {
    throw new Error('Selected pool is no longer available.');
  }

  const currentPositions = await buildUserPositions(chainId, owner);
  const currentPosition = currentPositions.find((position) => position.poolId === poolId);
  const hasExistingPosition = !!currentPosition;

  const normalizedToken0Amount =
    mode === 'remove'
      ? Math.min(token0Amount, currentPosition?.deposited0 ?? 0)
      : token0Amount;
  const normalizedToken1Amount =
    mode === 'remove'
      ? Math.min(token1Amount, currentPosition?.deposited1 ?? 0)
      : token1Amount;

  if (
    normalizedToken0Amount <= MIN_POSITION_AMOUNT &&
    normalizedToken1Amount <= MIN_POSITION_AMOUNT
  ) {
    throw new Error(`Enter a larger ${pool.pairLabel} amount.`);
  }

  const signedReserve0Delta = mode === 'add' ? normalizedToken0Amount : -normalizedToken0Amount;
  const signedReserve1Delta = mode === 'add' ? normalizedToken1Amount : -normalizedToken1Amount;
  const poolKey = getPoolKey(chainId, poolId);
  const positionKey = getPositionKey(chainId, owner, poolId);
  const existingPoolDelta = runtimePoolDeltas.get(poolKey) ?? {
    reserve0Delta: 0,
    reserve1Delta: 0,
    liquidityProviderDelta: 0,
  };
  const nextPoolDelta = {
    reserve0Delta: existingPoolDelta.reserve0Delta + signedReserve0Delta,
    reserve1Delta: existingPoolDelta.reserve1Delta + signedReserve1Delta,
    liquidityProviderDelta: existingPoolDelta.liquidityProviderDelta,
  };
  const existingPositionDelta = runtimePositionDeltas.get(positionKey) ?? {
    deposited0Delta: 0,
    deposited1Delta: 0,
  };
  const currentDeposited0 = currentPosition?.deposited0 ?? 0;
  const currentDeposited1 = currentPosition?.deposited1 ?? 0;
  const nextDeposited0 = Math.max(currentDeposited0 + signedReserve0Delta, 0);
  const nextDeposited1 = Math.max(currentDeposited1 + signedReserve1Delta, 0);
  const isNewProvider = mode === 'add' && !hasExistingPosition;
  const isClosingPosition =
    mode === 'remove' &&
    nextDeposited0 <= MIN_POSITION_AMOUNT &&
    nextDeposited1 <= MIN_POSITION_AMOUNT &&
    hasExistingPosition;

  if (isNewProvider) {
    nextPoolDelta.liquidityProviderDelta += 1;
  }

  if (isClosingPosition) {
    nextPoolDelta.liquidityProviderDelta -= 1;
  }

  runtimePoolDeltas.set(poolKey, nextPoolDelta);
  runtimePositionDeltas.set(positionKey, {
    deposited0Delta: existingPositionDelta.deposited0Delta + signedReserve0Delta,
    deposited1Delta: existingPositionDelta.deposited1Delta + signedReserve1Delta,
  });

  const updatedPool = (await buildPoolDetails(chainId)).find((candidate) => candidate.id === poolId);
  const updatedPosition = (await buildUserPositions(chainId, owner)).find(
    (position) => position.poolId === poolId
  );

  if (!updatedPool) {
    throw new Error('Failed to update the simulated liquidity position.');
  }

  const shareFractionDelta = [
    pool.reserve0 > 0 ? normalizedToken0Amount / pool.reserve0 : 0,
    pool.reserve1 > 0 ? normalizedToken1Amount / pool.reserve1 : 0,
  ]
    .filter((value) => value > 0)
    .reduce((sum, value, _, values) => sum + value / values.length, 0);

  const activity: LiquidityActivity = {
    id: `${owner.toLowerCase()}-${poolId}-${txHash}`,
    chainId,
    owner,
    poolId,
    pairLabel: pool.pairLabel,
    mode,
    token0: pool.token0,
    token1: pool.token1,
    token0Amount: normalizedToken0Amount,
    token1Amount: normalizedToken1Amount,
    sharePercentDelta: shareFractionDelta * 100,
    valueUsdDelta: updatedPool.tvlUsd * shareFractionDelta,
    txHash,
    timestamp: Date.now(),
  };

  addRecentLiquidityActivity(activity);

  return {
    pool: updatedPool,
    position: updatedPosition ?? null,
    activity,
  };
}
