'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BaseError, useAccount, useChainId, useWalletClient } from 'wagmi';
import { type Address, keccak256, parseUnits, stringToHex } from 'viem';
import type { SupportedChainId } from '@/config/chains';
import type { TransactionReceiptData } from '@/components/ReceiptModal';
import type { Token } from '@/config/tokens';
import {
  buildLiquidityTransactionActivity,
  recordTransactionActivity,
} from '@/lib/activityHistory';
import {
  applySimulatedLiquidityMutation,
  checkSimulatedLiquidityAllowance,
  getRecentLiquidityActivities,
  grantSimulatedLiquidityAllowance,
  subscribeLiquidityActivity,
  type LiquidityActivity,
  type LiquidityPoolDetail,
  type LiquidityPosition,
} from '@/lib/liquidityRead';
import { isNativeTokenAddress } from '@/lib/tokenApproval';

const SIMULATED_SPENDER_ADDRESS =
  (process.env.NEXT_PUBLIC_SHELL_DEX_LIQUIDITY_MANAGER_ADDRESS ||
    '0x0000000000000000000000000000000000000d1a') as Address;
const MAX_APPROVAL_ALLOWANCE = BigInt(2) ** BigInt(255);
const SIMULATED_CONFIRMATION_DELAY_MS = 900;

export enum LiquidityWriteStage {
  IDLE = 'idle',
  CHECKING_ALLOWANCE = 'checking_allowance',
  AWAITING_APPROVAL = 'awaiting_approval',
  APPROVAL_PENDING = 'approval_pending',
  APPROVAL_CONFIRMED = 'approval_confirmed',
  AWAITING_SIGNATURE = 'awaiting_signature',
  TX_PENDING = 'tx_pending',
  SUCCESS = 'success',
  ERROR = 'error',
}

export interface LiquidityWriteState {
  stage: LiquidityWriteStage;
  isLoading: boolean;
  approvalTxHash?: string;
  liquidityTxHash?: string;
  receipt?: TransactionReceiptData;
  error?: string;
}

interface BaseExecutionParams {
  pool: LiquidityPoolDetail;
  onSuccess?: (receipt: TransactionReceiptData) => void;
  onError?: (error: Error) => void;
}

export interface AddLiquidityExecutionParams extends BaseExecutionParams {
  mode: 'add';
  token0Amount: string;
  token1Amount: string;
}

export interface RemoveLiquidityExecutionParams extends BaseExecutionParams {
  mode: 'remove';
  position: LiquidityPosition;
  removeFraction: number;
}

export type LiquidityExecutionParams =
  | AddLiquidityExecutionParams
  | RemoveLiquidityExecutionParams;

const INITIAL_STATE: LiquidityWriteState = {
  stage: LiquidityWriteStage.IDLE,
  isLoading: false,
};

