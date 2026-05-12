'use client';

import { useSyncExternalStore } from 'react';
import type { SupportedChainId } from '@/config/chains';
import {
  getRecentTransactionActivities,
  subscribeTransactionActivity,
  type TransactionActivityRecord,
} from '@/lib/activityHistory';

export function useTransactionActivityFeed(
  chainId?: SupportedChainId,
  owner?: string
): TransactionActivityRecord[] {
  return useSyncExternalStore(
    subscribeTransactionActivity,
    () => (owner ? getRecentTransactionActivities(chainId, owner) : []),
    () => []
  );
}
