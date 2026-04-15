/**
 * Mock Data Setup for Testing
 * Creates realistic test data for all user types and workflows
 */

export interface MockUser {
  id: string;
  email: string;
  password: string;
  name: string;
  phone: string;
  userType: 'residential' | 'collector' | 'recycler' | 'admin';
  role?: 'superadmin' | 'finance_admin' | 'support_admin';
  status: 'active' | 'pending' | 'inactive';
}

export interface MockPickup {
  id: string;
  userId: string;
  collectorId?: string;
  location: { lat: number; lng: number };
  description: string;
  status: 'requested' | 'assigned' | 'completed' | 'cancelled';
  scheduledTime: number;
  completedTime?: number;
  rating?: number;
}

export interface MockPayment {
  id: string;
  userId: string;
  amount: number;
  type: 'subscription' | 'affiliation_fee';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  method: 'mtn' | 'airtel' | 'bank' | 'card';
  createdAt: number;
  completedAt?: number;
}

export class MockDataSetup {
  /**
   * Create residential users for testing
   */
  static createResidentialUsers(count: number = 5): MockUser[] {
    const users: MockUser[] = [];

    for (let i = 1; i <= count; i++) {
      users.push({
        id: `residential-${i}`,
        email: `residential${i}@test.com`,
        password: 'TestPassword123!',
        name: `Residential User ${i}`,
        phone: `+26096000000${i}`,
        userType: 'residential',
        status: 'active',
      });
    }

    return users;
  }

  /**
   * Create collector users for testing
   */
  static createCollectorUsers(count: number = 5): MockUser[] {
    const users: MockUser[] = [];
    const businesses = [
      'Green Waste Solutions',
      'Eco Collectors Ltd',
      'Waste Management Pro',
      'Sustainable Recycling',
      'Clean City Services',
    ];

    for (let i = 1; i <= count; i++) {
      users.push({
        id: `collector-${i}`,
        email: `collector${i}@test.com`,
        password: 'TestPassword123!',
        name: businesses[i - 1] || `Collector ${i}`,
        phone: `+26097000000${i}`,
        userType: 'collector',
        status: i <= 3 ? 'active' : 'pending',
      });
    }

    return users;
  }

  /**
   * Create recycling company users for testing
   */
  static createRecyclerUsers(count: number = 3): MockUser[] {
    const users: MockUser[] = [];
    const companies = [
      'Zambia Recycling Corp',
      'EcoWaste Industries',
      'Green Future Ltd',
    ];

    for (let i = 1; i <= count; i++) {
      users.push({
        id: `recycler-${i}`,
        email: `recycler${i}@test.com`,
        password: 'TestPassword123!',
        name: companies[i - 1] || `Recycler ${i}`,
        phone: `+26098000000${i}`,
        userType: 'recycler',
        status: 'active',
      });
    }

    return users;
  }

  /**
   * Create admin users for testing
   */
  static createAdminUsers(): MockUser[] {
    return [
      {
        id: 'admin-superadmin',
        email: 'superadmin@ltcfasttrack.com',
        password: 'SuperAdmin123!',
        name: 'Super Admin',
        phone: '+260960819993',
        userType: 'admin',
        role: 'superadmin',
        status: 'active',
      },
      {
        id: 'admin-finance',
        email: 'finance@ltcfasttrack.com',
        password: 'Finance123!',
        name: 'Finance Admin',
        phone: '+260960819994',
        userType: 'admin',
        role: 'finance_admin',
        status: 'active',
      },
      {
        id: 'admin-support',
        email: 'support@ltcfasttrack.com',
        password: 'Support123!',
        name: 'Support Admin',
        phone: '+260960819995',
        userType: 'admin',
        role: 'support_admin',
        status: 'active',
      },
    ];
  }