export function useLiquidityExecution() {
  const queryClient = useQueryClient();
  const { address: userAddress } = useAccount();
  const chainId = useChainId() as SupportedChainId | undefined;
  const { data: walletClient } = useWalletClient({ chainId });
  const [state, setState] = useState<LiquidityWriteState>(INITIAL_STATE);

  const execute = useCallback(
    async (params: LiquidityExecutionParams) => {
      if (!userAddress || !chainId || !walletClient) {
        const error = new Error('Wallet connection is not ready. Reconnect and try again.');
        setState({
          ...INITIAL_STATE,
          stage: LiquidityWriteStage.ERROR,
          error: error.message,
        });
        params.onError?.(error);
        return;
      }

      try {
        setState({
          ...INITIAL_STATE,
          stage: LiquidityWriteStage.CHECKING_ALLOWANCE,
          isLoading: true,
        });

        if (params.mode === 'add') {
          const approvalTokens = getApprovalRequests({
            pool: params.pool,
            chainId,
            owner: userAddress,
            token0Amount: params.token0Amount,
            token1Amount: params.token1Amount,
          });

          const firstPendingApproval = approvalTokens.find((approval) => approval.isApprovalNeeded);

          if (firstPendingApproval) {
            setState((prev) => ({
              ...prev,
              stage: LiquidityWriteStage.AWAITING_APPROVAL,
            }));
          } else {
            setState((prev) => ({
              ...prev,
              stage: LiquidityWriteStage.APPROVAL_CONFIRMED,
            }));
          }

          for (const approval of approvalTokens) {
            if (!approval.isApprovalNeeded) {
              continue;
            }

            const signature = await walletClient.signMessage({
              account: userAddress,
              message: buildApprovalMessage(approval.token, approval.amount, params.pool),
            });
            const approvalTxHash = keccak256(signature);

            setState((prev) => ({
              ...prev,
              stage: LiquidityWriteStage.APPROVAL_PENDING,
              approvalTxHash,
            }));

            await waitForSimulation();
            grantSimulatedLiquidityAllowance({
              chainId,
              owner: userAddress,
              tokenAddress: approval.tokenAddress,
              spenderAddress: SIMULATED_SPENDER_ADDRESS,
              amount: MAX_APPROVAL_ALLOWANCE,
            });
          }

          setState((prev) => ({
            ...prev,
            stage: LiquidityWriteStage.APPROVAL_CONFIRMED,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            stage: LiquidityWriteStage.APPROVAL_CONFIRMED,
          }));
        }

        setState((prev) => ({
          ...prev,
          stage: LiquidityWriteStage.AWAITING_SIGNATURE,
        }));

        const executionMessage =
          params.mode === 'add'
            ? `Add liquidity to ${params.pool.pairLabel}: ${params.token0Amount} ${params.pool.token0.symbol} + ${params.token1Amount} ${params.pool.token1.symbol}`
            : `Remove ${(params.removeFraction * 100).toFixed(2)}% of ${params.pool.pairLabel} liquidity`;
        const executionSignature = await walletClient.signMessage({
          account: userAddress,
          message: executionMessage,
        });
        const liquidityTxHash = keccak256(
          stringToHex(`${executionSignature}:${params.pool.id}:${Date.now()}`)
        );

        setState((prev) => ({
          ...prev,
          stage: LiquidityWriteStage.TX_PENDING,
          liquidityTxHash,
        }));

        await waitForSimulation();

        const token0Amount =
          params.mode === 'add'
            ? parseAmount(params.token0Amount, params.pool.token0.symbol)
            : params.position.deposited0 * params.removeFraction;
        const token1Amount =
          params.mode === 'add'
            ? parseAmount(params.token1Amount, params.pool.token1.symbol)
            : params.position.deposited1 * params.removeFraction;

        const { activity } = await applySimulatedLiquidityMutation({
          chainId,
          owner: userAddress,
          poolId: params.pool.id,
          mode: params.mode,
          token0Amount,
          token1Amount,
          txHash: liquidityTxHash,
        });

        await queryClient.invalidateQueries({
          queryKey: ['liquidity-read'],
        });

        const receipt = buildLiquidityReceipt({
          activity,
          chainId,
          pool: params.pool,
        });
        recordTransactionActivity(buildLiquidityTransactionActivity(activity, receipt));

        setState((prev) => ({
          ...prev,
          stage: LiquidityWriteStage.SUCCESS,
          isLoading: false,
          liquidityTxHash,
          receipt,
        }));

        params.onSuccess?.(receipt);
      } catch (error) {
        const normalizedError = normalizeLiquidityWriteError(error);
        setState((prev) => ({
          ...prev,
          stage: LiquidityWriteStage.ERROR,
          isLoading: false,
          error: normalizedError.message,
        }));
        params.onError?.(normalizedError);
      }
    },
    [chainId, queryClient, userAddress, walletClient]
  );

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const retry = useCallback(() => {
    if (state.stage === LiquidityWriteStage.ERROR) {
      reset();
    }
  }, [reset, state.stage]);

  return {
    state,
    execute,
    reset,
    retry,
  };
}

export function useLiquidityActivityFeed(chainId?: SupportedChainId, owner?: string) {
  return useSyncExternalStore(
    subscribeLiquidityActivity,
    () => getRecentLiquidityActivities(chainId, owner),
    () => []
  );
}

