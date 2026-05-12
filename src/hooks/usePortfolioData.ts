'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { formatUnits, type Address } from 'viem';
import type { SupportedChainId } from '@/config/chains';
import { getTokensForChain } from '@/config/tokens';
import type { LiquidityPosition } from '@/lib/liquidityRead';
import {
  buildFallbackWalletBalance,
  buildWalletAssetBalances,
  type WalletAssetBalance,
  type WalletBalanceRead,
} from '@/lib/portfolio';
import { getTokenPrices } from '@/lib/priceOracle';
import { isNativeTokenAddress } from '@/lib/tokenApproval';
import { useUserLiquidityPositions } from './useLiquidityReads';

const ERC20_BALANCE_OF_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
] as const;

export interface PortfolioSnapshot {
  walletAssets: WalletAssetBalance[];
  positions: LiquidityPosition[];
  totalWalletValueUsd: number;
  totalLiquidityValueUsd: number;
  totalValueUsd: number;
  totalFees24hUsd: number;
  usedFallbackBalances: boolean;
  lastUpdated?: number;
}

export function usePortfolioSnapshot(
  chainId: SupportedChainId,
  owner?: string
) {
  const publicClient = usePublicClient({ chainId });
  const tokens = useMemo(() => getTokensForChain(chainId), [chainId]);
  const { data: positions = [], isLoading: positionsLoading } = useUserLiquidityPositions(
    chainId,
    owner
  );

  const pricesQuery = useQuery({
    queryKey: ['portfolio', 'prices', chainId],
    queryFn: () => getTokenPrices(tokens),
    staleTime: 60_000,
  });

  const balancesQuery = useQuery<WalletBalanceRead[]>({
    queryKey: ['portfolio', 'balances', chainId, owner?.toLowerCase() ?? 'disconnected'],
    queryFn: async () => {
      if (!owner) {
        return [];
      }

      return Promise.all(
        tokens.map(async (token) => {
          const tokenAddress = token.addresses[chainId];

          if (!tokenAddress) {
            return {
              token,
              balance: 0,
              source: 'simulated' as const,
            };
          }

          try {
            if (!publicClient) {
              throw new Error('Public client unavailable');
            }

            const resolvedTokenAddress = tokenAddress as Address;
            const rawBalance = isNativeTokenAddress(resolvedTokenAddress)
              ? await publicClient.getBalance({ address: owner as Address })
              : await publicClient.readContract({
                  address: resolvedTokenAddress,
                  abi: ERC20_BALANCE_OF_ABI,
                  functionName: 'balanceOf',
                  args: [owner as Address],
                });

            return {
              token,
              balance: Number(formatUnits(rawBalance, token.decimals)),
              source: 'wallet-rpc' as const,
            };
          } catch {
            return {
              token,
              balance: buildFallbackWalletBalance(chainId, owner, token),
              source: 'simulated' as const,
            };
          }
        })
      );
    },
    enabled: !!owner,
    staleTime: 30_000,
  });

  const snapshot = useMemo<PortfolioSnapshot>(() => {
    const priceMap = new Map(
      (pricesQuery.data ?? []).map((price) => [price.tokenId, price.priceUSD])
    );
    const walletAssets = buildWalletAssetBalances(balancesQuery.data ?? [], priceMap);
    const totalWalletValueUsd = walletAssets.reduce((sum, asset) => sum + asset.valueUsd, 0);
    const totalLiquidityValueUsd = positions.reduce((sum, position) => sum + position.valueUsd, 0);

    return {
      walletAssets,
      positions,
      totalWalletValueUsd,
      totalLiquidityValueUsd,
      totalValueUsd: totalWalletValueUsd + totalLiquidityValueUsd,
      totalFees24hUsd: positions.reduce((sum, position) => sum + position.fees24hUsd, 0),
      usedFallbackBalances: walletAssets.some((asset) => asset.source === 'simulated'),
      lastUpdated: (pricesQuery.data ?? []).reduce<number | undefined>((latest, price) => {
        if (!latest) {
          return price.lastUpdated;
        }

        return Math.max(latest, price.lastUpdated);
      }, undefined),
    };
  }, [balancesQuery.data, positions, pricesQuery.data]);

  return {
    data: snapshot,
    isLoading: balancesQuery.isLoading || pricesQuery.isLoading || positionsLoading,
    isRefetching: balancesQuery.isFetching || pricesQuery.isFetching,
    error: balancesQuery.error ?? pricesQuery.error ?? null,
  };
}
