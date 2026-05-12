import type { TransactionReceiptData } from '@/components/ReceiptModal';
import type { SupportedChainId } from '@/config/chains';
import type { LiquidityActivity } from '@/lib/liquidityRead';
import type { Token } from '@/config/tokens';

export type TransactionActivityKind = 'swap' | 'bridge' | 'add-liquidity' | 'remove-liquidity';
export type TransactionActivityStatus = 'success' | 'failed';
export type TransactionActivityTokenDirection = 'in' | 'out';

export interface TransactionActivityTokenChange {
  symbol: string;
  amount: string;
  direction: TransactionActivityTokenDirection;
}

export interface TransactionActivityRecord {
  id: string;
  kind: TransactionActivityKind;
  status: TransactionActivityStatus;
  chainId: SupportedChainId;
  owner: string;
  txHash: string;
  title: string;
  summary: string;
  timestamp: number;
  valueUsd?: number;
  receipt?: TransactionReceiptData;
  tokenChanges: TransactionActivityTokenChange[];
}

const MAX_TRANSACTION_ACTIVITY_ITEMS = 40;
const TRANSACTION_ACTIVITY_STORAGE_KEY = 'shell-dex:transaction-activity:v1';

const transactionActivityListeners = new Set<() => void>();
let activityStore: TransactionActivityRecord[] = [];
let didHydrateStore = false;

function hydrateActivityStore() {
  if (didHydrateStore || typeof window === 'undefined') {
    return;
  }

  didHydrateStore = true;

  try {
    const serialized = window.localStorage.getItem(TRANSACTION_ACTIVITY_STORAGE_KEY);
    if (!serialized) {
      return;
    }

    const parsed = JSON.parse(serialized);
    if (Array.isArray(parsed)) {
      activityStore = parsed as TransactionActivityRecord[];
    }
  } catch (error) {
    console.error('Failed to hydrate transaction activity store:', error);
  }
}

function persistActivityStore() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      TRANSACTION_ACTIVITY_STORAGE_KEY,
      JSON.stringify(activityStore)
    );
  } catch (error) {
    console.error('Failed to persist transaction activity store:', error);
  }
}

function notifyTransactionActivityListeners() {
  transactionActivityListeners.forEach((listener) => listener());
}

function formatAmount(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: value < 1 ? 2 : 0,
    maximumFractionDigits: 4,
  });
}

export function subscribeTransactionActivity(listener: () => void): () => void {
  hydrateActivityStore();
  transactionActivityListeners.add(listener);

  return () => {
    transactionActivityListeners.delete(listener);
  };
}

export function getRecentTransactionActivities(
  chainId?: SupportedChainId,
  owner?: string
): TransactionActivityRecord[] {
  hydrateActivityStore();

  return activityStore.filter((activity) => {
    const matchesChain = !chainId || activity.chainId === chainId;
    const matchesOwner = !owner || activity.owner.toLowerCase() === owner.toLowerCase();
    return matchesChain && matchesOwner;
  });
}

export function recordTransactionActivity(activity: TransactionActivityRecord) {
  hydrateActivityStore();

  activityStore = [
    activity,
    ...activityStore.filter(
      (existing) =>
        existing.id !== activity.id &&
        !(
          existing.txHash === activity.txHash &&
          existing.owner.toLowerCase() === activity.owner.toLowerCase() &&
          existing.kind === activity.kind
        )
    ),
  ].slice(0, MAX_TRANSACTION_ACTIVITY_ITEMS);

  persistActivityStore();
  notifyTransactionActivityListeners();
}

export function buildLiquidityTransactionActivity(
  activity: LiquidityActivity,
  receipt?: TransactionReceiptData
): TransactionActivityRecord {
  const isAdd = activity.mode === 'add';

  return {
    id: activity.id,
    kind: isAdd ? 'add-liquidity' : 'remove-liquidity',
    status: 'success',
    chainId: activity.chainId,
    owner: activity.owner,
    txHash: activity.txHash,
    title: isAdd ? 'Added liquidity' : 'Removed liquidity',
    summary: `${activity.pairLabel} • ${activity.sharePercentDelta.toFixed(3)}% share delta`,
    timestamp: activity.timestamp,
    valueUsd: activity.valueUsdDelta,
    receipt,
    tokenChanges: [
      {
        symbol: activity.token0.symbol,
        amount: formatAmount(activity.token0Amount),
        direction: isAdd ? 'out' : 'in',
      },
      {
        symbol: activity.token1.symbol,
        amount: formatAmount(activity.token1Amount),
        direction: isAdd ? 'out' : 'in',
      },
    ],
  };
}

export function buildSwapTransactionActivity({
  chainId,
  owner,
  receipt,
  inputToken,
  outputToken,
  inputAmount,
  outputAmount,
}: {
  chainId: SupportedChainId;
  owner: string;
  receipt: TransactionReceiptData;
  inputToken: Token;
  outputToken: Token;
  inputAmount: string;
  outputAmount: string;
}): TransactionActivityRecord {
  const timestamp = receipt.blockTime ? receipt.blockTime * 1000 : Date.now();

  return {
    id: `${owner.toLowerCase()}-${receipt.transactionHash}`,
    kind: 'swap',
    status: receipt.status,
    chainId,
    owner,
    txHash: receipt.transactionHash,
    title: receipt.status === 'success' ? 'Swap executed' : 'Swap failed',
    summary: `${inputToken.symbol} → ${outputToken.symbol}`,
    timestamp,
    receipt,
    tokenChanges: [
      {
        symbol: inputToken.symbol,
        amount: inputAmount,
        direction: 'out',
      },
      {
        symbol: outputToken.symbol,
        amount: outputAmount,
        direction: 'in',
      },
    ],
  };
}

export function buildBridgeTransactionActivity({
  chainId,
  owner,
  receipt,
  sourceChainName,
  destinationChainName,
  token,
  inputAmount,
  outputAmount,
}: {
  chainId: SupportedChainId;
  owner: string;
  receipt: TransactionReceiptData;
  sourceChainName: string;
  destinationChainName: string;
  token: Token;
  inputAmount: string;
  outputAmount: string;
}): TransactionActivityRecord {
  const timestamp = receipt.blockTime ? receipt.blockTime * 1000 : Date.now();

  return {
    id: `${owner.toLowerCase()}-${receipt.transactionHash}-bridge`,
    kind: 'bridge',
    status: receipt.status,
    chainId,
    owner,
    txHash: receipt.transactionHash,
    title: receipt.status === 'success' ? 'Bridge delivered' : 'Bridge failed',
    summary: `${sourceChainName} → ${destinationChainName}`,
    timestamp,
    receipt,
    tokenChanges: [
      {
        symbol: token.symbol,
        amount: inputAmount,
        direction: 'out',
      },
      {
        symbol: token.symbol,
        amount: outputAmount,
        direction: 'in',
      },
    ],
  };
}
