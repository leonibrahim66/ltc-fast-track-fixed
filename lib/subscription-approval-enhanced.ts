/**
 * Enhanced Subscription Approval with Bulk Operations and Payment Verification
 */

import { emailNotificationService } from './email-notification-service';
import { paymentVerificationService } from './payment-verification-service';

export interface BulkApprovalRequest {
  requestIds: string[];
  adminId: string;
  adminName: string;
  notes?: string;
}

export interface BulkRejectionRequest {
  requestIds: string[];
  adminId: string;
  adminName: string;
  reason: string;
}

export interface BulkOperationResult {
  operationType: 'approve' | 'reject';
  totalRequests: number;
  successCount: number;
  failureCount: number;
  timestamp: number;
  details: {
    requestId: string;
    success: boolean;
    message: string;
  }[];
}

export class SubscriptionApprovalEnhanced {
  private bulkOperationHistory: BulkOperationResult[] = [];

  /**
   * Bulk approve subscriptions
   */
  async bulkApproveSubscriptions(
    request: BulkApprovalRequest,
    approvalCallback: (requestId: string, adminId: string, notes?: string) => void,
    getRequestDetails: (requestId: string) => any
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      operationType: 'approve',
      totalRequests: request.requestIds.length,
      successCount: 0,
      failureCount: 0,
      timestamp: Date.now(),
      details: [],
    };

    for (const requestId of request.requestIds) {
      try {
        const requestDetails = getRequestDetails(requestId);
        if (!requestDetails) {
          throw new Error('Request not found');
        }

        // Approve the request
        approvalCallback(requestId, request.adminId, request.notes);

        // Send approval email
        await emailNotificationService.sendApprovalEmail(
          requestDetails.userEmail || `${requestDetails.userId}@ltcfasttrack.local`,
          requestDetails.userName,
          requestId,
          requestDetails.subscriptionPlan,
          requestDetails.planPrice
        );

        result.successCount++;
        result.details.push({
          requestId,
          success: true,
          message: 'Approved and email sent',
        });
      } catch (error) {
        result.failureCount++;
        result.details.push({
          requestId,
          success: false,
          message: `Error: ${error}`,
        });
      }
    }

