import React, { createContext, useContext, useState, useCallback } from 'react';

export interface RateLimitRule {
  id: string;
  apiKeyId: string;
  requestType: 'all' | 'read' | 'write';
  limit: number;
  windowSeconds: number; // 60 = per minute, 3600 = per hour, 86400 = per day
  isActive: boolean;
}

export interface RateLimitUsage {
  apiKeyId: string;
  requestCount: number;
  windowResetAt: string;
  isLimited: boolean;
}

export interface RateLimitContextType {
  rateLimitRules: RateLimitRule[];
  rateLimitUsage: RateLimitUsage[];
  createRateLimit: (apiKeyId: string, requestType: 'all' | 'read' | 'write', limit: number, windowSeconds: number) => RateLimitRule;
  updateRateLimit: (ruleid: string, limit: number, windowSeconds: number) => void;
  deleteRateLimit: (ruleId: string) => void;
  checkRateLimit: (apiKeyId: string) => { allowed: boolean; remaining: number; resetAt: string };
  recordRequest: (apiKeyId: string) => void;
  getRateLimitStats: (apiKeyId: string) => { limit: number; used: number; remaining: number; resetAt: string };
}

const RateLimitContext = createContext<RateLimitContextType | undefined>(undefined);

export function RateLimitProvider({ children }: { children: React.ReactNode }) {
  const [rateLimitRules, setRateLimitRules] = useState<RateLimitRule[]>([
    {
      id: 'rule-001',
      apiKeyId: 'key-001',
      requestType: 'all',
      limit: 10000,
      windowSeconds: 3600, // per hour
      isActive: true,
    },
    {
      id: 'rule-002',
      apiKeyId: 'key-002',
      requestType: 'all',
      limit: 5000,
      windowSeconds: 3600,
      isActive: true,
    },
  ]);

  const [rateLimitUsage, setRateLimitUsage] = useState<RateLimitUsage[]>([
    {
      apiKeyId: 'key-001',
      requestCount: 3250,
      windowResetAt: new Date(Date.now() + 3600000).toISOString(),
      isLimited: false,
    },
    {
      apiKeyId: 'key-002',
      requestCount: 4800,
      windowResetAt: new Date(Date.now() + 1800000).toISOString(),
      isLimited: false,
    },
  ]);

  const createRateLimit = useCallback(
    (apiKeyId: string, requestType: 'all' | 'read' | 'write', limit: number, windowSeconds: number) => {
      const newRule: RateLimitRule = {
        id: `rule-${Date.now()}`,
        apiKeyId,
        requestType,
        limit,
        windowSeconds,
        isActive: true,
      };

      setRateLimitRules([...rateLimitRules, newRule]);

      const newUsage: RateLimitUsage = {
        apiKeyId,
        requestCount: 0,
        windowResetAt: new Date(Date.now() + windowSeconds * 1000).toISOString(),
        isLimited: false,
      };

      setRateLimitUsage([...rateLimitUsage, newUsage]);

      return newRule;
    },
    [rateLimitRules, rateLimitUsage]
  );

  const updateRateLimit = useCallback(
    (ruleId: string, limit: number, windowSeconds: number) => {
      setRateLimitRules(
        rateLimitRules.map(r =>
          r.id === ruleId ? { ...r, limit, windowSeconds } : r
        )
      );
    },
    [rateLimitRules]
  );

  const deleteRateLimit = useCallback(
    (ruleId: string) => {
      const rule = rateLimitRules.find(r => r.id === ruleId);
      if (rule) {
        setRateLimitRules(rateLimitRules.filter(r => r.id !== ruleId));
        setRateLimitUsage(rateLimitUsage.filter(u => u.apiKeyId !== rule.apiKeyId));
      }
    },
    [rateLimitRules, rateLimitUsage]
  );

  const checkRateLimit = useCallback(
    (apiKeyId: string) => {
      const rule = rateLimitRules.find(r => r.apiKeyId === apiKeyId && r.isActive);
      const usage = rateLimitUsage.find(u => u.apiKeyId === apiKeyId);

      if (!rule || !usage) {
        return { allowed: true, remaining: 0, resetAt: new Date().toISOString() };
      }

      const allowed = usage.requestCount < rule.limit;
      const remaining = Math.max(0, rule.limit - usage.requestCount);

      return {
        allowed,
        remaining,
        resetAt: usage.windowResetAt,
      };
    },
    [rateLimitRules, rateLimitUsage]
  );

  const recordRequest = useCallback(
    (apiKeyId: string) => {
      setRateLimitUsage(
        rateLimitUsage.map(u =>
          u.apiKeyId === apiKeyId
            ? {
                ...u,
                requestCount: u.requestCount + 1,
                isLimited: u.requestCount + 1 >= (rateLimitRules.find(r => r.apiKeyId === apiKeyId)?.limit || 0),
              }
            : u
        )
      );
    },
    [rateLimitUsage, rateLimitRules]
  );

  const getRateLimitStats = useCallback(
    (apiKeyId: string) => {
      const rule = rateLimitRules.find(r => r.apiKeyId === apiKeyId && r.isActive);
      const usage = rateLimitUsage.find(u => u.apiKeyId === apiKeyId);

      if (!rule || !usage) {
        return { limit: 0, used: 0, remaining: 0, resetAt: new Date().toISOString() };
      }

      return {
        limit: rule.limit,
        used: usage.requestCount,
        remaining: Math.max(0, rule.limit - usage.requestCount),
        resetAt: usage.windowResetAt,
      };
    },
    [rateLimitRules, rateLimitUsage]
  );

  return (
    <RateLimitContext.Provider
      value={{
        rateLimitRules,
        rateLimitUsage,
        createRateLimit,
        updateRateLimit,
        deleteRateLimit,
        checkRateLimit,
        recordRequest,
        getRateLimitStats,
      }}
    >
      {children}
    </RateLimitContext.Provider>
  );
}

export function useRateLimit() {
  const context = useContext(RateLimitContext);
  if (!context) {
    throw new Error('useRateLimit must be used within RateLimitProvider');
  }
  return context;
}
