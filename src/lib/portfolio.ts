import type { SupportedChainId } from '@/config/chains';
import type { Token } from '@/config/tokens';

export type WalletBalanceSource = 'wallet-rpc' | 'simulated';

export interface WalletBalanceRead {
  token: Token;
  balance: number;
  source: WalletBalanceSource;
}

export interface WalletAssetBalance extends WalletBalanceRead {
  priceUsd: number;
  valueUsd: number;
  allocationPercent: number;
}

const MIN_DISPLAY_BALANCE = 0.000001;

function getAddressSeed(address: string, chainId: SupportedChainId): number {
  const normalized = address.toLowerCase().replace(/^0x/, '');
  const chunks = [0, 8, 16, 24, 32].map((offset) => normalized.slice(offset, offset + 8));

  return chunks.reduce<number>(
    (sum, chunk) => sum + parseInt(chunk || '0', 16),
    Number(chainId)
  );
}

export function buildFallbackWalletBalance(
  chainId: SupportedChainId,
  owner: string,
  token: Token
): number {
  const seed = getAddressSeed(owner, chainId) + token.id.length * 97;
  const weight = ((seed % 900) + 100) / 1000;

  switch (token.id) {
    case 'eth':
      return Number((0.08 + weight * 1.2).toFixed(4));
    case 'usdc':
    case 'usdt':
    case 'dai':
      return Number((200 + weight * 3_600).toFixed(2));
    case 'arb':
      return Number((60 + weight * 1_400).toFixed(2));
    case 'shell':
      return Number(
        (chainId === 10 ? 2_000 + weight * 18_000 : 500 + weight * 3_500).toFixed(2)
      );
    default:
      return 0;
  }
}

export function buildWalletAssetBalances(
  balances: WalletBalanceRead[],
  priceMap: Map<string, number>
): WalletAssetBalance[] {
  const assets = balances
    .map((balance) => {
      const priceUsd = priceMap.get(balance.token.id) ?? 0;
      const valueUsd = balance.balance * priceUsd;

      return {
        ...balance,
        priceUsd,
        valueUsd,
        allocationPercent: 0,
      };
    })
    .filter((balance) => balance.balance > MIN_DISPLAY_BALANCE || balance.valueUsd > 0.01)
    .sort((left, right) => right.valueUsd - left.valueUsd);

  const totalValueUsd = assets.reduce((sum, asset) => sum + asset.valueUsd, 0);

  return assets.map((asset) => ({
    ...asset,
    allocationPercent: totalValueUsd > 0 ? (asset.valueUsd / totalValueUsd) * 100 : 0,
  }));
}