  /**
   * Create pickup requests for testing
   */
  static createPickupRequests(count: number = 10): MockPickup[] {
    const pickups: MockPickup[] = [];
    const descriptions = [
      'Household waste - mixed items',
      'Garden waste - leaves and branches',
      'Plastic bottles and containers',
      'Paper and cardboard',
      'Metal cans and aluminum',
      'Glass bottles',
      'Electronic waste - old phone',
      'Textile waste - old clothes',
      'Food waste - organic',
      'Construction debris - small',
    ];

    const locations = [
      { lat: -10.8168, lng: 34.7669 }, // Lusaka CBD
      { lat: -10.8234, lng: 34.7654 }, // Lusaka North
      { lat: -10.8301, lng: 34.7789 }, // Lusaka East
      { lat: -10.8089, lng: 34.7456 }, // Lusaka South
      { lat: -10.8167, lng: 34.7523 }, // Lusaka West
    ];

    for (let i = 1; i <= count; i++) {
      const status = i % 4 === 0 ? 'completed' : i % 3 === 0 ? 'assigned' : 'requested';

      pickups.push({
        id: `pickup-${i}`,
        userId: `residential-${((i - 1) % 5) + 1}`,
        collectorId: status !== 'requested' ? `collector-${((i - 1) % 5) + 1}` : undefined,
        location: locations[(i - 1) % locations.length],
        description: descriptions[(i - 1) % descriptions.length],
        status: status as any,
        scheduledTime: Date.now() + i * 3600000,
        completedTime: status === 'completed' ? Date.now() + i * 3600000 + 1800000 : undefined,
        rating: status === 'completed' ? 4 + Math.random() : undefined,
      });
    }

    return pickups;
  }

  /**
   * Create payment records for testing
   */
  static createPayments(count: number = 20): MockPayment[] {
    const payments: MockPayment[] = [];
    const methods: Array<'mtn' | 'airtel' | 'bank' | 'card'> = ['mtn', 'airtel', 'bank', 'card'];

    for (let i = 1; i <= count; i++) {
      const userType = i % 3 === 0 ? 'collector' : 'residential';
      const type = userType === 'collector' ? 'affiliation_fee' : 'subscription';
      const amount = type === 'affiliation_fee' ? 50 : 180;
      const status = i % 5 === 0 ? 'failed' : i % 4 === 0 ? 'pending' : 'completed';

      payments.push({
        id: `payment-${i}`,
        userId: `${userType}-${((i - 1) % 5) + 1}`,
        amount,
        type: type as any,
        status: status as any,
        method: methods[(i - 1) % methods.length],
        createdAt: Date.now() - i * 86400000,
        completedAt: status === 'completed' ? Date.now() - i * 86400000 + 300000 : undefined,
      });
    }

    return payments;
  }

  /**
   * Get all test data
   */
  static getAllTestData() {
    return {
      residentialUsers: this.createResidentialUsers(5),
      collectorUsers: this.createCollectorUsers(5),
      recyclerUsers: this.createRecyclerUsers(3),
      adminUsers: this.createAdminUsers(),
      pickups: this.createPickupRequests(10),
      payments: this.createPayments(20),
    };
  }

  /**
   * Get login credentials for testing
   */
  static getTestCredentials() {
    return {
      residential: {
        email: 'residential1@test.com',
        password: 'TestPassword123!',
        name: 'Residential User 1',
      },
      collector: {
        email: 'collector1@test.com',
        password: 'TestPassword123!',
        name: 'Green Waste Solutions',
      },
      recycler: {
        email: 'recycler1@test.com',
        password: 'TestPassword123!',
        name: 'Zambia Recycling Corp',
      },
      superadmin: {
        email: 'superadmin@ltcfasttrack.com',
        password: 'SuperAdmin123!',
        name: 'Super Admin',
      },
      financeAdmin: {
        email: 'finance@ltcfasttrack.com',
        password: 'Finance123!',
        name: 'Finance Admin',
      },
    };
  }

