/**
 * Chain support status display for shell-dex M1.
 * 
 * Shows:
 * - All supported chains in card format
 * - RPC status
 * - Features available on each chain
 */

'use client';

import React, { useEffect, useState } from 'react';
import { allChains } from '@/config/chains';

export function ChainSupportCards() {
  const [rpcStatus, setRpcStatus] = useState<Record<number, boolean>>({});

  useEffect(() => {
    // Check RPC connectivity for each chain
    const checkRpc = async () => {
      const status: Record<number, boolean> = {};
      
      for (const chain of allChains) {
        try {
          const rpcUrl = chain.rpcUrls.public.http[0];
          const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_chainId',
              params: [],
              id: 1,
            }),
          });
          status[chain.id] = response.ok;
        } catch {
          status[chain.id] = false;
        }
      }

      setRpcStatus(status);
    };

    checkRpc();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {allChains.map(chain => (
        <div
          key={chain.id}
          className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{chain.name}</h3>
              <p className="text-sm text-gray-600">Chain ID: {chain.id}</p>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  rpcStatus[chain.id] ? 'bg-green-500' : 'bg-gray-300'
                }`}
              />
              <span className="text-xs font-medium text-gray-600">
                {rpcStatus[chain.id] ? 'RPC OK' : 'Checking...'}
              </span>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <p className="text-sm">
              <span className="font-medium text-gray-700">Native Token:</span>
              <span className="ml-2 text-gray-600">
                {chain.nativeCurrency.symbol}
              </span>
            </p>
            {chain.blockExplorers?.default && (
              <p className="text-sm">
                <span className="font-medium text-gray-700">Explorer:</span>
                <a
                  href={chain.blockExplorers.default.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-blue-600 hover:text-blue-800"
                >
                  {chain.blockExplorers.default.name}
                </a>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {chain.features.walletConnect && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                Wallet Connect
              </span>
            )}
            {chain.features.networkSwitch && (
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                Network Switch
              </span>
            )}
            <span
              className={`px-2 py-1 text-xs font-medium rounded ${
                chain.features.swapEnabled
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {chain.features.swapEnabled ? 'Swap Enabled' : 'Swap Coming Soon'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
