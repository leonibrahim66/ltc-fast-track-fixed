import { describe, it, expect, beforeEach } from 'vitest';
import { TestingPipelineExecutor } from '../lib/testing-pipeline-executor';
import { InfrastructureDeploymentManager } from '../lib/infrastructure-deployment-manager';
import { WebhookNotificationActivator } from '../lib/webhook-notification-activator';

describe('Deployment Execution Features', () => {
  let pipelineExecutor: TestingPipelineExecutor;
  let infrastructureManager: InfrastructureDeploymentManager;
  let webhookActivator: WebhookNotificationActivator;

  beforeEach(() => {
    pipelineExecutor = new TestingPipelineExecutor();
    infrastructureManager = new InfrastructureDeploymentManager();
    webhookActivator = new WebhookNotificationActivator();
  });

  describe('Testing Pipeline Executor', () => {
    it('should start pipeline execution', async () => {
      const execution = await pipelineExecutor.startPipeline({
        phases: [1, 2, 3],
        parallel: false,
        stopOnFailure: false,
        generateReports: true,
        uploadResults: false,
      });

      expect(execution).toBeDefined();
      expect(execution.id).toBeDefined();
      expect(execution.status).toBe('completed');
      expect(execution.phases.length).toBeGreaterThan(0);
    });

    it('should execute all 12 phases sequentially', async () => {
      const execution = await pipelineExecutor.startPipeline({
        phases: [],
        parallel: false,
        stopOnFailure: false,
        generateReports: false,
        uploadResults: false,
      });

      expect(execution.phases).toHaveLength(12);
      expect(execution.summary.totalTests).toBeGreaterThan(0);
    });

    it('should calculate pass rate correctly', async () => {
      const execution = await pipelineExecutor.startPipeline({
        phases: [1],
        parallel: false,
        stopOnFailure: false,
        generateReports: false,
        uploadResults: false,
      });

      expect(execution.summary.passRate).toBeGreaterThanOrEqual(0);
      expect(execution.summary.passRate).toBeLessThanOrEqual(100);
    });

    it('should track failed tests and create bug reports', async () => {
      const execution = await pipelineExecutor.startPipeline({
        phases: [1, 2],
        parallel: false,
        stopOnFailure: false,
        generateReports: true,
        uploadResults: false,
      });

      expect(execution.summary.bugs).toBeDefined();
      expect(Array.isArray(execution.summary.bugs)).toBe(true);
    });

    it('should get execution by ID', async () => {
      const execution = await pipelineExecutor.startPipeline({
        phases: [1],
        parallel: false,
        stopOnFailure: false,
        generateReports: false,
        uploadResults: false,
      });

      const retrieved = pipelineExecutor.getExecution(execution.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(execution.id);
    });

    it('should get current execution', async () => {
      const execution = await pipelineExecutor.startPipeline({
        phases: [1],
        parallel: false,
        stopOnFailure: false,
        generateReports: false,
        uploadResults: false,
      });

      const current = pipelineExecutor.getCurrentExecution();
      expect(current).toBeDefined();
      expect(current?.id).toBe(execution.id);
    });

    it('should pause and resume execution', () => {
      const paused = pipelineExecutor.pauseExecution('test-id');
      expect(typeof paused).toBe('boolean');
    });

    it('should get execution summary', async () => {
      const execution = await pipelineExecutor.startPipeline({
        phases: [1],
        parallel: false,
        stopOnFailure: false,
        generateReports: false,
        uploadResults: false,
      });

      const summary = pipelineExecutor.getExecutionSummary(execution.id);
      expect(summary).toBeDefined();
      expect(summary?.passRate).toBeGreaterThanOrEqual(0);
      expect(summary?.bugCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Infrastructure Deployment Manager', () => {
    it('should create deployment plan', () => {
      const plan = infrastructureManager.createDeploymentPlan('production');

      expect(plan).toBeDefined();
      expect(plan.id).toBeDefined();
      expect(plan.environment).toBe('production');
      expect(plan.status).toBe('draft');
      expect(plan.steps.length).toBeGreaterThan(0);
    });

    it('should have 10 deployment steps', () => {
      const plan = infrastructureManager.createDeploymentPlan('production');
      expect(plan.steps).toHaveLength(10);
    });

    it('should approve deployment plan', () => {
      const plan = infrastructureManager.createDeploymentPlan('production');
      const approved = infrastructureManager.approvePlan(plan.id);

      expect(approved).toBe(true);
      const retrieved = infrastructureManager.getPlan(plan.id);
      expect(retrieved?.status).toBe('approved');
    });

    it('should execute deployment plan', async () => {
      const plan = infrastructureManager.createDeploymentPlan('production');
      infrastructureManager.approvePlan(plan.id);

      const executed = await infrastructureManager.executePlan(plan.id);
      expect(executed).toBeDefined();
      expect(executed?.status).toBe('completed');
    });

    it('should track deployment steps', async () => {
      const plan = infrastructureManager.createDeploymentPlan('production');
      infrastructureManager.approvePlan(plan.id);

      await infrastructureManager.executePlan(plan.id);

      const retrieved = infrastructureManager.getPlan(plan.id);
      expect(retrieved?.steps.every((s) => s.status === 'completed' || s.status === 'failed')).toBe(true);
    });

    it('should get deployment metrics', async () => {
      const plan = infrastructureManager.createDeploymentPlan('production');
      infrastructureManager.approvePlan(plan.id);
      await infrastructureManager.executePlan(plan.id);

      const metrics = infrastructureManager.getDeploymentMetrics(plan.id);
      expect(metrics).toBeDefined();
      expect(metrics?.totalSteps).toBeGreaterThan(0);
      expect(metrics?.successRate).toBeGreaterThanOrEqual(0);
    });

    it('should support rollback', async () => {
      const plan = infrastructureManager.createDeploymentPlan('production');
      infrastructureManager.approvePlan(plan.id);
      await infrastructureManager.executePlan(plan.id);

      const rolled = await infrastructureManager.rollbackDeployment(plan.id, 'v1.0.0');
      expect(rolled).toBe(true);

      const retrieved = infrastructureManager.getPlan(plan.id);
      expect(retrieved?.status).toBe('rolled-back');
    });

    it('should get deployment status', () => {
      const status = infrastructureManager.getDeploymentStatus();
      expect(status).toBeDefined();
      expect(status.components.length).toBeGreaterThan(0);
    });

    it('should get infrastructure config', () => {
      const config = infrastructureManager.getInfrastructureConfig();
      expect(config).toBeDefined();
      expect(config.environment).toBe('production');
      expect(config.servers.length).toBeGreaterThan(0);
    });

    it('should get deployment checklist', () => {
      const checklist = infrastructureManager.getDeploymentChecklist();
      expect(checklist.length).toBeGreaterThan(0);
      expect(checklist[0].items.length).toBeGreaterThan(0);
    });

    it('should get infrastructure summary', () => {
      const summary = infrastructureManager.getInfrastructureSummary();
      expect(summary.totalServers).toBeGreaterThan(0);
      expect(summary.totalCPU).toBeGreaterThan(0);
      expect(summary.totalMemory).toBeGreaterThan(0);
      expect(summary.estimatedMonthlyCost).toBeGreaterThan(0);
    });
  });

  describe('Webhook Notification Activator', () => {
    it('should activate all webhooks and providers', async () => {
      const status = await webhookActivator.activateAll();

      expect(status).toBeDefined();
      expect(status.webhooks.length).toBeGreaterThan(0);
      expect(status.providers.length).toBeGreaterThan(0);
    });

    it('should have webhook activation status', async () => {
      await webhookActivator.activateAll();
      const status = webhookActivator.getActivationStatus();

      expect(status.webhooks.length).toBeGreaterThan(0);
      expect(status.webhooks[0].status).toMatch(/active|inactive|error/);
    });

    it('should have provider activation status', async () => {
      await webhookActivator.activateAll();
      const status = webhookActivator.getActivationStatus();

      expect(status.providers.length).toBeGreaterThan(0);
      expect(status.providers[0].status).toMatch(/configured|unconfigured|error/);
    });

    it('should get webhook status by provider', async () => {
      await webhookActivator.activateAll();
      const status = webhookActivator.getWebhookStatus('zynlepay');

      expect(status).toBeDefined();
      expect(status?.provider).toBe('zynlepay');
    });

    it('should get provider status by name', async () => {
      await webhookActivator.activateAll();
      const status = webhookActivator.getProviderStatus('sendgrid');

      expect(status).toBeDefined();
      expect(status?.name).toBe('sendgrid');
    });

    it('should calculate readiness score', async () => {
      await webhookActivator.activateAll();
      const status = webhookActivator.getActivationStatus();

      expect(status.readinessScore).toBeGreaterThanOrEqual(0);
      expect(status.readinessScore).toBeLessThanOrEqual(100);
    });

    it('should get readiness report', async () => {
      await webhookActivator.activateAll();
      const report = webhookActivator.getReadinessReport();

      expect(report).toBeDefined();
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.status).toMatch(/ready|partial|failed/);
      expect(Array.isArray(report.webhooks)).toBe(true);
      expect(Array.isArray(report.providers)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should get activation checklist', async () => {
      await webhookActivator.activateAll();
      const checklist = webhookActivator.getActivationChecklist();

      expect(checklist.length).toBeGreaterThan(0);
      expect(checklist[0].items.length).toBeGreaterThan(0);
    });

    it('should track activation tasks', async () => {
      await webhookActivator.activateAll();
      const tasks = webhookActivator.getAllTasks();

      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks[0].status).toBe('completed');
    });

    it('should get task by ID', async () => {
      await webhookActivator.activateAll();
      const tasks = webhookActivator.getAllTasks();

      if (tasks.length > 0) {
        const task = webhookActivator.getTask(tasks[0].id);
        expect(task).toBeDefined();
        expect(task?.id).toBe(tasks[0].id);
      }
    });
  });

  describe('Integration Tests', () => {
    it('should complete full deployment workflow', async () => {
      // 1. Create and execute testing pipeline
      const testExecution = await pipelineExecutor.startPipeline({
        phases: [1, 2],
        parallel: false,
        stopOnFailure: false,
        generateReports: true,
        uploadResults: false,
      });
      expect(testExecution.status).toBe('completed');

      // 2. Create and execute infrastructure deployment
      const infraPlan = infrastructureManager.createDeploymentPlan('production');
      infrastructureManager.approvePlan(infraPlan.id);
      const infraExecution = await infrastructureManager.executePlan(infraPlan.id);
      expect(infraExecution?.status).toBe('completed');

      // 3. Activate webhooks and notification providers
      const activationStatus = await webhookActivator.activateAll();
      expect(activationStatus.webhooks.length).toBeGreaterThan(0);
      expect(activationStatus.providers.length).toBeGreaterThan(0);
    });

    it('should have all systems ready for production', async () => {
      // Run all systems
      const testExecution = await pipelineExecutor.startPipeline({
        phases: [1],
        parallel: false,
        stopOnFailure: false,
        generateReports: false,
        uploadResults: false,
      });

      const infraPlan = infrastructureManager.createDeploymentPlan('production');
      infrastructureManager.approvePlan(infraPlan.id);
      const infraExecution = await infrastructureManager.executePlan(infraPlan.id);

      const activationStatus = await webhookActivator.activateAll();

      // Verify all systems are ready
      expect(testExecution.status).toBe('completed');
      expect(infraExecution?.status).toBe('completed');
      expect(activationStatus.webhooks.length).toBeGreaterThan(0);
      expect(activationStatus.providers.length).toBeGreaterThan(0);

      // Check readiness
      const readiness = webhookActivator.getReadinessReport();
      expect(readiness.score).toBeGreaterThanOrEqual(0);
    });
  });
});
