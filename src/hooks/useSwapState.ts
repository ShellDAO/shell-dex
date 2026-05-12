/**
 * useSwapState hook for managing swap UI and selected route state.
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useChainId } from 'wagmi';
import type { SupportedChainId } from '@/config/chains';
import { getToken, getTokenAddress, type Token } from '@/config/tokens';
import type { SwapRoute } from '@/lib/multiHopRouter';
import type { SwapQuote } from '@/lib/swapRouter';

export interface Quote {
  inputAmount: string;
  outputAmount: string;
  tradeType: 'exactIn' | 'exactOut';
  route: string[];
  fees: {
    total: string;
    percentage: number;
  };
  priceImpact: number;
  minReceived: string;
  expireTime: number;
  estimatedGas?: string;
  swapContract?: string;
  callData?: string;
}

export interface SwapStateType {
  inputToken: Token | null;
  outputToken: Token | null;
  inputAmount: string;
  outputAmount: string;
  quote: SwapQuote | null;
  selectedRoute: SwapRoute | null;
  availableRoutes: SwapRoute[];
  selectedRouteId: string | null;
  quoteTimestamp: number;
  quoteExpired: boolean;
  isLoadingQuote: boolean;
  quoteError: string | null;
  lastError: string | null;
  setInputToken: (token: Token) => void;
  setOutputToken: (token: Token) => void;
  setInputAmount: (amount: string) => void;
  setOutputAmount: (amount: string) => void;
  setQuote: (quote: SwapQuote) => void;
  selectRoute: (routeId: string) => void;
  refreshQuote: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const QUOTE_EXPIRY_MS = 30000;

function getDefaultSwapTokens(chainId: SupportedChainId): {
  inputToken: Token | null;
  outputToken: Token | null;
} {
  const usdc = getToken('usdc');
  const shell = getToken('shell');

  if (
    usdc &&
    shell &&
    getTokenAddress(usdc.id, chainId) &&
    getTokenAddress(shell.id, chainId)
  ) {
    return {
      inputToken: usdc,
      outputToken: shell,
    };
  }

  return {
    inputToken: null,
    outputToken: null,
  };
}

export function useSwapState(): SwapStateType {
  const chainId = useChainId() as SupportedChainId;
  const defaultTokens = getDefaultSwapTokens(chainId);

  const [inputToken, setInputToken] = useState<Token | null>(defaultTokens.inputToken);
  const [outputToken, setOutputToken] = useState<Token | null>(defaultTokens.outputToken);
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [tradeType, setTradeType] = useState<'exactIn' | 'exactOut'>('exactIn');
  const [quote, setQuoteData] = useState<SwapQuote | null>(null);
  const [availableRoutes, setAvailableRoutes] = useState<SwapRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [quoteTimestamp, setQuoteTimestamp] = useState(0);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const selectedRoute = quote?.selectedRoute ?? availableRoutes.find(route => route.id === selectedRouteId) ?? null;
  const quoteExpired = quote && (Date.now() - quoteTimestamp > QUOTE_EXPIRY_MS);

  useEffect(() => {
    const nextDefaults = getDefaultSwapTokens(chainId);
    setInputToken(nextDefaults.inputToken);
    setOutputToken(nextDefaults.outputToken);
    setInputAmount('');
    setOutputAmount('');
    setTradeType('exactIn');
    setQuoteData(null);
    setAvailableRoutes([]);
    setSelectedRouteId(null);
    setQuoteTimestamp(0);
    setQuoteError(null);
  }, [chainId]);

  const clearQuoteState = useCallback(() => {
    setQuoteData(null);
    setAvailableRoutes([]);
    setSelectedRouteId(null);
    setQuoteTimestamp(0);
  }, []);

  const handleSetInputToken = useCallback((token: Token) => {
    setInputToken(token);
    if (outputToken?.id === token.id) {
      setOutputToken(inputToken);
    }
    setTradeType('exactIn');
    clearQuoteState();
  }, [clearQuoteState, inputToken, outputToken]);

  const handleSetOutputToken = useCallback((token: Token) => {
    setOutputToken(token);
    if (inputToken?.id === token.id) {
      setInputToken(outputToken);
    }
    setTradeType('exactIn');
    clearQuoteState();
  }, [clearQuoteState, inputToken, outputToken]);

  const handleSetInputAmount = useCallback((amount: string) => {
    setInputAmount(amount);
    setOutputAmount('');
    setTradeType('exactIn');
    clearQuoteState();
  }, [clearQuoteState]);

  const handleSetOutputAmount = useCallback((amount: string) => {
    setOutputAmount(amount);
    setInputAmount('');
    setTradeType('exactOut');
    clearQuoteState();
  }, [clearQuoteState]);

  const handleSetQuote = useCallback((newQuote: SwapQuote) => {
    setInputAmount(newQuote.inputAmount);
    setOutputAmount(newQuote.outputAmount);
    setTradeType(newQuote.tradeType);
    setQuoteData(newQuote);
    setAvailableRoutes(newQuote.routes ?? []);
    setSelectedRouteId(newQuote.selectedRouteId ?? null);
    setQuoteTimestamp(Date.now());
    setQuoteError(null);
  }, []);

  const handleSelectRoute = useCallback(async (routeId: string) => {
    if (!quote) {
      return;
    }

    const { selectRouteQuote } = await import('@/lib/swapRouter');
    const nextQuote = selectRouteQuote(quote, routeId);
    setQuoteData(nextQuote);
    setAvailableRoutes(nextQuote.routes ?? []);
    setSelectedRouteId(nextQuote.selectedRouteId ?? null);
    setQuoteError(null);
  }, [quote]);

  const handleRefreshQuote = useCallback(async () => {
    const quoteAmount = tradeType === 'exactOut' ? outputAmount : inputAmount;

    if (!inputToken || !outputToken || !quoteAmount) {
      setQuoteError('Missing token or amount for quote refresh');
      return;
    }

    setIsLoadingQuote(true);
    setQuoteError(null);

    try {
      const { getQuote } = await import('@/lib/swapRouter');
      const { validateTokenPair, validateInputAmount } = await import('@/lib/swapErrors');

      validateTokenPair(inputToken, outputToken);
      validateInputAmount(
        quoteAmount,
        tradeType === 'exactOut' ? outputToken.decimals : inputToken.decimals
      );

      const newQuote = await getQuote(inputToken, outputToken, quoteAmount, chainId, {
        preferredRouteId: selectedRouteId ?? undefined,
        tradeType,
      });
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
  }, [chainId, handleSetQuote, inputAmount, inputToken, outputAmount, outputToken, selectedRouteId, tradeType]);

  const handleClearError = useCallback(() => {
    setQuoteError(null);
  }, []);

  const handleReset = useCallback(() => {
    const nextDefaults = getDefaultSwapTokens(chainId);
    setInputToken(nextDefaults.inputToken);
    setOutputToken(nextDefaults.outputToken);
    setInputAmount('');
    setOutputAmount('');
    setTradeType('exactIn');
    setQuoteData(null);
    setAvailableRoutes([]);
    setSelectedRouteId(null);
    setQuoteTimestamp(0);
    setQuoteError(null);
    setLastError(null);
  }, [chainId]);

  return {
    inputToken,
    outputToken,
    inputAmount,
    outputAmount,
    quote,
    selectedRoute,
    availableRoutes,
    selectedRouteId,
    quoteTimestamp,
    quoteExpired: !!quoteExpired,
    isLoadingQuote,
    quoteError,
    lastError,
    setInputToken: handleSetInputToken,
    setOutputToken: handleSetOutputToken,
    setInputAmount: handleSetInputAmount,
    setOutputAmount: handleSetOutputAmount,
    setQuote: handleSetQuote,
    selectRoute: handleSelectRoute,
    refreshQuote: handleRefreshQuote,
    clearError: handleClearError,
    reset: handleReset,
  };
}
