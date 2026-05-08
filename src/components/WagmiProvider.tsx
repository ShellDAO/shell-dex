/**
 * Wagmi Provider wrapper for Next.js.
 * 
 * This is a client-side component that wraps the wagmi Config context.
 * Must be "use client" to avoid server component conflicts with browser wallet APIs.
 */

'use client';

import React, { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/lib/wagmi';

// React Query client for wagmi (handles RPC calls and caching)
const queryClient = new QueryClient();

interface WagmiProviderWrapperProps {
  children: ReactNode;
}

export function WagmiProviderWrapper({ children }: WagmiProviderWrapperProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
