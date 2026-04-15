import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useWebhooks } from '@/lib/webhooks-context';

const WEBHOOK_EVENTS = [
  { id: 'pickup.created', label: 'Pickup Created', icon: 'add-circle' },
  { id: 'pickup.completed', label: 'Pickup Completed', icon: 'check-circle' },
  { id: 'payment.processed', label: 'Payment Processed', icon: 'payment' },
  { id: 'dispute.filed', label: 'Dispute Filed', icon: 'warning' },
  { id: 'subscription.activated', label: 'Subscription Activated', icon: 'card-membership' },
  { id: 'subscription.cancelled', label: 'Subscription Cancelled', icon: 'cancel' },
];

export default function AdminWebhooksScreen() {
  const colors = useColors();
  const { webhooks, createWebhook, deleteWebhook, toggleWebhook, getWebhookStats } = useWebhooks();
  const [showNewWebhookModal, setShowNewWebhookModal] = useState(false);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [newWebhookName, setNewWebhookName] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [apiKeyId, setApiKeyId] = useState('key-001');

  const handleCreateWebhook = () => {
    if (!newWebhookName.trim()) {
      Alert.alert('Error', 'Please enter a webhook name');
      return;
    }

    if (!newWebhookUrl.trim()) {
      Alert.alert('Error', 'Please enter a webhook URL');
      return;
    }

    if (selectedEvents.length === 0) {
      Alert.alert('Error', 'Please select at least one event');
      return;
    }

    createWebhook(newWebhookName, newWebhookUrl, apiKeyId, selectedEvents as any);
    Alert.alert('Success', 'Webhook created successfully');

    setNewWebhookName('');
    setNewWebhookUrl('');
    setSelectedEvents([]);
    setShowNewWebhookModal(false);
  };

  const handleToggleEvent = (eventId: string) => {
    setSelectedEvents(
      selectedEvents.includes(eventId)
        ? selectedEvents.filter(e => e !== eventId)
        : [...selectedEvents, eventId]
    );
  };

  const selectedWebhook = selectedWebhookId ? webhooks.find(w => w.id === selectedWebhookId) : null;

  return (
    <ScreenContainer className="bg-background">
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="active:opacity-70">
          <MaterialIcons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-foreground">Webhooks</Text>
        <TouchableOpacity onPress={() => setShowNewWebhookModal(true)} className="active:opacity-70">
          <MaterialIcons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 12 }}>
        {webhooks.length === 0 ? (
          <View className="items-center justify-center py-12 gap-4">
            <MaterialIcons name="webhook" size={48} color={colors.muted} />
            <Text className="text-foreground font-semibold">No Webhooks</Text>
            <Text className="text-muted text-center text-sm">Create your first webhook to receive real-time events</Text>
          </View>
        ) : (
          webhooks.map((webhook) => {
            const stats = getWebhookStats(webhook.id);
            return (
              <TouchableOpacity
                key={webhook.id}
                onPress={() => setSelectedWebhookId(selectedWebhookId === webhook.id ? null : webhook.id)}
                className={`border rounded-lg overflow-hidden ${
                  selectedWebhookId === webhook.id ? 'border-primary bg-primary/5' : 'border-border bg-surface'
                }`}
              >
                <View className="p-4 gap-3">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <Text className="text-lg font-bold text-foreground">{webhook.name}</Text>
                      <Text className="text-xs text-muted mt-1 font-mono truncate">{webhook.url}</Text>
                    </View>
                    <View className={`px-2 py-1 rounded ${webhook.isActive ? 'bg-green-100' : 'bg-red-100'}`}>
                      <Text className={`text-xs font-semibold ${webhook.isActive ? 'text-green-700' : 'text-red-700'}`}>
                        {webhook.isActive ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row gap-4 text-xs">
                    <View>
                      <Text className="text-muted">Success</Text>
                      <Text className="text-success font-semibold">{stats.successCount}</Text>
                    </View>
                    <View>
                      <Text className="text-muted">Failed</Text>
                      <Text className="text-error font-semibold">{stats.failureCount}</Text>
                    </View>
                    <View>
                      <Text className="text-muted">Events</Text>
                      <Text className="text-foreground font-semibold">{webhook.events.length}</Text>
                    </View>
                  </View>

                  {selectedWebhookId === webhook.id && (
                    <View className="mt-4 pt-4 border-t border-border gap-4">
                      <View>
                        <Text className="text-sm font-semibold text-muted mb-2">Events ({webhook.events.length})</Text>
                        <View className="flex-row flex-wrap gap-2">
                          {webhook.events.map((event) => {
                            const eventInfo = WEBHOOK_EVENTS.find(e => e.id === event);
                            return (
                              <View key={event} className="bg-primary/10 rounded-full px-3 py-1 flex-row items-center gap-1">
                                <MaterialIcons name={eventInfo?.icon as any} size={12} color={colors.primary} />
                                <Text className="text-xs text-primary font-semibold">{eventInfo?.label}</Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>

                      {stats.lastTriggeredAt && (
                        <View>
                          <Text className="text-sm font-semibold text-muted">Last Triggered</Text>
                          <Text className="text-foreground">{new Date(stats.lastTriggeredAt).toLocaleString()}</Text>
                        </View>
                      )}

                      <View className="flex-row gap-2 pt-2">
                        <TouchableOpacity
                          onPress={() => {
                            toggleWebhook(webhook.id);
                            Alert.alert('Success', webhook.isActive ? 'Webhook disabled' : 'Webhook enabled');
                          }}
                          className={`flex-1 rounded-lg py-2 items-center active:opacity-70 ${
                            webhook.isActive ? 'bg-warning/10' : 'bg-success/10'
                          }`}
                        >
                          <Text className={`font-semibold text-sm ${webhook.isActive ? 'text-warning' : 'text-success'}`}>
                            {webhook.isActive ? 'Disable' : 'Enable'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            Alert.alert('Delete Webhook', 'This will permanently delete the webhook.', [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: () => {
                                  deleteWebhook(webhook.id);
                                  Alert.alert('Success', 'Webhook deleted');
                                },
                              },
                            ]);
                          }}
                          className="flex-1 bg-error/10 rounded-lg py-2 items-center active:opacity-70"
                        >
                          <Text className="text-error font-semibold text-sm">Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* New Webhook Modal */}
      <Modal visible={showNewWebhookModal} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-2xl p-6 max-h-[90%]">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-2xl font-bold text-foreground">Create Webhook</Text>
              <TouchableOpacity onPress={() => setShowNewWebhookModal(false)} className="active:opacity-70">
                <MaterialIcons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: 16 }}>
              <View>
                <Text className="text-sm font-semibold text-muted mb-2">Webhook Name</Text>
                <TextInput
                  value={newWebhookName}
                  onChangeText={setNewWebhookName}
                  placeholder="e.g., Pickup Events"
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View>
                <Text className="text-sm font-semibold text-muted mb-2">Webhook URL</Text>
                <TextInput
                  value={newWebhookUrl}
                  onChangeText={setNewWebhookUrl}
                  placeholder="https://example.com/webhooks"
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View>
                <Text className="text-sm font-semibold text-muted mb-2">Events</Text>
                <View className="gap-2">
                  {WEBHOOK_EVENTS.map((event) => (
                    <TouchableOpacity
                      key={event.id}
                      onPress={() => handleToggleEvent(event.id)}
                      className={`flex-row items-center p-3 rounded-lg border ${
                        selectedEvents.includes(event.id)
                          ? 'bg-primary/10 border-primary'
                          : 'bg-surface border-border'
                      }`}
                    >
                      <MaterialIcons
                        name={selectedEvents.includes(event.id) ? 'check-box' : 'check-box-outline-blank'}
                        size={20}
                        color={selectedEvents.includes(event.id) ? colors.primary : colors.muted}
                      />
                      <MaterialIcons name={event.icon as any} size={16} color={colors.foreground} className="ml-2" />
                      <Text className="ml-3 text-foreground font-medium">{event.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                onPress={handleCreateWebhook}
                className="bg-primary rounded-lg py-4 items-center active:opacity-80 mt-4"
              >
                <Text className="text-background font-bold text-lg">Create Webhook</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
