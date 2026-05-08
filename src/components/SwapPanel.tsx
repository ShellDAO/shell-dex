/**
 * Swap panel placeholder for shell-dex M1.
 * 
 * M1 Scope:
 * - No real swap routing or transaction submission
 * - Placeholder UI only
 * - Future: Will integrate token selection, routing, and signing in M2/M3
 */

'use client';

import React from 'react';
import { useAccount } from 'wagmi';

export function SwapPanel() {
  const { isConnected } = useAccount();

  return (
    <div className="border border-gray-300 rounded-lg p-6 bg-gray-50">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Swap</h2>

      {!isConnected ? (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-2">Connect your wallet to swap tokens</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From
            </label>
            <div className="flex items-center gap-2 p-3 border border-gray-300 rounded bg-white">
              <span className="text-gray-600">Select token...</span>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              className="p-2 rounded-full border border-gray-300 bg-white hover:bg-gray-50"
            >
              ⇅
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To
            </label>
            <div className="flex items-center gap-2 p-3 border border-gray-300 rounded bg-white">
              <span className="text-gray-600">Select token...</span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-sm text-yellow-800">
          <span className="font-semibold">M1 Status:</span> Swap routing and
          transaction submission are disabled. This feature is planned for M2/M3
          releases.
        </p>
      </div>

      <button
        disabled={true}
        className="w-full mt-4 px-4 py-3 rounded font-semibold text-white bg-gray-400 cursor-not-allowed"
      >
        Swap (Disabled)
      </button>
    </div>
  );
}
