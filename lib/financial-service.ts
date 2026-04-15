/**
 * Financial Service
 * Handles all financial operations including withdrawals, commissions, and wallet management
 * All business logic is server-side via Supabase RPC
 */

import { supabase } from './supabase';

/**
 * Financial Settings Interface
 */
export interface FinancialSettings {
  withdrawalsEnabled: boolean;
  withdrawalMinimum: number;
  withdrawalCommissionPercent: number;
}

/**
 * Withdrawal Response Interface
 */
export interface WithdrawalResult {
  success: boolean;
  withdrawalId?: string;
  amount?: number;
  commissionAmount?: number;
  netAmount?: number;
  status?: string;
  errorMessage?: string;
}

/**
 * Get current financial settings
 * Used by frontend to display validation rules and commission preview
 */
export async function getFinancialSettings(): Promise<FinancialSettings | null> {
  try {
    const { data, error } = await supabase.rpc('get_financial_settings');

    if (error) {
      console.error('Financial settings error:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const result = data[0];
    return {
      withdrawalsEnabled: result.withdrawals_enabled,
      withdrawalMinimum: result.withdrawal_minimum,
      withdrawalCommissionPercent: result.withdrawal_commission_percent,
    };
  } catch (error) {
    console.error('Financial settings exception:', error);
    return null;
  }
}

/**
 * Update financial settings (admin only)
 * Allows admins to change withdrawal rules without code deployment
 */
export async function updateFinancialSettings(
  settings: Partial<FinancialSettings>
): Promise<{ success: boolean; message: string }> {
  try {
    const { data, error } = await supabase.rpc('update_financial_settings', {
      p_withdrawals_enabled: settings.withdrawalsEnabled ?? null,
      p_withdrawal_minimum: settings.withdrawalMinimum ?? null,
      p_withdrawal_commission_percent: settings.withdrawalCommissionPercent ?? null,
    });

    if (error) {
      console.error('Update financial settings error:', error);
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
    console.error('Update financial settings exception:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process withdrawal with atomic transaction
 * 
 * Server-side execution ensures:
 * 1. Withdrawals enabled check
 * 2. Minimum amount validation
 * 3. Balance validation
 * 4. Commission calculation (immutable)
 * 5. Wallet deduction
 * 6. Commission added to platform
 * 7. Ledger entries created
 * 8. All in single atomic transaction
 * 
 * Frontend has NO commission logic - purely display
 */
export async function processWithdrawalAtomic(
  userId: string,
  amount: number,
  phoneNumber: string,
  mobileMoneyProvider: string
): Promise<WithdrawalResult> {
  try {
    // Call atomic RPC function
    const { data, error } = await supabase.rpc('process_withdrawal_atomic', {
      p_user_id: userId,
      p_amount: amount,
      p_phone_number: phoneNumber,
      p_mobile_money_provider: mobileMoneyProvider,
    });

    if (error) {
      console.error('Withdrawal processing error:', error);
      return {
        success: false,
        errorMessage: error.message,
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        errorMessage: 'No response from server',
      };
    }

    const result = data[0];

    // Check if RPC returned success
    if (!result.success) {
      return {
        success: false,
        errorMessage: result.error_message,
      };
    }

    return {
      success: true,
      withdrawalId: result.withdrawal_id,
      amount: result.amount,
      commissionAmount: result.commission_amount,
      netAmount: result.net_amount,
      status: result.status,
    };
  } catch (error) {
    console.error('Withdrawal processing exception:', error);
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Calculate commission for display purposes only
 * IMPORTANT: This is frontend display only - actual calculation is server-side
 * Server RPC function has the authoritative calculation
 */
export function calculateCommissionForDisplay(
  amount: number,
  commissionPercent: number
): { commission: number; netAmount: number } {
  const commission = amount * (commissionPercent / 100);
  const netAmount = amount - commission;

  return {
    commission: Math.round(commission * 100) / 100, // Round to 2 decimals
    netAmount: Math.round(netAmount * 100) / 100,
  };
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
      console.error('Wallet balance error:', error);
      return null;
    }

    return data?.balance || 0;
  } catch (error) {
    console.error('Wallet balance exception:', error);
    return null;
  }
}

/**
 * Get user withdrawal history
 */
export async function getUserWithdrawalHistory(
  userId: string,
  limit: number = 10
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Withdrawal history error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Withdrawal history exception:', error);
    return [];
  }
}

/**
 * Get wallet ledger entries for user
 */
export async function getUserWalletLedger(
  userId: string,
  limit: number = 20
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('wallet_ledger')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Wallet ledger error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Wallet ledger exception:', error);
    return [];
  }
}

/**
 * Get platform wallet statistics (admin only)
 */
export async function getPlatformWalletStats(): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('platform_wallet')
      .select('*')
      .single();

    if (error) {
      console.error('Platform wallet stats error:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Platform wallet stats exception:', error);
    return null;
  }
}

/**
 * Initialize user wallet (called on first deposit/signup)
 */
export async function initializeUserWallet(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('user_wallets').insert({
      user_id: userId,
      balance: 0,
      total_deposited: 0,
      total_withdrawn: 0,
      total_commissions_paid: 0,
    });

    if (error) {
      console.error('Wallet initialization error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Wallet initialization exception:', error);
    return false;
  }
}
