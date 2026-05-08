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

export function WalletConnect() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [showConnectors, setShowConnectors] = React.useState(false);

  const formatAddress = (addr: string | undefined) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <div className="px-3 py-2 rounded border border-green-300 bg-green-50 text-green-700 text-sm font-medium">
          {formatAddress(address)}
        </div>
        <button
          onClick={() => disconnect()}
          className="px-3 py-2 rounded border border-gray-300 bg-white text-gray-700 text-sm hover:bg-gray-50 transition"
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
        className="px-4 py-2 rounded border border-blue-500 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>

      {showConnectors && (
        <div className="absolute top-full mt-2 w-48 border border-gray-300 rounded bg-white shadow-lg z-10">
          {connectors.map(connector => (
            <button
              key={connector.uid}
              onClick={() => {
                connect({ connector });
                setShowConnectors(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-900 transition"
            >
              {connector.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
