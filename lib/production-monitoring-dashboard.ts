/**
 * Production Monitoring Dashboard
 * Real-time monitoring and analytics for production systems
 */

export interface ServerMetrics {
  serverId: string;
  serverName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  cpu: {
    usage: number; // percentage
    cores: number;
    threshold: number;
  };
  memory: {
    usage: number; // percentage
    total: number; // GB
    available: number; // GB
    threshold: number;
  };
  disk: {
    usage: number; // percentage
    total: number; // GB
    available: number; // GB
    threshold: number;
  };
  network: {
    inbound: number; // Mbps
    outbound: number; // Mbps
    latency: number; // ms
  };
  uptime: number; // percentage
  lastUpdated: number;
}

export interface PaymentMetrics {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  pendingTransactions: number;
  successRate: number; // percentage
  averageProcessingTime: number; // ms
  totalRevenue: number;
  revenueByMethod: {
    method: string;
    amount: number;
    count: number;
  }[];
  topFailureReasons: {
    reason: string;
    count: number;
  }[];
}

export interface UserActivityMetrics {
  activeUsers: number;
  newUsersToday: number;
  totalUsers: number;
  usersByRole: {
    role: string;
    count: number;
  }[];
  sessionMetrics: {
    averageSessionDuration: number; // seconds
    totalSessions: number;
    sessionsToday: number;
  };
  topFeatures: {
    feature: string;
    usageCount: number;
  }[];
}

export interface SystemAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  affectedComponent: string;
  suggestedAction?: string;
}

export interface MetricsSnapshot {
  timestamp: number;
  servers: ServerMetrics[];
  payments: PaymentMetrics;
  userActivity: UserActivityMetrics;
  alerts: SystemAlert[];
  systemHealth: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    score: number; // 0-100
  };
}

export class ProductionMonitoringDashboard {
  private metricsHistory: MetricsSnapshot[] = [];
  private alerts: Map<string, SystemAlert> = new Map();
  private currentMetrics: MetricsSnapshot | null = null;

  constructor() {
    this.initializeSampleMetrics();
  }

  /**
   * Initialize sample metrics
   */
  private initializeSampleMetrics(): void {
    const snapshot: MetricsSnapshot = {
      timestamp: Date.now(),
      servers: [
        {
          serverId: 'app-1',
          serverName: 'Application Server 1',
          status: 'healthy',
          cpu: { usage: 35, cores: 8, threshold: 80 },
          memory: { usage: 62, total: 32, available: 12, threshold: 85 },
          disk: { usage: 45, total: 500, available: 275, threshold: 90 },
          network: { inbound: 250, outbound: 180, latency: 2 },
          uptime: 99.98,
          lastUpdated: Date.now(),
        },
        {
          serverId: 'api-1',
          serverName: 'API Server 1',
          status: 'healthy',
          cpu: { usage: 42, cores: 8, threshold: 80 },
          memory: { usage: 58, total: 32, available: 13.4, threshold: 85 },
          disk: { usage: 38, total: 500, available: 310, threshold: 90 },
          network: { inbound: 320, outbound: 280, latency: 3 },
          uptime: 99.99,
          lastUpdated: Date.now(),
        },
      ],
      payments: {
        totalTransactions: 1250,
        successfulTransactions: 1187,
        failedTransactions: 45,
        pendingTransactions: 18,
        successRate: 94.96,
        averageProcessingTime: 2500,
        totalRevenue: 225000,
        revenueByMethod: [
          { method: 'MTN Mobile Money', amount: 125000, count: 650 },
          { method: 'Airtel Mobile Money', amount: 75000, count: 390 },
          { method: 'Bank Transfer', amount: 25000, count: 130 },
        ],
        topFailureReasons: [
          { reason: 'Insufficient Funds', count: 25 },
          { reason: 'Network Timeout', count: 12 },
          { reason: 'Invalid Account', count: 8 },
        ],
      },
      userActivity: {
        activeUsers: 342,
        newUsersToday: 28,
        totalUsers: 5420,
        usersByRole: [
          { role: 'Residential', count: 3200 },
          { role: 'Commercial', count: 1100 },
          { role: 'Collector', count: 850 },
          { role: 'Recycler', count: 270 },
        ],
        sessionMetrics: {
          averageSessionDuration: 1200,
          totalSessions: 8500,
          sessionsToday: 342,
        },
        topFeatures: [
          { feature: 'Schedule Pickup', usageCount: 450 },
          { feature: 'View History', usageCount: 380 },
          { feature: 'Make Payment', usageCount: 320 },
          { feature: 'Track Pickup', usageCount: 280 },
        ],
      },
      alerts: [],
      systemHealth: {
        status: 'healthy',
        score: 98,
      },
    };

    this.currentMetrics = snapshot;
    this.metricsHistory.push(snapshot);
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): MetricsSnapshot | null {
    return this.currentMetrics;
  }

