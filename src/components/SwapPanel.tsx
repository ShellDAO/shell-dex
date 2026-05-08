/**
 * Swap panel for shell-dex M2/M3.
 * 
 * M2 Features:
 * - Token selection UI
 * - Amount input with quote fetching
 * - Quote display with fees and impact
 * - Quote refresh control
 * 
 * M3 Features:
 * - Slippage tolerance configuration
 * - Gas estimation display
 * - Approval status tracking
 * - Transaction submission and status monitoring
 * - Swap execution with error handling
 */

'use client';

import React, { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useSwapState, useSwapExecution, getSwapStageMessage, SwapStage } from '@/hooks';
import { getTokensForChain } from '@/config/tokens';
import { supportedChains, type SupportedChainId } from '@/config/chains';
import { SwapQuote } from '@/lib/swapRouter';

const DEFAULT_SLIPPAGE = 0.005; // 0.5%
const SHELL_DEX_ROUTER_ADDRESS = process.env.NEXT_PUBLIC_SHELL_DEX_ROUTER_ADDRESS || '0x0000000000000000000000000000000000000000';

export function SwapPanel() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const swap = useSwapState();
  const execution = useSwapExecution();

  const [showInputTokens, setShowInputTokens] = useState(false);
  const [showOutputTokens, setShowOutputTokens] = useState(false);
  const [slippageTolerance, setSlippageTolerance] = useState(DEFAULT_SLIPPAGE);
  const [showSlippageInput, setShowSlippageInput] = useState(false);

  const supportedChainId = chainId as SupportedChainId;
  const availableTokens = getTokensForChain(supportedChainId);
  const chain = supportedChains[supportedChainId];

  const handleSwapTokens = () => {
    if (swap.inputToken && swap.outputToken) {
      swap.setInputToken(swap.outputToken);
      swap.setOutputToken(swap.inputToken);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    swap.setInputAmount(value);
    // Auto-refresh quote after short delay
    if (value && swap.outputToken) {
      const timer = setTimeout(() => {
        if (value === e.target.value) {
          swap.refreshQuote();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  };

  const handleSlippageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    if (value >= 0 && value <= 0.5) {
      setSlippageTolerance(value / 100);
    }
  };

  const handleSwap = async () => {
    if (!swap.inputToken || !swap.outputToken || !swap.quote || !swap.inputAmount) {
      console.error('Missing swap parameters');
      return;
    }

    await execution.executeSwap({
      quote: swap.quote as SwapQuote,
      slippageTolerance,
      swapContract: SHELL_DEX_ROUTER_ADDRESS as `0x${string}`,
      tokenAddress: swap.inputToken.addresses[supportedChainId] as `0x${string}`,
      onSuccess: () => {
        // Reset swap state after successful swap
        setTimeout(() => {
          swap.setInputAmount('');
          execution.reset();
        }, 2000);
      },
      onError: (error) => {
        console.error('Swap failed:', error);
      },
    });
  };

  const canSubmitSwap = swap.inputToken &&
    swap.outputToken &&
    swap.quote &&
    swap.inputAmount &&
    !swap.isLoadingQuote &&
    !execution.state.isLoading;

  if (!isConnected) {
    return (
      <div className="border border-gray-300 rounded-lg p-6 bg-gray-50">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Swap</h2>
        <div className="text-center py-8">
          <p className="text-gray-600 mb-2">Connect your wallet to swap tokens</p>
        </div>
      </div>
    );
  }

  if (!chain) {
    return (
      <div className="border border-red-300 rounded-lg p-6 bg-red-50">
        <h2 className="text-xl font-bold text-red-900 mb-4">Unsupported Network</h2>
        <p className="text-red-700 text-sm">
          Please switch to Arbitrum One or Shell Testnet to use the DEX.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-gray-300 rounded-lg p-6 bg-white shadow-sm">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Swap</h2>

      <div className="space-y-4">
        {/* Input Token Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            From
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setShowInputTokens(!showInputTokens)}
              className="flex-1 px-3 py-3 border border-gray-300 rounded bg-white hover:bg-gray-50 text-left font-medium"
              disabled={execution.state.isLoading}
            >
              {swap.inputToken ? (
                <span className="flex items-center gap-2">
                  <span className="text-lg">🪙</span>
                  {swap.inputToken.symbol}
                </span>
              ) : (
                <span className="text-gray-500">Select token...</span>
              )}
            </button>
            <input
              type="number"
              placeholder="0"
              value={swap.inputAmount}
              onChange={handleAmountChange}
              disabled={execution.state.isLoading}
              className="flex-1 px-3 py-3 border border-gray-300 rounded bg-white font-mono text-right disabled:bg-gray-100"
            />
          </div>

          {showInputTokens && (
            <div className="absolute mt-1 w-48 border border-gray-300 rounded bg-white shadow-lg z-20">
              {availableTokens.map(token => (
                <button
                  key={token.id}
                  onClick={() => {
                    swap.setInputToken(token);
                    setShowInputTokens(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                >
                  {token.symbol} - {token.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center">
          <button
            onClick={handleSwapTokens}
            disabled={!swap.inputToken || !swap.outputToken || execution.state.isLoading}
            className="p-2 rounded-full border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Swap tokens"
          >
            ⇅
          </button>
        </div>

        {/* Output Token Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            To
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setShowOutputTokens(!showOutputTokens)}
              className="flex-1 px-3 py-3 border border-gray-300 rounded bg-white hover:bg-gray-50 text-left font-medium"
              disabled={execution.state.isLoading}
            >
              {swap.outputToken ? (
                <span className="flex items-center gap-2">
                  <span className="text-lg">🪙</span>
                  {swap.outputToken.symbol}
                </span>
              ) : (
                <span className="text-gray-500">Select token...</span>
              )}
            </button>
            <div className="flex-1 px-3 py-3 border border-gray-300 rounded bg-gray-50 font-mono text-right text-gray-900">
              {swap.isLoadingQuote ? (
                <span className="text-gray-500">Loading...</span>
              ) : swap.quote ? (
                swap.quote.outputAmount
              ) : (
                <span className="text-gray-500">-</span>
              )}
            </div>
          </div>

          {showOutputTokens && (
            <div className="absolute mt-1 w-48 border border-gray-300 rounded bg-white shadow-lg z-20">
              {availableTokens.map(token => (
                <button
                  key={token.id}
                  onClick={() => {
                    swap.setOutputToken(token);
                    setShowOutputTokens(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                >
                  {token.symbol} - {token.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quote Details */}
        {swap.quote && (
          <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">Fee:</span>
                <span className="font-medium">
                  {swap.quote.fees.total} ({swap.quote.fees.percentage}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Price Impact:</span>
                <span className="font-medium">{swap.quote.priceImpact.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Min. Received:</span>
                <span className="font-medium">{swap.quote.minReceived} {swap.outputToken?.symbol}</span>
              </div>
              {swap.quote.estimatedGas && (
                <div className="flex justify-between">
                  <span className="text-gray-700">Est. Gas:</span>
                  <span className="font-medium text-xs font-mono">{swap.quote.estimatedGas} gas</span>
                </div>
              )}
              {swap.quoteExpired && (
                <div className="text-xs text-orange-600 font-medium">Quote expired - refresh recommended</div>
              )}
            </div>
          </div>
        )}

        {/* Slippage Tolerance (M3) */}
        {swap.quote && (
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Slippage Tolerance</label>
              <button
                onClick={() => setShowSlippageInput(!showSlippageInput)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                {showSlippageInput ? 'Hide' : 'Edit'}
              </button>
            </div>
            <div className="text-lg font-semibold text-gray-900">
              {(slippageTolerance * 100).toFixed(2)}%
            </div>
            {showSlippageInput && (
              <div className="mt-2">
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="0.1"
                  value={slippageTolerance * 100}
                  onChange={handleSlippageChange}
                  className="w-full"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Adjust slippage tolerance (0-50%, default 0.5%)
                </p>
              </div>
            )}
          </div>
        )}

        {/* Transaction Status (M3) */}
        {execution.state.stage !== SwapStage.IDLE && (
          <div className={`border rounded-lg p-3 ${
            execution.state.stage === SwapStage.SUCCESS ? 'border-green-200 bg-green-50' :
            execution.state.stage === SwapStage.ERROR ? 'border-red-200 bg-red-50' :
            'border-blue-200 bg-blue-50'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {getSwapStageMessage(execution.state.stage)}
              </span>
              {execution.state.isLoading && (
                <span className="inline-block animate-spin text-lg">⟳</span>
              )}
            </div>
            {execution.state.approvalTxHash && (
              <p className="text-xs text-gray-600 mt-1 font-mono">
                Approval: {execution.state.approvalTxHash.slice(0, 10)}...
              </p>
            )}
            {execution.state.swapTxHash && (
              <p className="text-xs text-gray-600 mt-1 font-mono">
                Swap: {execution.state.swapTxHash.slice(0, 10)}...
              </p>
            )}
            {execution.state.error && (
              <p className="text-xs text-red-700 mt-1">{execution.state.error}</p>
            )}
          </div>
        )}

        {/* Error Display */}
        {swap.quoteError && execution.state.stage === SwapStage.IDLE && (
          <div className="border border-orange-200 rounded-lg p-3 bg-orange-50">
            <p className="text-sm text-orange-800">{swap.quoteError}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={swap.refreshQuote}
            disabled={
              !swap.inputToken ||
              !swap.outputToken ||
              !swap.inputAmount ||
              swap.isLoadingQuote ||
              execution.state.isLoading
            }
            className="flex-1 px-4 py-2 rounded border border-blue-300 bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {swap.isLoadingQuote ? 'Loading...' : 'Refresh Quote'}
          </button>
          <button
            onClick={handleSwap}
            disabled={!canSubmitSwap || (execution.state.error !== undefined && execution.state.stage !== SwapStage.IDLE)}
            className="flex-1 px-4 py-3 rounded font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {execution.state.isLoading ? 'Processing...' : 'Swap'}
          </button>
          {execution.state.stage === SwapStage.ERROR && (
            <button
              onClick={execution.retry}
              className="px-4 py-2 rounded border border-gray-300 bg-white hover:bg-gray-50 font-medium text-sm"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {/* M3 Status Banner */}
      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
        <p className="text-xs text-green-800">
          <span className="font-semibold">M3 Ready:</span> Transaction execution, slippage control,
          and approval flows are now live.
        </p>
      </div>
    </div>
  );
}
