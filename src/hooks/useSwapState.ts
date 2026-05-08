/**
 * useSwapState hook for managing swap UI and data state in shell-dex M2.
 * 
 * Manages:
 * - Input/output token selection
 * - Input amount
 * - Quote data and refresh state
 * - Loading and error states
 * - Network change detection
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useChainId } from 'wagmi';
import { Token } from '@/config/tokens';
import { SupportedChainId } from '@/config/chains';

export interface Quote {
  inputAmount: string;
  outputAmount: string;
  route: string[];
  fees: {
    total: string;
    percentage: number;
  };
  priceImpact: number;
  minReceived: string;
  expireTime: number;
}

export interface SwapStateType {
  // Token selection
  inputToken: Token | null;
  outputToken: Token | null;

  // Amount
  inputAmount: string;

  // Quote data
  quote: Quote | null;
  quoteTimestamp: number;
  quoteExpired: boolean;

  // Loading/Error states
  isLoadingQuote: boolean;
  quoteError: string | null;
  lastError: string | null;

  // Actions
  setInputToken: (token: Token) => void;
  setOutputToken: (token: Token) => void;
  setInputAmount: (amount: string) => void;
  setQuote: (quote: Quote) => void;
  refreshQuote: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const QUOTE_EXPIRY_MS = 30000; // 30 seconds

export function useSwapState(): SwapStateType {
  const chainId = useChainId() as SupportedChainId;
  
  // Token selection
  const [inputToken, setInputToken] = useState<Token | null>(null);
  const [outputToken, setOutputToken] = useState<Token | null>(null);

  // Amount
  const [inputAmount, setInputAmount] = useState('');

  // Quote data
  const [quote, setQuoteData] = useState<Quote | null>(null);
  const [quoteTimestamp, setQuoteTimestamp] = useState(0);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Check if quote has expired
  const quoteExpired = quote && (Date.now() - quoteTimestamp > QUOTE_EXPIRY_MS);

  // Reset state when chain changes
  useEffect(() => {
    setInputToken(null);
    setOutputToken(null);
    setInputAmount('');
    setQuoteData(null);
    setQuoteTimestamp(0);
    setQuoteError(null);
  }, [chainId]);

  // Handlers
  const handleSetInputToken = useCallback((token: Token) => {
    setInputToken(token);
    // If output token is the same, swap them
    if (outputToken?.id === token.id) {
      setOutputToken(inputToken);
    }
    setQuoteData(null);
    setQuoteTimestamp(0);
  }, [inputToken, outputToken]);

  const handleSetOutputToken = useCallback((token: Token) => {
    setOutputToken(token);
    // If input token is the same, swap them
    if (inputToken?.id === token.id) {
      setInputToken(outputToken);
    }
    setQuoteData(null);
    setQuoteTimestamp(0);
  }, [inputToken, outputToken]);

  const handleSetInputAmount = useCallback((amount: string) => {
    setInputAmount(amount);
    // Invalidate quote when amount changes
    setQuoteData(null);
    setQuoteTimestamp(0);
  }, []);

  const handleSetQuote = useCallback((newQuote: Quote) => {
    setQuoteData(newQuote);
    setQuoteTimestamp(Date.now());
    setQuoteError(null);
  }, []);

  const handleRefreshQuote = useCallback(async () => {
    if (!inputToken || !outputToken || !inputAmount) {
      setQuoteError('Missing token or amount for quote refresh');
      return;
    }

    setIsLoadingQuote(true);
    setQuoteError(null);

    try {
      // Import dynamically to avoid circular dependencies
      const { getQuote } = await import('@/lib/swapRouter');
      const { validateTokenPair, validateInputAmount } = await import('@/lib/swapErrors');
      
      // Validate before requesting quote
      validateTokenPair(inputToken, outputToken);
      validateInputAmount(inputAmount, inputToken.decimals);
      
      const newQuote = await getQuote(inputToken, outputToken, inputAmount, chainId);
      handleSetQuote(newQuote);
    } catch (error) {
      const { handleRoutingError } = await import('@/lib/swapErrors');
      const swapError = handleRoutingError(error);
      const message = swapError.message;
      setQuoteError(message);
      setLastError(message);
    } finally {
      setIsLoadingQuote(false);
    }
  }, [inputToken, outputToken, inputAmount, chainId, handleSetQuote]);

  const handleClearError = useCallback(() => {
    setQuoteError(null);
  }, []);

  const handleReset = useCallback(() => {
    setInputToken(null);
    setOutputToken(null);
    setInputAmount('');
    setQuoteData(null);
    setQuoteTimestamp(0);
    setQuoteError(null);
    setLastError(null);
  }, []);

  return {
    inputToken,
    outputToken,
    inputAmount,
    quote,
    quoteTimestamp,
    quoteExpired: !!quoteExpired,
    isLoadingQuote,
    quoteError,
    lastError,
    setInputToken: handleSetInputToken,
    setOutputToken: handleSetOutputToken,
    setInputAmount: handleSetInputAmount,
    setQuote: handleSetQuote,
    refreshQuote: handleRefreshQuote,
    clearError: handleClearError,
    reset: handleReset,
  };
}
