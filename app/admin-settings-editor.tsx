import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useContentManagement } from '@/lib/content-management-context';

export default function AdminSettingsEditor() {
  const colors = useColors();
  const { appSettings, updateAppSettings } = useContentManagement();
  const [editingSettings, setEditingSettings] = useState(appSettings);

  const handleSaveSettings = () => {
    updateAppSettings(editingSettings);
    Alert.alert('Success', 'App settings updated successfully');
  };

  const handleToggleMaintenance = () => {
    setEditingSettings({
      ...editingSettings,
      maintenanceMode: !editingSettings.maintenanceMode,
    });
  };

  const handleToggleForceUpdate = () => {
    setEditingSettings({
      ...editingSettings,
      forceUpdate: !editingSettings.forceUpdate,
    });
  };

  const handleExportSettings = () => {
    const settingsJson = JSON.stringify(editingSettings, null, 2);
    Alert.alert('Export Settings', 'Settings exported to clipboard', [
      { text: 'OK', onPress: () => {} },
    ]);
  };

  return (
    <ScreenContainer className="bg-background">
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="active:opacity-70">
          <MaterialIcons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-foreground">App Settings</Text>
        <View className="w-6" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Colors Section */}
        <View>
          <Text className="text-lg font-bold text-foreground mb-4">Colors</Text>

          <View className="bg-surface border border-border rounded-lg p-4 gap-4">
            <View>
              <Text className="text-sm font-semibold text-muted mb-2">Primary Color</Text>
              <View className="flex-row items-center gap-3">
                <View
                  className="w-12 h-12 rounded-lg border-2 border-border"
                  style={{ backgroundColor: editingSettings.primaryColor }}
                />
                <TextInput
                  value={editingSettings.primaryColor}
                  onChangeText={(text) =>
                    setEditingSettings({ ...editingSettings, primaryColor: text })
                  }
                  placeholder="#22C55E"
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>

            <View>
              <Text className="text-sm font-semibold text-muted mb-2">Secondary Color</Text>
              <View className="flex-row items-center gap-3">
                <View
                  className="w-12 h-12 rounded-lg border-2 border-border"
                  style={{ backgroundColor: editingSettings.secondaryColor }}
                />
                <TextInput
                  value={editingSettings.secondaryColor}
                  onChangeText={(text) =>
                    setEditingSettings({ ...editingSettings, secondaryColor: text })
                  }
                  placeholder="#0a7ea4"
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>

            <View>
              <Text className="text-sm font-semibold text-muted mb-2">Accent Color</Text>
              <View className="flex-row items-center gap-3">
                <View
                  className="w-12 h-12 rounded-lg border-2 border-border"
                  style={{ backgroundColor: editingSettings.accentColor }}
                />
                <TextInput
                  value={editingSettings.accentColor}
                  onChangeText={(text) =>
                    setEditingSettings({ ...editingSettings, accentColor: text })
                  }
                  placeholder="#EF4444"
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Version Section */}
        <View>
          <Text className="text-lg font-bold text-foreground mb-4">Version Control</Text>

          <View className="bg-surface border border-border rounded-lg p-4 gap-4">
            <View>
              <Text className="text-sm font-semibold text-muted mb-2">Current App Version</Text>
              <TextInput
                value={editingSettings.appVersion}
                onChangeText={(text) =>
                  setEditingSettings({ ...editingSettings, appVersion: text })
                }
                placeholder="1.0.0"
                className="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                placeholderTextColor={colors.muted}
              />
            </View>

            <View>
              <Text className="text-sm font-semibold text-muted mb-2">Minimum Required Version</Text>
              <TextInput
                value={editingSettings.minAppVersion}
                onChangeText={(text) =>
                  setEditingSettings({ ...editingSettings, minAppVersion: text })
                }
                placeholder="1.0.0"
                className="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                placeholderTextColor={colors.muted}
              />
            </View>

            <TouchableOpacity
              onPress={handleToggleForceUpdate}
              className={`flex-row items-center justify-between p-3 rounded-lg ${
                editingSettings.forceUpdate ? 'bg-primary/10' : 'bg-background border border-border'
              }`}
            >
              <Text className="font-semibold text-foreground">Force Update</Text>
              <View
                className={`w-10 h-6 rounded-full items-center justify-center ${
                  editingSettings.forceUpdate ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <MaterialIcons
                  name={editingSettings.forceUpdate ? 'check' : 'close'}
                  size={16}
                  color="white"
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Maintenance Section */}
        <View>
          <Text className="text-lg font-bold text-foreground mb-4">Maintenance</Text>

          <View className="bg-surface border border-border rounded-lg p-4 gap-4">
            <TouchableOpacity
              onPress={handleToggleMaintenance}
              className={`flex-row items-center justify-between p-3 rounded-lg ${
                editingSettings.maintenanceMode ? 'bg-error/10' : 'bg-background border border-border'
              }`}
            >
              <Text className="font-semibold text-foreground">Maintenance Mode</Text>
              <View
                className={`w-10 h-6 rounded-full items-center justify-center ${
                  editingSettings.maintenanceMode ? 'bg-error' : 'bg-muted'
                }`}
              >
                <MaterialIcons
                  name={editingSettings.maintenanceMode ? 'check' : 'close'}
                  size={16}
                  color="white"
                />
              </View>
            </TouchableOpacity>

            {editingSettings.maintenanceMode && (
              <View>
                <Text className="text-sm font-semibold text-muted mb-2">Maintenance Message</Text>
                <TextInput
                  value={editingSettings.maintenanceMessage}
                  onChangeText={(text) =>
                    setEditingSettings({ ...editingSettings, maintenanceMessage: text })
                  }
                  placeholder="We are under maintenance..."
                  multiline
                  numberOfLines={3}
                  className="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                  placeholderTextColor={colors.muted}
                />
              </View>
            )}
          </View>
        </View>

        {/* URLs Section */}
        <View>
          <Text className="text-lg font-bold text-foreground mb-4">URLs</Text>

          <View className="bg-surface border border-border rounded-lg p-4 gap-4">
            <View>
              <Text className="text-sm font-semibold text-muted mb-2">App Logo URL</Text>
              <TextInput
                value={editingSettings.appLogo}
                onChangeText={(text) =>
                  setEditingSettings({ ...editingSettings, appLogo: text })
                }
                placeholder="Logo URL"
                className="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                placeholderTextColor={colors.muted}
              />
            </View>

            <View>
              <Text className="text-sm font-semibold text-muted mb-2">Favicon URL</Text>
              <TextInput
                value={editingSettings.appFavicon}
                onChangeText={(text) =>
                  setEditingSettings({ ...editingSettings, appFavicon: text })
                }
                placeholder="Favicon URL"
                className="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                placeholderTextColor={colors.muted}
              />
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="gap-3">
          <TouchableOpacity
            onPress={handleSaveSettings}
            className="bg-primary rounded-lg py-3 items-center active:opacity-80"
          >
            <Text className="text-background font-semibold">Save Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleExportSettings}
            className="bg-surface border border-border rounded-lg py-3 items-center active:opacity-80"
          >
            <Text className="text-foreground font-semibold">Export Settings</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
