'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { supportedChains, type SupportedChainId } from '@/config/chains';
import {
  getLiquidityWriteStageMessage,
  LiquidityWriteStage,
  useLiquidityActivityFeed,
  useLiquidityExecution,
  useLiquidityPoolDetail,
  useLiquidityPools,
  useUserLiquidityPositions,
} from '@/hooks';
import { formatUSD } from '@/lib/priceOracle';
import { ReceiptModal, useReceiptModal } from '@/components/ReceiptModal';

function formatTokenAmount(value: number): string {
  if (value >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: value < 1 ? 2 : 0,
    maximumFractionDigits: 4,
  });
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function parseEditableAmount(value: string): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function PositionCard({
  pairLabel,
  strategy,
  sharePercent,
  token0Amount,
  token0Symbol,
  token1Amount,
  token1Symbol,
  valueUsd,
  fees24hUsd,
  isSelected,
  onAdd,
  onRemove,
}: {
  pairLabel: string;
  strategy: string;
  sharePercent: number;
  token0Amount: number;
  token0Symbol: string;
  token1Amount: number;
  token1Symbol: string;
  valueUsd: number;
  fees24hUsd: number;
  isSelected: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        isSelected ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{pairLabel}</p>
          <p className="mt-1 text-xs text-gray-500">{strategy}</p>
        </div>
        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
          {formatPercent(sharePercent)} share
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-600">
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Deposited</p>
          <p className="mt-2 font-medium text-gray-900">
            {formatTokenAmount(token0Amount)} {token0Symbol}
          </p>
          <p className="mt-1 font-medium text-gray-900">
            {formatTokenAmount(token1Amount)} {token1Symbol}
          </p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Value</p>
          <p className="mt-2 font-medium text-gray-900">{formatUSD(valueUsd)}</p>
          <p className="mt-1 text-xs text-gray-500">24h fees ≈ {formatUSD(fees24hUsd)}</p>
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onAdd}
          className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export function LiquidityPanel() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId() as SupportedChainId;
  const effectiveChainId = supportedChains[chainId] ? chainId : 42161;
  const { data: pools = [], isLoading: poolsLoading } = useLiquidityPools(effectiveChainId);
  const { data: positions = [], isLoading: positionsLoading } = useUserLiquidityPositions(
    effectiveChainId,
    address
  );
  const activityFeed = useLiquidityActivityFeed(effectiveChainId, address);
  const execution = useLiquidityExecution();
  const receiptModal = useReceiptModal();

  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [token0Amount, setToken0Amount] = useState('');
  const [token1Amount, setToken1Amount] = useState('');
  const [removeFraction, setRemoveFraction] = useState(0.25);
  const { data: selectedPool, isLoading: selectedPoolLoading } = useLiquidityPoolDetail(
    effectiveChainId,
    selectedPoolId
  );

  useEffect(() => {
    if (!pools.length) {
      setSelectedPoolId(null);
      return;
    }

    if (!selectedPoolId || !pools.some((pool) => pool.id === selectedPoolId)) {
      setSelectedPoolId(pools[0].id);
    }
  }, [pools, selectedPoolId]);

  useEffect(() => {
    if (execution.state.receipt) {
      receiptModal.show(execution.state.receipt);
    }
  }, [execution.state.receipt, receiptModal.show]);

  const totalPositionValue = useMemo(
    () => positions.reduce((sum, position) => sum + position.valueUsd, 0),
    [positions]
  );
  const selectedPosition = useMemo(
    () => positions.find((position) => position.poolId === selectedPoolId) ?? null,
    [positions, selectedPoolId]
  );
  const addPreview = useMemo(() => {
    if (!selectedPool) {
      return null;
    }

    const amount0 = parseEditableAmount(token0Amount);
    const amount1 = parseEditableAmount(token1Amount);
    const shareFractions = [
      selectedPool.reserve0 > 0 ? amount0 / selectedPool.reserve0 : 0,
      selectedPool.reserve1 > 0 ? amount1 / selectedPool.reserve1 : 0,
    ].filter((value) => value > 0);
    const shareFraction = shareFractions.length
      ? shareFractions.reduce((sum, value) => sum + value, 0) / shareFractions.length
      : 0;

    return {
      amount0,
      amount1,
      sharePercentDelta: shareFraction * 100,
      projectedSharePercent: (selectedPosition?.sharePercent ?? 0) + shareFraction * 100,
      projectedValueUsd: selectedPool.tvlUsd * shareFraction,
    };
  }, [selectedPool, selectedPosition?.sharePercent, token0Amount, token1Amount]);
  const removePreview = useMemo(() => {
    if (!selectedPosition) {
      return null;
    }

    return {
      amount0: selectedPosition.deposited0 * removeFraction,
      amount1: selectedPosition.deposited1 * removeFraction,
      withdrawnValueUsd: selectedPosition.valueUsd * removeFraction,
      remainingSharePercent: selectedPosition.sharePercent * (1 - removeFraction),
    };
  }, [removeFraction, selectedPosition]);

  const canSubmitAdd =
    isConnected &&
    !!selectedPool &&
    !!addPreview &&
    addPreview.amount0 > 0 &&
    addPreview.amount1 > 0 &&
    !execution.state.isLoading;
  const canSubmitRemove =
    isConnected &&
    !!selectedPool &&
    !!selectedPosition &&
    removeFraction > 0 &&
    !execution.state.isLoading;

  const handleAddLiquidity = async () => {
    if (!selectedPool || !canSubmitAdd) {
      return;
    }

    await execution.execute({
      mode: 'add',
      pool: selectedPool,
      token0Amount,
      token1Amount,
      onSuccess: () => {
        setToken0Amount('');
        setToken1Amount('');
      },
    });
  };

  const handleRemoveLiquidity = async () => {
    if (!selectedPool || !selectedPosition || !canSubmitRemove) {
      return;
    }

    await execution.execute({
      mode: 'remove',
      pool: selectedPool,
      position: selectedPosition,
      removeFraction,
    });
  };

  return (
    <section className="space-y-8">
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="space-y-8">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Liquidity pools</h2>
                <p className="mt-2 text-sm text-gray-600">
                  Add and remove flows now ride on the shared liquidity cache, simulated approvals,
                  and receipt handling used across the MVP shell.
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {supportedChains[effectiveChainId]?.name}
              </span>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Pool</th>
                    <th className="px-4 py-3 font-medium">Fee</th>
                    <th className="px-4 py-3 font-medium">TVL</th>
                    <th className="px-4 py-3 font-medium">24h Volume</th>
                    <th className="px-4 py-3 font-medium">APR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {poolsLoading ? (
                    <tr>
                      <td className="px-4 py-4 text-gray-600" colSpan={5}>
                        Loading pool summaries…
                      </td>
                    </tr>
                  ) : (
                    pools.map((pool) => {
                      const isSelected = pool.id === selectedPoolId;

                      return (
                        <tr
                          key={pool.id}
                          onClick={() => setSelectedPoolId(pool.id)}
                          className={
                            isSelected
                              ? 'cursor-pointer bg-blue-50/60'
                              : 'cursor-pointer hover:bg-gray-50'
                          }
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">{pool.pairLabel}</td>
                          <td className="px-4 py-3 text-gray-600">{pool.feeTierLabel}</td>
                          <td className="px-4 py-3 text-gray-600">{formatUSD(pool.tvlUsd)}</td>
                          <td className="px-4 py-3 text-gray-600">{formatUSD(pool.volume24hUsd)}</td>
                          <td className="px-4 py-3 text-green-700">{formatPercent(pool.aprPercent)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Your positions</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Position cards now jump straight into add/remove flows for the selected pool.
                </p>
              </div>
              {isConnected && positions.length > 0 ? (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {formatUSD(totalPositionValue)} total
                </span>
              ) : null}
            </div>

            <div className="mt-5 space-y-3">
              {!isConnected ? (
                <div className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">
                  Connect a wallet to inspect and manage LP positions for the active chain.
                </div>
              ) : positionsLoading ? (
                <div className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">
                  Loading LP positions…
                </div>
              ) : positions.length ? (
                positions.map((position) => (
                  <PositionCard
                    key={position.id}
                    pairLabel={position.pairLabel}
                    strategy={position.strategy}
                    sharePercent={position.sharePercent}
                    token0Amount={position.deposited0}
                    token0Symbol={position.token0.symbol}
                    token1Amount={position.deposited1}
                    token1Symbol={position.token1.symbol}
                    valueUsd={position.valueUsd}
                    fees24hUsd={position.fees24hUsd}
                    isSelected={position.poolId === selectedPoolId}
                    onAdd={() => {
                      setSelectedPoolId(position.poolId);
                      setMode('add');
                    }}
                    onRemove={() => {
                      setSelectedPoolId(position.poolId);
                      setMode('remove');
                    }}
                  />
                ))
              ) : (
                <div className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">
                  No LP positions found for this wallet on {supportedChains[effectiveChainId]?.name}.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Selected pool</h3>
            <p className="mt-2 text-sm text-gray-600">
              Pool detail, your position, and write previews all read from the same cached source.
            </p>

            {selectedPoolLoading || (poolsLoading && !selectedPool) ? (
              <div className="mt-5 rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">
                Loading pool detail…
              </div>
            ) : selectedPool ? (
              <div className="mt-5 space-y-4 text-sm text-gray-700">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-gray-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">TVL</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">
                      {formatUSD(selectedPool.tvlUsd)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">LPs</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">
                      {selectedPool.liquidityProviderCount}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Strategy</p>
                  <p className="mt-2 font-medium text-gray-900">{selectedPool.strategy}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-gray-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Reserve {selectedPool.token0.symbol}
                    </p>
                    <p className="mt-2 font-medium text-gray-900">
                      {formatTokenAmount(selectedPool.reserve0)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Reserve {selectedPool.token1.symbol}
                    </p>
                    <p className="mt-2 font-medium text-gray-900">
                      {formatTokenAmount(selectedPool.reserve1)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">
                No pool detail available for this network.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex gap-2 rounded-xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setMode('add')}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                  mode === 'add' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'
                }`}
              >
                Add liquidity
              </button>
              <button
                type="button"
                onClick={() => setMode('remove')}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                  mode === 'remove' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'
                }`}
              >
                Remove liquidity
              </button>
            </div>

            {!selectedPool ? (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">
                Select a pool to manage liquidity.
              </div>
            ) : mode === 'add' ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                  Provide both assets to expand your {selectedPool.pairLabel} position. Non-native
                  assets reuse the approval gate before submission.
                </div>
                <label className="block text-sm font-medium text-gray-700">
                  <span>{selectedPool.token0.symbol} amount</span>
                  <input
                    type="number"
                    value={token0Amount}
                    onChange={(event) => setToken0Amount(event.target.value)}
                    disabled={execution.state.isLoading}
                    className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-3 text-right font-mono"
                    placeholder="0.0"
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  <span>{selectedPool.token1.symbol} amount</span>
                  <input
                    type="number"
                    value={token1Amount}
                    onChange={(event) => setToken1Amount(event.target.value)}
                    disabled={execution.state.isLoading}
                    className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-3 text-right font-mono"
                    placeholder="0.0"
                  />
                </label>

                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-gray-700">
                  <div className="flex justify-between">
                    <span>Projected value</span>
                    <span className="font-semibold text-gray-900">
                      {addPreview ? formatUSD(addPreview.projectedValueUsd) : '—'}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span>Share gained</span>
                    <span className="font-semibold text-blue-700">
                      {addPreview ? formatPercent(addPreview.sharePercentDelta) : '—'}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span>Projected total share</span>
                    <span className="font-semibold text-gray-900">
                      {addPreview ? formatPercent(addPreview.projectedSharePercent) : '—'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddLiquidity}
                  disabled={!canSubmitAdd}
                  className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {execution.state.isLoading ? 'Processing...' : 'Approve & add liquidity'}
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {selectedPosition ? (
                  <>
                    <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                      Remove a portion of your {selectedPool.pairLabel} position and return both
                      underlying assets to the wallet flow.
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[0.25, 0.5, 0.75, 1].map((fraction) => (
                        <button
                          key={fraction}
                          type="button"
                          onClick={() => setRemoveFraction(fraction)}
                          className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                            removeFraction === fraction
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {fraction * 100}%
                        </button>
                      ))}
                    </div>
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-gray-700">
                      <div className="flex justify-between">
                        <span>{selectedPool.token0.symbol} out</span>
                        <span className="font-semibold text-gray-900">
                          {removePreview
                            ? `${formatTokenAmount(removePreview.amount0)} ${selectedPool.token0.symbol}`
                            : '—'}
                        </span>
                      </div>
                      <div className="mt-2 flex justify-between">
                        <span>{selectedPool.token1.symbol} out</span>
                        <span className="font-semibold text-gray-900">
                          {removePreview
                            ? `${formatTokenAmount(removePreview.amount1)} ${selectedPool.token1.symbol}`
                            : '—'}
                        </span>
                      </div>
                      <div className="mt-2 flex justify-between">
                        <span>Remaining share</span>
                        <span className="font-semibold text-blue-700">
                          {removePreview ? formatPercent(removePreview.remainingSharePercent) : '—'}
                        </span>
                      </div>
                      <div className="mt-2 flex justify-between">
                        <span>Withdrawn value</span>
                        <span className="font-semibold text-gray-900">
                          {removePreview ? formatUSD(removePreview.withdrawnValueUsd) : '—'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveLiquidity}
                      disabled={!canSubmitRemove}
                      className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {execution.state.isLoading ? 'Processing...' : 'Remove liquidity'}
                    </button>
                  </>
                ) : (
                  <div className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">
                    You do not currently hold liquidity in this pool. Select Add liquidity or pick a
                    position card above to remove from an existing LP.
                  </div>
                )}
              </div>
            )}

            {execution.state.stage !== LiquidityWriteStage.IDLE ? (
              <div
                className={`mt-4 rounded-2xl border p-4 text-sm ${
                  execution.state.stage === LiquidityWriteStage.SUCCESS
                    ? 'border-green-200 bg-green-50 text-green-800'
                    : execution.state.stage === LiquidityWriteStage.ERROR
                      ? 'border-red-200 bg-red-50 text-red-800'
                      : 'border-blue-200 bg-blue-50 text-blue-800'
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  <span>{getLiquidityWriteStageMessage(execution.state.stage)}</span>
                  {execution.state.isLoading ? (
                    <span className="inline-block animate-spin text-lg">⟳</span>
                  ) : null}
                </div>
                {execution.state.approvalTxHash ? (
                  <p className="mt-1 font-mono text-xs">
                    Approval: {execution.state.approvalTxHash.slice(0, 10)}...
                  </p>
                ) : null}
                {execution.state.liquidityTxHash ? (
                  <p className="mt-1 font-mono text-xs">
                    Liquidity: {execution.state.liquidityTxHash.slice(0, 10)}...
                  </p>
                ) : null}
                {execution.state.error ? <p className="mt-1 text-xs">{execution.state.error}</p> : null}
              </div>
            ) : null}

            {execution.state.stage === LiquidityWriteStage.ERROR ? (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={execution.retry}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={execution.reset}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Reset
                </button>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Recent liquidity activity</h3>
            <p className="mt-2 text-sm text-gray-600">
              Successful simulated writes invalidate the shared cache so pool and portfolio surfaces
              refresh together.
            </p>
            <div className="mt-4 space-y-3">
              {activityFeed.length ? (
                activityFeed.map((activity) => (
                  <div key={activity.id} className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-gray-900">
                        {activity.mode === 'add' ? 'Added' : 'Removed'} {activity.pairLabel}
                      </p>
                      <span className="text-xs text-gray-500">
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-1">
                      {formatTokenAmount(activity.token0Amount)} {activity.token0.symbol} •{' '}
                      {formatTokenAmount(activity.token1Amount)} {activity.token1.symbol}
                    </p>
                    <p className="mt-1 text-xs text-blue-700">
                      Share delta {formatPercent(activity.sharePercentDelta)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                  No liquidity writes yet for this wallet on the selected network.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ReceiptModal
        isOpen={receiptModal.isOpen}
        receipt={receiptModal.receipt}
        onClose={() => {
          receiptModal.close();
          execution.reset();
        }}
      />
    </section>
  );
}
