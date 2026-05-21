'use client';

import { useQuery } from '@tanstack/react-query';
import type { SupportedChainId } from '@/config/chains';
import {
  getLiquidityReadProvider,
  type LiquidityPoolDetail,
  type LiquidityPoolSummary,
  type LiquidityPosition,
} from '@/lib/liquidityRead';

const LIQUIDITY_QUERY_SCOPE = 'liquidity-read';

export function useLiquidityPools(chainId: SupportedChainId) {
  return useQuery<LiquidityPoolSummary[]>({
    queryKey: [LIQUIDITY_QUERY_SCOPE, 'pools', chainId],
    queryFn: () => getLiquidityReadProvider().getPoolSummaries(chainId),
    staleTime: 60_000,
  });
}

export function useLiquidityPoolDetail(
  chainId: SupportedChainId,
  poolId: string | null
) {
  return useQuery<LiquidityPoolDetail | null>({
    queryKey: [LIQUIDITY_QUERY_SCOPE, 'pool-detail', chainId, poolId],
    queryFn: () => {
      if (!poolId) {
        return Promise.resolve(null);
      }

      return getLiquidityReadProvider().getPoolDetail(chainId, poolId);
    },
    enabled: !!poolId,
    staleTime: 60_000,
  });
}

export function useUserLiquidityPositions(
  chainId: SupportedChainId,
  owner?: string
) {
  return useQuery<LiquidityPosition[]>({
    queryKey: [LIQUIDITY_QUERY_SCOPE, 'positions', chainId, owner?.toLowerCase() ?? 'disconnected'],
    queryFn: () => {
      if (!owner) {
        return Promise.resolve([]);
      }

      return getLiquidityReadProvider().getUserPositions(chainId, owner);
    },
    enabled: !!owner,
    staleTime: 60_000,
  });
}
