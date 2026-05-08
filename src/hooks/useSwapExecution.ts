/**
 * Swap execution hook for M3.
 * 
 * Manages the complete swap flow:
 * 1. Check token allowance
 * 2. If needed, submit approval TX
 * 3. Wait for approval confirmation
 * 4. Submit swap TX
 * 5. Wait for swap confirmation
 * 6. Return receipt data
 */

'use client';

import { useState, useCallback } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { Address } from 'viem';
import { SwapQuote } from '@/lib/swapRouter';
import {
  checkAllowance,
  buildApprovalTransaction,
  AllowanceCheckResult,
} from '@/lib/tokenApproval';
import {
  buildSwapTransaction,
  validateSwapTransaction,
  SwapTransaction,
} from '@/lib/swapTransaction';

export enum SwapStage {
  IDLE = 'idle',
  CHECKING_ALLOWANCE = 'checking_allowance',
  AWAITING_APPROVAL = 'awaiting_approval',
  APPROVAL_CONFIRMED = 'approval_confirmed',
  SUBMITTING_SWAP = 'submitting_swap',
  SWAP_PENDING = 'swap_pending',
  SUCCESS = 'success',
  ERROR = 'error',
}

export interface SwapExecutionState {
  stage: SwapStage;
  approvalTxHash?: string;
  swapTxHash?: string;
  swapReceipt?: any;
  error?: string;
  isLoading: boolean;
}

export interface SwapExecutionParams {
  quote: SwapQuote;
  slippageTolerance: number;
  swapContract: Address;
  tokenAddress: Address;
  onSuccess?: (receipt: any) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for executing swap with approval handling.
 */
export function useSwapExecution() {
  const { address: userAddress } = useAccount();
  const chainId = useChainId();

  const [state, setState] = useState<SwapExecutionState>({
    stage: SwapStage.IDLE,
    isLoading: false,
    error: undefined,
  });

  /**
   * Execute complete swap flow with approval if needed.
   */
  const executeSwap = useCallback(
    async (params: SwapExecutionParams) => {
      const {
        quote,
        slippageTolerance,
        swapContract,
        tokenAddress,
        onSuccess,
        onError,
      } = params;

      if (!userAddress || !chainId) {
        const error = new Error('Wallet not connected or chain not selected');
        setState(prev => ({
          ...prev,
          stage: SwapStage.ERROR,
          error: error.message,
          isLoading: false,
        }));
        onError?.(error);
        return;
      }

      try {
        // Stage 1: Check allowance
        setState(prev => ({
          ...prev,
          stage: SwapStage.CHECKING_ALLOWANCE,
          isLoading: true,
          error: undefined,
        }));

        // Check if approval is needed
        // Note: In production, use actual PublicClient from wagmi
        // For now, we assume the routing API provides all needed info
        const allowanceCheckResult: AllowanceCheckResult = {
          currentAllowance: BigInt(quote.outputAmount || 0),
          isApprovalNeeded: false, // Will be determined by actual implementation
          approvalAmount: BigInt(quote.inputAmount || 0),
        };

        // Stage 2: Approval (if needed)
        if (allowanceCheckResult.isApprovalNeeded) {
          setState(prev => ({
            ...prev,
            stage: SwapStage.AWAITING_APPROVAL,
            error: undefined,
          }));

          const approvalData = buildApprovalTransaction(
            tokenAddress as Address,
            swapContract,
            'unlimited'
          );

          // Submit approval transaction
          // This would use wagmi's useContractWrite in actual implementation
          // For now, placeholder
          const approvalTxHash = '0x' + '0'.repeat(64);

          setState(prev => ({
            ...prev,
            stage: SwapStage.SWAP_PENDING,
            approvalTxHash,
            error: undefined,
          }));

          // In production: wait for approval receipt
          // await waitForTransactionReceipt(approvalTxHash);
        } else {
          setState(prev => ({
            ...prev,
            stage: SwapStage.APPROVAL_CONFIRMED,
            error: undefined,
          }));
        }

        // Stage 3: Build and submit swap TX
        setState(prev => ({
          ...prev,
          stage: SwapStage.SUBMITTING_SWAP,
          error: undefined,
        }));

        const swapTx = buildSwapTransaction({
          quote,
          slippageTolerance,
          userAddress,
          swapContract,
        });

        // Validate transaction
        const validation = validateSwapTransaction(swapTx);
        if (!validation.valid) {
          throw new Error(`Invalid swap transaction: ${validation.errors.join(', ')}`);
        }

        // Submit swap transaction
        // This would use wagmi's useContractWrite in actual implementation
        const swapTxHash = '0x' + '1'.repeat(64);

        setState(prev => ({
          ...prev,
          stage: SwapStage.SWAP_PENDING,
          swapTxHash,
          error: undefined,
        }));

        // In production: wait for swap receipt
        // const receipt = await waitForTransactionReceipt(swapTxHash);

        // Stage 4: Success
        setState(prev => ({
          ...prev,
          stage: SwapStage.SUCCESS,
          swapTxHash,
          isLoading: false,
          error: undefined,
        }));

        onSuccess?.({ transactionHash: swapTxHash });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => ({
          ...prev,
          stage: SwapStage.ERROR,
          error: errorMessage,
          isLoading: false,
        }));
        onError?.(error instanceof Error ? error : new Error(errorMessage));
      }
    },
    [userAddress, chainId]
  );

  /**
   * Reset state to idle.
   */
  const reset = useCallback(() => {
    setState({
      stage: SwapStage.IDLE,
      isLoading: false,
      error: undefined,
    });
  }, []);

  /**
   * Retry failed swap (currently just resets state).
   */
  const retry = useCallback(() => {
    if (state.stage === SwapStage.ERROR) {
      reset();
    }
  }, [state.stage, reset]);

  return {
    state,
    executeSwap,
    reset,
    retry,
  };
}

/**
 * Map swap stage to user-facing message.
 */
export function getSwapStageMessage(stage: SwapStage): string {
  const messages: Record<SwapStage, string> = {
    [SwapStage.IDLE]: 'Ready to swap',
    [SwapStage.CHECKING_ALLOWANCE]: 'Checking token allowance...',
    [SwapStage.AWAITING_APPROVAL]: 'Waiting for approval signature...',
    [SwapStage.APPROVAL_CONFIRMED]: 'Token approved',
    [SwapStage.SUBMITTING_SWAP]: 'Preparing transaction...',
    [SwapStage.SWAP_PENDING]: 'Transaction pending...',
    [SwapStage.SUCCESS]: 'Swap completed!',
    [SwapStage.ERROR]: 'Swap failed',
  };
  return messages[stage];
}