  /**
   * Get realistic test scenarios
   */
  static getTestScenarios() {
    return {
      userRegistration: {
        name: 'User Registration Flow',
        steps: [
          'Navigate to Create Account',
          'Enter email: residential1@test.com',
          'Enter password: TestPassword123!',
          'Select Residential user type',
          'Accept terms and conditions',
          'Submit registration',
          'Verify confirmation email',
          'Click email verification link',
          'Login with credentials',
        ],
      },
      subscriptionPayment: {
        name: 'Subscription Payment Flow',
        steps: [
          'Login as residential user',
          'Navigate to Subscriptions',
          'Select Premium plan (K180)',
          'Click Subscribe',
          'Select MTN Mobile Money',
          'Enter phone: +260960000001',
          'Confirm payment',
          'Verify payment confirmation',
          'Check subscription activated',
        ],
      },
      collectorRegistration: {
        name: 'Collector Registration & Approval',
        steps: [
          'Navigate to Collector Registration',
          'Fill business details',
          'Upload registration document',
          'Pay affiliation fee (K50)',
          'Wait for admin approval',
          'Login as superadmin',
          'Navigate to Approvals',
          'Approve collector registration',
          'Verify collector account activated',
        ],
      },
      pickupRequest: {
        name: 'Garbage Pickup Request',
        steps: [
          'Login as residential user',
          'Navigate to Request Pickup',
          'Pin garbage location on map',
          'Enter description: Household waste',
          'Upload 2-3 garbage photos',
          'Select pickup date/time',
          'Submit request',
          'Wait for collector assignment',
          'Track collector on map',
          'Rate collector after pickup',
        ],
      },
      paymentRetry: {
        name: 'Payment Retry Scenario',
        steps: [
          'Initiate payment',
          'Simulate payment failure',
          'Verify retry scheduled',
          'Check retry notification sent',
          'Wait for retry attempt',
          'Simulate successful retry',
          'Verify payment completed',
          'Check retry history in admin',
        ],
      },
    };
  }

  /**
   * Get performance test parameters
   */
  static getPerformanceTestParams() {
    return {
      concurrentUsers: [10, 50, 100],
      requestsPerSecond: 100,
      testDuration: 300, // 5 minutes
      endpoints: [
        '/api/auth/login',
        '/api/pickups/list',
        '/api/payments/history',
        '/api/admin/approvals',
      ],
      expectedResponseTimes: {
        login: 2000, // 2 seconds
        pageLoad: 3000, // 3 seconds
        apiCall: 1000, // 1 second
        payment: 5000, // 5 seconds
      },
    };
  }

  /**
   * Get security test cases
   */
  static getSecurityTestCases() {
    return {
      sqlInjection: [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
      ],
      xssAttacks: [
        '<script>alert("XSS")</script>',
        '<img src=x onerror="alert(\'XSS\')">',
        'javascript:alert("XSS")',
      ],
      invalidInputs: [
        { email: 'invalid-email', password: 'test' },
        { email: 'test@example.com', password: '123' }, // Too short
        { email: '', password: 'TestPassword123!' }, // Empty email
        { phone: 'invalid-phone', amount: 'not-a-number' },
      ],
    };
  }

  /**
   * Get compatibility test devices
   */
  static getCompatibilityTestDevices() {
    return {
      ios: [
        { device: 'iPhone 14 Pro', os: 'iOS 17', screenSize: '6.1"' },
        { device: 'iPhone 13', os: 'iOS 16', screenSize: '6.1"' },
        { device: 'iPhone 12', os: 'iOS 15', screenSize: '6.1"' },
        { device: 'iPhone 8', os: 'iOS 14', screenSize: '4.7"' },
      ],
      android: [
        { device: 'Samsung Galaxy S23', os: 'Android 13', screenSize: '6.1"' },
        { device: 'Samsung Galaxy S21', os: 'Android 12', screenSize: '6.2"' },
        { device: 'Xiaomi 12', os: 'Android 12', screenSize: '6.28"' },
        { device: 'Samsung Galaxy A12', os: 'Android 11', screenSize: '6.5"' },
      ],
      browsers: [
        { browser: 'Chrome', version: 'Latest' },
        { browser: 'Firefox', version: 'Latest' },
        { browser: 'Safari', version: 'Latest' },
        { browser: 'Edge', version: 'Latest' },
      ],
    };
  }
}

// Export singleton instance
export const mockDataSetup = new MockDataSetup();
