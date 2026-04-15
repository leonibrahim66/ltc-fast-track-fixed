import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  Switch,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useNews } from "@/contexts/news-context";
import { HomeNewsItem, NavigationNewsItem, NewsCategory } from "@/types/news";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";

import { getStaticResponsive } from "@/hooks/use-responsive";
type TabType = "home" | "navigation";

export default function AdminNewsManagementScreen() {
  const router = useRouter();
  const colors = useColors();
  const {
    homeNews,
    navigationNews,
    addHomeNews,
    addNavigationNews,
    updateHomeNews,
    updateNavigationNews,
    deleteHomeNews,
    deleteNavigationNews,
  } = useNews();

  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingNews, setEditingNews] = useState<HomeNewsItem | NavigationNewsItem | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    image: "",
    title: "",
    shortDescription: "",
    fullDescription: "",
    category: "General" as NewsCategory,
    isActive: true,
    order: 1,
  });

  const categories: NewsCategory[] = [
    "Trash Pickup Services",
    "Carrier Services",
    "General",
    "Announcement",
  ];

  const handleImagePick = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow access to your photo library to upload news images.");
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setFormData({ ...formData, image: result.assets[0].uri });
    }
  };

  const resetForm = () => {
    setFormData({
      image: "",
      title: "",
      shortDescription: "",
      fullDescription: "",
      category: "General",
      isActive: true,
      order: 1,
    });
    setEditingNews(null);
    setShowAddModal(false);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.shortDescription || !formData.fullDescription) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    const newsData = {
      id: editingNews?.id || `${activeTab}-${Date.now()}`,
      image: formData.image || require("@/assets/news-images/garbage-truck.jpg"),
      title: formData.title,
      shortDescription: formData.shortDescription,
      fullDescription: formData.fullDescription,
      category: formData.category,
      isActive: formData.isActive,
      order: formData.order,
      createdAt: editingNews?.createdAt || new Date().toISOString(),
    };

    try {
      if (editingNews) {
        if (activeTab === "home") {
          await updateHomeNews(newsData as HomeNewsItem);
        } else {
          await updateNavigationNews(newsData as NavigationNewsItem);
        }
        Alert.alert("Success", "News updated successfully");
      } else {
        if (activeTab === "home") {
          await addHomeNews(newsData as HomeNewsItem);
        } else {
          await addNavigationNews(newsData as NavigationNewsItem);
        }
        Alert.alert("Success", "News added successfully");
      }
      resetForm();
    } catch (error) {
      Alert.alert("Error", "Failed to save news");
    }
  };

  const handleEdit = (news: HomeNewsItem | NavigationNewsItem) => {
    setEditingNews(news);
    setFormData({
      image: news.image as string,
      title: news.title,
      shortDescription: news.shortDescription,
      fullDescription: news.fullDescription,
      category: news.category,
      isActive: news.isActive,
      order: news.order,
    });
    setShowAddModal(true);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "Delete News",
      "Are you sure you want to delete this news item?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (activeTab === "home") {
              await deleteHomeNews(id);
            } else {
              await deleteNavigationNews(id);
            }
            Alert.alert("Success", "News deleted successfully");
          },
        },
      ]
    );
  };

  const currentNews = activeTab === "home" ? homeNews : navigationNews;
  const sortedNews = [...currentNews].sort((a, b) => a.order - b.order);

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          News Management
        </Text>
        <TouchableOpacity
          onPress={() => setShowAddModal(true)}
          style={[styles.addButton, { backgroundColor: colors.primary }]}
        >
          <MaterialIcons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => setActiveTab("home")}
          style={[
            styles.tab,
            activeTab === "home" && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
          ]}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === "home" ? colors.primary : colors.muted },
            ]}
          >
            Home News ({homeNews.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab("navigation")}
          style={[
            styles.tab,
            activeTab === "navigation" && {
              borderBottomColor: colors.primary,
              borderBottomWidth: 2,
            },
          ]}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === "navigation" ? colors.primary : colors.muted },
            ]}
          >
            Navigation News ({navigationNews.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* News List or Form */}
      <ScrollView style={styles.content}>
        {showAddModal ? (
          <View style={styles.formContainer}>
            <Text style={[styles.formTitle, { color: colors.foreground }]}>
              {editingNews ? "Edit News" : "Add New News"}
            </Text>

            {/* Image Picker */}
            <TouchableOpacity
              onPress={handleImagePick}
              style={[styles.imagePicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              {formData.image ? (
                <Image source={{ uri: formData.image }} style={styles.previewImage} />
              ) : (
                <View style={styles.imagePickerPlaceholder}>
                  <MaterialIcons name="add-photo-alternate" size={48} color={colors.muted} />
                  <Text style={[styles.imagePickerText, { color: colors.muted }]}>
                    Tap to upload image
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Title */}
            <Text style={[styles.label, { color: colors.foreground }]}>Title *</Text>
            <TextInput
              value={formData.title}
              onChangeText={(text) => setFormData({ ...formData, title: text })}
              placeholder="Enter news title"
              placeholderTextColor={colors.muted}
              style={[styles.input, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
            />

            {/* Short Description */}
            <Text style={[styles.label, { color: colors.foreground }]}>Short Description *</Text>
            <TextInput
              value={formData.shortDescription}
              onChangeText={(text) => setFormData({ ...formData, shortDescription: text })}
              placeholder="Brief summary (for cards and carousel)"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={2}
              style={[styles.input, styles.textArea, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
            />

            {/* Full Description */}
            <Text style={[styles.label, { color: colors.foreground }]}>Full Description *</Text>
            <TextInput
              value={formData.fullDescription}
              onChangeText={(text) => setFormData({ ...formData, fullDescription: text })}
              placeholder="Full article content"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={6}
              style={[styles.input, styles.textArea, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
            />

            {/* Category */}
            <Text style={[styles.label, { color: colors.foreground }]}>Category</Text>
            <View style={styles.categoryContainer}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setFormData({ ...formData, category: cat })}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: formData.category === cat ? colors.primary : colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      { color: formData.category === cat ? "#FFFFFF" : colors.foreground },
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Order */}
            <Text style={[styles.label, { color: colors.foreground }]}>Display Order</Text>
            <TextInput
              value={formData.order.toString()}
              onChangeText={(text) => setFormData({ ...formData, order: parseInt(text) || 1 })}
              placeholder="1"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              style={[styles.input, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
            />

            {/* Active Toggle */}
            <View style={styles.switchRow}>
              <Text style={[styles.label, { color: colors.foreground }]}>Active</Text>
              <Switch
                value={formData.isActive}
                onValueChange={(value) => setFormData({ ...formData, isActive: value })}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                onPress={resetForm}
                style={[styles.button, styles.cancelButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={[styles.buttonText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                style={[styles.button, styles.saveButton, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.buttonText, { color: "#FFFFFF" }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.newsList}>
            {sortedNews.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
                <MaterialIcons name="article" size={64} color={colors.muted} />
                <Text style={[styles.emptyText, { color: colors.muted }]}>
                  No news items yet
                </Text>
                <Text style={[styles.emptySubtext, { color: colors.muted }]}>
                  Tap the + button to add your first news item
                </Text>
              </View>
            ) : (
              sortedNews.map((news) => (
                <View
                  key={news.id}
                  style={[styles.newsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Image
                    source={typeof news.image === "string" ? { uri: news.image } : news.image}
                    style={styles.newsImage}
                  />
                  <View style={styles.newsContent}>
                    <View style={styles.newsHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.newsTitle, { color: colors.foreground }]} numberOfLines={1}>
                          {news.title}
                        </Text>
                        <Text style={[styles.newsCategory, { color: colors.muted }]}>
                          {news.category} • Order: {news.order}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: news.isActive ? "#10B981" : "#EF4444" },
                        ]}
                      >
                        <Text style={styles.statusText}>
                          {news.isActive ? "Active" : "Inactive"}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.newsDescription, { color: colors.muted }]} numberOfLines={2}>
                      {news.shortDescription}
                    </Text>
                    <View style={styles.newsActions}>
                      <TouchableOpacity
                        onPress={() => handleEdit(news)}
                        style={[styles.actionButton, { backgroundColor: colors.primary }]}
                      >
                        <MaterialIcons name="edit" size={18} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(news.id)}
                        style={[styles.actionButton, { backgroundColor: "#EF4444" }]}
                      >
                        <MaterialIcons name="delete" size={18} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: _rs.sp(16),
    borderBottomWidth: 1,
  },
  backButton: {
    padding: _rs.sp(8),
  },
  headerTitle: {
    fontSize: _rs.fs(20),
    fontWeight: "700",
    flex: 1,
    marginLeft: _rs.sp(12),
  },
  addButton: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    justifyContent: "center",
    alignItems: "center",
  },
  tabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: _rs.sp(16),
    alignItems: "center",
  },
  tabText: {
    fontSize: _rs.fs(15),
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  formContainer: {
    padding: _rs.sp(16),
  },
  formTitle: {
    fontSize: _rs.fs(22),
    fontWeight: "700",
    marginBottom: _rs.sp(20),
  },
  imagePicker: {
    width: "100%",
    height: _rs.s(200),
    borderRadius: _rs.s(12),
    marginBottom: _rs.sp(16),
    overflow: "hidden",
    borderWidth: 2,
    borderStyle: "dashed",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  imagePickerPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  imagePickerText: {
    marginTop: _rs.sp(8),
    fontSize: _rs.fs(14),
  },
  label: {
    fontSize: _rs.fs(14),
    fontWeight: "600",
    marginBottom: _rs.sp(8),
  },
  input: {
    borderWidth: 1,
    borderRadius: _rs.s(8),
    padding: _rs.sp(12),
    fontSize: _rs.fs(15),
    marginBottom: _rs.sp(16),
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  categoryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: _rs.sp(8),
    marginBottom: _rs.sp(16),
  },
  categoryChip: {
    paddingHorizontal: _rs.sp(12),
    paddingVertical: _rs.sp(8),
    borderRadius: _rs.s(16),
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: _rs.fs(13),
    fontWeight: "500",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: _rs.sp(24),
  },
  buttonRow: {
    flexDirection: "row",
    gap: _rs.sp(12),
  },
  button: {
    flex: 1,
    paddingVertical: _rs.sp(14),
    borderRadius: _rs.s(8),
    alignItems: "center",
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {},
  buttonText: {
    fontSize: _rs.fs(16),
    fontWeight: "600",
  },
  newsList: {
    padding: _rs.sp(16),
  },
  emptyState: {
    padding: _rs.sp(40),
    borderRadius: _rs.s(12),
    alignItems: "center",
  },
  emptyText: {
    fontSize: _rs.fs(18),
    fontWeight: "600",
    marginTop: _rs.sp(16),
  },
  emptySubtext: {
    fontSize: _rs.fs(14),
    marginTop: _rs.sp(4),
    textAlign: "center",
  },
  newsCard: {
    borderRadius: _rs.s(12),
    marginBottom: _rs.sp(16),
    overflow: "hidden",
    borderWidth: 1,
  },
  newsImage: {
    width: "100%",
    height: _rs.s(160),
  },
  newsContent: {
    padding: _rs.sp(12),
  },
  newsHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: _rs.sp(8),
  },
  newsTitle: {
    fontSize: _rs.fs(16),
    fontWeight: "700",
  },
  newsCategory: {
    fontSize: _rs.fs(12),
    marginTop: _rs.sp(2),
  },
  statusBadge: {
    paddingHorizontal: _rs.sp(8),
    paddingVertical: _rs.sp(4),
    borderRadius: _rs.s(8),
    marginLeft: _rs.sp(8),
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: _rs.fs(11),
    fontWeight: "600",
  },
  newsDescription: {
    fontSize: _rs.fs(14),
    lineHeight: _rs.fs(20),
    marginBottom: _rs.sp(12),
  },
  newsActions: {
    flexDirection: "row",
    gap: _rs.sp(8),
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: _rs.sp(8),
    borderRadius: _rs.s(8),
    gap: _rs.sp(4),
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: _rs.fs(13),
    fontWeight: "600",
  },
});
