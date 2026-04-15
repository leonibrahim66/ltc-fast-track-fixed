import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useContentManagement } from '@/lib/content-management-context';
import { useFeaturedUpdates } from '@/lib/featured-updates-context';

export default function AdminContentEditor() {
  const colors = useColors();
  const { appContent, updateAppContent } = useContentManagement();
  const { updates, createUpdate, updateUpdate, deleteUpdate } = useFeaturedUpdates();
  
  const [activeTab, setActiveTab] = useState<'content' | 'updates'>('content');
  const [editingContent, setEditingContent] = useState(appContent);
  const [newUpdate, setNewUpdate] = useState<{
    title: string;
    message: string;
    type: 'feature' | 'announcement' | 'promotion' | 'maintenance' | 'tip';
    icon: string;
    color: string;
    priority: number;
    startDate: string;
    dismissible: boolean;
    targetRoles: string[];
  }>({
    title: '',
    message: '',
    type: 'announcement',
    icon: 'info',
    color: '#22C55E',
    priority: 2,
    startDate: new Date().toISOString(),
    dismissible: true,
    targetRoles: ['customer', 'collector', 'recycler'],
  });
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);

  const handleSaveContent = () => {
    updateAppContent(editingContent);
    Alert.alert('Success', 'App content updated successfully');
  };

  const handleAddUpdate = async () => {
    if (!newUpdate.title.trim() || !newUpdate.message.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    try {
      await createUpdate({
        title: newUpdate.title,
        message: newUpdate.message,
        type: newUpdate.type,
        icon: newUpdate.icon,
        color: newUpdate.color,
        priority: newUpdate.priority,
        startDate: newUpdate.startDate,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        dismissible: newUpdate.dismissible,
        targetRoles: newUpdate.targetRoles,
      });
      
      setNewUpdate({
        title: '',
        message: '',
        type: 'announcement',
        icon: 'info',
        color: '#22C55E',
        priority: 2,
        startDate: new Date().toISOString(),
        dismissible: true,
        targetRoles: ['customer', 'collector', 'recycler'],
      });
      
      Alert.alert('Success', 'Featured update added successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to add update');
    }
  };

  const handleDeleteUpdate = (id: string) => {
    Alert.alert('Delete Update', 'Are you sure you want to delete this update?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteUpdate(id);
          Alert.alert('Success', 'Update deleted');
        },
      },
    ]);
  };

  return (
    <ScreenContainer className="bg-background">
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="active:opacity-70">
          <MaterialIcons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-foreground">Content Manager</Text>
        <View className="w-6" />
      </View>

      {/* Tab Navigation */}
      <View className="flex-row border-b border-border">
        <TouchableOpacity
          onPress={() => setActiveTab('content')}
          className={`flex-1 py-3 items-center border-b-2 ${
            activeTab === 'content' ? 'border-primary' : 'border-transparent'
          }`}
        >
          <Text className={`font-semibold ${activeTab === 'content' ? 'text-primary' : 'text-muted'}`}>
            App Content
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('updates')}
          className={`flex-1 py-3 items-center border-b-2 ${
            activeTab === 'updates' ? 'border-primary' : 'border-transparent'
          }`}
        >
          <Text className={`font-semibold ${activeTab === 'updates' ? 'text-primary' : 'text-muted'}`}>
            Featured Updates
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 16 }}>
        {activeTab === 'content' ? (
          // App Content Editor
          <View className="gap-4">
            <View>
              <Text className="text-sm font-semibold text-muted mb-2">App Name</Text>
              <TextInput
                value={editingContent.appName}
                onChangeText={(text) => setEditingContent({ ...editingContent, appName: text })}
                placeholder="App name"
                className="bg-surface border border-border rounded-lg px-3 py-2 text-foreground"
                placeholderTextColor={colors.muted}
              />
            </View>

            <View>
              <Text className="text-sm font-semibold text-muted mb-2">Tagline</Text>
              <TextInput
                value={editingContent.appTagline}
                onChangeText={(text) => setEditingContent({ ...editingContent, appTagline: text })}
                placeholder="App tagline"
                className="bg-surface border border-border rounded-lg px-3 py-2 text-foreground"
                placeholderTextColor={colors.muted}
              />
            </View>

            <View>
              <Text className="text-sm font-semibold text-muted mb-2">Description</Text>
              <TextInput
                value={editingContent.appDescription}
                onChangeText={(text) => setEditingContent({ ...editingContent, appDescription: text })}
                placeholder="App description"
                multiline
                numberOfLines={4}
                className="bg-surface border border-border rounded-lg px-3 py-2 text-foreground"
                placeholderTextColor={colors.muted}
              />
            </View>

            <View>
              <Text className="text-sm font-semibold text-muted mb-2">Support Phone</Text>
              <TextInput
                value={editingContent.supportPhone}
                onChangeText={(text) => setEditingContent({ ...editingContent, supportPhone: text })}
                placeholder="Support phone"
                className="bg-surface border border-border rounded-lg px-3 py-2 text-foreground"
                placeholderTextColor={colors.muted}
              />
            </View>

            <View>
              <Text className="text-sm font-semibold text-muted mb-2">Support Email</Text>
              <TextInput
                value={editingContent.supportEmail}
                onChangeText={(text) => setEditingContent({ ...editingContent, supportEmail: text })}
                placeholder="Support email"
                className="bg-surface border border-border rounded-lg px-3 py-2 text-foreground"
                placeholderTextColor={colors.muted}
              />
            </View>

            <View>
              <Text className="text-sm font-semibold text-muted mb-2">WhatsApp Link</Text>
              <TextInput
                value={editingContent.whatsappLink}
                onChangeText={(text) => setEditingContent({ ...editingContent, whatsappLink: text })}
                placeholder="WhatsApp link"
                className="bg-surface border border-border rounded-lg px-3 py-2 text-foreground"
                placeholderTextColor={colors.muted}
              />
            </View>

            <View>
              <Text className="text-sm font-semibold text-muted mb-2">Payment Phone</Text>
              <TextInput
                value={editingContent.paymentPhone}
                onChangeText={(text) => setEditingContent({ ...editingContent, paymentPhone: text })}
                placeholder="Payment phone"
                className="bg-surface border border-border rounded-lg px-3 py-2 text-foreground"
                placeholderTextColor={colors.muted}
              />
            </View>

            <TouchableOpacity
              onPress={handleSaveContent}
              className="bg-primary rounded-lg py-3 items-center active:opacity-80"
            >
              <Text className="text-background font-semibold">Save Content</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Featured Updates Editor
          <View className="gap-4">
            <View className="bg-surface border border-border rounded-lg p-4">
              <Text className="text-lg font-bold text-foreground mb-4">Add New Update</Text>

              <View>
                <Text className="text-sm font-semibold text-muted mb-2">Title</Text>
                <TextInput
                  value={newUpdate.title}
                  onChangeText={(text) => setNewUpdate({ ...newUpdate, title: text })}
                  placeholder="Update title"
                  className="bg-background border border-border rounded-lg px-3 py-2 text-foreground mb-3"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View>
                <Text className="text-sm font-semibold text-muted mb-2">Message</Text>
                <TextInput
                  value={newUpdate.message}
                  onChangeText={(text) => setNewUpdate({ ...newUpdate, message: text })}
                  placeholder="Update message"
                  multiline
                  numberOfLines={3}
                  className="bg-background border border-border rounded-lg px-3 py-2 text-foreground mb-3"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View>
                <Text className="text-sm font-semibold text-muted mb-2">Type</Text>
                <View className="flex-row gap-2 flex-wrap">
                  {(['announcement', 'feature', 'promotion', 'maintenance', 'tip'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setNewUpdate({ ...newUpdate, type })}
                      className={`py-2 px-3 rounded-lg ${
                        newUpdate.type === type ? 'bg-primary' : 'bg-background border border-border'
                      }`}
                    >
                      <Text
                        className={`capitalize font-semibold text-xs ${
                          newUpdate.type === type ? 'text-background' : 'text-foreground'
                        }`}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View>
                <Text className="text-sm font-semibold text-muted mb-2">Priority Level</Text>
                <View className="flex-row gap-2">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <TouchableOpacity
                      key={level}
                      onPress={() => setNewUpdate({ ...newUpdate, priority: level })}
                      className={`flex-1 py-2 rounded-lg items-center ${
                        newUpdate.priority === level ? 'bg-primary' : 'bg-background border border-border'
                      }`}
                    >
                      <Text
                        className={`font-semibold ${
                          newUpdate.priority === level ? 'text-background' : 'text-foreground'
                        }`}
                      >
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                onPress={handleAddUpdate}
                className="bg-primary rounded-lg py-3 items-center active:opacity-80 mt-4"
              >
                <Text className="text-background font-semibold">Add Update</Text>
              </TouchableOpacity>
            </View>

            {/* Existing Updates */}
            <View>
              <Text className="text-lg font-bold text-foreground mb-3">Active Updates ({updates.length})</Text>
              {updates.map((update) => (
                <View key={update.id} className="bg-surface border border-border rounded-lg p-3 mb-3">
                  <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-1">
                      <Text className="text-base font-bold text-foreground">{update.title}</Text>
                      <Text className="text-xs text-muted capitalize mt-1">Priority: {update.priority}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteUpdate(update.id)}
                      className="bg-error/10 p-2 rounded-lg active:opacity-70"
                    >
                      <MaterialIcons name="delete" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                  <Text className="text-sm text-muted">{update.message}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
