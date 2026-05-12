'use client';

import React, { useEffect, useMemo } from 'react';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { chainIds, supportedChains, type SupportedChainId } from '@/config/chains';
import { ReceiptModal, useReceiptModal } from '@/components/ReceiptModal';
import {
  BridgeExecutionStage,
  getBridgeStageMessage,
  useBridgeActivityFeed,
  useBridgeExecution,
  useBridgeState,
} from '@/hooks';

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(Math.ceil(ms / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function StatusPill({ tone, label }: { tone: 'blue' | 'green' | 'red' | 'gray'; label: string }) {
  const tones: Record<'blue' | 'green' | 'red' | 'gray', string> = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    gray: 'bg-gray-100 text-gray-600',
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>
      {label}
    </span>
  );
}

export function BridgePanel() {
  const { address, isConnected } = useAccount();
  const activeChainId = useChainId() as SupportedChainId;
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const bridge = useBridgeState(supportedChains[activeChainId] ? activeChainId : chainIds.arbitrumOne);
  const execution = useBridgeExecution();
  const receiptModal = useReceiptModal();
  const activityFeed = useBridgeActivityFeed(address, bridge.sourceChainId).slice(0, 4);

  const walletOnSourceChain = !isConnected || activeChainId === bridge.sourceChainId;
  const canRequestQuote =
    !!bridge.selectedToken && !!bridge.inputAmount && !!bridge.availableProtocols.length;
  const readinessError = useMemo(() => {
    if (!isConnected) return 'Connect your wallet to review bridge execution readiness.';
    if (!walletOnSourceChain) {
      return `Switch your wallet to ${supportedChains[bridge.sourceChainId]?.name} before bridging.`;
    }
    if (!bridge.availableProtocols.length) return 'This chain pair is not bridge-enabled yet.';
    if (!bridge.selectedToken) return 'No bridgeable token is available for this route.';
    if (!bridge.inputAmount) return 'Enter an amount to fetch a bridge quote.';
    if (!bridge.quote) return 'Refresh the quote before executing the bridge.';
    if (bridge.quoteExpired) return 'Quote expired. Refresh before submitting.';
    return null;
  }, [
    bridge.availableProtocols.length,
    bridge.inputAmount,
    bridge.quote,
    bridge.quoteExpired,
    bridge.selectedToken,
    bridge.sourceChainId,
    isConnected,
    walletOnSourceChain,
  ]);

  useEffect(() => {
    if (!canRequestQuote || execution.state.isLoading) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void bridge.refreshQuote();
    }, 500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    bridge.destinationChainId,
    bridge.inputAmount,
    bridge.refreshQuote,
    bridge.selectedToken,
    bridge.sourceChainId,
    canRequestQuote,
    execution.state.isLoading,
  ]);

  useEffect(() => {
    if (execution.state.receipt) {
      receiptModal.show(execution.state.receipt);
    }
  }, [execution.state.receipt, receiptModal.show]);

  const handleExecuteBridge = async () => {
    if (!bridge.selectedToken || !bridge.quote) {
      return;
    }

    await execution.executeBridge({
      quote: bridge.quote,
      token: bridge.selectedToken,
      onSuccess: () => {
        bridge.setInputAmount('');
      },
    });
  };

  const handlePrimaryAction = async () => {
    if (!isConnected || execution.state.isLoading) {
      return;
    }

    if (!walletOnSourceChain) {
      switchChain({ chainId: bridge.sourceChainId });
      return;
    }

    await handleExecuteBridge();
  };

  const sourceChainName = supportedChains[bridge.sourceChainId]?.name;
  const destinationChainName = supportedChains[bridge.destinationChainId]?.name;
  const primaryActionLabel = !isConnected
    ? 'Connect wallet'
    : !walletOnSourceChain
      ? `Switch to ${sourceChainName}`
      : execution.state.isLoading
        ? 'Bridging...'
        : 'Bridge now';

  return (
    <section className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">Bridge</h2>
          <p className="text-sm text-gray-600">
            Move assets between Arbitrum One and Shell Testnet with route-aware quotes,
            readiness checks, and tracked delivery states.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3">
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">From</span>
              <select
                value={bridge.sourceChainId}
                onChange={(event) =>
                  bridge.setSourceChainId(Number(event.target.value) as SupportedChainId)
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900"
                disabled={execution.state.isLoading}
              >
                {Object.values(supportedChains).map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={bridge.swapDirection}
              disabled={execution.state.isLoading}
              className="mb-0.5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Swap bridge direction"
            >
              <ArrowRight className="h-4 w-4 rotate-90 sm:rotate-0" />
            </button>

            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">To</span>
              <select
                value={bridge.destinationChainId}
                onChange={(event) =>
                  bridge.setDestinationChainId(Number(event.target.value) as SupportedChainId)
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900"
                disabled={execution.state.isLoading}
              >
                {Object.values(supportedChains)
                  .filter((chain) => chain.id !== bridge.sourceChainId)
                  .map((chain) => (
                    <option key={chain.id} value={chain.id}>
                      {chain.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Token</span>
            <select
              value={bridge.selectedToken?.id ?? ''}
              onChange={(event) =>
                bridge.setSelectedToken(
                  bridge.bridgeableTokens.find((token) => token.id === event.target.value) ?? null
                )
              }
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900"
              disabled={!bridge.bridgeableTokens.length || execution.state.isLoading}
            >
              {bridge.bridgeableTokens.map((token) => (
                <option key={token.id} value={token.id}>
                  {token.symbol} — {token.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Amount</span>
            <input
              type="number"
              min="0"
              step="any"
              value={bridge.inputAmount}
              onChange={(event) => bridge.setInputAmount(event.target.value)}
              placeholder="0.0"
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900"
              disabled={execution.state.isLoading}
            />
          </label>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            <div className="flex items-center justify-between gap-3">
              <span>Route</span>
              <span className="font-medium text-gray-900">
                {sourceChainName} → {destinationChainName}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span>Provider</span>
              <span className="font-medium text-gray-900">
                {bridge.availableProtocols.length ? bridge.availableProtocols.join(', ') : 'Unavailable'}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span>Quote status</span>
              {bridge.quote ? (
                <StatusPill
                  tone={bridge.quoteExpired ? 'red' : 'blue'}
                  label={bridge.quoteExpired ? 'Expired' : `Fresh • ${formatCountdown(bridge.quoteExpiresInMs)}`}
                />
              ) : (
                <StatusPill tone="gray" label="Awaiting quote" />
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void bridge.refreshQuote()}
              disabled={!canRequestQuote || bridge.isLoadingQuote || execution.state.isLoading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${bridge.isLoadingQuote ? 'animate-spin' : ''}`} />
              {bridge.isLoadingQuote ? 'Refreshing…' : 'Refresh quote'}
            </button>
            <button
              type="button"
              onClick={() => void handlePrimaryAction()}
              disabled={
                !isConnected ||
                (walletOnSourceChain && !!readinessError) ||
                execution.state.isLoading ||
                isSwitchingChain
              }
              className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {primaryActionLabel}
            </button>
          </div>

          {readinessError && <p className="text-sm text-amber-700">{readinessError}</p>}
          {bridge.quoteError && <p className="text-sm text-red-700">{bridge.quoteError}</p>}
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Bridge route overview</h3>
              <p className="mt-2 text-sm text-gray-600">
                The bridge flow shares the same wallet-driven execution pattern as swap and
                liquidity, but tracks cross-chain delivery after the source confirmation.
              </p>
            </div>
            <StatusPill
              tone={bridge.availableProtocols.length ? 'green' : 'red'}
              label={bridge.availableProtocols.length ? 'Bridge ready' : 'Route unavailable'}
            />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Source</p>
              <p className="mt-2 text-lg font-semibold text-gray-900">{sourceChainName}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Destination</p>
              <p className="mt-2 text-lg font-semibold text-gray-900">{destinationChainName}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Wallet network</p>
              <p className="mt-2 text-lg font-semibold text-gray-900">
                {isConnected && supportedChains[activeChainId]
                  ? supportedChains[activeChainId]?.name
                  : 'Not connected'}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {(bridge.quote?.routeSteps ?? [
              `Lock funds on ${sourceChainName}`,
              'Relay the bridge message',
              `Release funds on ${destinationChainName}`,
            ]).map((step, index) => (
              <div key={step} className="flex gap-3 rounded-xl border border-gray-200 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{step}</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {index === 0
                      ? 'Approval is only needed once per token and source chain.'
                      : index === 1
                        ? 'The source transaction transitions into an in-transit delivery state.'
                        : 'The destination release finalizes the receipt and activity history.'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Latest quote</h3>

          {bridge.quote ? (
            <div className="mt-4 space-y-4 text-sm text-gray-700">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-blue-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Expected output</p>
                  <p className="mt-2 text-xl font-semibold text-gray-900">
                    {bridge.quote.estimatedOutputAmount} {bridge.quote.token.symbol}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Bridge fee</p>
                  <p className="mt-2 text-xl font-semibold text-gray-900">
                    {bridge.quote.bridgeFee.amount} ({bridge.quote.bridgeFee.percentage.toFixed(2)}%)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Min received</p>
                  <p className="mt-2 font-semibold text-gray-900">{bridge.quote.minReceived}</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Source gas</p>
                  <p className="mt-2 font-semibold text-gray-900">{bridge.quote.estimatedGasSource}</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Destination gas</p>
                  <p className="mt-2 font-semibold text-gray-900">{bridge.quote.estimatedGasDestination}</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">ETA</p>
                  <p className="mt-2 font-semibold text-gray-900">~{Math.ceil(bridge.quote.estimatedTime / 60)} min</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-600">
              Refresh a quote to inspect fees, route steps, and delivery timing before bridging.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-gray-900">Execution status</h3>
              <StatusPill
                tone={
                  execution.state.stage === BridgeExecutionStage.SUCCESS
                    ? 'green'
                    : execution.state.stage === BridgeExecutionStage.ERROR
                      ? 'red'
                      : execution.state.stage === BridgeExecutionStage.IDLE
                        ? 'gray'
                        : 'blue'
                }
                label={getBridgeStageMessage(execution.state.stage)}
              />
            </div>

            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="font-medium text-gray-900">{getBridgeStageMessage(execution.state.stage)}</p>
                <p className="mt-1 text-gray-600">
                  {execution.state.stage === BridgeExecutionStage.IDLE
                    ? 'Approval, source submission, in-transit delivery, and receipt handling are now unified into one bridge flow.'
                    : execution.state.stage === BridgeExecutionStage.IN_TRANSIT
                      ? 'The bridge is now waiting for the destination-side delivery step.'
                      : execution.state.stage === BridgeExecutionStage.SUCCESS
                        ? 'Delivery completed and the bridge was written into the recent activity feed.'
                        : execution.state.stage === BridgeExecutionStage.ERROR
                          ? execution.state.error
                          : 'Follow the wallet prompts and wait for the status to advance.'}
                </p>
              </div>

              {execution.state.approvalTxHash && (
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Approval hash</p>
                  <p className="mt-2 break-all font-mono text-xs text-gray-900">{execution.state.approvalTxHash}</p>
                </div>
              )}
              {execution.state.bridgeTxHash && (
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Source tx hash</p>
                  <p className="mt-2 break-all font-mono text-xs text-gray-900">{execution.state.bridgeTxHash}</p>
                </div>
              )}
              {execution.state.destinationTxHash && (
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Destination tx hash</p>
                  <p className="mt-2 break-all font-mono text-xs text-gray-900">{execution.state.destinationTxHash}</p>
                </div>
              )}

              {execution.state.stage === BridgeExecutionStage.ERROR && (
                <button
                  type="button"
                  onClick={execution.retry}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Reset error
                </button>
              )}
              {execution.state.stage !== BridgeExecutionStage.IDLE &&
                execution.state.stage !== BridgeExecutionStage.ERROR && (
                  <button
                    type="button"
                    onClick={execution.reset}
                    disabled={execution.state.isLoading}
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Clear status
                  </button>
                )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Recent bridge activity</h3>
            <div className="mt-4 space-y-3 text-sm text-gray-600">
              {activityFeed.length ? (
                activityFeed.map((activity) => (
                  <div key={activity.id} className="rounded-xl bg-gray-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-gray-900">{activity.title}</p>
                      <StatusPill
                        tone={activity.status === 'failed' ? 'red' : 'green'}
                        label={activity.status}
                      />
                    </div>
                    <p className="mt-1">{activity.summary}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-blue-700">
                      {activity.tokenChanges.map((tokenChange) => (
                        <span
                          key={`${activity.id}-${tokenChange.symbol}-${tokenChange.direction}`}
                          className="rounded-full bg-blue-50 px-2 py-1 font-semibold"
                        >
                          {tokenChange.direction === 'in' ? '+' : '-'}
                          {tokenChange.amount} {tokenChange.symbol}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl bg-gray-50 p-4">
                  Complete a bridge to populate the recent bridge activity feed.
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
