import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useNews } from "@/contexts/news-context";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { HomeNewsItem, NavigationNewsItem } from "@/types/news";

import { getStaticResponsive } from "@/hooks/use-responsive";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function NewsDetailScreen() {
  const router = useRouter();
  const colors = useColors();
  const params = useLocalSearchParams();
  const { homeNews, navigationNews } = useNews();

  const newsId = params.newsId as string;
  const source = params.source as "home" | "navigation";

  const [newsItem, setNewsItem] = useState<HomeNewsItem | NavigationNewsItem | null>(null);

  useEffect(() => {
    if (source === "home") {
      const item = homeNews.find((n) => n.id === newsId);
      setNewsItem(item || null);
    } else {
      const item = navigationNews.find((n) => n.id === newsId);
      setNewsItem(item || null);
    }
  }, [newsId, source, homeNews, navigationNews]);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Trash Pickup Services":
        return "#10B981"; // Green
      case "Carrier Services":
        return "#3B82F6"; // Blue
      case "Announcement":
        return "#F59E0B"; // Amber
      default:
        return "#6B7280"; // Gray
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (!newsItem) {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: colors.surface }]}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.muted }]}>News not found</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Image */}
        <View style={styles.imageContainer}>
          <Image
            source={typeof newsItem.image === "string" ? { uri: newsItem.image } : newsItem.image}
            style={styles.headerImage}
            resizeMode="cover"
          />
          <View style={styles.imageOverlay} />
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButtonOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          {/* Category Badge */}
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: getCategoryColor(newsItem.category) },
            ]}
          >
            <Text style={styles.categoryText}>{newsItem.category}</Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.foreground }]}>{newsItem.title}</Text>

          {/* Date */}
          <Text style={[styles.date, { color: colors.muted }]}>
            {formatDate(newsItem.createdAt)}
          </Text>

          {/* Short Description */}
          <Text style={[styles.shortDescription, { color: colors.foreground }]}>
            {newsItem.shortDescription}
          </Text>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Full Description */}
          <Text style={[styles.fullDescription, { color: colors.foreground }]}>
            {newsItem.fullDescription}
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: _rs.sp(40),
  },
  header: {
    padding: _rs.sp(16),
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: _rs.fs(16),
    fontWeight: "500",
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: _rs.s(280),
    position: "relative",
  },
  headerImage: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  backButtonOverlay: {
    position: "absolute",
    top: 16,
    left: 16,
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainer: {
    padding: _rs.sp(20),
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: _rs.sp(12),
    paddingVertical: _rs.sp(6),
    borderRadius: _rs.s(16),
    marginBottom: _rs.sp(12),
  },
  categoryText: {
    color: "#FFFFFF",
    fontSize: _rs.fs(12),
    fontWeight: "600",
    textTransform: "uppercase",
  },
  title: {
    fontSize: _rs.fs(26),
    fontWeight: "700",
    marginBottom: _rs.sp(8),
    lineHeight: _rs.fs(34),
  },
  date: {
    fontSize: _rs.fs(14),
    fontWeight: "400",
    marginBottom: _rs.sp(16),
  },
  shortDescription: {
    fontSize: _rs.fs(16),
    fontWeight: "600",
    lineHeight: _rs.fs(24),
    marginBottom: _rs.sp(16),
  },
  divider: {
    height: 1,
    marginVertical: _rs.sp(20),
  },
  fullDescription: {
    fontSize: _rs.fs(16),
    fontWeight: "400",
    lineHeight: _rs.fs(26),
  },
});
