/**
 * Deployment Scheduler
 * Manages automated deployment scheduling and execution
 */

export interface DeploymentSchedule {
  id: string;
  name: string;
  environment: 'staging' | 'production';
  schedule: {
    type: 'once' | 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
    time: string; // HH:mm format
    timezone: string;
  };
  maintenanceWindow: {
    enabled: boolean;
    startTime: string; // HH:mm
    endTime: string; // HH:mm
    duration: number; // minutes
  };
  rollbackPolicy: {
    enabled: boolean;
    autoRollbackOnFailure: boolean;
    maxRetries: number;
    retryDelay: number; // minutes
  };
  notifications: {
    enabled: boolean;
    channels: ('email' | 'slack' | 'sms')[];
    recipients: string[];
    notifyBefore: number; // minutes
    notifyOnCompletion: boolean;
  };
  status: 'active' | 'inactive' | 'paused';
  createdAt: number;
  lastRun?: number;
  nextRun?: number;
  runs: ScheduledDeploymentRun[];
}

export interface ScheduledDeploymentRun {
  id: string;
  scheduleId: string;
  startTime: number;
  endTime?: number;
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'rolled-back' | 'cancelled';
  result?: {
    success: boolean;
    message: string;
    duration: number;
  };
  rollback?: {
    triggered: boolean;
    reason: string;
    success: boolean;
  };
}

export interface MaintenanceWindow {
  id: string;
  scheduleId: string;
  startTime: number;
  endTime: number;
  reason: string;
  status: 'scheduled' | 'active' | 'completed';
  notifications: {
    preWarning: boolean;
    started: boolean;
    completed: boolean;
  };
}

export class DeploymentScheduler {
  private schedules: Map<string, DeploymentSchedule> = new Map();
  private maintenanceWindows: Map<string, MaintenanceWindow> = new Map();
  private scheduledRuns: ScheduledDeploymentRun[] = [];

  constructor() {
    this.initializeSampleSchedules();
  }

  /**
   * Initialize sample schedules
   */
  private initializeSampleSchedules(): void {
    const schedule: DeploymentSchedule = {
      id: `sched-${Date.now()}`,
      name: 'Weekly Production Deployment',
      environment: 'production',
      schedule: {
        type: 'weekly',
        dayOfWeek: 2, // Tuesday
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
        channels: ['email', 'slack'],
        recipients: ['devops@ltcfasttrack.com'],
        notifyBefore: 30,
        notifyOnCompletion: true,
      },
      status: 'active',
      createdAt: Date.now(),
      runs: [],
    };

    this.schedules.set(schedule.id, schedule);
  }

