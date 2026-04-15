/**
 * Withdrawal Service
 * Handles all withdrawal operations via Supabase RPC
 * 10% commission calculated server-side
 */

import { supabase } from './supabase';

export interface WithdrawalRequest {
  amount: number;
  phoneNumber: string;
  mobileMoneyProvider: string; // 'mtn', 'airtel', 'zamtel'
}

export interface WithdrawalResponse {
  withdrawalId: string;
  amount: number;
  commissionAmount: number;
  netAmount: number;
  status: string;
  errorMessage?: string;
}

export interface WithdrawalRecord {
  id: string;
  userId: string;
  amount: number;
  commissionAmount: number;
  netAmount: number;
  status: string;
  phoneNumber: string;
  mobileMoneyProvider: string;
  externalTransactionId?: string;
  createdAt: string;
  completedAt?: string;
  updatedAt: string;
  notes?: string;
  adminId?: string;
}

export interface WalletLedgerEntry {
  id: string;
  userId: string;
  transactionType: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  withdrawalId?: string;
  description: string;
  createdAt: string;
}

export interface PlatformWalletStats {
  totalCommissions: number;
  availableBalance: number;
  settledAmount: number;
  pendingSettlement: number;
  pendingWithdrawalCount: number;
  pendingWithdrawalAmount: number;
}

export interface WithdrawalConfig {
  withdrawalsEnabled: boolean;
  minimumAmount: number;
  maximumAmount: number;
  commissionPercentage: number;
}

/**
 * Process a withdrawal request
 * Calls server-side RPC function that:
 * 1. Validates amount
 * 2. Checks user balance
 * 3. Calculates 10% commission
 * 4. Deducts full amount from user wallet
 * 5. Adds commission to platform wallet
 * 6. Creates withdrawal record
 * 7. Logs transaction in wallet ledger
 */