    this.bulkOperationHistory.push(result);
    return result;
  }

  /**
   * Bulk reject subscriptions
   */
  async bulkRejectSubscriptions(
    request: BulkRejectionRequest,
    rejectionCallback: (requestId: string, adminId: string, reason: string) => void,
    getRequestDetails: (requestId: string) => any
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      operationType: 'reject',
      totalRequests: request.requestIds.length,
      successCount: 0,
      failureCount: 0,
      timestamp: Date.now(),
      details: [],
    };

    for (const requestId of request.requestIds) {
      try {
        const requestDetails = getRequestDetails(requestId);
        if (!requestDetails) {
          throw new Error('Request not found');
        }

        // Reject the request
        rejectionCallback(requestId, request.adminId, request.reason);

        // Send rejection email
        await emailNotificationService.sendRejectionEmail(
          requestDetails.userEmail || `${requestDetails.userId}@ltcfasttrack.local`,
          requestDetails.userName,
          requestId,
          request.reason
        );

        result.successCount++;
        result.details.push({
          requestId,
          success: true,
          message: 'Rejected and email sent',
        });
      } catch (error) {
        result.failureCount++;
        result.details.push({
          requestId,
          success: false,
          message: `Error: ${error}`,
        });
      }
    }

    this.bulkOperationHistory.push(result);
    return result;
  }

  /**
   * Auto-approve verified payments
   */
  async autoApproveVerifiedPayments(
    approvalCallback: (requestId: string, adminId: string, notes?: string) => void,
    getRequestDetails: (requestId: string) => any
  ): Promise<BulkOperationResult> {
    const verifiedRequestIds = paymentVerificationService.getAutoApprovalCandidates();

    const result: BulkOperationResult = {
      operationType: 'approve',
      totalRequests: verifiedRequestIds.length,
      successCount: 0,
      failureCount: 0,
      timestamp: Date.now(),
      details: [],
    };

    for (const requestId of verifiedRequestIds) {
      try {
        const requestDetails = getRequestDetails(requestId);
        if (!requestDetails) {
          throw new Error('Request not found');
        }

        // Auto-approve
        approvalCallback(requestId, 'system', 'Auto-approved due to verified payment');

        // Send approval email
        await emailNotificationService.sendApprovalEmail(
          requestDetails.userEmail || `${requestDetails.userId}@ltcfasttrack.local`,
          requestDetails.userName,
          requestId,
          requestDetails.subscriptionPlan,
          requestDetails.planPrice
        );

        result.successCount++;
        result.details.push({
          requestId,
          success: true,
          message: 'Auto-approved (verified payment)',
        });
      } catch (error) {
        result.failureCount++;
        result.details.push({
          requestId,
          success: false,
          message: `Error: ${error}`,
        });
      }
    }

    this.bulkOperationHistory.push(result);
    return result;
  }

  /**
   * Auto-reject failed payments
   */
  async autoRejectFailedPayments(
    rejectionCallback: (requestId: string, adminId: string, reason: string) => void,
    getRequestDetails: (requestId: string) => any
  ): Promise<BulkOperationResult> {
    const failedRequestIds = paymentVerificationService.getAutoRejectionCandidates();

    const result: BulkOperationResult = {
      operationType: 'reject',
      totalRequests: failedRequestIds.length,
      successCount: 0,
      failureCount: 0,
      timestamp: Date.now(),
      details: [],
    };

    for (const requestId of failedRequestIds) {
      try {
        const requestDetails = getRequestDetails(requestId);
        if (!requestDetails) {
          throw new Error('Request not found');
        }

        // Auto-reject
        rejectionCallback(
          requestId,
          'system',
          'Payment verification failed - please resubmit with valid payment proof'
        );

        // Send rejection email
        await emailNotificationService.sendRejectionEmail(
          requestDetails.userEmail || `${requestDetails.userId}@ltcfasttrack.local`,
          requestDetails.userName,
          requestId,
          'Payment verification failed - please resubmit with valid payment proof'
        );

        result.successCount++;
        result.details.push({
          requestId,
          success: true,
          message: 'Auto-rejected (failed payment verification)',
        });
      } catch (error) {
        result.failureCount++;
        result.details.push({
          requestId,
          success: false,
          message: `Error: ${error}`,
        });
      }
    }

    this.bulkOperationHistory.push(result);
    return result;
  }

  /**
   * Get bulk operation history
   */
  getBulkOperationHistory(): BulkOperationResult[] {
    return this.bulkOperationHistory;
  }

  /**
   * Get bulk operation statistics
   */
  getBulkOperationStats() {
    const totalOperations = this.bulkOperationHistory.length;
    const totalRequests = this.bulkOperationHistory.reduce(
      (sum, op) => sum + op.totalRequests,
      0
    );
    const totalSuccesses = this.bulkOperationHistory.reduce(
      (sum, op) => sum + op.successCount,
      0
    );
    const totalFailures = this.bulkOperationHistory.reduce(
      (sum, op) => sum + op.failureCount,
      0
    );

    return {
      totalOperations,
      totalRequests,
      totalSuccesses,
      totalFailures,
      successRate: totalRequests > 0 ? (totalSuccesses / totalRequests) * 100 : 0,
      approvals: this.bulkOperationHistory.filter(op => op.operationType === 'approve').length,
      rejections: this.bulkOperationHistory.filter(op => op.operationType === 'reject').length,
    };
  }

  /**
   * Check payment status for request
   */
  isPaymentVerified(requestId: string): boolean {
    return paymentVerificationService.isPaymentVerified(requestId);
  }

  /**
   * Get payment details for request
   */
  getPaymentDetails(requestId: string) {
    return paymentVerificationService.getPaymentByRequestId(requestId);
  }

  /**
   * Get payment statistics
   */
  getPaymentStatistics() {
    return paymentVerificationService.getStatistics();
  }

  /**
   * Get email notification statistics
   */
  getEmailStatistics() {
    return emailNotificationService.getStatistics();
  }

  /**
   * Verify payment for request
   */
  verifyPaymentForRequest(requestId: string, paymentId: string, adminId: string) {
    const result = paymentVerificationService.verifyPayment(paymentId, adminId);
    return result;
  }

  /**
   * Get auto-approval candidates
   */
  getAutoApprovalCandidates(): string[] {
    return paymentVerificationService.getAutoApprovalCandidates();
  }

  /**
   * Get auto-rejection candidates
   */
  getAutoRejectionCandidates(): string[] {
    return paymentVerificationService.getAutoRejectionCandidates();
  }
}

// Create singleton instance
export const subscriptionApprovalEnhanced = new SubscriptionApprovalEnhanced();
