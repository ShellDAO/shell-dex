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
    <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/92 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-semibold text-white shadow-sm">
            S
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-semibold tracking-tight text-gray-900">
                Shell DEX
              </h1>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                Swap
              </span>
            </div>
            <p className="hidden text-xs text-gray-500 sm:block">
              Swap-first shell-chain interface
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <NetworkSwitcher />
          <WalletConnect />
        </div>
      </div>
    </header>
  );
}
