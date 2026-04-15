import React, { createContext, useContext, useState, useCallback } from 'react';

export interface APIKey {
  id: string;
  name: string;
  key: string;
  maskedKey: string;
  permissions: string[];
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  ipWhitelist: string[];
  usageCount: number;
  isActive: boolean;
}

export interface APIKeyContextType {
  apiKeys: APIKey[];
  generateAPIKey: (name: string, permissions: string[], expiresAt?: string, ipWhitelist?: string[]) => APIKey;
  revokeAPIKey: (keyId: string) => void;
  rotateAPIKey: (keyId: string) => APIKey;
  updateAPIKeyPermissions: (keyId: string, permissions: string[]) => void;
  updateIPWhitelist: (keyId: string, ipWhitelist: string[]) => void;
  trackAPIKeyUsage: (keyId: string) => void;
  getAPIKeyUsageStats: (keyId: string) => { usageCount: number; lastUsedAt?: string };
}

const APIKeysContext = createContext<APIKeyContextType | undefined>(undefined);

export function APIKeysProvider({ children }: { children: React.ReactNode }) {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([
    {
      id: 'key-001',
      name: 'Production API Key',
      key: 'ltc_prod_abc123def456ghi789jkl',
      maskedKey: 'ltc_prod_abc123...jkl',
      permissions: ['read:pickups', 'read:users', 'read:payments'],
      createdAt: '2025-12-01T10:00:00Z',
      lastUsedAt: '2026-01-08T06:30:00Z',
      expiresAt: '2026-12-01T10:00:00Z',
      ipWhitelist: ['192.168.1.0/24', '10.0.0.0/8'],
      usageCount: 1250,
      isActive: true,
    },
    {
      id: 'key-002',
      name: 'Testing API Key',
      key: 'ltc_test_xyz789uvw456rst123opq',
      maskedKey: 'ltc_test_xyz789...opq',
      permissions: ['read:pickups', 'write:test'],
      createdAt: '2025-11-15T14:20:00Z',
      lastUsedAt: '2026-01-07T15:45:00Z',
      ipWhitelist: [],
      usageCount: 450,
      isActive: true,
    },
  ]);

  const generateAPIKey = useCallback(
    (name: string, permissions: string[], expiresAt?: string, ipWhitelist: string[] = []) => {
      const newKey: APIKey = {
        id: `key-${Date.now()}`,
        name,
        key: `ltc_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
        maskedKey: `ltc_${Math.random().toString(36).substring(2, 8)}...${Math.random().toString(36).substring(2, 8)}`,
        permissions,
        createdAt: new Date().toISOString(),
        expiresAt,
        ipWhitelist,
        usageCount: 0,
        isActive: true,
      };

      setApiKeys([...apiKeys, newKey]);
      return newKey;
    },
    [apiKeys]
  );

  const revokeAPIKey = useCallback(
    (keyId: string) => {
      setApiKeys(apiKeys.map(k => (k.id === keyId ? { ...k, isActive: false } : k)));
    },
    [apiKeys]
  );

  const rotateAPIKey = useCallback(
    (keyId: string) => {
      let rotatedKey: APIKey | null = null;

      setApiKeys(
        apiKeys.map(k => {
          if (k.id === keyId) {
            const newKey: APIKey = {
              ...k,
              key: `ltc_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
              maskedKey: `ltc_${Math.random().toString(36).substring(2, 8)}...${Math.random().toString(36).substring(2, 8)}`,
              createdAt: new Date().toISOString(),
            };
            rotatedKey = newKey;
            return newKey;
          }
          return k;
        })
      );

      return rotatedKey || apiKeys.find(k => k.id === keyId)!;
    },
    [apiKeys]
  );

  const updateAPIKeyPermissions = useCallback(
    (keyId: string, permissions: string[]) => {
      setApiKeys(apiKeys.map(k => (k.id === keyId ? { ...k, permissions } : k)));
    },
    [apiKeys]
  );

  const updateIPWhitelist = useCallback(
    (keyId: string, ipWhitelist: string[]) => {
      setApiKeys(apiKeys.map(k => (k.id === keyId ? { ...k, ipWhitelist } : k)));
    },
    [apiKeys]
  );

  const trackAPIKeyUsage = useCallback(
    (keyId: string) => {
      setApiKeys(
        apiKeys.map(k =>
          k.id === keyId
            ? { ...k, usageCount: k.usageCount + 1, lastUsedAt: new Date().toISOString() }
            : k
        )
      );
    },
    [apiKeys]
  );

  const getAPIKeyUsageStats = useCallback(
    (keyId: string) => {
      const key = apiKeys.find(k => k.id === keyId);
      return {
        usageCount: key?.usageCount || 0,
        lastUsedAt: key?.lastUsedAt,
      };
    },
    [apiKeys]
  );

  return (
    <APIKeysContext.Provider
      value={{
        apiKeys,
        generateAPIKey,
        revokeAPIKey,
        rotateAPIKey,
        updateAPIKeyPermissions,
        updateIPWhitelist,
        trackAPIKeyUsage,
        getAPIKeyUsageStats,
      }}
    >
      {children}
    </APIKeysContext.Provider>
  );
}

export function useAPIKeys() {
  const context = useContext(APIKeysContext);
  if (!context) {
    throw new Error('useAPIKeys must be used within APIKeysProvider');
  }
  return context;
}
