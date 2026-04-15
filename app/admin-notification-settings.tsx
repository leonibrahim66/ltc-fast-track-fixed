import { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Switch,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import {
  useNotificationSettings,
  NotificationRecipient,
  NotificationChannel,
  AlertPriority,
} from "@/lib/notification-settings-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function AdminNotificationSettingsScreen() {
  const router = useRouter();
  const { isAdminAuthenticated, hasPermission } = useAdmin();
  const {
    recipients,
    templates,
    logs,
    addRecipient,
    updateRecipient,
    deleteRecipient,
    toggleRecipient,
    updateTemplate,
    getRecentLogs,
  } = useNotificationSettings();

  const [activeTab, setActiveTab] = useState<"recipients" | "templates" | "logs">("recipients");
  const [showAddRecipient, setShowAddRecipient] = useState(false);
  const [newRecipient, setNewRecipient] = useState({
    name: "",
    email: "",
    phone: "",
    channels: ["email"] as NotificationChannel[],
    alertPriority: "high" as AlertPriority,
  });

  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.replace("/admin-login" as any);
      return;
    }
    if (!hasPermission("settings")) {
      Alert.alert("Access Denied", "You don't have permission to access notification settings.");
      router.back();
    }
  }, [isAdminAuthenticated]);

  const handleAddRecipient = async () => {
    if (!newRecipient.name.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }
    if (!newRecipient.email && !newRecipient.phone) {
      Alert.alert("Error", "Please enter an email or phone number");
      return;
    }

    await addRecipient({
      name: newRecipient.name,
      email: newRecipient.email || undefined,
      phone: newRecipient.phone || undefined,
      channels: newRecipient.channels,
      alertPriority: newRecipient.alertPriority,
      enabled: true,
    });

    setShowAddRecipient(false);
    setNewRecipient({
      name: "",
      email: "",
      phone: "",
      channels: ["email"],
      alertPriority: "high",
    });
  };

  const handleDeleteRecipient = (id: string, name: string) => {
    Alert.alert(
      "Delete Recipient",
      `Are you sure you want to remove "${name}" from notifications?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteRecipient(id) },
      ]
    );
  };

  const toggleChannel = (channel: NotificationChannel) => {
    const channels = newRecipient.channels.includes(channel)
      ? newRecipient.channels.filter((c) => c !== channel)
      : [...newRecipient.channels, channel];
    setNewRecipient({ ...newRecipient, channels });
  };

  const getChannelIcon = (channel: NotificationChannel) => {
    switch (channel) {
      case "email":
        return "email";
      case "sms":
        return "sms";
      case "push":
        return "notifications";
      case "inApp":
        return "inbox";
      default:
        return "notifications";
    }
  };

  const recentLogs = getRecentLogs(20);

  if (!isAdminAuthenticated || !hasPermission("settings")) {
    return null;
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="px-6 pt-4 pb-4">
          <View className="flex-row items-center mb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-4"
            >
              <MaterialIcons name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground">Notification Settings</Text>
              <Text className="text-muted">Configure email & SMS alerts</Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View className="px-6 mb-4">
          <View className="flex-row bg-surface rounded-xl p-1">
            <TouchableOpacity
              onPress={() => setActiveTab("recipients")}
              className={`flex-1 py-3 rounded-lg ${activeTab === "recipients" ? "bg-primary" : ""}`}
            >
              <Text className={`text-center font-medium ${activeTab === "recipients" ? "text-white" : "text-muted"}`}>
                Recipients
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab("templates")}
              className={`flex-1 py-3 rounded-lg ${activeTab === "templates" ? "bg-primary" : ""}`}
            >
              <Text className={`text-center font-medium ${activeTab === "templates" ? "text-white" : "text-muted"}`}>
                Templates
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab("logs")}
              className={`flex-1 py-3 rounded-lg ${activeTab === "logs" ? "bg-primary" : ""}`}
            >
              <Text className={`text-center font-medium ${activeTab === "logs" ? "text-white" : "text-muted"}`}>
                Logs
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {activeTab === "recipients" && (
          <View className="px-6">
            {/* Add Button */}
            <TouchableOpacity
              onPress={() => setShowAddRecipient(true)}
              className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-4 flex-row items-center justify-center"
            >
              <MaterialIcons name="add" size={24} color="#22C55E" />
              <Text className="text-primary font-semibold ml-2">Add Recipient</Text>
            </TouchableOpacity>

            {/* Recipients List */}
            {recipients.length === 0 ? (
              <View className="bg-surface rounded-xl p-8 border border-border items-center">
                <MaterialIcons name="person-add" size={48} color="#9BA1A6" />
                <Text className="text-foreground font-semibold mt-3">No Recipients</Text>
                <Text className="text-muted text-center mt-1">
                  Add recipients to receive alert notifications
                </Text>
              </View>
            ) : (
              recipients.map((recipient) => (
                <View
                  key={recipient.id}
                  className={`bg-surface rounded-xl p-4 mb-3 border border-border ${
                    !recipient.enabled ? "opacity-50" : ""
                  }`}
                >
                  <View className="flex-row items-start">
                    <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center">
                      <MaterialIcons name="person" size={24} color="#22C55E" />
                    </View>
                    <View className="flex-1 ml-3">
                      <Text className="text-foreground font-semibold">{recipient.name}</Text>
                      {recipient.email && (
                        <View className="flex-row items-center mt-1">
                          <MaterialIcons name="email" size={14} color="#9BA1A6" />
                          <Text className="text-muted text-sm ml-1">{recipient.email}</Text>
                        </View>
                      )}
                      {recipient.phone && (
                        <View className="flex-row items-center mt-1">
                          <MaterialIcons name="phone" size={14} color="#9BA1A6" />
                          <Text className="text-muted text-sm ml-1">{recipient.phone}</Text>
                        </View>
                      )}
                      <View className="flex-row items-center mt-2">
                        {recipient.channels.map((channel) => (
                          <View
                            key={channel}
                            className="bg-primary/10 px-2 py-1 rounded mr-2"
                          >
                            <Text className="text-primary text-xs capitalize">{channel}</Text>
                          </View>
                        ))}
                        <View className="bg-warning/10 px-2 py-1 rounded">
                          <Text className="text-warning text-xs capitalize">{recipient.alertPriority}</Text>
                        </View>
                      </View>
                    </View>
                    <View className="items-end">
                      <Switch
                        value={recipient.enabled}
                        onValueChange={() => toggleRecipient(recipient.id)}
                        trackColor={{ false: "#E5E7EB", true: "#22C55E40" }}
                        thumbColor={recipient.enabled ? "#22C55E" : "#9BA1A6"}
                      />
                      <TouchableOpacity
                        onPress={() => handleDeleteRecipient(recipient.id, recipient.name)}
                        className="mt-2"
                      >
                        <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === "templates" && (
          <View className="px-6">
            {templates.map((template) => (
              <View
                key={template.id}
                className={`bg-surface rounded-xl p-4 mb-3 border border-border ${
                  !template.enabled ? "opacity-50" : ""
                }`}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-foreground font-semibold">{template.name}</Text>
                  <Switch
                    value={template.enabled}
                    onValueChange={(value) => updateTemplate(template.id, { enabled: value })}
                    trackColor={{ false: "#E5E7EB", true: "#22C55E40" }}
                    thumbColor={template.enabled ? "#22C55E" : "#9BA1A6"}
                  />
                </View>
                <View className="bg-background rounded-lg p-3 mb-2">
                  <Text className="text-muted text-xs mb-1">Subject</Text>
                  <Text className="text-foreground text-sm">{template.subject}</Text>
                </View>
                <View className="bg-background rounded-lg p-3 mb-2">
                  <Text className="text-muted text-xs mb-1">SMS Preview</Text>
                  <Text className="text-foreground text-sm" numberOfLines={2}>
                    {template.smsBody}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <View className="bg-primary/10 px-2 py-1 rounded">
                    <Text className="text-primary text-xs capitalize">{template.alertType}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === "logs" && (
          <View className="px-6">
            {recentLogs.length === 0 ? (
              <View className="bg-surface rounded-xl p-8 border border-border items-center">
                <MaterialIcons name="history" size={48} color="#9BA1A6" />
                <Text className="text-foreground font-semibold mt-3">No Logs Yet</Text>
                <Text className="text-muted text-center mt-1">
                  Notification logs will appear here
                </Text>
              </View>
            ) : (
              recentLogs.map((log) => (
                <View
                  key={log.id}
                  className="bg-surface rounded-xl p-3 mb-2 border border-border flex-row items-center"
                >
                  <View
                    className={`w-10 h-10 rounded-full items-center justify-center ${
                      log.status === "sent" ? "bg-success/10" : "bg-error/10"
                    }`}
                  >
                    <MaterialIcons
                      name={getChannelIcon(log.channel) as any}
                      size={20}
                      color={log.status === "sent" ? "#22C55E" : "#EF4444"}
                    />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-foreground text-sm font-medium">{log.recipientName}</Text>
                    <Text className="text-muted text-xs">{log.subject}</Text>
                    <Text className="text-muted text-xs">
                      {new Date(log.sentAt).toLocaleString()}
                    </Text>
                  </View>
                  <View
                    className={`px-2 py-1 rounded ${
                      log.status === "sent" ? "bg-success/10" : "bg-error/10"
                    }`}
                  >
                    <Text
                      className={`text-xs capitalize ${
                        log.status === "sent" ? "text-success" : "text-error"
                      }`}
                    >
                      {log.status}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Add Recipient Modal */}
      <Modal visible={showAddRecipient} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-foreground">Add Recipient</Text>
              <TouchableOpacity onPress={() => setShowAddRecipient(false)}>
                <MaterialIcons name="close" size={24} color="#9BA1A6" />
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text className="text-muted text-sm mb-2">Name *</Text>
              <TextInput
                value={newRecipient.name}
                onChangeText={(text) => setNewRecipient({ ...newRecipient, name: text })}
                placeholder="John Doe"
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                placeholderTextColor="#9BA1A6"
              />
            </View>

            <View className="mb-4">
              <Text className="text-muted text-sm mb-2">Email</Text>
              <TextInput
                value={newRecipient.email}
                onChangeText={(text) => setNewRecipient({ ...newRecipient, email: text })}
                placeholder="john@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                placeholderTextColor="#9BA1A6"
              />
            </View>

            <View className="mb-4">
              <Text className="text-muted text-sm mb-2">Phone (for SMS)</Text>
              <TextInput
                value={newRecipient.phone}
                onChangeText={(text) => setNewRecipient({ ...newRecipient, phone: text })}
                placeholder="+260960000000"
                keyboardType="phone-pad"
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                placeholderTextColor="#9BA1A6"
              />
            </View>

            <View className="mb-4">
              <Text className="text-muted text-sm mb-2">Notification Channels</Text>
              <View className="flex-row flex-wrap">
                {(["email", "sms", "push", "inApp"] as NotificationChannel[]).map((channel) => (
                  <TouchableOpacity
                    key={channel}
                    onPress={() => toggleChannel(channel)}
                    className={`px-4 py-2 rounded-lg mr-2 mb-2 flex-row items-center ${
                      newRecipient.channels.includes(channel)
                        ? "bg-primary"
                        : "bg-surface border border-border"
                    }`}
                  >
                    <MaterialIcons
                      name={getChannelIcon(channel) as any}
                      size={16}
                      color={newRecipient.channels.includes(channel) ? "#fff" : "#9BA1A6"}
                    />
                    <Text
                      className={`ml-1 capitalize ${
                        newRecipient.channels.includes(channel) ? "text-white" : "text-foreground"
                      }`}
                    >
                      {channel}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="mb-6">
              <Text className="text-muted text-sm mb-2">Alert Priority</Text>
              <View className="flex-row">
                {(["all", "high", "critical"] as AlertPriority[]).map((priority) => (
                  <TouchableOpacity
                    key={priority}
                    onPress={() => setNewRecipient({ ...newRecipient, alertPriority: priority })}
                    className={`flex-1 py-3 rounded-lg mr-2 ${
                      newRecipient.alertPriority === priority
                        ? "bg-primary"
                        : "bg-surface border border-border"
                    }`}
                  >
                    <Text
                      className={`text-center capitalize ${
                        newRecipient.alertPriority === priority ? "text-white" : "text-foreground"
                      }`}
                    >
                      {priority}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              onPress={handleAddRecipient}
              className="bg-primary py-4 rounded-xl"
            >
              <Text className="text-white text-center font-semibold">Add Recipient</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
