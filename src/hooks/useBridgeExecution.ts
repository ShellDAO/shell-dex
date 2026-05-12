'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { BaseError, useAccount, useChainId, useWalletClient } from 'wagmi';
import { type Address, keccak256, parseUnits, stringToHex } from 'viem';
import type { SupportedChainId } from '@/config/chains';
import { supportedChains } from '@/config/chains';
import type { TransactionReceiptData } from '@/components/ReceiptModal';
import type { Token } from '@/config/tokens';
import {
  buildBridgeTransactionActivity,
  getRecentTransactionActivities,
  recordTransactionActivity,
  subscribeTransactionActivity,
} from '@/lib/activityHistory';
import { type BridgeQuote } from '@/lib/bridgeRouter';
import { isNativeTokenAddress } from '@/lib/tokenApproval';

const MAX_SIMULATED_ALLOWANCE = BigInt(2) ** BigInt(255);
const SIMULATED_APPROVAL_DELAY_MS = 900;
const SIMULATED_RELAY_DELAY_MS = 1400;
const bridgeAllowances = new Map<string, bigint>();

export enum BridgeExecutionStage {
  IDLE = 'idle',
  CHECKING_ALLOWANCE = 'checking_allowance',
  AWAITING_APPROVAL = 'awaiting_approval',
  APPROVAL_PENDING = 'approval_pending',
  APPROVAL_CONFIRMED = 'approval_confirmed',
  AWAITING_SIGNATURE = 'awaiting_signature',
  SOURCE_PENDING = 'source_pending',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  SUCCESS = 'success',
  ERROR = 'error',
}

export interface BridgeExecutionState {
  stage: BridgeExecutionStage;
  isLoading: boolean;
  approvalTxHash?: string;
  bridgeTxHash?: string;
  destinationTxHash?: string;
  receipt?: TransactionReceiptData;
  error?: string;
}

export interface BridgeExecutionParams {
  quote: BridgeQuote;
  token: Token;
  onSuccess?: (receipt: TransactionReceiptData) => void;
  onError?: (error: Error) => void;
}

const INITIAL_STATE: BridgeExecutionState = {
  stage: BridgeExecutionStage.IDLE,
  isLoading: false,
};

