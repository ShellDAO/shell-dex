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
import { SupportedChainId, supportedChains } from '@/config/chains';

export interface TransactionReceiptItem {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'danger';
}

export interface TransactionReceiptData {
  transactionHash: string;
  status: 'success' | 'failed';
  title: string;
  summary?: string;
  items: TransactionReceiptItem[];
  fee?: {
    amount: string;
    currency: string;
  };
  blockNumber?: number;
  blockTime?: number;
  confirmations?: number;
  chainId: SupportedChainId;
  isSimulated?: boolean;
}

interface ReceiptModalProps {
  isOpen: boolean;
  receipt?: TransactionReceiptData;
  onClose: () => void;
}

/**
 * Get block explorer URL for a transaction.
 */
function getBlockExplorerTxUrl(chainId: SupportedChainId, txHash: string): string {
  const baseUrl = supportedChains[chainId]?.blockExplorers?.default.url;
  return baseUrl ? `${baseUrl}/tx/${txHash}` : '#';
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
            {isSuccess ? `✓ ${receipt.title}` : `✕ ${receipt.title}`}
          </h2>
          {receipt.summary ? (
            <p className={`mt-1 text-sm ${isSuccess ? 'text-green-800' : 'text-red-800'}`}>
              {receipt.summary}
            </p>
          ) : null}
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <div className="space-y-2">
            {receipt.items.map((item) => (
              <div key={`${item.label}-${item.value}`} className="flex justify-between items-center gap-4">
                <span className="text-gray-600">{item.label}:</span>
                <span
                  className={`font-mono text-sm text-right ${
                    item.tone === 'success'
                      ? 'font-bold text-green-700'
                      : item.tone === 'danger'
                        ? 'font-bold text-red-700'
                        : 'text-gray-900'
                  }`}
                >
                  {item.value}
                </span>
              </div>
            ))}
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
                className={`font-mono text-xs ${
                  receipt.isSimulated
                    ? 'pointer-events-none text-gray-500'
                    : 'text-blue-600 hover:text-blue-700'
                }`}
              >
                {formatTxHash(receipt.transactionHash)} {receipt.isSimulated ? '(simulated)' : '↗'}
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
          {!receipt.isSimulated ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-2 text-center rounded border border-blue-300 bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 text-sm"
            >
              View on Explorer
            </a>
          ) : (
            <div className="flex-1 px-4 py-2 text-center rounded border border-gray-200 bg-gray-50 text-gray-500 font-medium text-sm">
              Simulated execution
            </div>
          )}
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
  const [receipt, setReceipt] = React.useState<TransactionReceiptData | undefined>();

  const show = React.useCallback((data: TransactionReceiptData) => {
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
