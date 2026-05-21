'use client';

import React, { useMemo, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { supportedChains, type SupportedChainId } from '@/config/chains';
import { ReceiptModal, useReceiptModal } from '@/components/ReceiptModal';
import {
  usePortfolioSnapshot,
  useTransactionActivityFeed,
} from '@/hooks';
import type { TransactionActivityRecord } from '@/lib/activityHistory';
import { formatUSD } from '@/lib/priceOracle';
import { TokenIcon } from './TokenIcon';

type ActivityFilter = 'all' | 'swap' | 'bridge' | 'liquidity';
type ActivityRange = '24h' | '7d' | '30d' | 'all';

function formatTokenAmount(value: number): string {
  if (value >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: value < 1 ? 2 : 0,
    maximumFractionDigits: 4,
  });
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function matchesActivityFilter(activity: TransactionActivityRecord, filter: ActivityFilter) {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'swap') {
    return activity.kind === 'swap';
  }

  if (filter === 'bridge') {
    return activity.kind === 'bridge';
  }

  return activity.kind === 'add-liquidity' || activity.kind === 'remove-liquidity';
}

function matchesActivityRange(activity: TransactionActivityRecord, range: ActivityRange) {
  if (range === 'all') {
    return true;
  }

  const now = Date.now();
  const thresholds: Record<Exclude<ActivityRange, 'all'>, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };

  return now - activity.timestamp <= thresholds[range];
}

function SummaryCard({
  title,
  value,
  detail,
  className = '',
}: {
  title: string;
  value: string;
  detail: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-600">{detail}</p>
    </div>
  );
}

