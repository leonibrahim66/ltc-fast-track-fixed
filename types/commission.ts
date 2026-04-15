export interface CommissionSettings {
  id: string;
  percentage: number; // Platform commission percentage (e.g., 10 for 10%)
  effectiveDate: string; // ISO date string
  updatedBy: string; // Admin user ID
  updatedAt: string; // ISO date string
  notes?: string;
}

export interface EarningsBreakdown {
  collectorId: string;
  period: {
    start: string; // ISO date string
    end: string; // ISO date string
  };
  totalSubscriptionCollected: number; // Total from zone subscriptions
  platformCommission: number; // Calculated commission amount
  commissionPercentage: number; // Commission rate used
  netEarnings: number; // Total - Commission
  pendingPayout: number; // Amount pending withdrawal
  paidAmount: number; // Total amount already paid out
  lastUpdated: string; // ISO date string
}

export interface WithdrawalRequest {
  id: string;
  collectorId: string;
  collectorName: string;
  amount: number;
  paymentMethod: "mobile_money" | "bank_transfer";
  accountDetails: {
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    mobileNumber?: string;
    provider?: string; // MTN, Airtel, Zamtel
  };
  status: "pending" | "approved" | "paid" | "rejected";
  requestDate: string; // ISO date string
  approvedDate?: string; // ISO date string
  paidDate?: string; // ISO date string
  rejectedDate?: string; // ISO date string
  approvedBy?: string; // Admin user ID
  rejectionReason?: string;
  notes?: string;
}

export interface CommissionTransaction {
  id: string;
  collectorId: string;
  type: "earning" | "commission" | "withdrawal";
  amount: number;
  description: string;
  date: string; // ISO date string
  status: "completed" | "pending" | "failed";
  relatedId?: string; // Related pickup or withdrawal ID
}
