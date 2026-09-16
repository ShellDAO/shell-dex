import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeFunctionData, encodeFunctionData, isAddress, type Address } from 'viem';
import { getToken } from '../src/config/tokens';
import { configureRouter, getQuote } from '../src/lib/swapRouter';
import { buildSwapTransaction, SHELL_DEX_ROUTER_ABI } from '../src/lib/swapTransaction';
import { buildApprovalTransaction } from '../src/lib/tokenApproval';

const input = getToken('usdc')!;
const output = getToken('usdt')!;
const chainId = 42161;
const recipient = '0x3333333333333333333333333333333333333333';
const router = '0x4444444444444444444444444444444444444444';

function route(inputAmount = '1') {
  return {
    path: ['usdc', 'usdt'], inputAmount, outputAmount: '2', swapContract: router,
    callData: encodeFunctionData({
      abi: SHELL_DEX_ROUTER_ABI, functionName: 'swap',
      args: [input.addresses[chainId]!.toLowerCase() as Address, output.addresses[chainId]!.toLowerCase() as Address,
        1000000n, 0n, recipient, BigInt(Math.floor(Date.now() / 1000) + 3600)],
    }),
  };
}

beforeEach(() => {
  configureRouter({ routerApiUrl: 'https://router.example', useFixtures: false });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('API quote trade amounts', () => {
  it('uses the Arbitrum USDC.e contract for quotes, swaps and approvals', async () => {
    // Arbitrum Foundation: https://blog.arbitrum.foundation/usdc-to-come-natively-to-arbitrum/
    const usdce = '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ routes: [route()] }) });
    vi.stubGlobal('fetch', fetchMock);

    const quote = await getQuote(input, output, '1', chainId, { tradeType: 'exactIn' });
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.inputToken.toLowerCase()).toBe(usdce);
    expect(isAddress(input.addresses[chainId]!)).toBe(true);

    const tx = buildSwapTransaction({
      quote, slippageTolerance: 0.005, userAddress: recipient, swapContract: router,
      inputTokenAddress: input.addresses[chainId] as Address,
      outputTokenAddress: output.addresses[chainId] as Address,
      inputAmount: quote.inputAmount, inputTokenDecimals: input.decimals,
      outputTokenDecimals: output.decimals, isNativeInput: false,
    });
    expect(decodeFunctionData({ abi: SHELL_DEX_ROUTER_ABI, data: tx.data }).args[0].toLowerCase()).toBe(usdce);
    expect(buildApprovalTransaction(input.addresses[chainId] as Address, router, 'exact', 1000000n)
      .to.toLowerCase()).toBe(usdce);
  });

  it('preserves the required input for an exact-output quote through transaction construction', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ routes: [route()] }) });
    vi.stubGlobal('fetch', fetchMock);
    const quote = await getQuote(input, output, '2', chainId, { tradeType: 'exactOut' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ outputAmount: '2', tradeType: 'exactOut' });
    expect(quote.inputAmount).toBe('1');
    expect(quote.outputAmount).toBe('2');
    const tx = buildSwapTransaction({
      quote, slippageTolerance: 0.005, userAddress: recipient, swapContract: router,
      inputTokenAddress: input.addresses[chainId]!.toLowerCase() as Address,
      outputTokenAddress: output.addresses[chainId]!.toLowerCase() as Address,
      inputAmount: quote.inputAmount, inputTokenDecimals: input.decimals,
      outputTokenDecimals: output.decimals, isNativeInput: false,
    });
    expect(decodeFunctionData({ abi: SHELL_DEX_ROUTER_ABI, data: tx.data }).args[2]).toBe(1000000n);
  });

  it('keeps the requested exact-input amount despite an API input override', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ routes: [route('9')] }) }));
    const quote = await getQuote(input, output, '1', chainId, { tradeType: 'exactIn' });
    expect(quote.inputAmount).toBe('1');
    expect(quote.outputAmount).toBe('2');
  });
  it('uses the envelope input amount when an exact-output route omits it', async () => {
    const { inputAmount: _, ...candidate } = route();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true,
      json: async () => ({ inputAmount: '1', routes: [candidate] }),
    }));
    const quote = await getQuote(input, output, '2', chainId, { tradeType: 'exactOut' });
    expect(quote.inputAmount).toBe('1');
  });

  it.each([undefined, '', '0', '-1', 'not-an-amount', '1e3', '1.0000001'])('rejects an unusable exact-output input amount: %s', async value => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true,
      json: async () => ({ routes: [{ ...route(), inputAmount: value }] }),
    }));
    await expect(getQuote(input, output, '2', chainId, { tradeType: 'exactOut' }))
      .rejects.toThrow();
  });

});
