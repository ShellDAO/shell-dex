/**
 * Swap panel for shell-dex M2.
 * 
 * M2 Features:
 * - Token selection UI
 * - Amount input with quote fetching
 * - Quote display with fees and impact
 * - Quote refresh control
 * 
 * M3 Preview: Swap button will enable transaction signing and submission.
 */

'use client';

import React, { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useSwapState } from '@/hooks';
import { getTokensForChain } from '@/config/tokens';
import { supportedChains, type SupportedChainId } from '@/config/chains';

export function SwapPanel() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const swap = useSwapState();
  const [showInputTokens, setShowInputTokens] = useState(false);
  const [showOutputTokens, setShowOutputTokens] = useState(false);

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
              className="flex-1 px-3 py-3 border border-gray-300 rounded bg-white font-mono text-right"
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
            disabled={!swap.inputToken || !swap.outputToken}
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
              {swap.quoteExpired && (
                <div className="text-xs text-orange-600 font-medium">Quote expired - refresh recommended</div>
              )}
            </div>
          </div>
        )}

        {/* Error Display */}
        {swap.quoteError && (
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
              swap.isLoadingQuote
            }
            className="flex-1 px-4 py-2 rounded border border-blue-300 bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {swap.isLoadingQuote ? 'Loading...' : 'Refresh Quote'}
          </button>
        </div>
      </div>

      {/* M2 Status Banner */}
      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-xs text-yellow-800">
          <span className="font-semibold">M2 Status:</span> Quote and routing enabled with
          fixture data. Actual transaction submission coming in M3.
        </p>
      </div>

      <button
        disabled={true}
        className="w-full mt-4 px-4 py-3 rounded font-semibold text-white bg-gray-400 cursor-not-allowed"
      >
        Swap (M3 Feature)
      </button>
    </div>
  );
}