export function useBridgeExecution() {
  const { address: userAddress } = useAccount();
  const chainId = useChainId() as SupportedChainId | undefined;
  const { data: walletClient } = useWalletClient({ chainId });
  const [state, setState] = useState<BridgeExecutionState>(INITIAL_STATE);

  const executeBridge = useCallback(
    async ({ quote, token, onSuccess, onError }: BridgeExecutionParams) => {
      if (!userAddress || !chainId || !walletClient) {
        const error = new Error('Wallet connection is not ready. Reconnect and try again.');
        setState({ ...INITIAL_STATE, stage: BridgeExecutionStage.ERROR, error: error.message });
        onError?.(error);
        return;
      }

      if (chainId !== quote.sourceChain) {
        const error = new Error(`Switch to ${supportedChains[quote.sourceChain]?.name} to execute this bridge.`);
        setState({ ...INITIAL_STATE, stage: BridgeExecutionStage.ERROR, error: error.message });
        onError?.(error);
        return;
      }

      if (Date.now() >= quote.expiresAt) {
        const error = new Error('Bridge quote expired. Refresh before submitting.');
        setState({ ...INITIAL_STATE, stage: BridgeExecutionStage.ERROR, error: error.message });
        onError?.(error);
        return;
      }

      try {
        let approvalTxHash: string | undefined;

        setState({
          ...INITIAL_STATE,
          stage: BridgeExecutionStage.CHECKING_ALLOWANCE,
          isLoading: true,
        });

        const requiredAmount = parseUnits(quote.inputAmount, token.decimals);
        const tokenAddress = quote.sourceTokenAddress as Address;

        if (isApprovalNeeded({
          chainId: quote.sourceChain,
          owner: userAddress,
          tokenAddress,
          spenderAddress: quote.approvalSpender,
          requiredAmount,
        })) {
          setState((prev) => ({ ...prev, stage: BridgeExecutionStage.AWAITING_APPROVAL }));

          const approvalSignature = await walletClient.signMessage({
            account: userAddress,
            message: `Approve ${quote.inputAmount} ${token.symbol} for bridge routing on ${supportedChains[quote.sourceChain]?.name}`,
          });
          approvalTxHash = keccak256(stringToHex(approvalSignature));

          setState((prev) => ({
            ...prev,
            stage: BridgeExecutionStage.APPROVAL_PENDING,
            approvalTxHash,
          }));

          await waitForSimulation(SIMULATED_APPROVAL_DELAY_MS);
          grantBridgeAllowance({
            chainId: quote.sourceChain,
            owner: userAddress,
            tokenAddress,
            spenderAddress: quote.approvalSpender,
            amount: MAX_SIMULATED_ALLOWANCE,
          });
        }

        setState((prev) => ({
          ...prev,
          stage: BridgeExecutionStage.APPROVAL_CONFIRMED,
        }));

        setState((prev) => ({
          ...prev,
          stage: BridgeExecutionStage.AWAITING_SIGNATURE,
        }));

        const bridgeSignature = await walletClient.signMessage({
          account: userAddress,
          message: `Bridge ${quote.inputAmount} ${token.symbol} from ${supportedChains[quote.sourceChain]?.name} to ${supportedChains[quote.destinationChain]?.name} via ${quote.bridgeProtocol}`,
        });
        const bridgeTxHash = keccak256(stringToHex(`${bridgeSignature}:${quote.quoteId}`));
        const destinationTxHash = keccak256(
          stringToHex(`${bridgeTxHash}:${quote.destinationChain}:${quote.token.id}`)
        );

        setState((prev) => ({
          ...prev,
          stage: BridgeExecutionStage.SOURCE_PENDING,
          bridgeTxHash,
        }));

        await waitForSimulation(SIMULATED_APPROVAL_DELAY_MS);

        setState((prev) => ({
          ...prev,
          stage: BridgeExecutionStage.IN_TRANSIT,
          bridgeTxHash,
        }));

        await waitForSimulation(SIMULATED_RELAY_DELAY_MS);

        setState((prev) => ({
          ...prev,
          stage: BridgeExecutionStage.DELIVERED,
          bridgeTxHash,
          destinationTxHash,
        }));

        const receipt = buildBridgeReceipt({
          quote,
          sourceTxHash: bridgeTxHash,
          destinationTxHash,
        });

        recordTransactionActivity(
          buildBridgeTransactionActivity({
            chainId: quote.sourceChain,
            owner: userAddress,
            receipt,
            sourceChainName: supportedChains[quote.sourceChain]?.name ?? 'Source',
            destinationChainName: supportedChains[quote.destinationChain]?.name ?? 'Destination',
            token,
            inputAmount: quote.inputAmount,
            outputAmount: quote.estimatedOutputAmount,
          })
        );

        setState({
          stage: BridgeExecutionStage.SUCCESS,
          isLoading: false,
          approvalTxHash,
          bridgeTxHash,
          destinationTxHash,
          receipt,
        });

        onSuccess?.(receipt);
      } catch (error) {
        const normalizedError = normalizeBridgeError(error);
        setState((prev) => ({
          ...prev,
          stage: BridgeExecutionStage.ERROR,
          isLoading: false,
          error: normalizedError.message,
        }));
        onError?.(normalizedError);
      }
    },
    [chainId, userAddress, walletClient]
  );

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const retry = useCallback(() => {
    if (state.stage === BridgeExecutionStage.ERROR) {
      reset();
    }
  }, [reset, state.stage]);

  return {
    state,
    executeBridge,
    reset,
    retry,
  };
}

export function useBridgeActivityFeed(owner?: string, chainId?: SupportedChainId) {
  return useSyncExternalStore(
    subscribeTransactionActivity,
    () =>
      owner
        ? getRecentTransactionActivities(chainId, owner).filter(
            (activity) => activity.kind === 'bridge'
          )
        : [],
    () => []
  );
}