export function PortfolioView() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId() as SupportedChainId;
  const effectiveChainId = supportedChains[chainId] ? chainId : 42161;
  const receiptModal = useReceiptModal();
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [activityRange, setActivityRange] = useState<ActivityRange>('7d');
  const portfolio = usePortfolioSnapshot(effectiveChainId, address);
  const activityFeed = useTransactionActivityFeed(effectiveChainId, address);
  const filteredActivity = useMemo(
    () =>
      activityFeed
        .filter((activity) => matchesActivityFilter(activity, activityFilter))
        .filter((activity) => matchesActivityRange(activity, activityRange)),
    [activityFeed, activityFilter, activityRange]
  );
  const liquidSharePercent =
    portfolio.data.totalValueUsd > 0
      ? (portfolio.data.totalWalletValueUsd / portfolio.data.totalValueUsd) * 100
      : 0;
  const lpSharePercent =
    portfolio.data.totalValueUsd > 0
      ? (portfolio.data.totalLiquidityValueUsd / portfolio.data.totalValueUsd) * 100
      : 0;

  return (
    <section className="space-y-8">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <SummaryCard
          title="Connected wallet"
          value={isConnected && address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
          detail="Portfolio reads are scoped by wallet address and active chain."
          className="lg:col-span-2"
        />
        <SummaryCard
          title="Total portfolio"
          value={isConnected ? (portfolio.isLoading ? 'Loading...' : formatUSD(portfolio.data.totalValueUsd)) : '—'}
          detail="Wallet balances plus LP positions."
        />
        <SummaryCard
          title="Recent activity"
          value={isConnected ? String(activityFeed.length) : '—'}
          detail="Swaps, bridges, and liquidity operations tracked together."
        />
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Wallet balances</h2>
              <p className="mt-2 text-sm text-gray-600">
                Token balances and prices flow through one portfolio snapshot abstraction.
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {supportedChains[effectiveChainId]?.name}
            </span>
          </div>

          {!isConnected ? (
            <div className="mt-6 rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">
              Connect a wallet to hydrate balances, valuation, and wallet-scoped history.
            </div>
          ) : portfolio.error ? (
            <p className="mt-4 text-sm text-red-700">
              {portfolio.error instanceof Error ? portfolio.error.message : 'Failed to load portfolio.'}
            </p>
          ) : (
            <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Asset</th>
                    <th className="px-4 py-3 font-medium">Balance</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Value</th>
                    <th className="px-4 py-3 font-medium">Mix</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {portfolio.isLoading ? (
                    <tr>
                      <td className="px-4 py-4 text-gray-600" colSpan={5}>
                        Loading wallet balances…
                      </td>
                    </tr>
                  ) : portfolio.data.walletAssets.length ? (
                    portfolio.data.walletAssets.map((asset) => (
                      <tr key={asset.token.id}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <TokenIcon token={asset.token} size={22} />
                            <div>
                              <p className="font-medium text-gray-900">{asset.token.symbol}</p>
                              <p className="text-xs text-gray-500">{asset.token.name}</p>
                            </div>
                            {asset.source === 'simulated' ? (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                fallback
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {formatTokenAmount(asset.balance)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{formatUSD(asset.priceUsd)}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {formatUSD(asset.valueUsd)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {asset.allocationPercent.toFixed(1)}%
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-4 text-gray-600" colSpan={5}>
                        No wallet balances detected for the active network.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {portfolio.data.usedFallbackBalances ? (
            <p className="mt-4 text-xs text-amber-700">
              Some token reads fell back to deterministic wallet-linked balances because the active
              network does not expose every token contract yet.
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Portfolio mix</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-700">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Wallet value</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">
                  {isConnected ? formatUSD(portfolio.data.totalWalletValueUsd) : '—'}
                </p>
                <p className="mt-1 text-xs text-gray-500">{liquidSharePercent.toFixed(1)}% of total</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">LP value</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">
                  {isConnected ? formatUSD(portfolio.data.totalLiquidityValueUsd) : '—'}
                </p>
                <p className="mt-1 text-xs text-gray-500">{lpSharePercent.toFixed(1)}% of total</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-700">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">LP fees / 24h</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">
                  {isConnected ? formatUSD(portfolio.data.totalFees24hUsd) : '—'}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Assets tracked</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">
                  {isConnected ? portfolio.data.walletAssets.length : '—'}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-sm text-gray-600">
              {!isConnected ? (
                <div className="rounded-xl bg-gray-50 p-4">
                  Connect a wallet to compare liquid balances against LP deployment.
                </div>
              ) : portfolio.isLoading ? (
                <div className="rounded-xl bg-gray-50 p-4">Loading LP positions…</div>
              ) : portfolio.data.positions.length ? (
                portfolio.data.positions.map((position) => (
                  <div key={position.id} className="rounded-xl bg-gray-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-gray-900">{position.pairLabel}</p>
                      <span className="text-xs font-semibold text-blue-700">
                        {position.feeTierLabel}
                      </span>
                    </div>
                    <p className="mt-1">{formatUSD(position.valueUsd)} • {position.sharePercent.toFixed(2)}% share</p>
                    <p className="mt-1 text-xs text-gray-500">{position.strategy}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl bg-gray-50 p-4">
                  No LP positions found for this wallet on the selected network.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Snapshot status</h3>
            <p className="mt-2 text-sm text-gray-600">
              Wallet balances, LP exposure, and transaction activity now refresh through shared
              portfolio/history abstractions instead of inline placeholders.
            </p>
            {portfolio.data.lastUpdated ? (
              <p className="mt-3 text-xs text-gray-500">
                Price snapshot updated {formatTimestamp(portfolio.data.lastUpdated)}.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Recent activity</h3>
            <p className="mt-2 text-sm text-gray-600">
              Wallet history is grouped by chain and address, with shared receipts for swap,
              bridge, and liquidity actions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'swap', 'bridge', 'liquidity'] as ActivityFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActivityFilter(filter)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  activityFilter === filter
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {filter === 'all'
                  ? 'All'
                  : filter === 'swap'
                    ? 'Swaps'
                    : filter === 'bridge'
                      ? 'Bridges'
                      : 'Liquidity'}
              </button>
            ))}
            {(['24h', '7d', '30d', 'all'] as ActivityRange[]).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setActivityRange(range)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  activityRange === range
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {range === 'all' ? 'All time' : range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {!isConnected ? (
            <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
              Connect a wallet to view address-scoped transaction history.
            </div>
          ) : filteredActivity.length ? (
            filteredActivity.map((activity) => (
              <div key={activity.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{activity.title}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          activity.status === 'success'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {activity.kind}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{activity.summary}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {activity.tokenChanges.map((tokenChange) => (
                        <span
                          key={`${activity.id}-${tokenChange.symbol}-${tokenChange.direction}`}
                          className={`rounded-full px-2 py-1 font-semibold ${
                            tokenChange.direction === 'in'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          {tokenChange.direction === 'in' ? '+' : '-'}
                          {tokenChange.amount} {tokenChange.symbol}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="text-left text-xs text-gray-500 sm:text-right">
                    <p>{formatTimestamp(activity.timestamp)}</p>
                    <p className="mt-1 font-mono">{activity.txHash.slice(0, 10)}...</p>
                    {activity.valueUsd ? <p className="mt-1">{formatUSD(activity.valueUsd)}</p> : null}
                    {activity.receipt ? (
                      <button
                        type="button"
                        onClick={() => receiptModal.show(activity.receipt!)}
                        className="mt-2 text-blue-600 hover:text-blue-700"
                      >
                        View receipt
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
              No {activityFilter === 'all' ? '' : `${activityFilter} `}activity found for the
              selected range on this network yet.
            </div>
          )}
        </div>
      </div>

      <ReceiptModal
        isOpen={receiptModal.isOpen}
        receipt={receiptModal.receipt}
        onClose={receiptModal.close}
      />
    </section>
  );
}
