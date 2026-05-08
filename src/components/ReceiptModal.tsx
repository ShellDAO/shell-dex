/**
 * Receipt modal for displaying swap transaction results (M3).
 * 
 * Shows:
 * - Transaction status (success/failure)
 * - Input/output amounts
 * - Transaction hash with block explorer link
 * - Block height and confirmation count
 * - Transaction fees
 * - Timestamp
 */

'use client';

import React from 'react';
import { SupportedChainId } from '@/config/chains';

export interface SwapReceiptData {
  transactionHash: string;
  status: 'success' | 'failed';
  inputToken: {
    symbol: string;
    amount: string;
  };
  outputToken: {
    symbol: string;
    amount: string;
  };
  fee?: {
    amount: string;
    currency: string;
  };
  blockNumber?: number;
  blockTime?: number;
  confirmations?: number;
  chainId: SupportedChainId;
}

interface ReceiptModalProps {
  isOpen: boolean;
  receipt?: SwapReceiptData;
  onClose: () => void;
}

/**
 * Get block explorer URL for a transaction.
 */
function getBlockExplorerTxUrl(chainId: SupportedChainId, txHash: string): string {
  const explorers: Record<SupportedChainId, string> = {
    42161: 'https://arbiscan.io/tx',
    10: 'https://testnet.shell.network/tx',
  };
  return `${explorers[chainId]}/${txHash}`;
}

/**
 * Format transaction hash for display.
 */
function formatTxHash(hash: string): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

/**
 * Receipt modal component.
 */
export function ReceiptModal({ isOpen, receipt, onClose }: ReceiptModalProps) {
  if (!isOpen || !receipt) {
    return null;
  }

  const explorerUrl = getBlockExplorerTxUrl(receipt.chainId, receipt.transactionHash);
  const isSuccess = receipt.status === 'success';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className={`px-6 py-4 border-b ${
          isSuccess ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
        }`}>
          <h2 className={`text-lg font-bold ${
            isSuccess ? 'text-green-900' : 'text-red-900'
          }`}>
            {isSuccess ? '✓ Swap Successful' : '✕ Swap Failed'}
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Amounts */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">From:</span>
              <span className="font-mono text-sm">
                {receipt.inputToken.amount} {receipt.inputToken.symbol}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">To:</span>
              <span className="font-mono text-sm font-bold text-green-700">
                {receipt.outputToken.amount} {receipt.outputToken.symbol}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200" />

          {/* Transaction Details */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-start">
              <span className="text-gray-600">Transaction:</span>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 font-mono text-xs"
              >
                {formatTxHash(receipt.transactionHash)} ↗
              </a>
            </div>

            {receipt.blockNumber && (
              <div className="flex justify-between">
                <span className="text-gray-600">Block:</span>
                <span className="font-mono text-xs"># {receipt.blockNumber}</span>
              </div>
            )}

            {receipt.confirmations !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600">Confirmations:</span>
                <span className="font-mono text-xs">{receipt.confirmations}</span>
              </div>
            )}

            {receipt.fee && (
              <div className="flex justify-between">
                <span className="text-gray-600">Transaction Fee:</span>
                <span className="font-mono text-xs">
                  {receipt.fee.amount} {receipt.fee.currency}
                </span>
              </div>
            )}

            {receipt.blockTime && (
              <div className="flex justify-between">
                <span className="text-gray-600">Time:</span>
                <span className="text-xs">
                  {new Date(receipt.blockTime * 1000).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg flex gap-2">
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-4 py-2 text-center rounded border border-blue-300 bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 text-sm"
          >
            View on Explorer
          </a>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded border border-gray-300 bg-white hover:bg-gray-50 font-medium text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for managing receipt modal state.
 */
export function useReceiptModal() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [receipt, setReceipt] = React.useState<SwapReceiptData | undefined>();

  const show = React.useCallback((data: SwapReceiptData) => {
    setReceipt(data);
    setIsOpen(true);
  }, []);

  const close = React.useCallback(() => {
    setIsOpen(false);
    // Delay clearing data so modal can animate out
    setTimeout(() => setReceipt(undefined), 300);
  }, []);

  return { isOpen, receipt, show, close };
}