export async function processWithdrawal(
  userId: string,
  request: WithdrawalRequest
): Promise<WithdrawalResponse> {
  try {
    const { data, error } = await supabase.rpc('process_withdrawal', {
      p_user_id: userId,
      p_amount: request.amount,
      p_phone_number: request.phoneNumber,
      p_mobile_money_provider: request.mobileMoneyProvider,
    });

    if (error) {
      console.error('Withdrawal error:', error);
      return {
        withdrawalId: '',
        amount: 0,
        commissionAmount: 0,
        netAmount: 0,
        status: 'error',
        errorMessage: error.message,
      };
    }

    if (!data || data.length === 0) {
      return {
        withdrawalId: '',
        amount: 0,
        commissionAmount: 0,
        netAmount: 0,
        status: 'error',
        errorMessage: 'No response from server',
      };
    }

    const result = data[0];
    return {
      withdrawalId: result.withdrawal_id,
      amount: result.amount,
      commissionAmount: result.commission_amount,
      netAmount: result.net_amount,
      status: result.status,
      errorMessage: result.error_message,
    };
  } catch (error) {
    console.error('Withdrawal exception:', error);
    return {
      withdrawalId: '',
      amount: 0,
      commissionAmount: 0,
      netAmount: 0,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get pending withdrawals (admin only)
 */
export async function getPendingWithdrawals(): Promise<WithdrawalRecord[]> {
  try {
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('status', 'pending_manual_settlement')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((w: any) => ({
      id: w.id,
      userId: w.user_id,
      amount: w.amount,
      commissionAmount: w.commission_amount,
      netAmount: w.net_amount,
      status: w.status,
      phoneNumber: w.phone_number,
      mobileMoneyProvider: w.mobile_money_provider,
      externalTransactionId: w.external_transaction_id,
      createdAt: w.created_at,
      completedAt: w.completed_at,
      updatedAt: w.updated_at,
      notes: w.notes,
      adminId: w.admin_id,
    }));
  } catch (error) {
    console.error('Error fetching pending withdrawals:', error);
    return [];
  }
}

/**
 * Get all withdrawals for a user
 */
export async function getUserWithdrawals(userId: string): Promise<WithdrawalRecord[]> {
  try {
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((w: any) => ({
      id: w.id,
      userId: w.user_id,
      amount: w.amount,
      commissionAmount: w.commission_amount,
      netAmount: w.net_amount,
      status: w.status,
      phoneNumber: w.phone_number,
      mobileMoneyProvider: w.mobile_money_provider,
      externalTransactionId: w.external_transaction_id,
      createdAt: w.created_at,
      completedAt: w.completed_at,
      updatedAt: w.updated_at,
      notes: w.notes,
      adminId: w.admin_id,
    }));
  } catch (error) {
    console.error('Error fetching user withdrawals:', error);
    return [];
  }
}

/**
 * Get withdrawal details
 */
export async function getWithdrawalDetails(withdrawalId: string): Promise<WithdrawalRecord | null> {
  try {
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', withdrawalId)
      .single();

    if (error) throw error;

    if (!data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      amount: data.amount,
      commissionAmount: data.commission_amount,
      netAmount: data.net_amount,
      status: data.status,
      phoneNumber: data.phone_number,
      mobileMoneyProvider: data.mobile_money_provider,
      externalTransactionId: data.external_transaction_id,
      createdAt: data.created_at,
      completedAt: data.completed_at,
      updatedAt: data.updated_at,
      notes: data.notes,
      adminId: data.admin_id,
    };
  } catch (error) {
    console.error('Error fetching withdrawal details:', error);
    return null;
  }
}

/**
 * Complete a withdrawal (admin only)
 * Marks withdrawal as completed and updates platform wallet
 */
export async function completeWithdrawal(
  withdrawalId: string,
  adminId: string,
  notes?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { data, error } = await supabase.rpc('complete_withdrawal', {
      p_withdrawal_id: withdrawalId,
      p_admin_id: adminId,
      p_notes: notes || null,
    });

    if (error) {
      console.error('Complete withdrawal error:', error);
      return {
        success: false,
        message: error.message,
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        message: 'No response from server',
      };
    }

    const result = data[0];
    return {
      success: result.success,
      message: result.message,
    };
  } catch (error) {
    console.error('Complete withdrawal exception:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Cancel a withdrawal (admin only)
 * Refunds user and removes commission from platform wallet
 */
export async function cancelWithdrawal(
  withdrawalId: string,
  adminId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { data, error } = await supabase.rpc('cancel_withdrawal', {
      p_withdrawal_id: withdrawalId,
      p_admin_id: adminId,
      p_reason: reason,
    });

    if (error) {
      console.error('Cancel withdrawal error:', error);
      return {
        success: false,
        message: error.message,
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        message: 'No response from server',
      };
    }

    const result = data[0];
    return {
      success: result.success,
      message: result.message,
    };
  } catch (error) {
    console.error('Cancel withdrawal exception:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get wallet ledger entries for a user
 */
export async function getUserWalletLedger(userId: string): Promise<WalletLedgerEntry[]> {
  try {
    const { data, error } = await supabase
      .from('wallet_ledger')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((entry: any) => ({
      id: entry.id,
      userId: entry.user_id,
      transactionType: entry.transaction_type,
      amount: entry.amount,
      balanceBefore: entry.balance_before,
      balanceAfter: entry.balance_after,
      withdrawalId: entry.withdrawal_id,
      description: entry.description,
      createdAt: entry.created_at,
    }));
  } catch (error) {
    console.error('Error fetching wallet ledger:', error);
    return [];
  }
}

/**
 * Get withdrawal configuration
 */
export async function getWithdrawalConfig(): Promise<WithdrawalConfig | null> {
  try {
    const { data, error } = await supabase.rpc('get_withdrawal_config');

    if (error) {
      console.error('Withdrawal config error:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const result = data[0];
    return {
      withdrawalsEnabled: result.withdrawals_enabled,
      minimumAmount: result.minimum_amount,
      maximumAmount: result.maximum_amount,
      commissionPercentage: result.commission_percentage,
    };
  } catch (error) {
    console.error('Withdrawal config exception:', error);
    return null;
  }
}

/**
 * Update withdrawal configuration (admin only)
 */
export async function updateWithdrawalConfig(
  config: Partial<WithdrawalConfig>
): Promise<{ success: boolean; message: string }> {
  try {
    const { data, error } = await supabase.rpc('update_withdrawal_config', {
      p_withdrawals_enabled: config.withdrawalsEnabled ?? null,
      p_minimum_amount: config.minimumAmount ?? null,
      p_maximum_amount: config.maximumAmount ?? null,
      p_commission_percentage: config.commissionPercentage ?? null,
    });

    if (error) {
      console.error('Update config error:', error);
      return {
        success: false,
        message: error.message,
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        message: 'No response from server',
      };
    }

    const result = data[0];
    return {
      success: result.success,
      message: result.message,
    };
  } catch (error) {
    console.error('Update config exception:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get platform wallet statistics (admin only)
 */
export async function getPlatformWalletStats(): Promise<PlatformWalletStats | null> {
  try {
    const { data, error } = await supabase.rpc('get_platform_wallet_stats');

    if (error) {
      console.error('Platform wallet stats error:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const result = data[0];
    return {
      totalCommissions: result.total_commissions,
      availableBalance: result.available_balance,
      settledAmount: result.settled_amount,
      pendingSettlement: result.pending_settlement,
      pendingWithdrawalCount: result.pending_withdrawal_count,
      pendingWithdrawalAmount: result.pending_withdrawal_amount,
    };
  } catch (error) {
    console.error('Platform wallet stats exception:', error);
    return null;
  }
}

/**
 * Get user wallet balance
 */
export async function getUserWalletBalance(userId: string): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('user_wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - wallet doesn't exist yet
        return null;
      }
      throw error;
    }

    return data?.balance || 0;
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    return null;
  }
}

/**
 * Initialize user wallet (called on first deposit)
 */
export async function initializeUserWallet(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_wallets')
      .insert([
        {
          user_id: userId,
          balance: 0,
          total_deposited: 0,
          total_withdrawn: 0,
          total_commissions_paid: 0,
        },
      ])
      .select();

    if (error) {
      if (error.code === '23505') {
        // Unique constraint violation - wallet already exists
        return true;
      }
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error initializing wallet:', error);
    return false;
  }
}

/**
 * Get withdrawal statistics by status
 */
export async function getWithdrawalStatistics(): Promise<{
  pending: number;
  completed: number;
  cancelled: number;
  failed: number;
  totalAmount: number;
  totalCommissions: number;
}> {
  try {
    const { data, error } = await supabase
      .from('withdrawals')
      .select('status, amount, commission_amount');

    if (error) throw error;

    const stats = {
      pending: 0,
      completed: 0,
      cancelled: 0,
      failed: 0,
      totalAmount: 0,
      totalCommissions: 0,
    };

    (data || []).forEach((w: any) => {
      stats[w.status as keyof typeof stats]++;
      stats.totalAmount += w.amount;
      stats.totalCommissions += w.commission_amount;
    });

    return stats;
  } catch (error) {
    console.error('Error fetching withdrawal statistics:', error);
    return {
      pending: 0,
      completed: 0,
      cancelled: 0,
      failed: 0,
      totalAmount: 0,
      totalCommissions: 0,
    };
  }
}
