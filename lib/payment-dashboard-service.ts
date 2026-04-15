/**
 * Payment Dashboard Service
 * Provides analytics and reporting for admin payment dashboard
 */

export interface DashboardMetrics {
  totalRevenue: number;
  dailyRevenue: number;
  monthlyRevenue: number;
  totalTransactions: number;
  completedTransactions: number;
  failedTransactions: number;
  pendingTransactions: number;
  successRate: number;
  failureRate: number;
  averageTransactionAmount: number;
}

export interface TransactionRecord {
  id: string;
  transactionId: string;
  requestId: string;
  userId: string;
  userName: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  paymentMethod: string;
  timestamp: number;
  completedAt?: number;
  reference?: string;
}

export interface RevenueChart {
  date: string;
  revenue: number;
  transactions: number;
  successRate: number;
}

export interface PaymentMethodBreakdown {
  method: string;
  count: number;
  amount: number;
  percentage: number;
}

export interface Alert {
  id: string;
  type: 'high_failure_rate' | 'low_revenue' | 'pending_payment' | 'system_error';
  severity: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  timestamp: number;
  resolved: boolean;
}

export class PaymentDashboardService {
  private transactions: TransactionRecord[] = [];
  private alerts: Alert[] = [];
  private dailyMetrics: Map<string, DashboardMetrics> = new Map();

  /**
   * Add transaction record
   */
  addTransaction(transaction: TransactionRecord): void {
    this.transactions.push(transaction);
    this.updateDailyMetrics();
    this.checkAlerts();
  }

  /**
   * Get dashboard metrics
   */
  getDashboardMetrics(): DashboardMetrics {
    const total = this.transactions.length;
    const completed = this.transactions.filter(t => t.status === 'completed').length;
    const failed = this.transactions.filter(t => t.status === 'failed').length;
    const pending = this.transactions.filter(t => t.status === 'pending').length;

    const totalRevenue = this.transactions
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailyRevenue = this.transactions
      .filter(t => t.status === 'completed' && t.timestamp >= today.getTime())
      .reduce((sum, t) => sum + t.amount, 0);

    const currentMonth = new Date();
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthlyRevenue = this.transactions
      .filter(t => t.status === 'completed' && t.timestamp >= monthStart.getTime())
      .reduce((sum, t) => sum + t.amount, 0);

    const totalAmount = this.transactions.reduce((sum, t) => sum + t.amount, 0);

    return {
      totalRevenue,
      dailyRevenue,
      monthlyRevenue,
      totalTransactions: total,
      completedTransactions: completed,
      failedTransactions: failed,
      pendingTransactions: pending,
      successRate: total > 0 ? (completed / total) * 100 : 0,
      failureRate: total > 0 ? (failed / total) * 100 : 0,
      averageTransactionAmount: total > 0 ? totalAmount / total : 0,
    };
  }

  /**
   * Get revenue chart data
   */
  getRevenueChart(days: number = 30): RevenueChart[] {
    const chart: RevenueChart[] = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayTransactions = this.transactions.filter(
        t => t.timestamp >= date.getTime() && t.timestamp < nextDate.getTime()
      );

      const completed = dayTransactions.filter(t => t.status === 'completed');
      const revenue = completed.reduce((sum, t) => sum + t.amount, 0);

      chart.push({
        date: date.toISOString().split('T')[0],
        revenue,
        transactions: dayTransactions.length,
        successRate:
          dayTransactions.length > 0 ? (completed.length / dayTransactions.length) * 100 : 0,
      });
    }

