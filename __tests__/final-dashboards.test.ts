import { describe, it, expect, beforeEach } from 'vitest';
import { AdminDeploymentDashboard } from '../lib/admin-deployment-dashboard';
import { DeploymentScheduler } from '../lib/deployment-scheduler';
import { ProductionMonitoringDashboard } from '../lib/production-monitoring-dashboard';

describe('Final Dashboard Features', () => {
  let deploymentDashboard: AdminDeploymentDashboard;
  let deploymentScheduler: DeploymentScheduler;
  let monitoringDashboard: ProductionMonitoringDashboard;

  beforeEach(() => {
    deploymentDashboard = new AdminDeploymentDashboard();
    deploymentScheduler = new DeploymentScheduler();
    monitoringDashboard = new ProductionMonitoringDashboard();
  });

  describe('Admin Deployment Dashboard', () => {
    it('should get dashboard metrics', () => {
      const metrics = deploymentDashboard.getDashboardMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.currentDeployment).toBeDefined();
      expect(metrics.recentDeployments).toBeDefined();
      expect(metrics.deploymentStats).toBeDefined();
      expect(metrics.systemHealth).toBeDefined();
    });

    it('should have deployment statistics', () => {
      const metrics = deploymentDashboard.getDashboardMetrics();

      expect(metrics.deploymentStats.totalDeployments).toBeGreaterThanOrEqual(0);
      expect(metrics.deploymentStats.successfulDeployments).toBeGreaterThanOrEqual(0);
      expect(metrics.deploymentStats.failedDeployments).toBeGreaterThanOrEqual(0);
      expect(metrics.deploymentStats.successRate).toBeGreaterThanOrEqual(0);
      expect(metrics.deploymentStats.successRate).toBeLessThanOrEqual(100);
    });

    it('should trigger deployment', async () => {
      const action = await deploymentDashboard.triggerDeployment('production', 'admin@ltcfasttrack.com');

      expect(action).toBeDefined();
      expect(action.type).toBe('deploy');
      expect(action.status).toBe('completed');
      expect(action.result?.success).toBe(true);
    });

    it('should trigger rollback', async () => {
      const action = await deploymentDashboard.triggerRollback('deploy-1', 'v1.0.0', 'admin@ltcfasttrack.com');

      expect(action).toBeDefined();
      expect(action.type).toBe('rollback');
      expect(action.status).toBe('completed');
      expect(action.result?.success).toBe(true);
    });

    it('should pause deployment', async () => {
      const action = await deploymentDashboard.pauseDeployment('deploy-1', 'admin@ltcfasttrack.com');

      expect(action).toBeDefined();
      expect(action.type).toBe('pause');
      expect(action.status).toBe('completed');
    });

    it('should resume deployment', async () => {
      const action = await deploymentDashboard.resumeDeployment('deploy-1', 'admin@ltcfasttrack.com');

      expect(action).toBeDefined();
      expect(action.type).toBe('resume');
      expect(action.status).toBe('completed');
    });

    it('should cancel deployment', async () => {
      const action = await deploymentDashboard.cancelDeployment('deploy-1', 'admin@ltcfasttrack.com');

      expect(action).toBeDefined();
      expect(action.type).toBe('cancel');
      expect(action.status).toBe('completed');
    });

    it('should get notifications', () => {
      const notifications = deploymentDashboard.getNotifications();

      expect(Array.isArray(notifications)).toBe(true);
    });

    it('should get deployment history', () => {
      const history = deploymentDashboard.getDeploymentHistory();

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThanOrEqual(0);
    });

    it('should get deployment readiness checklist', () => {
      const checklist = deploymentDashboard.getDeploymentReadinessChecklist();

      expect(Array.isArray(checklist)).toBe(true);
      expect(checklist.length).toBeGreaterThan(0);
      expect(checklist[0].items.length).toBeGreaterThan(0);
    });

    it('should get deployment recommendations', () => {
      const recommendations = deploymentDashboard.getDeploymentRecommendations();

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should get system health overview', () => {
      const health = deploymentDashboard.getSystemHealthOverview();

      expect(health).toBeDefined();
      expect(health.status).toMatch(/healthy|degraded|unhealthy/);
      expect(health.components.length).toBeGreaterThan(0);
    });
  });

  describe('Deployment Scheduler', () => {
    it('should create deployment schedule', () => {
      const schedule = deploymentScheduler.createSchedule({
        name: 'Test Schedule',
        environment: 'production',
        schedule: {
          type: 'weekly',
          dayOfWeek: 2,
          time: '02:00',
          timezone: 'UTC',
        },
        maintenanceWindow: {
          enabled: true,
          startTime: '02:00',
          endTime: '03:00',
          duration: 60,
        },
        rollbackPolicy: {
          enabled: true,
          autoRollbackOnFailure: true,
          maxRetries: 3,
          retryDelay: 5,
        },
        notifications: {
          enabled: true,
          channels: ['email'],
          recipients: ['admin@ltcfasttrack.com'],
          notifyBefore: 30,
          notifyOnCompletion: true,
        },
        status: 'active',
      });

      expect(schedule).toBeDefined();
      expect(schedule.id).toBeDefined();
      expect(schedule.name).toBe('Test Schedule');
      expect(schedule.status).toBe('active');
    });

    it('should get all schedules', () => {
      const schedules = deploymentScheduler.getAllSchedules();

      expect(Array.isArray(schedules)).toBe(true);
      expect(schedules.length).toBeGreaterThan(0);
    });

    it('should activate schedule', () => {
      const schedules = deploymentScheduler.getAllSchedules();
      const firstSchedule = schedules[0];

      const activated = deploymentScheduler.activateSchedule(firstSchedule.id);
      expect(activated).toBe(true);

      const retrieved = deploymentScheduler.getSchedule(firstSchedule.id);
      expect(retrieved?.status).toBe('active');
    });

    it('should deactivate schedule', () => {
      const schedules = deploymentScheduler.getAllSchedules();
      const firstSchedule = schedules[0];

      const deactivated = deploymentScheduler.deactivateSchedule(firstSchedule.id);
      expect(deactivated).toBe(true);

      const retrieved = deploymentScheduler.getSchedule(firstSchedule.id);
      expect(retrieved?.status).toBe('inactive');
    });

    it('should pause schedule', () => {
      const schedules = deploymentScheduler.getAllSchedules();
      const firstSchedule = schedules[0];

      const paused = deploymentScheduler.pauseSchedule(firstSchedule.id);
      expect(paused).toBe(true);

      const retrieved = deploymentScheduler.getSchedule(firstSchedule.id);
      expect(retrieved?.status).toBe('paused');
    });

    it('should resume schedule', () => {
      const schedules = deploymentScheduler.getAllSchedules();
      const firstSchedule = schedules[0];

      deploymentScheduler.pauseSchedule(firstSchedule.id);
      const resumed = deploymentScheduler.resumeSchedule(firstSchedule.id);
      expect(resumed).toBe(true);

      const retrieved = deploymentScheduler.getSchedule(firstSchedule.id);
      expect(retrieved?.status).toBe('active');
    });

    it('should execute scheduled deployment', async () => {
      const schedules = deploymentScheduler.getAllSchedules();
      const firstSchedule = schedules[0];

      const run = await deploymentScheduler.executeScheduledDeployment(firstSchedule.id);

      expect(run).toBeDefined();
      expect(run?.status).toBe('completed');
      expect(run?.result?.success).toBe(true);
    });

    it('should get upcoming deployments', () => {
      const upcoming = deploymentScheduler.getUpcomingDeployments();

      expect(Array.isArray(upcoming)).toBe(true);
    });

    it('should get deployment statistics', () => {
      const stats = deploymentScheduler.getDeploymentStatistics();

      expect(stats).toBeDefined();
      expect(stats.totalRuns).toBeGreaterThanOrEqual(0);
      expect(stats.successfulRuns).toBeGreaterThanOrEqual(0);
      expect(stats.failedRuns).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBeGreaterThanOrEqual(0);
    });

    it('should get scheduler status', () => {
      const status = deploymentScheduler.getSchedulerStatus();

      expect(status).toBeDefined();
      expect(status.activeSchedules).toBeGreaterThanOrEqual(0);
      expect(status.inactiveSchedules).toBeGreaterThanOrEqual(0);
      expect(status.upcomingDeployments).toBeGreaterThanOrEqual(0);
    });

    it('should get schedule recommendations', () => {
      const recommendations = deploymentScheduler.getScheduleRecommendations();

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Production Monitoring Dashboard', () => {
    it('should get current metrics', () => {
      const metrics = monitoringDashboard.getCurrentMetrics();

      expect(metrics).toBeDefined();
      expect(metrics?.servers).toBeDefined();
      expect(metrics?.payments).toBeDefined();
      expect(metrics?.userActivity).toBeDefined();
    });

    it('should get server metrics', () => {
      const metrics = monitoringDashboard.getServerMetrics();

      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should get payment metrics', () => {
      const metrics = monitoringDashboard.getPaymentMetrics();

      expect(metrics).toBeDefined();
      expect(metrics?.totalTransactions).toBeGreaterThanOrEqual(0);
      expect(metrics?.successRate).toBeGreaterThanOrEqual(0);
      expect(metrics?.successRate).toBeLessThanOrEqual(100);
    });

    it('should get user activity metrics', () => {
      const metrics = monitoringDashboard.getUserActivityMetrics();

      expect(metrics).toBeDefined();
      expect(metrics?.activeUsers).toBeGreaterThanOrEqual(0);
      expect(metrics?.totalUsers).toBeGreaterThanOrEqual(0);
    });

    it('should create alert', () => {
      const alert = monitoringDashboard.createAlert({
        severity: 'warning',
        title: 'Test Alert',
        message: 'This is a test alert',
        affectedComponent: 'test-component',
      });

      expect(alert).toBeDefined();
      expect(alert.id).toBeDefined();
      expect(alert.resolved).toBe(false);
    });

    it('should resolve alert', () => {
      const alert = monitoringDashboard.createAlert({
        severity: 'warning',
        title: 'Test Alert',
        message: 'This is a test alert',
        affectedComponent: 'test-component',
      });

      const resolved = monitoringDashboard.resolveAlert(alert.id);
      expect(resolved).toBe(true);

      const alerts = monitoringDashboard.getAlerts(true);
      expect(alerts.some((a) => a.id === alert.id)).toBe(true);
    });

    it('should get active alerts', () => {
      monitoringDashboard.createAlert({
        severity: 'critical',
        title: 'Critical Alert',
        message: 'This is critical',
        affectedComponent: 'critical-component',
      });

      const alerts = monitoringDashboard.getActiveAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should get alert count by severity', () => {
      const counts = monitoringDashboard.getAlertCountBySeverity();

      expect(counts).toBeDefined();
      expect(counts.critical).toBeGreaterThanOrEqual(0);
      expect(counts.warning).toBeGreaterThanOrEqual(0);
      expect(counts.info).toBeGreaterThanOrEqual(0);
    });

    it('should get system health score', () => {
      const score = monitoringDashboard.getSystemHealthScore();

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should get performance trends', () => {
      const trends = monitoringDashboard.getPerformanceTrends();

      expect(Array.isArray(trends)).toBe(true);
    });

    it('should get dashboard summary', () => {
      const summary = monitoringDashboard.getDashboardSummary();

      expect(summary).toBeDefined();
      expect(summary.systemHealth).toMatch(/healthy|degraded|unhealthy|unknown/);
      expect(summary.healthScore).toBeGreaterThanOrEqual(0);
      expect(summary.healthScore).toBeLessThanOrEqual(100);
      expect(summary.activeAlerts).toBeGreaterThanOrEqual(0);
      expect(summary.serverStatus).toBeDefined();
      expect(summary.paymentMetrics).toBeDefined();
      expect(summary.userMetrics).toBeDefined();
    });

    it('should get monitoring recommendations', () => {
      const recommendations = monitoringDashboard.getMonitoringRecommendations();

      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should get metrics history', () => {
      const history = monitoringDashboard.getMetricsHistory(24);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('Integration Tests', () => {
    it('should have all dashboards operational', () => {
      const deployMetrics = deploymentDashboard.getDashboardMetrics();
      const schedules = deploymentScheduler.getAllSchedules();
      const monitorMetrics = monitoringDashboard.getCurrentMetrics();

      expect(deployMetrics).toBeDefined();
      expect(schedules.length).toBeGreaterThan(0);
      expect(monitorMetrics).toBeDefined();
    });

    it('should support complete deployment workflow with monitoring', async () => {
      // 1. Check current system health
      const initialHealth = monitoringDashboard.getSystemHealthScore();
      expect(initialHealth).toBeGreaterThanOrEqual(0);

      // 2. Create deployment schedule
      const schedule = deploymentScheduler.createSchedule({
        name: 'Integration Test Schedule',
        environment: 'production',
        schedule: {
          type: 'once',
          time: '02:00',
          timezone: 'UTC',
        },
        maintenanceWindow: {
          enabled: true,
          startTime: '02:00',
          endTime: '03:00',
          duration: 60,
        },
        rollbackPolicy: {
          enabled: true,
          autoRollbackOnFailure: true,
          maxRetries: 3,
          retryDelay: 5,
        },
        notifications: {
          enabled: true,
          channels: ['email'],
          recipients: ['admin@ltcfasttrack.com'],
          notifyBefore: 30,
          notifyOnCompletion: true,
        },
        status: 'active',
      });

      expect(schedule).toBeDefined();

      // 3. Trigger deployment
      const action = await deploymentDashboard.triggerDeployment('production', 'admin@ltcfasttrack.com');
      expect(action.status).toBe('completed');

      // 4. Monitor system health after deployment
      const finalHealth = monitoringDashboard.getSystemHealthScore();
      expect(finalHealth).toBeGreaterThanOrEqual(0);

      // 5. Get deployment summary
      const summary = monitoringDashboard.getDashboardSummary();
      expect(summary.systemHealth).toBeDefined();
    });
  });
});
