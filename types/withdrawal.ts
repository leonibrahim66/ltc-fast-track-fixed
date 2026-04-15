/**
 * Withdrawal System Types
 */

export type WithdrawalStatus = 
  | 'pending_manual_settlement'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'processing';

export type MobileMoneyProvider = 'mtn' | 'airtel' | 'zamtel';

export type TransactionType = 
  | 'deposit'
  | 'withdrawal'
  | 'commission_deduction'
  | 'refund'
  | 'adjustment';

export type SettlementStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * User Wallet
 */
export interface UserWallet {
  userId: string;
  balance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalCommissionsPaid: number;
  updatedAt: string;
}

/**
 * Withdrawal Request
 */
export interface WithdrawalRequest {
  amount: number;
  phoneNumber: string;
  mobileMoneyProvider: MobileMoneyProvider;
}

/**
 * Withdrawal Record
 */
export interface Withdrawal {
  id: string;
  userId: string;
  amount: number;
  commissionAmount: number;
  netAmount: number;
  status: WithdrawalStatus;
  phoneNumber: string;
  mobileMoneyProvider: MobileMoneyProvider;
  externalTransactionId?: string;
  createdAt: string;
  completedAt?: string;
  updatedAt: string;
  notes?: string;
  adminId?: string;
}

/**
 * Withdrawal Response
 */
export interface WithdrawalResponse {
  withdrawalId: string;
  amount: number;
  commissionAmount: number;
  netAmount: number;
  status: WithdrawalStatus;
  errorMessage?: string;
}

/**
 * Wallet Ledger Entry
 */
export interface WalletLedgerEntry {
  id: string;
  userId: string;
  transactionType: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  withdrawalId?: string;
  depositId?: string;
  description: string;
  createdAt: string;
}

/**
 * Platform Wallet
 */
export interface PlatformWallet {
  id: string;
  totalCommissions: number;
  availableBalance: number;
  settledAmount: number;
  pendingSettlement: number;
  updatedAt: string;
}

/**
 * Platform Wallet Statistics
 */
export interface PlatformWalletStats {
  totalCommissions: number;
  availableBalance: number;
  settledAmount: number;
  pendingSettlement: number;
  pendingWithdrawalCount: number;
  pendingWithdrawalAmount: number;
}

/**
 * Withdrawal Settlement
 */
export interface WithdrawalSettlement {
  id: string;
  batchId?: string;
  status: SettlementStatus;
  totalWithdrawals: number;
  totalAmount: number;
  successfulCount: number;
  failedCount: number;
  mtnBatchId?: string;
  mtnStatus?: string;
  createdAt: string;
  completedAt?: string;
  updatedAt: string;
  notes?: string;
  adminId?: string;
}

/**
 * Withdrawal Statistics
 */
export interface WithdrawalStatistics {
  pending: number;
  completed: number;
  cancelled: number;
  failed: number;
  totalAmount: number;
  totalCommissions: number;
}

/**
 * Admin Settlement Request
 */
export interface AdminSettlementRequest {
  withdrawalId: string;
  adminId: string;
  notes?: string;
}

/**
 * Admin Cancellation Request
 */
export interface AdminCancellationRequest {
  withdrawalId: string;
  adminId: string;
  reason: string;
}

/**
 * Commission Configuration
 */
export interface CommissionConfig {
  percentage: number; // 10 for 10%
  minAmount: number;
  maxAmount: number;
  roundingDecimals: number; // 2 for $X.XX
}

/**
 * Withdrawal Filter Options
 */
export interface WithdrawalFilterOptions {
  userId?: string;
  status?: WithdrawalStatus;
  provider?: MobileMoneyProvider;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
}

/**
 * Withdrawal Export Format
 */
export interface WithdrawalExportRow {
  id: string;
  userId: string;
  amount: number;
  commission: number;
  netAmount: number;
  status: string;
  phoneNumber: string;
  provider: string;
  requestedDate: string;
  completedDate?: string;
  adminNotes?: string;
}
