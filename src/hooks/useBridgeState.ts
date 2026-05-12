'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupportedChainId } from '@/config/chains';
import { chainIds, supportedChains } from '@/config/chains';
import { getTokensForChain, type Token } from '@/config/tokens';
import { getAvailableBridges, getBridgeQuote, type BridgeQuote } from '@/lib/bridgeRouter';

export interface BridgeState {
  sourceChainId: SupportedChainId;
  destinationChainId: SupportedChainId;
  selectedToken: Token | null;
  inputAmount: string;
  quote: BridgeQuote | null;
  bridgeableTokens: Token[];
  availableProtocols: Array<'stargate' | 'custom'>;
  isLoadingQuote: boolean;
  quoteError: string | null;
  lastError: string | null;
  quoteExpired: boolean;
  quoteExpiresInMs: number;
  setSourceChainId: (chainId: SupportedChainId) => void;
  setDestinationChainId: (chainId: SupportedChainId) => void;
  setSelectedToken: (token: Token | null) => void;
  setInputAmount: (amount: string) => void;
  swapDirection: () => void;
  refreshQuote: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export function useBridgeState(initialSourceChainId: SupportedChainId): BridgeState {
  const [sourceChainId, setSourceChainIdState] = useState<SupportedChainId>(initialSourceChainId);
  const [destinationChainId, setDestinationChainIdState] = useState<SupportedChainId>(
    initialSourceChainId === chainIds.arbitrumOne ? chainIds.shellTestnet : chainIds.arbitrumOne
  );
  const [selectedToken, setSelectedTokenState] = useState<Token | null>(null);
  const [inputAmount, setInputAmountState] = useState('');
  const [quote, setQuote] = useState<BridgeQuote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const availableProtocols = useMemo(
    () => getAvailableBridges(sourceChainId, destinationChainId),
    [destinationChainId, sourceChainId]
  );
  const bridgeableTokens = useMemo(
    () =>
      getTokensForChain(sourceChainId).filter((token) =>
        Boolean(token.addresses[destinationChainId])
      ),
    [destinationChainId, sourceChainId]
  );
  const quoteExpiresInMs = quote ? Math.max(quote.expiresAt - now, 0) : 0;
  const quoteExpired = !!quote && quoteExpiresInMs === 0;

  useEffect(() => {
    if (!quote) {
      return;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [quote]);

  useEffect(() => {
    if (!supportedChains[sourceChainId]) {
      setSourceChainIdState(chainIds.arbitrumOne);
    }
  }, [sourceChainId]);

  useEffect(() => {
    if (sourceChainId === destinationChainId) {
      setDestinationChainIdState(
        sourceChainId === chainIds.arbitrumOne ? chainIds.shellTestnet : chainIds.arbitrumOne
      );
    }
  }, [destinationChainId, sourceChainId]);

  useEffect(() => {
    if (!bridgeableTokens.length) {
      setSelectedTokenState(null);
      return;
    }

    if (!selectedToken || !bridgeableTokens.some((token) => token.id === selectedToken.id)) {
      setSelectedTokenState(bridgeableTokens[0]);
    }
  }, [bridgeableTokens, selectedToken]);

  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
    setNow(Date.now());
  }, [destinationChainId, inputAmount, selectedToken, sourceChainId]);

  const setSourceChainId = useCallback((chainId: SupportedChainId) => {
    setSourceChainIdState(chainId);
    setQuoteError(null);
  }, []);

  const setDestinationChainId = useCallback((chainId: SupportedChainId) => {
    setDestinationChainIdState(chainId);
    setQuoteError(null);
  }, []);

  const setSelectedToken = useCallback((token: Token | null) => {
    setSelectedTokenState(token);
    setQuoteError(null);
  }, []);

  const setInputAmount = useCallback((amount: string) => {
    setInputAmountState(amount);
    setQuoteError(null);
  }, []);

  const swapDirection = useCallback(() => {
    setSourceChainIdState(destinationChainId);
    setDestinationChainIdState(sourceChainId);
    setQuoteError(null);
  }, [destinationChainId, sourceChainId]);

  const refreshQuote = useCallback(async () => {
    if (!selectedToken) {
      setQuoteError('Select a token before requesting a quote.');
      return;
    }

    if (!inputAmount) {
      setQuoteError('Enter an amount before requesting a quote.');
      return;
    }

    if (!availableProtocols.length) {
      setQuoteError('This bridge path is not supported yet.');
      return;
    }

    setIsLoadingQuote(true);
    setQuoteError(null);

    try {
      const nextQuote = await getBridgeQuote(
        selectedToken,
        inputAmount,
        sourceChainId,
        destinationChainId
      );
      setQuote(nextQuote);
      setNow(Date.now());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch bridge quote.';
      setQuote(null);
      setQuoteError(message);
      setLastError(message);
    } finally {
      setIsLoadingQuote(false);
    }
  }, [availableProtocols.length, destinationChainId, inputAmount, selectedToken, sourceChainId]);

  const clearError = useCallback(() => {
    setQuoteError(null);
  }, []);

  const reset = useCallback(() => {
    setSelectedTokenState(bridgeableTokens[0] ?? null);
    setInputAmountState('');
    setQuote(null);
    setIsLoadingQuote(false);
    setQuoteError(null);
    setLastError(null);
    setNow(Date.now());
  }, [bridgeableTokens]);

  return {
    sourceChainId,
    destinationChainId,
    selectedToken,
    inputAmount,
    quote,
    bridgeableTokens,
    availableProtocols,
    isLoadingQuote,
    quoteError,
    lastError,
    quoteExpired,
    quoteExpiresInMs,
    setSourceChainId,
    setDestinationChainId,
    setSelectedToken,
    setInputAmount,
    swapDirection,
    refreshQuote,
    clearError,
    reset,
  };
}
