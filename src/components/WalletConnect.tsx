/**
 * Wallet connection status and control component for shell-dex M1.
 * 
 * Displays:
 * - Connected account address (or connect button if disconnected)
 * - Connection status
 * - Disconnect option
 */

'use client';

import React from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useMounted } from '@/hooks/useMounted';

export function WalletConnect() {
  const mounted = useMounted();
  const { address, isConnected, isConnecting } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [showConnectors, setShowConnectors] = React.useState(false);

  const formatAddress = (addr: string | undefined) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!mounted) {
    return (
      <div className="relative">
        <button
          disabled={false}
          className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
          {formatAddress(address)}
        </div>
        <button
          onClick={() => disconnect()}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-100"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowConnectors(!showConnectors)}
        disabled={isConnecting}
        className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>

      {showConnectors && (
        <div className="absolute top-full right-0 z-10 mt-2 w-48 rounded-2xl border border-gray-200 bg-white p-1 shadow-xl">
          {connectors.map(connector => (
            <button
              key={connector.uid}
              onClick={() => {
                connect({ connector });
                setShowConnectors(false);
              }}
              className="w-full rounded-xl px-3 py-2 text-left text-sm text-gray-900 transition hover:bg-gray-100"
            >
              {connector.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
