/**
 * Header component for shell-dex.
 * 
 * Displays:
 * - Logo/branding
 * - Network switcher
 * - Wallet connect/status
 */

'use client';

import React from 'react';
import { NetworkSwitcher } from './NetworkSwitcher';
import { WalletConnect } from './WalletConnect';

export function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <h1 className="text-2xl font-bold text-gray-900">Shell DEX</h1>
          <nav className="hidden md:flex gap-6">
            <a
              href="#"
              className="text-gray-700 hover:text-gray-900 font-medium transition"
            >
              Swap
            </a>
            <a
              href="#"
              className="text-gray-700 hover:text-gray-900 font-medium transition"
            >
              Bridge
            </a>
            <a
              href="#"
              className="text-gray-700 hover:text-gray-900 font-medium transition"
            >
              Liquidity
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <NetworkSwitcher />
          <WalletConnect />
        </div>
      </div>
    </header>
  );
}
