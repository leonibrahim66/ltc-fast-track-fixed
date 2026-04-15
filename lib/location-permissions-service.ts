/**
 * Location Permissions Service
 * Manages location sharing permissions and privacy controls
 */

export interface LocationPermission {
  userId: string;
  grantedBy: string;
  grantedTo: string; // User ID or role
  permissionType: 'view_location' | 'track_movement' | 'view_history' | 'access_analytics';
  grantedAt: number;
  expiresAt?: number;
  isActive: boolean;
  restrictions?: {
    maxDistance?: number; // meters
    timeWindow?: { start: number; end: number }; // hours
    geofenceZones?: string[]; // zone IDs
  };
}

export interface LocationSharingPreference {
  userId: string;
  shareWith: {
    subscribers: boolean;
    collectors: boolean;
    superadmins: boolean;
    specificUsers?: string[];
  };
  shareData: {
    currentLocation: boolean;
    locationHistory: boolean;
    movementAnalytics: boolean;
    collectionHistory: boolean;
  };
  privacy: {
    anonymizeData: boolean;
    hideExactLocation: boolean;
    locationAccuracy: 'exact' | 'approximate' | 'city'; // exact, ~100m, ~1km
    dataRetention: number; // days
  };
  notifications: {
    notifyOnAccess: boolean;
    notifyOnTracking: boolean;
    notifyOnDataExport: boolean;
  };
  updatedAt: number;
}

export interface LocationAccessLog {
  id: string;
  userId: string;
  accessedBy: string;
  accessType: 'view' | 'track' | 'export' | 'analyze';
  timestamp: number;
  dataAccessed: string[];
  duration?: number; // seconds
  ipAddress?: string;
  deviceInfo?: string;
}

export interface LocationDataExport {
  id: string;
  userId: string;
  requestedBy: string;
  exportType: 'history' | 'analytics' | 'full';
  startDate: number;
  endDate: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
  fileUrl?: string;
  expiresAt?: number;
}

export class LocationPermissionsService {
  private permissions: Map<string, LocationPermission[]> = new Map();
  private preferences: Map<string, LocationSharingPreference> = new Map();
  private accessLogs: LocationAccessLog[] = [];
  private dataExports: Map<string, LocationDataExport> = new Map();

  constructor() {
    this.initializeSampleData();
  }

  /**
   * Initialize sample data
   */
  private initializeSampleData(): void {
    // Sample preferences
    const samplePreferences: LocationSharingPreference[] = [
      {
        userId: 'col-1',
        shareWith: {
          subscribers: true,
          collectors: false,
          superadmins: true,
          specificUsers: [],
        },
        shareData: {
          currentLocation: true,
          locationHistory: true,
          movementAnalytics: true,
          collectionHistory: true,
        },
        privacy: {
          anonymizeData: false,
          hideExactLocation: false,
          locationAccuracy: 'exact',
          dataRetention: 30,
        },
        notifications: {
          notifyOnAccess: true,
          notifyOnTracking: true,
          notifyOnDataExport: true,
        },
        updatedAt: Date.now(),
      },
      {
        userId: 'sub-1',
        shareWith: {
          subscribers: false,
          collectors: true,
          superadmins: true,
          specificUsers: [],
        },
        shareData: {
          currentLocation: true,
          locationHistory: false,
          movementAnalytics: false,
          collectionHistory: true,
        },
        privacy: {
          anonymizeData: false,
          hideExactLocation: false,
          locationAccuracy: 'approximate',
          dataRetention: 7,
        },
        notifications: {
          notifyOnAccess: true,
          notifyOnTracking: false,
          notifyOnDataExport: false,
        },
        updatedAt: Date.now(),
      },
    ];

    samplePreferences.forEach((pref) => {
      this.preferences.set(pref.userId, pref);
    });
  }

  /**
   * Grant location permission
   */
  grantPermission(permission: Omit<LocationPermission, 'isActive'>): LocationPermission {
    const newPermission: LocationPermission = {
      ...permission,
      isActive: true,
    };

    const userPermissions = this.permissions.get(permission.userId) || [];
    userPermissions.push(newPermission);
    this.permissions.set(permission.userId, userPermissions);

    this.logAccess({
      userId: permission.userId,
      accessedBy: permission.grantedBy,
      accessType: 'view',
      dataAccessed: ['permission_granted'],
    });

    return newPermission;
  }