  /**
   * Create deployment schedule
   */
  createSchedule(config: Omit<DeploymentSchedule, 'id' | 'createdAt' | 'runs'>): DeploymentSchedule {
    const schedule: DeploymentSchedule = {
      ...config,
      id: `sched-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      runs: [],
    };

    this.schedules.set(schedule.id, schedule);
    this.calculateNextRun(schedule);

    return schedule;
  }

  /**
   * Calculate next run time
   */
  private calculateNextRun(schedule: DeploymentSchedule): void {
    const now = new Date();
    let nextRun: Date;

    switch (schedule.schedule.type) {
      case 'once':
        nextRun = new Date();
        break;
      case 'daily':
        nextRun = new Date();
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'weekly':
        nextRun = new Date();
        const dayDiff = (schedule.schedule.dayOfWeek || 0) - nextRun.getDay();
        nextRun.setDate(nextRun.getDate() + (dayDiff > 0 ? dayDiff : dayDiff + 7));
        break;
      case 'monthly':
        nextRun = new Date();
        nextRun.setMonth(nextRun.getMonth() + 1);
        nextRun.setDate(schedule.schedule.dayOfMonth || 1);
        break;
    }

    const [hours, minutes] = schedule.schedule.time.split(':').map(Number);
    nextRun.setHours(hours, minutes, 0, 0);

    schedule.nextRun = nextRun.getTime();
  }

  /**
   * Get schedule
   */
  getSchedule(scheduleId: string): DeploymentSchedule | undefined {
    return this.schedules.get(scheduleId);
  }

  /**
   * Get all schedules
   */
  getAllSchedules(): DeploymentSchedule[] {
    return Array.from(this.schedules.values());
  }

  /**
   * Update schedule
   */
  updateSchedule(scheduleId: string, updates: Partial<DeploymentSchedule>): boolean {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) return false;

    Object.assign(schedule, updates);
    this.calculateNextRun(schedule);

    return true;
  }

  /**
   * Activate schedule
   */
  activateSchedule(scheduleId: string): boolean {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) return false;

    schedule.status = 'active';
    this.calculateNextRun(schedule);

    return true;
  }

  /**
   * Deactivate schedule
   */
  deactivateSchedule(scheduleId: string): boolean {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) return false;

    schedule.status = 'inactive';

    return true;
  }

  /**
   * Pause schedule
   */
  pauseSchedule(scheduleId: string): boolean {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) return false;

    schedule.status = 'paused';

    return true;
  }

  /**
   * Resume schedule
   */
  resumeSchedule(scheduleId: string): boolean {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) return false;

    schedule.status = 'active';
    this.calculateNextRun(schedule);

    return true;
  }

  /**
   * Execute scheduled deployment
   */
  async executeScheduledDeployment(scheduleId: string): Promise<ScheduledDeploymentRun | null> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) return null;

    const run: ScheduledDeploymentRun = {
      id: `run-${Date.now()}`,
      scheduleId,
      startTime: Date.now(),
      status: 'running',
    };

    this.scheduledRuns.push(run);
    schedule.runs.push(run);
    schedule.lastRun = Date.now();

    // Simulate deployment
    await new Promise((resolve) => setTimeout(resolve, 2000));

    run.endTime = Date.now();
    run.status = 'completed';
    run.result = {
      success: true,
      message: 'Deployment completed successfully',
      duration: run.endTime - run.startTime,
    };

    // Calculate next run
    this.calculateNextRun(schedule);

    return run;
  }

  /**
   * Trigger rollback for deployment run
   */
  async triggerRollback(runId: string, reason: string): Promise<boolean> {
    const run = this.scheduledRuns.find((r) => r.id === runId);
    if (!run) return false;

    run.rollback = {
      triggered: true,
      reason,
      success: true,
    };

    run.status = 'rolled-back';

    return true;
  }

  /**
   * Create maintenance window
   */
  createMaintenanceWindow(scheduleId: string, startTime: number, endTime: number, reason: string): MaintenanceWindow {
    const window: MaintenanceWindow = {
      id: `maint-${Date.now()}`,
      scheduleId,
      startTime,
      endTime,
      reason,
      status: 'scheduled',
      notifications: {
        preWarning: false,
        started: false,
        completed: false,
      },
    };

    this.maintenanceWindows.set(window.id, window);

    return window;
  }

  /**
   * Get maintenance windows
   */
  getMaintenanceWindows(scheduleId?: string): MaintenanceWindow[] {
    let windows = Array.from(this.maintenanceWindows.values());

    if (scheduleId) {
      windows = windows.filter((w) => w.scheduleId === scheduleId);
    }

    return windows;
  }

  /**
   * Update maintenance window status
   */
  updateMaintenanceWindowStatus(windowId: string, status: 'scheduled' | 'active' | 'completed'): boolean {
    const window = this.maintenanceWindows.get(windowId);
    if (!window) return false;

    window.status = status;

    return true;
  }

  /**
   * Get scheduled runs
   */
  getScheduledRuns(scheduleId?: string, limit: number = 20): ScheduledDeploymentRun[] {
    let runs = this.scheduledRuns;

    if (scheduleId) {
      runs = runs.filter((r) => r.scheduleId === scheduleId);
    }

    return runs.slice(-limit).reverse();
  }

  /**
   * Get upcoming deployments
   */
  getUpcomingDeployments(): {
    schedule: DeploymentSchedule;
    nextRun: number;
    timeUntilRun: number;
  }[] {
    const now = Date.now();

    return Array.from(this.schedules.values())
      .filter((s) => s.status === 'active' && s.nextRun && s.nextRun > now)
      .map((s) => ({
        schedule: s,
        nextRun: s.nextRun!,
        timeUntilRun: s.nextRun! - now,
      }))
      .sort((a, b) => a.nextRun - b.nextRun);
  }

  /**
   * Get deployment statistics
   */
  getDeploymentStatistics(scheduleId?: string): {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    rolledBackRuns: number;
    successRate: number;
    averageDuration: number;
  } {
    let runs = this.scheduledRuns;

    if (scheduleId) {
      runs = runs.filter((r) => r.scheduleId === scheduleId);
    }

    const totalRuns = runs.length;
    const successfulRuns = runs.filter((r) => r.status === 'completed').length;
    const failedRuns = runs.filter((r) => r.status === 'failed').length;
    const rolledBackRuns = runs.filter((r) => r.status === 'rolled-back').length;

    const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0;

    const averageDuration = runs.reduce((sum, r) => {
      if (r.result?.duration) {
        return sum + r.result.duration;
      }
      return sum;
    }, 0) / (totalRuns || 1);

    return {
      totalRuns,
      successfulRuns,
      failedRuns,
      rolledBackRuns,
      successRate,
      averageDuration,
    };
  }

  /**
   * Get scheduler status
   */
  getSchedulerStatus(): {
    activeSchedules: number;
    inactiveSchedules: number;
    pausedSchedules: number;
    upcomingDeployments: number;
    lastDeployment?: {
      schedule: string;
      time: number;
      status: string;
    };
  } {
    const schedules = Array.from(this.schedules.values());
    const activeSchedules = schedules.filter((s) => s.status === 'active').length;
    const inactiveSchedules = schedules.filter((s) => s.status === 'inactive').length;
    const pausedSchedules = schedules.filter((s) => s.status === 'paused').length;

    const upcomingDeployments = this.getUpcomingDeployments().length;

    const lastRun = this.scheduledRuns[this.scheduledRuns.length - 1];
    const lastDeployment = lastRun
      ? {
          schedule: lastRun.scheduleId,
          time: lastRun.endTime || lastRun.startTime,
          status: lastRun.status,
        }
      : undefined;

    return {
      activeSchedules,
      inactiveSchedules,
      pausedSchedules,
      upcomingDeployments,
      lastDeployment,
    };
  }

  /**
   * Get schedule recommendations
   */
  getScheduleRecommendations(): {
    priority: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
  }[] {
    return [
      {
        priority: 'high',
        title: 'Schedule Deployments During Off-Peak Hours',
        description: 'Consider scheduling deployments during low-traffic periods (2-4 AM UTC)',
      },
      {
        priority: 'medium',
        title: 'Enable Auto-Rollback',
        description: 'Enable automatic rollback on deployment failure for safety',
      },
      {
        priority: 'medium',
        title: 'Configure Notifications',
        description: 'Set up email and Slack notifications for deployment events',
      },
      {
        priority: 'low',
        title: 'Review Deployment History',
        description: 'Regularly review deployment history to identify patterns and issues',
      },
    ];
  }
}

export const deploymentScheduler = new DeploymentScheduler();
