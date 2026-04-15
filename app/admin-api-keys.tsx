import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useAPIKeys } from '@/lib/api-keys-context';

const AVAILABLE_PERMISSIONS = [
  'read:pickups',
  'write:pickups',
  'read:users',
  'write:users',
  'read:payments',
  'write:payments',
  'read:disputes',
  'write:disputes',
  'read:subscriptions',
  'write:subscriptions',
  'admin:all',
];

export default function AdminAPIKeysScreen() {
  const colors = useColors();
  const { apiKeys, generateAPIKey, revokeAPIKey, rotateAPIKey, updateAPIKeyPermissions, updateIPWhitelist } = useAPIKeys();
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [expiresIn, setExpiresIn] = useState('12'); // months
  const [ipWhitelist, setIpWhitelist] = useState('');
  const [newIp, setNewIp] = useState('');

  const handleCreateKey = () => {
    if (!newKeyName.trim()) {
      Alert.alert('Error', 'Please enter a key name');
      return;
    }

    if (selectedPermissions.length === 0) {
      Alert.alert('Error', 'Please select at least one permission');
      return;
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + parseInt(expiresIn));

    const newKey = generateAPIKey(newKeyName, selectedPermissions, expiresAt.toISOString(), ipWhitelist.split('\n').filter(ip => ip.trim()));

    Alert.alert('Success', `API Key created!\n\nKey: ${newKey.key}\n\nSave this key securely. You won't be able to see it again.`, [
      { text: 'Copy Key', onPress: () => console.log('Copy to clipboard') },
      { text: 'Done', onPress: () => setShowNewKeyModal(false) },
    ]);

    setNewKeyName('');
    setSelectedPermissions([]);
    setExpiresIn('12');
    setIpWhitelist('');
  };

  const handleTogglePermission = (permission: string) => {
    setSelectedPermissions(
      selectedPermissions.includes(permission)
        ? selectedPermissions.filter(p => p !== permission)
        : [...selectedPermissions, permission]
    );
  };

  const handleAddIP = () => {
    if (!newIp.trim()) return;
    setIpWhitelist(ipWhitelist ? `${ipWhitelist}\n${newIp}` : newIp);
    setNewIp('');
  };

  const handleRemoveIP = (ip: string) => {
    setIpWhitelist(ipWhitelist.split('\n').filter(i => i !== ip).join('\n'));
  };

  const selectedKey = selectedKeyId ? apiKeys.find(k => k.id === selectedKeyId) : null;

  return (
    <ScreenContainer className="bg-background">
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="active:opacity-70">
          <MaterialIcons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-foreground">API Keys</Text>
        <TouchableOpacity onPress={() => setShowNewKeyModal(true)} className="active:opacity-70">
          <MaterialIcons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 12 }}>
        {apiKeys.length === 0 ? (
          <View className="items-center justify-center py-12 gap-4">
            <MaterialIcons name="vpn-key" size={48} color={colors.muted} />
            <Text className="text-foreground font-semibold">No API Keys</Text>
            <Text className="text-muted text-center text-sm">Create your first API key to enable integrations</Text>
          </View>
        ) : (
          apiKeys.map((key) => (
            <TouchableOpacity
              key={key.id}
              onPress={() => setSelectedKeyId(selectedKeyId === key.id ? null : key.id)}
              className={`border rounded-lg overflow-hidden ${
                selectedKeyId === key.id ? 'border-primary bg-primary/5' : 'border-border bg-surface'
              }`}
            >
              <View className="p-4 gap-3">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-foreground">{key.name}</Text>
                    <Text className="text-sm text-muted font-mono mt-1">{key.maskedKey}</Text>
                  </View>
                  <View className={`px-2 py-1 rounded ${key.isActive ? 'bg-green-100' : 'bg-red-100'}`}>
                    <Text className={`text-xs font-semibold ${key.isActive ? 'text-green-700' : 'text-red-700'}`}>
                      {key.isActive ? 'Active' : 'Revoked'}
                    </Text>
                  </View>
                </View>

                <View className="flex-row gap-4 text-xs text-muted">
                  <View>
                    <Text className="text-muted">Created</Text>
                    <Text className="text-foreground">{new Date(key.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <View>
                    <Text className="text-muted">Usage</Text>
                    <Text className="text-foreground">{key.usageCount}</Text>
                  </View>
                  {key.lastUsedAt && (
                    <View>
                      <Text className="text-muted">Last Used</Text>
                      <Text className="text-foreground">{new Date(key.lastUsedAt).toLocaleDateString()}</Text>
                    </View>
                  )}
                </View>

                {selectedKeyId === key.id && (
                  <View className="mt-4 pt-4 border-t border-border gap-4">
                    <View>
                      <Text className="text-sm font-semibold text-muted mb-2">Permissions ({key.permissions.length})</Text>
                      <View className="flex-row flex-wrap gap-2">
                        {key.permissions.map((perm) => (
                          <View key={perm} className="bg-primary/10 rounded-full px-3 py-1">
                            <Text className="text-xs text-primary font-semibold">{perm}</Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {key.ipWhitelist.length > 0 && (
                      <View>
                        <Text className="text-sm font-semibold text-muted mb-2">IP Whitelist</Text>
                        <View className="gap-2">
                          {key.ipWhitelist.map((ip) => (
                            <View key={ip} className="flex-row items-center justify-between bg-background border border-border rounded-lg p-2">
                              <Text className="text-sm text-foreground font-mono">{ip}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {key.expiresAt && (
                      <View>
                        <Text className="text-sm font-semibold text-muted">Expires</Text>
                        <Text className="text-foreground">{new Date(key.expiresAt).toLocaleDateString()}</Text>
                      </View>
                    )}

                    <View className="flex-row gap-2 pt-2">
                      {key.isActive && (
                        <>
                          <TouchableOpacity
                            onPress={() => {
                              Alert.alert('Rotate Key', 'Generate a new key? The old one will become invalid.', [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Rotate',
                                  style: 'destructive',
                                  onPress: () => {
                                    rotateAPIKey(key.id);
                                    Alert.alert('Success', 'API key rotated');
                                  },
                                },
                              ]);
                            }}
                            className="flex-1 bg-warning/10 rounded-lg py-2 items-center active:opacity-70"
                          >
                            <Text className="text-warning font-semibold text-sm">Rotate</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              Alert.alert('Revoke Key', 'This will deactivate the API key immediately.', [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Revoke',
                                  style: 'destructive',
                                  onPress: () => {
                                    revokeAPIKey(key.id);
                                    Alert.alert('Success', 'API key revoked');
                                  },
                                },
                              ]);
                            }}
                            className="flex-1 bg-error/10 rounded-lg py-2 items-center active:opacity-70"
                          >
                            <Text className="text-error font-semibold text-sm">Revoke</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* New Key Modal */}
      <Modal visible={showNewKeyModal} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-2xl p-6 max-h-[90%]">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-2xl font-bold text-foreground">Create API Key</Text>
              <TouchableOpacity onPress={() => setShowNewKeyModal(false)} className="active:opacity-70">
                <MaterialIcons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: 16 }}>
              <View>
                <Text className="text-sm font-semibold text-muted mb-2">Key Name</Text>
                <TextInput
                  value={newKeyName}
                  onChangeText={setNewKeyName}
                  placeholder="e.g., Production API"
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View>
                <Text className="text-sm font-semibold text-muted mb-2">Permissions</Text>
                <View className="gap-2">
                  {AVAILABLE_PERMISSIONS.map((perm) => (
                    <TouchableOpacity
                      key={perm}
                      onPress={() => handleTogglePermission(perm)}
                      className={`flex-row items-center p-3 rounded-lg border ${
                        selectedPermissions.includes(perm)
                          ? 'bg-primary/10 border-primary'
                          : 'bg-surface border-border'
                      }`}
                    >
                      <MaterialIcons
                        name={selectedPermissions.includes(perm) ? 'check-box' : 'check-box-outline-blank'}
                        size={20}
                        color={selectedPermissions.includes(perm) ? colors.primary : colors.muted}
                      />
                      <Text className="ml-3 text-foreground font-medium">{perm}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View>
                <Text className="text-sm font-semibold text-muted mb-2">Expiration (months)</Text>
                <TextInput
                  value={expiresIn}
                  onChangeText={setExpiresIn}
                  placeholder="12"
                  keyboardType="number-pad"
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View>
                <Text className="text-sm font-semibold text-muted mb-2">IP Whitelist (optional)</Text>
                <View className="gap-2 mb-3">
                  {ipWhitelist.split('\n').filter(ip => ip.trim()).map((ip) => (
                    <View key={ip} className="flex-row items-center justify-between bg-surface border border-border rounded-lg p-2">
                      <Text className="text-sm text-foreground font-mono">{ip}</Text>
                      <TouchableOpacity onPress={() => handleRemoveIP(ip)} className="active:opacity-70">
                        <MaterialIcons name="close" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                <View className="flex-row gap-2">
                  <TextInput
                    value={newIp}
                    onChangeText={setNewIp}
                    placeholder="e.g., 192.168.1.0/24"
                    className="flex-1 bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                    placeholderTextColor={colors.muted}
                  />
                  <TouchableOpacity
                    onPress={handleAddIP}
                    className="bg-primary rounded-lg px-4 items-center justify-center active:opacity-80"
                  >
                    <MaterialIcons name="add" size={20} color="white" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleCreateKey}
                className="bg-primary rounded-lg py-4 items-center active:opacity-80 mt-4"
              >
                <Text className="text-background font-bold text-lg">Create API Key</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
