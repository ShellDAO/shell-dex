/**
 * Swap transaction building for M3 execution.
 *
 * Constructs viem transaction requests from routing quotes,
 * applies slippage adjustments, and validates output amounts.
 */

import {
  type Abi,
  type Address,
  type Hex,
  decodeFunctionData,
  encodeFunctionData,
  isAddress,
  parseUnits,
} from 'viem';
import { SwapQuote } from './swapRouter';

/**
 * Shell DEX router ABI – swap function that the on-chain router enforces.
 *
 * The router validates that the actual output >= amountOutMinimum and reverts
 * if it does not, making this the key slippage-protection hook.
 */
export const SHELL_DEX_ROUTER_ABI = [
  {
    name: 'swap',
    type: 'function',
    inputs: [
      { name: 'tokenIn',           type: 'address' },
      { name: 'tokenOut',          type: 'address' },
      { name: 'amountIn',          type: 'uint256' },
      { name: 'amountOutMinimum',  type: 'uint256' },
      { name: 'recipient',         type: 'address' },
      { name: 'deadline',          type: 'uint256' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
  },
] as const satisfies Abi;

export interface SwapTransactionParams {
  quote: SwapQuote;
  slippageTolerance: number; // 0–1 as a decimal (e.g. 0.005 = 0.5 %).  Converted to BPS internally.
  userAddress: Address;
  swapContract?: Address;
  inputTokenAddress: Address;
  outputTokenAddress: Address;
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
 * @param outputAmount The expected output amount (in token base units, as BigInt)
 * @param slippageBps  Slippage in basis points (1 = 0.01 %, 50 = 0.5 %, 5000 = 50 %).
 *                     Accepted range: 1–5000.
 * @returns Minimum acceptable output after slippage
 *
 * Formula: minOutput = outputAmount × (10000 − slippageBps) / 10000
 *
 * Previous implementation erroneously used (slippageTolerance × 100) as the
 * numerator instead of the correct basis-point value, producing protection that
 * was 100× weaker than intended (DEX-CRIT-1).
 */
export function calculateMinimumOutput(
  outputAmount: bigint,
  slippageBps: number
): bigint {
  if (!Number.isSafeInteger(slippageBps) || slippageBps < 1 || slippageBps > 5000) {
    throw new Error('slippageBps must be an integer between 1 and 5000 (0.01 %–50 %)');
  }

  const minimumOutput = (outputAmount * BigInt(10000 - slippageBps)) / 10000n;

  if (minimumOutput <= 0n) {
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
    inputTokenAddress,
    outputTokenAddress,
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

  // Convert decimal slippage tolerance to integer basis points (e.g. 0.005 → 50).
  // Clamp to the accepted range so rounding edge-cases don't produce out-of-range values.
  const rawBps = Math.round(slippageTolerance * 10000);
  const slippageBps = Math.min(Math.max(rawBps, 1), 5000);

  // Calculate minimum output with slippage
  const expectedInput = parseAmountToBaseUnits(inputAmount, inputTokenDecimals, 'Input');
  const expectedOutput = parseAmountToBaseUnits(quote.outputAmount, outputTokenDecimals, 'Quote output');
  const minOutput = calculateMinimumOutput(expectedOutput, slippageBps);
  const resolvedSwapContract = swapContract;

  if (quote.swapContract && resolvedSwapContract && quote.swapContract.toLowerCase() !== resolvedSwapContract.toLowerCase()) {
    throw new Error('Quote router does not match configured swap router');
  }

  if (!resolvedSwapContract) {
    throw new Error('Swap router address is not configured; cannot build transaction');
  }

  // Decode and validate untrusted quote calldata before the wallet signs it.
  const callData = encodeSlippageIntoCallData(quote.callData, minOutput.toString(), {
    tokenIn: inputTokenAddress,
    tokenOut: outputTokenAddress,
    amountIn: expectedInput,
    recipient: userAddress,
  });

  return {
    to: resolvedSwapContract,
    from: userAddress,
    data: callData as Hex,
    value: isNativeInput ? expectedInput : BigInt(0),
    estimatedGas: quote.estimatedGas ? BigInt(quote.estimatedGas) : undefined,
    minOutput,
    expectedOutput,
  };
}

/**
 * Encode minimum output into swap call data.
 *
 * Decodes the existing calldata using the Shell DEX router ABI, replaces the
 * `amountOutMinimum` parameter with `minOutput`, and re-encodes it with
 * `viem`'s `encodeFunctionData`.  This ensures the wallet signs – and the
 * router contract enforces – the slippage limit computed by
 * `calculateMinimumOutput`.
 *
 * @param originalCallData Hex calldata string from the routing quote
 * @param minOutput        Minimum acceptable output, as a decimal string (token base units)
 * @returns Updated calldata with `amountOutMinimum` set to `minOutput`
 */
export function encodeSlippageIntoCallData(
  originalCallData: string,
  minOutput: string,
  expected?: {
    tokenIn: Address;
    tokenOut: Address;
    amountIn: bigint;
    recipient: Address;
    nowSeconds?: number;
  }
): string {
  try {
    const decoded = decodeFunctionData({
      abi: SHELL_DEX_ROUTER_ABI,
      data: originalCallData as Hex,
    });

    if (decoded.functionName !== 'swap') {
      throw new Error('Quote calldata is not a Shell router swap call');
    }

    // args = [tokenIn, tokenOut, amountIn, amountOutMinimum, recipient, deadline]
    const [tokenIn, tokenOut, amountIn, , recipient, deadline] = decoded.args;
    if (expected) {
      assertAddressEqual(tokenIn, expected.tokenIn, 'tokenIn');
      assertAddressEqual(tokenOut, expected.tokenOut, 'tokenOut');
      assertAddressEqual(recipient, expected.recipient, 'recipient');
      if (amountIn !== expected.amountIn) {
        throw new Error('Quote calldata amountIn does not match requested input amount');
      }

      const now = BigInt(expected.nowSeconds ?? Math.floor(Date.now() / 1000));
      if (deadline <= now || deadline > now + 7n * 24n * 60n * 60n) {
        throw new Error('Quote calldata deadline is expired or too far in the future');
      }
    }

    return encodeFunctionData({
      abi: SHELL_DEX_ROUTER_ABI,
      functionName: 'swap',
      args: [tokenIn, tokenOut, amountIn, BigInt(minOutput), recipient, deadline],
    });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Quote calldata')) {
      throw err;
    }
    throw new Error('Quote calldata does not match the Shell router ABI');
  }
}

function assertAddressEqual(actual: Address, expected: Address, label: string): void {
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`Quote calldata ${label} does not match requested swap`);
  }
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
