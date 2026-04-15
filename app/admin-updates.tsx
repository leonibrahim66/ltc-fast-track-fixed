import { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  RefreshControl,
  Modal,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import { useFeaturedUpdates, FeaturedUpdate, UpdateType } from "@/lib/featured-updates-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function AdminUpdatesScreen() {
  const router = useRouter();
  const { isAdminAuthenticated } = useAdmin();
  const { updates, createUpdate, updateUpdate, deleteUpdate, refreshUpdates } = useFeaturedUpdates();
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<FeaturedUpdate | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<UpdateType>("announcement");
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [dismissible, setDismissible] = useState(true);
  const [priority, setPriority] = useState(50);
  const [icon, setIcon] = useState("campaign");
  const [color, setColor] = useState("#3B82F6");

  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.replace("/admin-login" as any);
      return;
    }
  }, [isAdminAuthenticated]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshUpdates();
    setRefreshing(false);
  };

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setType("announcement");
    setTargetRoles([]);
    setDismissible(true);
    setPriority(50);
    setIcon("campaign");
    setColor("#3B82F6");
    setEditingUpdate(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (update: FeaturedUpdate) => {
    setEditingUpdate(update);
    setTitle(update.title);
    setMessage(update.message);
    setType(update.type);
    setTargetRoles(update.targetRoles || []);
    setDismissible(update.dismissible);
    setPriority(update.priority);
    setIcon(update.icon);
    setColor(update.color);
    setShowCreateModal(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert("Error", "Title and message are required");
      return;
    }

    const updateData = {
      title: title.trim(),
      message: message.trim(),
      type,
      targetRoles: targetRoles.length > 0 ? targetRoles : undefined,
      dismissible,
      priority,
      icon,
      color,
      startDate: new Date().toISOString(),
    };

    if (editingUpdate) {
      await updateUpdate(editingUpdate.id, updateData);
      Alert.alert("Success", "Update modified successfully");
    } else {
      await createUpdate(updateData);
      Alert.alert("Success", "Update created successfully");
    }

    setShowCreateModal(false);
    resetForm();
  };

  const handleDelete = (update: FeaturedUpdate) => {
    Alert.alert(
      "Delete Update",
      `Are you sure you want to delete "${update.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteUpdate(update.id);
            Alert.alert("Success", "Update deleted");
          },
        },
      ]
    );
  };

  const isUpdateActive = (update: FeaturedUpdate) => {
    const now = new Date();
    const startDate = new Date(update.startDate);
    const endDate = update.endDate ? new Date(update.endDate) : null;
    return now >= startDate && (!endDate || now <= endDate);
  };

  const toggleActive = async (update: FeaturedUpdate) => {
    if (isUpdateActive(update)) {
      // Deactivate by setting endDate to now
      await updateUpdate(update.id, { endDate: new Date().toISOString() });
    } else {
      // Reactivate by clearing endDate and setting new startDate
      await updateUpdate(update.id, { startDate: new Date().toISOString(), endDate: undefined });
    }
  };

  const getTypeStyle = (updateType: UpdateType) => {
    switch (updateType) {
      case "announcement":
        return { bg: "bg-blue-500/10", text: "text-blue-500", color: "#3B82F6", icon: "campaign" };
      case "feature":
        return { bg: "bg-success/10", text: "text-success", color: "#22C55E", icon: "new-releases" };
      case "tip":
        return { bg: "bg-purple-500/10", text: "text-purple-500", color: "#8B5CF6", icon: "lightbulb" };
      case "promotion":
        return { bg: "bg-warning/10", text: "text-warning", color: "#F59E0B", icon: "local-offer" };
      default:
        return { bg: "bg-muted/10", text: "text-muted", color: "#9BA1A6", icon: "info" };
    }
  };

  const updateTypes: { id: UpdateType; label: string; icon: string }[] = [
    { id: "announcement", label: "Announcement", icon: "campaign" },
    { id: "feature", label: "New Feature", icon: "new-releases" },
    { id: "tip", label: "Tip", icon: "lightbulb" },
    { id: "promotion", label: "Promotion", icon: "local-offer" },
  ];

  const roleOptions = [
    { id: "all", label: "All Users" },
    { id: "residential", label: "Residential" },
    { id: "commercial", label: "Commercial" },
    { id: "collector", label: "Zone Managers" },
    { id: "zone_manager", label: "Zone Managers (New)" },
    { id: "recycler", label: "Recyclers" },
  ];

  const toggleRole = (role: string) => {
    if (role === "all") {
      setTargetRoles(["all"]);
    } else {
      const newRoles = targetRoles.filter((r) => r !== "all");
      if (newRoles.includes(role)) {
        setTargetRoles(newRoles.filter((r) => r !== role));
      } else {
        setTargetRoles([...newRoles, role]);
      }
    }
  };

  const renderUpdateItem = ({ item }: { item: FeaturedUpdate }) => {
    const typeStyle = getTypeStyle(item.type);

    return (
      <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-row items-center flex-1">
            <View
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: `${typeStyle.color}20` }}
            >
              <MaterialIcons name={typeStyle.icon as any} size={20} color={typeStyle.color} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-foreground font-semibold">{item.title}</Text>
              <Text className="text-muted text-xs capitalize">{item.type}</Text>
            </View>
          </View>
          <View className="flex-row items-center">
            <View
              className={`px-2 py-1 rounded-full mr-2 ${
                isUpdateActive(item) ? "bg-success/10" : "bg-muted/10"
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  isUpdateActive(item) ? "text-success" : "text-muted"
                }`}
              >
                {isUpdateActive(item) ? "Active" : "Inactive"}
              </Text>
            </View>
          </View>
        </View>

        <Text className="text-muted text-sm mb-2" numberOfLines={2}>
          {item.message}
        </Text>

        <View className="flex-row items-center justify-between pt-2 border-t border-border">
          <View className="flex-row items-center">
            <MaterialIcons name="people" size={14} color="#9BA1A6" />
            <Text className="text-muted text-xs ml-1">
              {!item.targetRoles || item.targetRoles.length === 0
                ? "All Users"
                : item.targetRoles.join(", ")}
            </Text>
          </View>
          <Text className="text-muted text-xs">
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>

        {/* Action Buttons */}
        <View className="flex-row mt-3 pt-3 border-t border-border">
          <TouchableOpacity
            onPress={() => toggleActive(item)}
            className="flex-1 flex-row items-center justify-center py-2 mr-1 bg-background rounded-lg"
          >
            <MaterialIcons
              name={isUpdateActive(item) ? "visibility-off" : "visibility"}
              size={16}
              color="#9BA1A6"
            />
            <Text className="text-muted text-sm ml-1">
              {isUpdateActive(item) ? "Deactivate" : "Activate"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => openEditModal(item)}
            className="flex-1 flex-row items-center justify-center py-2 mx-1 bg-background rounded-lg"
          >
            <MaterialIcons name="edit" size={16} color="#3B82F6" />
            <Text className="text-blue-500 text-sm ml-1">Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            className="flex-1 flex-row items-center justify-center py-2 ml-1 bg-background rounded-lg"
          >
            <MaterialIcons name="delete" size={16} color="#EF4444" />
            <Text className="text-error text-sm ml-1">Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (!isAdminAuthenticated) {
    return null;
  }

  return (
    <ScreenContainer>
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
            <Text className="text-2xl font-bold text-foreground">Featured Updates</Text>
            <Text className="text-muted">{updates.length} updates</Text>
          </View>
          <TouchableOpacity
            onPress={openCreateModal}
            className="bg-primary px-4 py-2 rounded-full flex-row items-center"
          >
            <MaterialIcons name="add" size={20} color="#fff" />
            <Text className="text-white font-medium ml-1">New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Updates List */}
      <FlatList
        data={updates}
        renderItem={renderUpdateItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <MaterialIcons name="campaign" size={48} color="#9BA1A6" />
            <Text className="text-muted text-center mt-4">No updates yet</Text>
            <TouchableOpacity
              onPress={openCreateModal}
              className="mt-4 bg-primary px-6 py-3 rounded-full"
            >
              <Text className="text-white font-medium">Create First Update</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Create/Edit Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6 max-h-[90%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-foreground">
                {editingUpdate ? "Edit Update" : "Create Update"}
              </Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <MaterialIcons name="close" size={24} color="#9BA1A6" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Title */}
              <View className="mb-4">
                <Text className="text-foreground font-medium mb-2">Title *</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Enter update title..."
                  placeholderTextColor="#9BA1A6"
                  className="bg-surface rounded-xl border border-border p-4 text-foreground"
                />
              </View>

              {/* Message */}
              <View className="mb-4">
                <Text className="text-foreground font-medium mb-2">Message *</Text>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Enter update message..."
                  placeholderTextColor="#9BA1A6"
                  multiline
                  numberOfLines={4}
                  className="bg-surface rounded-xl border border-border p-4 text-foreground"
                  textAlignVertical="top"
                />
              </View>

              {/* Type */}
              <View className="mb-4">
                <Text className="text-foreground font-medium mb-2">Type</Text>
                <View className="flex-row flex-wrap">
                  {updateTypes.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => setType(t.id)}
                      className={`px-4 py-2 rounded-full mr-2 mb-2 flex-row items-center ${
                        type === t.id ? "bg-primary" : "bg-surface border border-border"
                      }`}
                    >
                      <MaterialIcons
                        name={t.icon as any}
                        size={16}
                        color={type === t.id ? "#fff" : "#9BA1A6"}
                      />
                      <Text
                        className={`ml-1 font-medium ${
                          type === t.id ? "text-white" : "text-muted"
                        }`}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Target Roles */}
              <View className="mb-4">
                <Text className="text-foreground font-medium mb-2">Target Audience</Text>
                <View className="flex-row flex-wrap">
                  {roleOptions.map((role) => (
                    <TouchableOpacity
                      key={role.id}
                      onPress={() => toggleRole(role.id)}
                      className={`px-4 py-2 rounded-full mr-2 mb-2 ${
                        targetRoles.includes(role.id)
                          ? "bg-primary"
                          : "bg-surface border border-border"
                      }`}
                    >
                      <Text
                        className={`font-medium ${
                          targetRoles.includes(role.id) ? "text-white" : "text-muted"
                        }`}
                      >
                        {role.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Priority */}
              <View className="mb-4">
                <Text className="text-foreground font-medium mb-2">Priority (1-100)</Text>
                <TextInput
                  value={String(priority)}
                  onChangeText={(v) => setPriority(Math.min(100, Math.max(1, parseInt(v) || 50)))}
                  placeholder="50"
                  placeholderTextColor="#9BA1A6"
                  keyboardType="numeric"
                  className="bg-surface rounded-xl border border-border p-4 text-foreground"
                />
                <Text className="text-muted text-xs mt-1">Higher priority updates appear first</Text>
              </View>

              {/* Dismissible Toggle */}
              <View className="flex-row items-center justify-between mb-6 bg-surface rounded-xl p-4 border border-border">
                <View>
                  <Text className="text-foreground font-medium">Dismissible</Text>
                  <Text className="text-muted text-sm">Users can dismiss this update</Text>
                </View>
                <Switch
                  value={dismissible}
                  onValueChange={setDismissible}
                  trackColor={{ false: "#E5E7EB", true: "#22C55E" }}
                  thumbColor="#fff"
                />
              </View>

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSave}
                className="bg-primary py-4 rounded-xl items-center mb-6"
              >
                <Text className="text-white font-semibold text-lg">
                  {editingUpdate ? "Save Changes" : "Create Update"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
