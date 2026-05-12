/**
 * Network switcher UI component for shell-dex M1.
 * 
 * Handles:
 * - Display current connected network
 * - Show available networks
 * - Switch to supported networks
 * - Handle custom chain (Shell Testnet) add-network flow
 * - Display unsupported network warnings
 */

'use client';

import React, { useState } from 'react';
import { useChainId, useSwitchChain } from 'wagmi';
import { allChains, supportedChains, chainIds } from '@/config/chains';
import { useMounted } from '@/hooks/useMounted';

export function NetworkSwitcher() {
  const mounted = useMounted();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const [showDropdown, setShowDropdown] = useState(false);

  const currentChain = supportedChains[chainId];
  const isUnsupported = !currentChain;

  const handleSwitchChain = async (targetChainId: number) => {
    try {
      switchChain({ chainId: targetChainId });
      setShowDropdown(false);
    } catch (error) {
      console.error(`Failed to switch to chain ${targetChainId}:`, error);
      
      // For custom chains (Shell Testnet), prompt user to add network
      if (targetChainId === chainIds.shellTestnet) {
        promptAddShellTestnet();
      }
    }
  };

  const promptAddShellTestnet = async () => {
    if (!window.ethereum) {
      alert('Please install a Web3 wallet (e.g., MetaMask)');
      return;
    }

    const chain = allChains.find(c => c.id === chainIds.shellTestnet);
    if (!chain) return;

    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: `0x${chain.id.toString(16)}`,
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: chain.rpcUrls.public.http,
            blockExplorerUrls: chain.blockExplorers
              ? [chain.blockExplorers.default.url]
              : undefined,
          },
        ],
      });
    } catch (error: any) {
      if (error.code === 4001) {
        console.log('User rejected network addition');
      } else {
        console.error('Failed to add Shell Testnet:', error);
        alert(
          'Failed to add Shell Testnet. Please add it manually in your wallet.'
        );
      }
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => mounted && setShowDropdown(!showDropdown)}
        disabled={!mounted || isPending}
        className={`
          rounded-xl border px-3 py-2 text-sm font-medium transition
          ${
            mounted && isUnsupported
              ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        {mounted ? (currentChain ? currentChain.name : 'Unsupported Network') : 'Select Network'}
      </button>

      {mounted && showDropdown && (
        <div className="absolute top-full right-0 z-10 mt-2 w-48 rounded-2xl border border-gray-200 bg-white p-1 shadow-xl">
          {allChains.map(chain => (
            <button
              key={chain.id}
              onClick={() => handleSwitchChain(chain.id)}
              disabled={isPending || chain.id === chainId}
              className={`
                w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-gray-100
                ${
                  chain.id === chainId
                    ? 'bg-blue-50 font-medium text-blue-700'
                    : 'text-gray-900'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {chain.name}
              {chain.id === chainIds.shellTestnet && (
                <span className="ml-2 text-xs text-orange-600">(custom)</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Extend Window interface for Ethereum provider
 */
declare global {
  interface Window {
    ethereum?: {
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}