export function getBridgeStageMessage(stage: BridgeExecutionStage): string {
  const messages: Record<BridgeExecutionStage, string> = {
    [BridgeExecutionStage.IDLE]: 'Ready to bridge',
    [BridgeExecutionStage.CHECKING_ALLOWANCE]: 'Checking token approval...',
    [BridgeExecutionStage.AWAITING_APPROVAL]: 'Confirm the bridge approval in your wallet...',
    [BridgeExecutionStage.APPROVAL_PENDING]: 'Approval submitted. Waiting for confirmation...',
    [BridgeExecutionStage.APPROVAL_CONFIRMED]: 'Approval ready',
    [BridgeExecutionStage.AWAITING_SIGNATURE]: 'Confirm the bridge in your wallet...',
    [BridgeExecutionStage.SOURCE_PENDING]: 'Source transaction submitted. Waiting for confirmation...',
    [BridgeExecutionStage.IN_TRANSIT]: 'Funds are in transit across the bridge...',
    [BridgeExecutionStage.DELIVERED]: 'Destination delivery confirmed',
    [BridgeExecutionStage.SUCCESS]: 'Bridge completed!',
    [BridgeExecutionStage.ERROR]: 'Bridge failed',
  };

  return messages[stage];
}

function buildBridgeReceipt({
  quote,
  sourceTxHash,
  destinationTxHash,
}: {
  quote: BridgeQuote;
  sourceTxHash: string;
  destinationTxHash: string;
}): TransactionReceiptData {
  return {
    transactionHash: sourceTxHash,
    status: 'success',
    title: 'Bridge Complete',
    summary: `${supportedChains[quote.sourceChain]?.name} → ${supportedChains[quote.destinationChain]?.name}`,
    items: [
      {
        label: 'Sent',
        value: `${quote.inputAmount} ${quote.token.symbol}`,
      },
      {
        label: 'Expected received',
        value: `${quote.estimatedOutputAmount} ${quote.token.symbol}`,
        tone: 'success',
      },
      {
        label: 'Bridge fee',
        value: `${quote.bridgeFee.amount} ${quote.token.symbol}`,
      },
      {
        label: 'Destination tx',
        value: `${destinationTxHash.slice(0, 10)}...`,
      },
    ],
    confirmations: 1,
    blockTime: Math.floor(Date.now() / 1000),
    chainId: quote.sourceChain,
    isSimulated: true,
  };
}

function isApprovalNeeded({
  chainId,
  owner,
  tokenAddress,
  spenderAddress,
  requiredAmount,
}: {
  chainId: SupportedChainId;
  owner: string;
  tokenAddress: Address;
  spenderAddress: Address;
  requiredAmount: bigint;
}) {
  if (isNativeTokenAddress(tokenAddress)) {
    return false;
  }

  const currentAllowance = bridgeAllowances.get(
    getAllowanceKey(chainId, owner, tokenAddress, spenderAddress)
  ) ?? BigInt(0);

  return currentAllowance < requiredAmount;
}

function grantBridgeAllowance({
  chainId,
  owner,
  tokenAddress,
  spenderAddress,
  amount,
}: {
  chainId: SupportedChainId;
  owner: string;
  tokenAddress: Address;
  spenderAddress: Address;
  amount: bigint;
}) {
  if (isNativeTokenAddress(tokenAddress)) {
    return;
  }

  bridgeAllowances.set(getAllowanceKey(chainId, owner, tokenAddress, spenderAddress), amount);
}

function getAllowanceKey(
  chainId: SupportedChainId,
  owner: string,
  tokenAddress: Address,
  spenderAddress: Address
) {
  return `${chainId}:${owner.toLowerCase()}:${tokenAddress.toLowerCase()}:${spenderAddress.toLowerCase()}`;
}

function waitForSimulation(delay: number) {
  return new Promise((resolve) => window.setTimeout(resolve, delay));
}

function normalizeBridgeError(error: unknown): Error {
  const message =
    error instanceof BaseError
      ? error.shortMessage
      : error instanceof Error
        ? error.message
        : 'Unknown bridge error';

  return new Error(message);
}