  /**
   * Revoke location permission
   */
  revokePermission(userId: string, grantedTo: string): boolean {
    const userPermissions = this.permissions.get(userId) || [];
    const index = userPermissions.findIndex((p) => p.grantedTo === grantedTo);

    if (index === -1) return false;

    userPermissions[index].isActive = false;
    this.permissions.set(userId, userPermissions);

    this.logAccess({
      userId,
      accessedBy: grantedTo,
      accessType: 'view',
      dataAccessed: ['permission_revoked'],
    });

    return true;
  }

  /**
   * Get user permissions
   */
  getUserPermissions(userId: string): LocationPermission[] {
    return (this.permissions.get(userId) || []).filter((p) => p.isActive);
  }

  /**
   * Check if user has permission
   */
  hasPermission(
    userId: string,
    grantedTo: string,
    permissionType: string
  ): boolean {
    const permissions = this.getUserPermissions(userId);
    return permissions.some(
      (p) =>
        p.grantedTo === grantedTo &&
        p.permissionType === permissionType &&
        (!p.expiresAt || p.expiresAt > Date.now())
    );
  }

  /**
   * Get or create sharing preference
   */
  getOrCreatePreference(userId: string): LocationSharingPreference {
    if (this.preferences.has(userId)) {
      return this.preferences.get(userId)!;
    }

    const newPreference: LocationSharingPreference = {
      userId,
      shareWith: {
        subscribers: false,
        collectors: false,
        superadmins: true,
        specificUsers: [],
      },
      shareData: {
        currentLocation: true,
        locationHistory: false,
        movementAnalytics: false,
        collectionHistory: false,
      },
      privacy: {
        anonymizeData: false,
        hideExactLocation: false,
        locationAccuracy: 'approximate',
        dataRetention: 7,
      },
      notifications: {
        notifyOnAccess: true,
        notifyOnTracking: false,
        notifyOnDataExport: false,
      },
      updatedAt: Date.now(),
    };

    this.preferences.set(userId, newPreference);
    return newPreference;
  }

  /**
   * Update sharing preference
   */
  updatePreference(userId: string, updates: Partial<LocationSharingPreference>): LocationSharingPreference {
    const preference = this.getOrCreatePreference(userId);
    const updated = { ...preference, ...updates, updatedAt: Date.now() };
    this.preferences.set(userId, updated);

    this.logAccess({
      userId,
      accessedBy: userId,
      accessType: 'view',
      dataAccessed: ['preference_updated'],
    });

    return updated;
  }

  /**
   * Get sharing preference
   */
  getPreference(userId: string): LocationSharingPreference {
    return this.getOrCreatePreference(userId);
  }

  /**
   * Can access location data
   */
  canAccessLocationData(
    userId: string,
    requestedBy: string,
    dataType: string
  ): boolean {
    // Check permissions
    if (!this.hasPermission(userId, requestedBy, 'view_location')) {
      return false;
    }

    // Check preferences
    const preference = this.getPreference(userId);

    // Check if data type is shared
    const shareDataKey = dataType as keyof typeof preference.shareData;
    if (!preference.shareData[shareDataKey]) {
      return false;
    }

    // Check if requestedBy is in allowed list
    if (preference.shareWith.specificUsers && preference.shareWith.specificUsers.length > 0) {
      return preference.shareWith.specificUsers.includes(requestedBy);
    }

    return true;
  }

  /**
   * Log access
   */
  private logAccess(log: Omit<LocationAccessLog, 'id' | 'timestamp'>): LocationAccessLog {
    const accessLog: LocationAccessLog = {
      ...log,
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
    };

    this.accessLogs.push(accessLog);

    // Keep only last 1000 logs
    if (this.accessLogs.length > 1000) {
      this.accessLogs = this.accessLogs.slice(-1000);
    }

    return accessLog;
  }

  /**
   * Get access logs
   */
  getAccessLogs(userId?: string, limit: number = 100): LocationAccessLog[] {
    let logs = this.accessLogs;

    if (userId) {
      logs = logs.filter((log) => log.userId === userId);
    }

    return logs.slice(-limit);
  }