export function getLiquidityWriteStageMessage(stage: LiquidityWriteStage): string {
  const messages: Record<LiquidityWriteStage, string> = {
    [LiquidityWriteStage.IDLE]: 'Ready to manage liquidity',
    [LiquidityWriteStage.CHECKING_ALLOWANCE]: 'Checking token approvals...',
    [LiquidityWriteStage.AWAITING_APPROVAL]: 'Confirm approvals in your wallet...',
    [LiquidityWriteStage.APPROVAL_PENDING]: 'Approval submitted. Waiting for confirmation...',
    [LiquidityWriteStage.APPROVAL_CONFIRMED]: 'Approvals ready',
    [LiquidityWriteStage.AWAITING_SIGNATURE]: 'Confirm the liquidity action in your wallet...',
    [LiquidityWriteStage.TX_PENDING]: 'Liquidity action submitted. Waiting for confirmation...',
    [LiquidityWriteStage.SUCCESS]: 'Liquidity updated',
    [LiquidityWriteStage.ERROR]: 'Liquidity action failed',
  };

  return messages[stage];
}

function getApprovalRequests({
  pool,
  chainId,
  owner,
  token0Amount,
  token1Amount,
}: {
  pool: LiquidityPoolDetail;
  chainId: SupportedChainId;
  owner: string;
  token0Amount: string;
  token1Amount: string;
}) {
  return [
    {
      token: pool.token0,
      tokenAddress: pool.token0.addresses[chainId] as Address,
      amount: token0Amount,
    },
    {
      token: pool.token1,
      tokenAddress: pool.token1.addresses[chainId] as Address,
      amount: token1Amount,
    },
  ].map((entry) => {
    if (isNativeTokenAddress(entry.tokenAddress)) {
      return {
        ...entry,
        isApprovalNeeded: false,
      };
    }

    const amount = toBaseUnits(entry.amount, entry.token.decimals, entry.token.symbol);
    const allowance = checkSimulatedLiquidityAllowance({
      chainId,
      owner,
      tokenAddress: entry.tokenAddress,
      spenderAddress: SIMULATED_SPENDER_ADDRESS,
      requiredAmount: amount,
    });

    return {
      ...entry,
      isApprovalNeeded: allowance.isApprovalNeeded,
    };
  });
}

function buildApprovalMessage(token: Token, amount: string, pool: LiquidityPoolDetail): string {
  return `Approve ${amount} ${token.symbol} for ${pool.pairLabel} liquidity management`;
}

function buildLiquidityReceipt({
  activity,
  chainId,
  pool,
}: {
  activity: LiquidityActivity;
  chainId: SupportedChainId;
  pool: LiquidityPoolDetail;
}): TransactionReceiptData {
  const actionLabel = activity.mode === 'add' ? 'Liquidity Added' : 'Liquidity Removed';
  const shareLabel =
    activity.mode === 'add' ? 'Pool share gained' : 'Pool share removed';

  return {
    transactionHash: activity.txHash,
    status: 'success',
    title: actionLabel,
    summary: `${pool.pairLabel} • ${pool.feeTierLabel}`,
    items: [
      {
        label: activity.mode === 'add' ? `Supplied ${activity.token0.symbol}` : `Received ${activity.token0.symbol}`,
        value: `${formatTokenAmount(activity.token0Amount)} ${activity.token0.symbol}`,
      },
      {
        label: activity.mode === 'add' ? `Supplied ${activity.token1.symbol}` : `Received ${activity.token1.symbol}`,
        value: `${formatTokenAmount(activity.token1Amount)} ${activity.token1.symbol}`,
      },
      {
        label: shareLabel,
        value: `${activity.sharePercentDelta.toFixed(3)}%`,
        tone: 'success',
      },
    ],
    confirmations: 1,
    blockTime: Math.floor(activity.timestamp / 1000),
    chainId,
    isSimulated: true,
  };
}

function normalizeLiquidityWriteError(error: unknown): Error {
  const message =
    error instanceof BaseError
      ? error.shortMessage
      : error instanceof Error
        ? error.message
        : 'Unknown liquidity error';

  return new Error(message);
}

function toBaseUnits(amount: string, decimals: number, symbol: string): bigint {
  if (!amount || Number(amount) <= 0) {
    return BigInt(0);
  }

  try {
    return parseUnits(amount, decimals);
  } catch {
    throw new Error(`Invalid ${symbol} amount.`);
  }
}

function parseAmount(value: string, symbol: string): number {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid ${symbol} amount.`);
  }

  return amount;
}

function formatTokenAmount(value: number): string {
  if (value >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: value < 1 ? 2 : 0,
    maximumFractionDigits: 4,
  });
}

function waitForSimulation() {
  return new Promise((resolve) => setTimeout(resolve, SIMULATED_CONFIRMATION_DELAY_MS));
}