    return chart;
  }

  /**
   * Get payment method breakdown
   */
  getPaymentMethodBreakdown(): PaymentMethodBreakdown[] {
    const breakdown: Map<string, { count: number; amount: number }> = new Map();

    for (const transaction of this.transactions) {
      if (!breakdown.has(transaction.paymentMethod)) {
        breakdown.set(transaction.paymentMethod, { count: 0, amount: 0 });
      }

      const data = breakdown.get(transaction.paymentMethod)!;
      data.count++;
      if (transaction.status === 'completed') {
        data.amount += transaction.amount;
      }
    }

    const total = this.transactions.reduce((sum, t) => sum + t.amount, 0);

    return Array.from(breakdown.entries()).map(([method, data]) => ({
      method,
      count: data.count,
      amount: data.amount,
      percentage: total > 0 ? (data.amount / total) * 100 : 0,
    }));
  }

  /**
   * Get failed payments
   */
  getFailedPayments(): TransactionRecord[] {
    return this.transactions.filter(t => t.status === 'failed');
  }

  /**
   * Get pending payments
   */
  getPendingPayments(): TransactionRecord[] {
    return this.transactions.filter(t => t.status === 'pending');
  }

  /**
   * Get transaction history
   */
  getTransactionHistory(
    limit: number = 50,
    offset: number = 0,
    status?: string
  ): TransactionRecord[] {
    let filtered = this.transactions;

    if (status) {
      filtered = filtered.filter(t => t.status === status);
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    return filtered.slice(offset, offset + limit);
  }

  /**
   * Search transactions
   */
  searchTransactions(query: string): TransactionRecord[] {
    const lowerQuery = query.toLowerCase();
    return this.transactions.filter(
      t =>
        t.userName.toLowerCase().includes(lowerQuery) ||
        t.transactionId.toLowerCase().includes(lowerQuery) ||
        t.requestId.toLowerCase().includes(lowerQuery) ||
        t.userId.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get transaction by ID
   */
  getTransaction(transactionId: string): TransactionRecord | undefined {
    return this.transactions.find(t => t.transactionId === transactionId);
  }

  /**
   * Update transaction status
   */
  updateTransactionStatus(
    transactionId: string,
    status: TransactionRecord['status']
  ): boolean {
    const transaction = this.transactions.find(t => t.transactionId === transactionId);
    if (transaction) {
      transaction.status = status;
      if (status === 'completed') {
        transaction.completedAt = Date.now();
      }
      this.updateDailyMetrics();
      this.checkAlerts();
      return true;
    }
    return false;
  }

  /**
   * Check for alerts
   */
  private checkAlerts(): void {
    const metrics = this.getDashboardMetrics();

    // High failure rate alert
    if (metrics.failureRate > 10 && metrics.totalTransactions >= 10) {
      this.createAlert(
        'high_failure_rate',
        'high',
        'High Payment Failure Rate',
        `Payment failure rate is ${metrics.failureRate.toFixed(1)}%. Please investigate.`
      );
    }

    // Low revenue alert
    if (metrics.dailyRevenue < 1000 && metrics.totalTransactions > 0) {
      this.createAlert(
        'low_revenue',
        'medium',
        'Low Daily Revenue',
        `Today's revenue is only K${metrics.dailyRevenue}. Below expected threshold.`
      );
    }

    // Pending payments alert
    if (metrics.pendingTransactions > 5) {
      this.createAlert(
        'pending_payment',
        'medium',
        'Multiple Pending Payments',
        `There are ${metrics.pendingTransactions} pending payments awaiting confirmation.`
      );
    }
  }

  /**
   * Create alert
   */
  private createAlert(
    type: Alert['type'],
    severity: Alert['severity'],
    title: string,
    message: string
  ): void {
    // Check if similar alert already exists
    const existingAlert = this.alerts.find(a => a.type === type && !a.resolved);
    if (existingAlert) {
      return; // Don't create duplicate
    }

    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      title,
      message,
      timestamp: Date.now(),
      resolved: false,
    };

    this.alerts.push(alert);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): Alert[] {
    return this.alerts;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      return true;
    }
    return false;
  }

  /**
   * Update daily metrics
   */
  private updateDailyMetrics(): void {
    const today = new Date().toISOString().split('T')[0];
    this.dailyMetrics.set(today, this.getDashboardMetrics());
  }

  /**
   * Get reconciliation report
   */
  getReconciliationReport(): {
    totalExpected: number;
    totalReceived: number;
    discrepancy: number;
    failedTransactions: TransactionRecord[];
    pendingTransactions: TransactionRecord[];
  } {
    const allTransactions = this.transactions;
    const completed = allTransactions.filter(t => t.status === 'completed');
    const failed = this.getFailedPayments();
    const pending = this.getPendingPayments();

    const totalExpected = allTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalReceived = completed.reduce((sum, t) => sum + t.amount, 0);
    const discrepancy = totalExpected - totalReceived;

    return {
      totalExpected,
      totalReceived,
      discrepancy,
      failedTransactions: failed,
      pendingTransactions: pending,
    };
  }

  /**
   * Export dashboard data
   */
  exportDashboardData(format: 'json' | 'csv' = 'json'): string {
    const data = {
      exportedAt: new Date().toISOString(),
      metrics: this.getDashboardMetrics(),
      revenueChart: this.getRevenueChart(30),
      paymentMethods: this.getPaymentMethodBreakdown(),
      alerts: this.getActiveAlerts(),
      reconciliation: this.getReconciliationReport(),
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    // CSV format
    let csv = 'Transaction ID,Request ID,User Name,Amount,Status,Payment Method,Timestamp\n';
    for (const transaction of this.transactions) {
      csv += `${transaction.transactionId},${transaction.requestId},${transaction.userName},${transaction.amount},${transaction.status},${transaction.paymentMethod},${new Date(transaction.timestamp).toISOString()}\n`;
    }
    return csv;
  }

  /**
   * Get all transactions
   */
  getAllTransactions(): TransactionRecord[] {
    return this.transactions;
  }

  /**
   * Clear old data (older than 90 days)
   */
  clearOldData(daysOld: number = 90): number {
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    const initialLength = this.transactions.length;

    this.transactions = this.transactions.filter(t => t.timestamp > cutoffTime);

    return initialLength - this.transactions.length;
  }
}

// Create singleton instance
export const paymentDashboardService = new PaymentDashboardService();
