/**
 * ERC20 token approval management for M3 swap execution.
 * 
 * Handles:
 * - Allowance checking
 * - Approval transaction building
 * - Unlimited vs. exact amount approval strategies
 */

import { Address, erc20Abi, formatUnits, parseUnits } from 'viem';

export interface AllowanceCheckResult {
  currentAllowance: bigint;
  isApprovalNeeded: boolean;
  approvalAmount: bigint;
}

export interface ApprovalTransactionData {
  to: Address;
  data: string;
  value: '0x0';
}

/**
 * Check if token approval is needed for a swap.
 * 
 * @param tokenAddress ERC20 token address
 * @param spenderAddress The router/swap contract address
 * @param ownerAddress The user's wallet address
 * @param requiredAmount The amount of token needed for the swap (as wei string)
 * @param publicClient Viem PublicClient for reading from chain
 * @returns Allowance check result with approval recommendation
 */
export async function checkAllowance(
  tokenAddress: Address,
  spenderAddress: Address,
  ownerAddress: Address,
  requiredAmount: string,
  publicClient: any
): Promise<AllowanceCheckResult> {
  try {
    const currentAllowance = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [ownerAddress, spenderAddress],
    });

    const requiredBig = BigInt(requiredAmount);
    const isApprovalNeeded = BigInt(currentAllowance) < requiredBig;

    return {
      currentAllowance: BigInt(currentAllowance),
      isApprovalNeeded,
      approvalAmount: requiredBig,
    };
  } catch (error) {
    console.error('Failed to check token allowance:', error);
    throw new Error(`Could not verify token allowance: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Build an ERC20 approval transaction.
 * 
 * Strategy: Always approve unlimited (max uint256) to avoid repeated approvals.
 * Alternative: exact amount approval (less gas cost but requires re-approval).
 * 
 * @param tokenAddress ERC20 token address
 * @param spenderAddress The router/swap contract address
 * @param strategy 'unlimited' (default) or 'exact'
 * @param exactAmount Amount to approve (required if strategy='exact')
 * @returns Transaction call data for approval
 */
export function buildApprovalTransaction(
  tokenAddress: Address,
  spenderAddress: Address,
  strategy: 'unlimited' | 'exact' = 'unlimited',
  exactAmount?: string
): ApprovalTransactionData {
  const approvalAmount = strategy === 'unlimited'
    ? '115792089237316195423570985008687907853269984665640564039457584007913129639935' // max uint256
    : exactAmount;

  if (!approvalAmount) {
    throw new Error('exactAmount required for exact approval strategy');
  }

  // Encode ERC20 approve(spender, amount) function call
  // approve(address spender, uint256 amount)
  // Function selector: 0x095ea7b3
  const encoded = encodeERC20Approve(spenderAddress, approvalAmount);

  return {
    to: tokenAddress,
    data: encoded,
    value: '0x0',
  };
}

/**
 * Encode ERC20 approve function call.
 * 
 * Function signature: approve(address spender, uint256 amount)
 * Function selector (4 bytes): 0x095ea7b3
 */
function encodeERC20Approve(spender: Address, amount: string): string {
  const APPROVE_SELECTOR = '0x095ea7b3';
  
  // Pad address to 32 bytes (remove 0x, pad with zeros)
  const paddedSpender = spender.slice(2).padStart(64, '0');
  
  // Convert amount to hex and pad to 32 bytes
  const amountBig = BigInt(amount);
  const paddedAmount = amountBig.toString(16).padStart(64, '0');
  
  return `${APPROVE_SELECTOR}${paddedSpender}${paddedAmount}`;
}

/**
 * Parse approval transaction response from signed TX.
 * 
 * @param txHash Transaction hash from approval
 * @returns True if approval was likely successful (not a guarantee; must check receipt)
 */
export function isApprovalPending(txHash: string): boolean {
  return !!(txHash && txHash.startsWith('0x') && txHash.length === 66);
}
