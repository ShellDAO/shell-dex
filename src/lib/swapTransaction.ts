/**
 * Swap transaction building for M3 execution.
 *
 * Constructs viem transaction requests from routing quotes,
 * applies slippage adjustments, and validates output amounts.
 */

import { type Address, type Hex, isAddress, parseUnits } from 'viem';
import { SwapQuote } from './swapRouter';

export interface SwapTransactionParams {
  quote: SwapQuote;
  slippageTolerance: number; // 0-1 (e.g., 0.005 = 0.5%)
  userAddress: Address;
  swapContract?: Address;
  inputAmount: string;
  inputTokenDecimals: number;
  outputTokenDecimals: number;
  isNativeInput: boolean;
}

export interface SwapTransaction {
  to: Address;
  from: Address;
  data: Hex;
  value: bigint;
  estimatedGas?: bigint;
  minOutput: bigint;
  expectedOutput: bigint;
}

/**
 * Apply slippage tolerance to minimum output amount.
 * 
 * @param outputAmount The expected output amount from quote
 * @param slippageTolerance Tolerance as decimal (0.005 = 0.5%)
 * @returns Minimum acceptable output after slippage
 */
export function calculateMinimumOutput(
  outputAmount: bigint,
  slippageTolerance: number
): bigint {
  if (slippageTolerance < 0 || slippageTolerance > 0.5) {
    throw new Error('Slippage tolerance must be between 0 and 0.5 (0% to 50%)');
  }

  const slippageAmount = (outputAmount * BigInt(Math.round(slippageTolerance * 100))) / BigInt(10000);
  const minimumOutput = outputAmount - slippageAmount;

  if (minimumOutput <= BigInt(0)) {
    throw new Error('Slippage tolerance too high; minimum output would be zero');
  }

  return minimumOutput;
}

/**
 * Build a swap transaction from a routing quote.
 * 
 * Constructs the transaction data that will be signed and submitted.
 * 
 * @param params Swap transaction parameters
 * @returns Transaction object ready for signing
 */
export function buildSwapTransaction(params: SwapTransactionParams): SwapTransaction {
  const {
    quote,
    slippageTolerance,
    userAddress,
    swapContract,
    inputAmount,
    inputTokenDecimals,
    outputTokenDecimals,
    isNativeInput,
  } = params;

  // Validate inputs
  if (!quote.callData) {
    throw new Error('Quote missing callData; cannot build transaction');
  }

  if (!quote.outputAmount) {
    throw new Error('Quote missing outputAmount');
  }

  // Calculate minimum output with slippage
  const expectedOutput = parseAmountToBaseUnits(quote.outputAmount, outputTokenDecimals, 'Quote output');
  const minOutput = calculateMinimumOutput(expectedOutput, slippageTolerance);
  const resolvedSwapContract = (quote.swapContract ?? swapContract) as Address | undefined;

  // For now, use call data directly from quote
  // In production, may need to encode slippage into call data
  // depending on router interface (e.g., update minOutput parameter)
  const callData = quote.callData;

  if (!resolvedSwapContract) {
    throw new Error('Quote missing swap contract; cannot build transaction');
  }

  return {
    to: resolvedSwapContract,
    from: userAddress,
    data: callData as Hex,
    value: isNativeInput
      ? parseAmountToBaseUnits(inputAmount, inputTokenDecimals, 'Input')
      : BigInt(0),
    estimatedGas: quote.estimatedGas ? BigInt(quote.estimatedGas) : undefined,
    minOutput,
    expectedOutput,
  };
}

/**
 * Encode minimum output into swap call data if needed.
 * 
 * This is router-specific; Shell DEX router interface may require
 * updating the minOutput parameter in the encoded function call.
 * 
 * For now, returns the original call data as-is (assuming router
 * validates slippage client-side or uses a default).
 */
export function encodeSlippageIntoCallData(
  originalCallData: string,
  minOutput: string,
  _routerInterface?: string
): string {
  // TODO: Implement if Shell DEX router requires call data modification
  // For now, pass through
  return originalCallData;
}

/**
 * Validate swap transaction before submission.
 * 
 * @param tx Transaction to validate
 * @returns Validation result with any error messages
 */
export function validateSwapTransaction(tx: SwapTransaction): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!tx.to || !isAddress(tx.to)) {
    errors.push('Invalid router contract address');
  }

  if (!tx.from || !isAddress(tx.from)) {
    errors.push('Invalid user address');
  }

  if (!tx.data || !tx.data.startsWith('0x')) {
    errors.push('Invalid transaction data');
  }

  if (tx.minOutput <= BigInt(0)) {
    errors.push('Minimum output must be greater than zero');
  }

  if (tx.minOutput > tx.expectedOutput) {
    errors.push('Minimum output cannot exceed expected output');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function parseAmountToBaseUnits(
  amount: string,
  decimals: number,
  label: string
): bigint {
  try {
    return parseUnits(amount, decimals);
  } catch {
    throw new Error(`${label} amount is invalid for token decimals`);
  }
}
