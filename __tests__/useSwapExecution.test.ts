import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeFunctionData } from 'viem';
import { useSwapExecution, type SwapExecutionParams } from '../src/hooks/useSwapExecution';
import { SHELL_DEX_ROUTER_ABI } from '../src/lib/swapTransaction';

const wallet = vi.hoisted(() => ({
  address: '0x3333333333333333333333333333333333333333',
  sendTransaction: vi.fn(),
  readContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
}));

// Exercise the async execution callback with isolated wallet transport and state setters.
vi.mock('react', () => ({ useCallback: (callback: unknown) => callback, useState: () => [{}, vi.fn()] }));
vi.mock('wagmi', () => ({
  BaseError: class extends Error {},
  useAccount: () => ({ address: wallet.address }),
  useChainId: () => 42161,
  usePublicClient: () => wallet,
  useWalletClient: () => ({ data: wallet }),
}));

const tokenIn = '0x1111111111111111111111111111111111111111';
const tokenOut = '0x2222222222222222222222222222222222222222';
const router = '0x4444444444444444444444444444444444444444';

function params(recipient: `0x${string}`): SwapExecutionParams {
  return {
    quote: {
      inputAmount: '1', outputAmount: '2', swapContract: router,
      callData: encodeFunctionData({
        abi: SHELL_DEX_ROUTER_ABI, functionName: 'swap',
        args: [tokenIn, tokenOut, 1000000n, 0n, recipient, BigInt(Math.floor(Date.now() / 1000) + 3600)],
      }),
    } as SwapExecutionParams['quote'],
    swapContract: router,
    slippageTolerance: 0.005,
    tokenAddress: tokenIn,
    inputToken: { id: 'in', symbol: 'IN', name: 'Input', decimals: 6, addresses: { 42161: tokenIn } },
    outputToken: { id: 'out', symbol: 'OUT', name: 'Output', decimals: 6, addresses: { 42161: tokenOut } },
    onError: vi.fn(),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  wallet.readContract.mockResolvedValue(0n);
  wallet.sendTransaction.mockResolvedValue('0x01');
  wallet.waitForTransactionReceipt.mockResolvedValue({ status: 'success' });
});

describe('swap preflight', () => {
  it('rejects a recipient mismatch before allowance reads or wallet approval', async () => {
    const input = params(tokenOut);
    await useSwapExecution().executeSwap(input);
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
    expect(wallet.readContract).not.toHaveBeenCalled();
    expect(input.onError).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Quote calldata recipient does not match requested swap'),
    }));
  });

  it('rejects undecodable quotes before requesting token approval', async () => {
    const input = params(wallet.address as `0x${string}`);
    input.quote.callData = '0xdeadbeef';
    await useSwapExecution().executeSwap(input);
    expect(input.onError).toHaveBeenCalled();
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
    expect(wallet.readContract).not.toHaveBeenCalled();
  });

  it('continues to the existing approval flow for the connected recipient', async () => {
    const input = params(wallet.address as `0x${string}`);
    wallet.sendTransaction.mockRejectedValueOnce(new Error('Approval declined'));
    await useSwapExecution().executeSwap(input);
    expect(wallet.readContract).toHaveBeenCalledOnce();
    expect(wallet.sendTransaction).toHaveBeenCalledOnce();
    expect(wallet.sendTransaction).toHaveBeenCalledWith(expect.objectContaining({ to: tokenIn }));
    expect(input.onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Approval declined' }));
  });
});
