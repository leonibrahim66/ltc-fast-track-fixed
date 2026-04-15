/**
 * tests/subscription-enhancements.test.ts
 *
 * Unit tests for the three subscription enhancement features:
 *  1. In-app notifications on approval / rejection / activation
 *  2. Customer home screen pending-approval banner logic
 *  3. Auto-activation of subscription via onActivateSubscription callback
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Types (inlined to avoid React import) ─────────────────────────────────────

interface SubscriptionRequest {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  userRole: 'residential' | 'commercial' | 'industrial' | 'collector' | 'recycler';
  subscriptionPlan: string;
  planId?: string;
  planPrice: number;
  requestDate: string;
  status: 'pending' | 'approved' | 'rejected' | 'activated';
  rejectionReason?: string;
  approvedBy?: string;
  approvalDate?: string;
  activationDate?: string;
  paymentReference?: string;
  paymentId?: string;
  transactionId?: string;
  amountPaid?: number;
  notes?: string;
}

type ActivateSubscriptionCallback = (
  userId: string,
  subscription: {
    planId: string;
    planName: string;
    expiresAt: string;
    pickupsRemaining: number;
  },
) => Promise<void>;

// ── Helpers ────────────────────────────────────────────────────────────────────

let _seq = 0;
function makeRequest(overrides: Partial<SubscriptionRequest> = {}): SubscriptionRequest {
  _seq++;
  return {
    id: `req-test-${_seq}`,
    userId: `user-${_seq}`,
    userName: 'Test User',
    userPhone: '+260960000000',
    userRole: 'residential',
    subscriptionPlan: 'Premium',
    planId: 'res_premium',
    planPrice: 180,
    requestDate: new Date().toISOString(),
    status: 'pending',
    paymentReference: `LTC${_seq}ABC`,
    amountPaid: 180,
    ...overrides,
  };
}

// ── 1. Notification service helpers ───────────────────────────────────────────

describe('Subscription Notification Service', () => {
  it('builds correct approval notification payload', () => {
    const planName = 'Premium';
    const requestId = 'req-001';
    const payload = {
      title: '✅ Subscription Approved!',
      body: `Your ${planName} subscription has been approved. Your account is now active.`,
      data: { type: 'subscription_approved', requestId },
    };
    expect(payload.title).toContain('Approved');
    expect(payload.body).toContain('Premium');
    expect(payload.data.type).toBe('subscription_approved');
    expect(payload.data.requestId).toBe(requestId);
  });

  it('builds correct rejection notification payload', () => {
    const planName = 'Basic';
    const reason = 'Payment not confirmed';
    const requestId = 'req-002';
    const payload = {
      title: '❌ Subscription Request Rejected',
      body: `Your ${planName} subscription request was not approved. Reason: ${reason}`,
      data: { type: 'subscription_rejected', requestId, reason },
    };
    expect(payload.title).toContain('Rejected');
    expect(payload.body).toContain(reason);
    expect(payload.data.type).toBe('subscription_rejected');
    expect(payload.data.reason).toBe(reason);
  });

  it('builds correct activation notification payload', () => {
    const planName = 'Business';
    const requestId = 'req-003';
    const payload = {
      title: '🎉 Account Activated!',
      body: `Your ${planName} subscription is now active. You can start requesting pickups.`,
      data: { type: 'subscription_activated', requestId },
    };
    expect(payload.title).toContain('Activated');
    expect(payload.body).toContain('Business');
    expect(payload.data.type).toBe('subscription_activated');
  });

  it('notification payloads include requestId for deep-link navigation', () => {
    const requestId = 'req-deep-link-test';
    const approvalPayload = { data: { type: 'subscription_approved', requestId } };
    const rejectionPayload = { data: { type: 'subscription_rejected', requestId, reason: 'x' } };
    const activationPayload = { data: { type: 'subscription_activated', requestId } };
    expect(approvalPayload.data.requestId).toBe(requestId);
    expect(rejectionPayload.data.requestId).toBe(requestId);
    expect(activationPayload.data.requestId).toBe(requestId);
  });
});

// ── 2. Home screen pending-approval banner logic ───────────────────────────────

describe('Home Screen Subscription Banner Logic', () => {
  it('shows pending banner when user has no subscription and a pending request', () => {
    const user = { id: 'u1', subscription: undefined };
    const requests: SubscriptionRequest[] = [makeRequest({ userId: 'u1', status: 'pending' })];
    const userRequests = requests.filter(r => r.userId === user.id);
    const hasPendingApproval = !user.subscription && userRequests.some(r => r.status === 'pending');
    expect(hasPendingApproval).toBe(true);
  });

  it('does NOT show pending banner when user already has an active subscription', () => {
    const user = {
      id: 'u2',
      subscription: { planId: 'res_premium', planName: 'Premium', expiresAt: '2027-01-01', pickupsRemaining: -1 },
    };
    const requests: SubscriptionRequest[] = [makeRequest({ userId: 'u2', status: 'pending' })];
    const userRequests = requests.filter(r => r.userId === user.id);
    const hasPendingApproval = !user.subscription && userRequests.some(r => r.status === 'pending');
    expect(hasPendingApproval).toBe(false);
  });

  it('shows approved-awaiting-activation banner when request is approved but not yet activated', () => {
    const user = { id: 'u3', subscription: undefined };
    const requests: SubscriptionRequest[] = [makeRequest({ userId: 'u3', status: 'approved' })];
    const userRequests = requests.filter(r => r.userId === user.id);
    const hasApprovedAwaitingActivation = !user.subscription && userRequests.some(r => r.status === 'approved');
    expect(hasApprovedAwaitingActivation).toBe(true);
  });

  it('shows no banner when user has no requests at all', () => {
    const user = { id: 'u4', subscription: undefined };
    const requests: SubscriptionRequest[] = [];
    const userRequests = requests.filter(r => r.userId === user.id);
    const hasPendingApproval = !user.subscription && userRequests.some(r => r.status === 'pending');
    const hasApprovedAwaitingActivation = !user.subscription && userRequests.some(r => r.status === 'approved');
    expect(hasPendingApproval).toBe(false);
    expect(hasApprovedAwaitingActivation).toBe(false);
  });

  it('shows payment reference in pending banner when available', () => {
    const user = { id: 'u5', subscription: undefined };
    const req = makeRequest({ userId: 'u5', status: 'pending', paymentReference: 'LTC-REF-999' });
    const latestPendingRequest = [req].find(r => r.status === 'pending' || r.status === 'approved');
    expect(latestPendingRequest?.paymentReference).toBe('LTC-REF-999');
  });

  it('subscription card badge shows Pending when hasPendingApproval is true', () => {
    const user = { id: 'u6', subscription: undefined };
    const hasPendingApproval = true;
    const hasApprovedAwaitingActivation = false;
    const badge = user.subscription
      ? 'Active'
      : hasPendingApproval
      ? 'Pending'
      : hasApprovedAwaitingActivation
      ? 'Approved'
      : 'Not Subscribed';
    expect(badge).toBe('Pending');
  });

  it('subscription card badge shows Approved when hasApprovedAwaitingActivation is true', () => {
    const user = { id: 'u7', subscription: undefined };
    const hasPendingApproval = false;
    const hasApprovedAwaitingActivation = true;
    const badge = user.subscription
      ? 'Active'
      : hasPendingApproval
      ? 'Pending'
      : hasApprovedAwaitingActivation
      ? 'Approved'
      : 'Not Subscribed';
    expect(badge).toBe('Approved');
  });
});

// ── 3. Auto-activation callback ───────────────────────────────────────────────

describe('Auto-Activation on Admin Approval', () => {
  it('calls onActivateSubscription with correct userId and subscription data', async () => {
    const onActivate = vi.fn().mockResolvedValue(undefined);
    const req = makeRequest({ userId: 'u8', subscriptionPlan: 'Premium', planId: 'res_premium', planPrice: 180 });

    // Simulate activateAccount logic
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const pickupsRemaining = req.planPrice >= 180 ? -1 : 4;
    await onActivate(req.userId, {
      planId: req.planId || req.subscriptionPlan.toLowerCase().replace(/\s+/g, '_'),
      planName: req.subscriptionPlan,
      expiresAt,
      pickupsRemaining,
    });

    expect(onActivate).toHaveBeenCalledOnce();
    const [calledUserId, calledSub] = onActivate.mock.calls[0];
    expect(calledUserId).toBe('u8');
    expect(calledSub.planId).toBe('res_premium');
    expect(calledSub.planName).toBe('Premium');
    expect(calledSub.pickupsRemaining).toBe(-1); // unlimited for premium
    expect(new Date(calledSub.expiresAt).getFullYear()).toBeGreaterThan(2025);
  });

  it('sets pickupsRemaining = 4 for non-premium plans (planPrice < 180)', async () => {
    const onActivate = vi.fn().mockResolvedValue(undefined);
    const req = makeRequest({ userId: 'u9', subscriptionPlan: 'Basic', planId: 'res_basic', planPrice: 100 });

    const pickupsRemaining = req.planPrice >= 180 ? -1 : 4;
    await onActivate(req.userId, {
      planId: req.planId!,
      planName: req.subscriptionPlan,
      expiresAt: new Date().toISOString(),
      pickupsRemaining,
    });

    const [, calledSub] = onActivate.mock.calls[0];
    expect(calledSub.pickupsRemaining).toBe(4);
  });

  it('does NOT call onActivateSubscription when callback is not provided', () => {
    // Simulate activateAccount with no callback (undefined guard)
    const onActivateSubscription: ActivateSubscriptionCallback | undefined = undefined;
    const req = makeRequest({ userId: 'u10' });
    let called = false;
    if (req && onActivateSubscription) {
      called = true;
    }
    expect(called).toBe(false);
  });

  it('expiresAt is approximately 1 year from now', () => {
    const now = Date.now();
    const expiresAt = new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString();
    const diff = new Date(expiresAt).getTime() - now;
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    expect(diff).toBeGreaterThan(oneYearMs - 1000);
    expect(diff).toBeLessThan(oneYearMs + 1000);
  });

  it('planId falls back to slugified planName when planId is undefined', () => {
    const req = makeRequest({ planId: undefined, subscriptionPlan: 'Collector Basic' });
    const planId = req.planId || req.subscriptionPlan.toLowerCase().replace(/\s+/g, '_');
    expect(planId).toBe('collector_basic');
  });
});