  /**
   * Update metrics
   */
  updateMetrics(snapshot: Partial<MetricsSnapshot>): void {
    if (!this.currentMetrics) {
      this.currentMetrics = {
        timestamp: Date.now(),
        servers: [],
        payments: {
          totalTransactions: 0,
          successfulTransactions: 0,
          failedTransactions: 0,
          pendingTransactions: 0,
          successRate: 0,
          averageProcessingTime: 0,
          totalRevenue: 0,
          revenueByMethod: [],
          topFailureReasons: [],
        },
        userActivity: {
          activeUsers: 0,
          newUsersToday: 0,
          totalUsers: 0,
          usersByRole: [],
          sessionMetrics: {
            averageSessionDuration: 0,
            totalSessions: 0,
            sessionsToday: 0,
          },
          topFeatures: [],
        },
        alerts: [],
        systemHealth: {
          status: 'healthy',
          score: 100,
        },
      };
    }

    Object.assign(this.currentMetrics, snapshot);
    this.currentMetrics.timestamp = Date.now();

    // Keep history (last 24 hours)
    this.metricsHistory.push(this.currentMetrics);
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.metricsHistory = this.metricsHistory.filter((m) => m.timestamp > oneDayAgo);
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(hours: number = 24): MetricsSnapshot[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.metricsHistory.filter((m) => m.timestamp > cutoff);
  }

  /**
   * Get server metrics
   */
  getServerMetrics(serverId?: string): ServerMetrics[] {
    if (!this.currentMetrics) return [];

    if (serverId) {
      return this.currentMetrics.servers.filter((s) => s.serverId === serverId);
    }

    return this.currentMetrics.servers;
  }

  /**
   * Get payment metrics
   */
  getPaymentMetrics(): PaymentMetrics | null {
    return this.currentMetrics?.payments || null;
  }

  /**
   * Get user activity metrics
   */
  getUserActivityMetrics(): UserActivityMetrics | null {
    return this.currentMetrics?.userActivity || null;
  }

  /**
   * Create alert
   */
  createAlert(alert: Omit<SystemAlert, 'id' | 'timestamp' | 'resolved' | 'resolvedAt'>): SystemAlert {
    const newAlert: SystemAlert = {
      ...alert,
      id: `alert-${Date.now()}`,
      timestamp: Date.now(),
      resolved: false,
    };

    this.alerts.set(newAlert.id, newAlert);

    // Add to current metrics
    if (this.currentMetrics) {
      this.currentMetrics.alerts.push(newAlert);
    }

    return newAlert;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.resolved = true;
    alert.resolvedAt = Date.now();

    return true;
  }

  /**
   * Get alerts
   */
  getAlerts(resolved?: boolean): SystemAlert[] {
    let alerts = Array.from(this.alerts.values());

    if (resolved !== undefined) {
      alerts = alerts.filter((a) => a.resolved === resolved);
    }

    return alerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): SystemAlert[] {
    return this.getAlerts(false);
  }

  /**
   * Get alert count by severity
   */
  getAlertCountBySeverity(): {
    critical: number;
    warning: number;
    info: number;
  } {
    const alerts = this.getActiveAlerts();

    return {
      critical: alerts.filter((a) => a.severity === 'critical').length,
      warning: alerts.filter((a) => a.severity === 'warning').length,
      info: alerts.filter((a) => a.severity === 'info').length,
    };
  }

  /**
   * Get system health score
   */
  getSystemHealthScore(): number {
    if (!this.currentMetrics) return 0;

    let score = 100;

    // Deduct for unhealthy servers
    const unhealthyServers = this.currentMetrics.servers.filter((s) => s.status !== 'healthy').length;
    score -= unhealthyServers * 15;

    // Deduct for low payment success rate
    if (this.currentMetrics.payments.successRate < 95) {
      score -= 10;
    }

    // Deduct for active critical alerts
    const criticalAlerts = this.currentMetrics.alerts.filter((a) => a.severity === 'critical' && !a.resolved).length;
    score -= criticalAlerts * 20;

    return Math.max(0, score);
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(hours: number = 24): {
    metric: string;
    trend: 'up' | 'down' | 'stable';
    change: number; // percentage
  }[] {
    const history = this.getMetricsHistory(hours);
    if (history.length < 2) return [];

    const latest = history[history.length - 1];
    const oldest = history[0];

    const trends = [];

    // CPU usage trend
    if (latest.servers.length > 0 && oldest.servers.length > 0) {
      const latestCpu = latest.servers.reduce((sum, s) => sum + s.cpu.usage, 0) / latest.servers.length;
      const oldestCpu = oldest.servers.reduce((sum, s) => sum + s.cpu.usage, 0) / oldest.servers.length;
      const cpuChange = ((latestCpu - oldestCpu) / oldestCpu) * 100;

      trends.push({
        metric: 'CPU Usage',
        trend: (cpuChange > 5 ? 'up' : cpuChange < -5 ? 'down' : 'stable') as 'up' | 'down' | 'stable',
        change: cpuChange,
      });
    }

    // Payment success rate trend
    const latestSuccessRate = latest.payments.successRate;
    const oldestSuccessRate = oldest.payments.successRate;
    const successChange = latestSuccessRate - oldestSuccessRate;

    trends.push({
      metric: 'Payment Success Rate',
      trend: (successChange > 1 ? 'up' : successChange < -1 ? 'down' : 'stable') as 'up' | 'down' | 'stable',
      change: successChange,
    });

    // Active users trend
    const latestActiveUsers = latest.userActivity.activeUsers;
    const oldestActiveUsers = oldest.userActivity.activeUsers;
    const usersChange = ((latestActiveUsers - oldestActiveUsers) / oldestActiveUsers) * 100;

    trends.push({
      metric: 'Active Users',
      trend: (usersChange > 5 ? 'up' : usersChange < -5 ? 'down' : 'stable') as 'up' | 'down' | 'stable',
      change: usersChange,
    });

    return trends;
  }

  /**
   * Get dashboard summary
   */
  getDashboardSummary(): {
    systemHealth: string;
    healthScore: number;
    activeAlerts: number;
    criticalAlerts: number;
    serverStatus: { healthy: number; degraded: number; unhealthy: number };
    paymentMetrics: {
      successRate: number;
      totalRevenue: number;
      failedTransactions: number;
    };
    userMetrics: {
      activeUsers: number;
      newUsersToday: number;
      totalUsers: number;
    };
  } {
    if (!this.currentMetrics) {
      return {
        systemHealth: 'unknown',
        healthScore: 0,
        activeAlerts: 0,
        criticalAlerts: 0,
        serverStatus: { healthy: 0, degraded: 0, unhealthy: 0 },
        paymentMetrics: { successRate: 0, totalRevenue: 0, failedTransactions: 0 },
        userMetrics: { activeUsers: 0, newUsersToday: 0, totalUsers: 0 },
      };
    }

    const healthScore = this.getSystemHealthScore();
    const activeAlerts = this.getActiveAlerts();
    const alertCounts = this.getAlertCountBySeverity();

    const serverStatus = {
      healthy: this.currentMetrics.servers.filter((s) => s.status === 'healthy').length,
      degraded: this.currentMetrics.servers.filter((s) => s.status === 'degraded').length,
      unhealthy: this.currentMetrics.servers.filter((s) => s.status === 'unhealthy').length,
    };

    return {
      systemHealth: this.currentMetrics.systemHealth.status,
      healthScore,
      activeAlerts: activeAlerts.length,
      criticalAlerts: alertCounts.critical,
      serverStatus,
      paymentMetrics: {
        successRate: this.currentMetrics.payments.successRate,
        totalRevenue: this.currentMetrics.payments.totalRevenue,
        failedTransactions: this.currentMetrics.payments.failedTransactions,
      },
      userMetrics: {
        activeUsers: this.currentMetrics.userActivity.activeUsers,
        newUsersToday: this.currentMetrics.userActivity.newUsersToday,
        totalUsers: this.currentMetrics.userActivity.totalUsers,
      },
    };
  }

  /**
   * Get monitoring recommendations
   */
  getMonitoringRecommendations(): {
    priority: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    affectedMetric: string;
  }[] {
    const recommendations: {
      priority: 'critical' | 'high' | 'medium' | 'low';
      title: string;
      description: string;
      affectedMetric: string;
    }[] = [];
    const summary = this.getDashboardSummary();

    if (summary.criticalAlerts > 0) {
      recommendations.push({
        priority: 'critical' as const,
        title: 'Critical Alerts Require Attention',
        description: `There are ${summary.criticalAlerts} critical alerts that need immediate investigation`,
        affectedMetric: 'System Health',
      });
    }

    if (summary.paymentMetrics.successRate < 95) {
      recommendations.push({
        priority: 'high' as const,
        title: 'Payment Success Rate Below Target',
        description: `Payment success rate is ${summary.paymentMetrics.successRate.toFixed(2)}%, target is 95%+`,
        affectedMetric: 'Payment Processing',
      });
    }

    if (summary.serverStatus.unhealthy > 0) {
      recommendations.push({
        priority: 'high' as const,
        title: 'Unhealthy Servers Detected',
        description: `${summary.serverStatus.unhealthy} server(s) are unhealthy and need attention`,
        affectedMetric: 'Server Health',
      });
    }

    if (summary.userMetrics.activeUsers > 500) {
      recommendations.push({
        priority: 'medium' as const,
        title: 'Monitor Scaling',
        description: 'High number of active users - monitor system performance and consider scaling',
        affectedMetric: 'User Activity',
      });
    }

    return recommendations;
  }
}

export const productionMonitoringDashboard = new ProductionMonitoringDashboard();