  /**
   * Request data export
   */
  requestDataExport(
    userId: string,
    requestedBy: string,
    exportType: 'history' | 'analytics' | 'full',
    startDate: number,
    endDate: number
  ): LocationDataExport {
    const dataExport: LocationDataExport = {
      id: `export-${Date.now()}`,
      userId,
      requestedBy,
      exportType,
      startDate,
      endDate,
      status: 'pending',
      createdAt: Date.now(),
    };

    this.dataExports.set(dataExport.id, dataExport);

    this.logAccess({
      userId,
      accessedBy: requestedBy,
      accessType: 'export',
      dataAccessed: [exportType],
    });

    // Simulate processing
    setTimeout(() => {
      const export_ = this.dataExports.get(dataExport.id);
      if (export_) {
        export_.status = 'completed';
        export_.completedAt = Date.now();
        export_.fileUrl = `https://ltcfasttrack.com/exports/${dataExport.id}.csv`;
        export_.expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
      }
    }, 2000);

    return dataExport;
  }

  /**
   * Get data export
   */
  getDataExport(exportId: string): LocationDataExport | null {
    return this.dataExports.get(exportId) || null;
  }

  /**
   * Get user data exports
   */
  getUserDataExports(userId: string): LocationDataExport[] {
    return Array.from(this.dataExports.values()).filter((exp) => exp.userId === userId);
  }

  /**
   * Get privacy compliance report
   */
  getPrivacyComplianceReport(userId: string): {
    dataShared: string[];
    sharingWith: string[];
    accessCount: number;
    lastAccess?: number;
    dataRetention: number;
    privacyScore: number; // 0-100
    recommendations: string[];
  } {
    const preference = this.getPreference(userId);
    const logs = this.getAccessLogs(userId, 100);
    const lastAccess = logs.length > 0 ? logs[logs.length - 1].timestamp : undefined;

    const dataShared = Object.entries(preference.shareData)
      .filter(([, shared]) => shared)
      .map(([key]) => key);

    const sharingWith = [
      ...(preference.shareWith.subscribers ? ['Subscribers'] : []),
      ...(preference.shareWith.collectors ? ['Collectors'] : []),
      ...(preference.shareWith.superadmins ? ['Superadmins'] : []),
      ...(preference.shareWith.specificUsers || []),
    ];

    let privacyScore = 100;

    // Deduct points for privacy risks
    if (!preference.privacy.anonymizeData) privacyScore -= 10;
    if (!preference.privacy.hideExactLocation) privacyScore -= 15;
    if (preference.privacy.locationAccuracy === 'exact') privacyScore -= 10;
    if (preference.privacy.dataRetention > 30) privacyScore -= 10;
    if (logs.length > 50) privacyScore -= 15;

    const recommendations: string[] = [];

    if (!preference.privacy.anonymizeData) {
      recommendations.push('Consider anonymizing location data for better privacy');
    }

    if (preference.privacy.locationAccuracy === 'exact') {
      recommendations.push('Consider reducing location accuracy to approximate for privacy');
    }

    if (preference.privacy.dataRetention > 30) {
      recommendations.push('Consider reducing data retention period');
    }

    if (logs.length > 50) {
      recommendations.push('Review access logs - high number of accesses detected');
    }

    return {
      dataShared,
      sharingWith,
      accessCount: logs.length,
      lastAccess,
      dataRetention: preference.privacy.dataRetention,
      privacyScore: Math.max(0, privacyScore),
      recommendations,
    };
  }

  /**
   * Get permission statistics
   */
  getPermissionStatistics(): {
    totalUsers: number;
    usersWithPermissions: number;
    totalPermissions: number;
    activePermissions: number;
    expiredPermissions: number;
    permissionsByType: Record<string, number>;
  } {
    const allPermissions = Array.from(this.permissions.values()).flat();
    const now = Date.now();

    return {
      totalUsers: this.preferences.size,
      usersWithPermissions: this.permissions.size,
      totalPermissions: allPermissions.length,
      activePermissions: allPermissions.filter((p) => p.isActive && (!p.expiresAt || p.expiresAt > now))
        .length,
      expiredPermissions: allPermissions.filter((p) => p.expiresAt && p.expiresAt <= now).length,
      permissionsByType: {
        view_location: allPermissions.filter((p) => p.permissionType === 'view_location').length,
        track_movement: allPermissions.filter((p) => p.permissionType === 'track_movement').length,
        view_history: allPermissions.filter((p) => p.permissionType === 'view_history').length,
        access_analytics: allPermissions.filter((p) => p.permissionType === 'access_analytics').length,
      },
    };
  }
}

export const locationPermissionsService = new LocationPermissionsService();
