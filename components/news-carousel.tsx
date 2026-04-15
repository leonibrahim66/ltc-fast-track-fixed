import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  Dimensions,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
} from "react-native";
import { useRouter } from "expo-router";
import { HomeNewsItem } from "@/types/news";
import { useColors } from "@/hooks/use-colors";

import { getStaticResponsive } from "@/hooks/use-responsive";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CAROUSEL_HEIGHT = 220;
const AUTO_SLIDE_INTERVAL = 5000; // 5 seconds

interface NewsCarouselProps {
  news: HomeNewsItem[];
}

export function NewsCarousel({ news }: NewsCarouselProps) {
  const router = useRouter();
  const colors = useColors();
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto-slide effect
  useEffect(() => {
    if (news.length <= 1) return;

    const interval = setInterval(() => {
      setActiveIndex((current) => {
        const nextIndex = (current + 1) % news.length;
        flatListRef.current?.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
        return nextIndex;
      });
    }, AUTO_SLIDE_INTERVAL);

    return () => clearInterval(interval);
  }, [news.length]);

  const handleScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / SCREEN_WIDTH);
    setActiveIndex(index);
  };

  const handleItemPress = (item: HomeNewsItem) => {
    if (item.type === "sponsor") {
      router.push(`/sponsor-detail?newsId=${item.id}` as any);
    } else {
      router.push(`/news-detail?newsId=${item.id}&source=home` as any);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Trash Pickup Services":
        return "#10B981";
      case "Carrier Services":
        return "#3B82F6";
      case "Announcement":
        return "#F59E0B";
      default:
        return "#6B7280";
    }
  };

  const renderNewsSlide = (item: HomeNewsItem) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => handleItemPress(item)}
      style={styles.carouselItem}
    >
      <Image
        source={typeof item.image === "string" ? { uri: item.image } : item.image}
        style={styles.carouselImage}
        resizeMode="cover"
      />
      <View style={styles.overlay} />
      <View style={styles.contentOverlay}>
        <View
          style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.category) }]}
        >
          <Text style={styles.categoryText}>{item.category}</Text>
        </View>
        <Text style={styles.newsTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.newsDescription} numberOfLines={2}>
          {item.shortDescription}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderSponsorSlide = (item: HomeNewsItem) => {
    const sponsor = item.sponsorDetails;
    const heroImage = sponsor?.images?.[0] ?? item.image;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => handleItemPress(item)}
        style={styles.carouselItem}
      >
        <Image
          source={typeof heroImage === "string" ? { uri: heroImage } : heroImage}
          style={styles.carouselImage}
          resizeMode="cover"
        />
        {/* Darker gradient overlay for sponsors */}
        <View style={styles.sponsorOverlay} />

        {/* Top-right SPONSORED badge */}
        <View style={styles.sponsoredBadge}>
          <Text style={styles.sponsoredText}>SPONSORED</Text>
        </View>

        {/* Bottom content */}
        <View style={styles.contentOverlay}>
          {/* Sponsor type pill */}
          <View style={styles.sponsorTypePill}>
            <Text style={styles.sponsorTypeText}>
              {sponsor?.sponsorType ?? "Partner"}
            </Text>
          </View>

          {/* Sponsor name */}
          <Text style={styles.sponsorName} numberOfLines={1}>
            {sponsor?.sponsorName ?? item.title}
          </Text>

          {/* Short description */}
          <Text style={styles.newsDescription} numberOfLines={2}>
            {item.shortDescription}
          </Text>

          {/* Tap to learn more */}
          <View style={styles.learnMoreRow}>
            <Text style={styles.learnMoreText}>Tap to learn more</Text>
            <View style={styles.learnMoreArrow}>
              <Text style={styles.learnMoreArrowText}>›</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: HomeNewsItem }) => {
    if (item.type === "sponsor") {
      return renderSponsorSlide(item);
    }
    return renderNewsSlide(item);
  };

  const renderDotIndicators = () => (
    <View style={styles.dotContainer}>
      {news.map((item, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor:
                index === activeIndex
                  ? item.type === "sponsor"
                    ? "#F59E0B" // Gold dot for sponsor
                    : colors.primary
                  : "rgba(255,255,255,0.4)",
              width: index === activeIndex ? 24 : 8,
            },
          ]}
        />
      ))}
    </View>
  );

  if (news.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.surface }]}>
        <Text style={[styles.emptyText, { color: colors.muted }]}>No news available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={news}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />
      {news.length > 1 && renderDotIndicators()}
    </View>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: CAROUSEL_HEIGHT,
    marginLeft: -16,
    marginRight: -16,
  },
  carouselItem: {
    width: SCREEN_WIDTH,
    height: CAROUSEL_HEIGHT,
    position: "relative",
  },
  carouselImage: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sponsorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.52)",
  },
  contentOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: _rs.sp(16),
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: _rs.sp(12),
    paddingVertical: _rs.sp(4),
    borderRadius: _rs.s(12),
    marginBottom: _rs.sp(8),
  },
  categoryText: {
    color: "#FFFFFF",
    fontSize: _rs.fs(11),
    fontWeight: "600",
    textTransform: "uppercase",
  },
  newsTitle: {
    color: "#FFFFFF",
    fontSize: _rs.fs(18),
    fontWeight: "700",
    marginBottom: _rs.sp(4),
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  newsDescription: {
    color: "rgba(255,255,255,0.85)",
    fontSize: _rs.fs(13),
    fontWeight: "400",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  // Sponsor-specific styles
  sponsoredBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(245,158,11,0.9)",
    paddingHorizontal: _rs.sp(10),
    paddingVertical: _rs.sp(4),
    borderRadius: _rs.s(8),
  },
  sponsoredText: {
    color: "#FFFFFF",
    fontSize: _rs.fs(10),
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  sponsorTypePill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(245,158,11,0.85)",
    paddingHorizontal: _rs.sp(10),
    paddingVertical: _rs.sp(3),
    borderRadius: _rs.s(10),
    marginBottom: _rs.sp(6),
  },
  sponsorTypeText: {
    color: "#FFFFFF",
    fontSize: _rs.fs(10),
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sponsorName: {
    color: "#FFFFFF",
    fontSize: _rs.fs(19),
    fontWeight: "800",
    marginBottom: _rs.sp(3),
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  learnMoreRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: _rs.sp(6),
  },
  learnMoreText: {
    color: "#F59E0B",
    fontSize: _rs.fs(12),
    fontWeight: "600",
  },
  learnMoreArrow: {
    marginLeft: _rs.sp(4),
    width: _rs.s(18),
    height: _rs.s(18),
    borderRadius: _rs.s(9),
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
  },
  learnMoreArrowText: {
    color: "#FFFFFF",
    fontSize: _rs.fs(14),
    fontWeight: "700",
    lineHeight: _rs.fs(18),
  },
  dotContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    gap: _rs.sp(6),
  },
  dot: {
    height: _rs.s(8),
    borderRadius: _rs.s(4),
  },
  emptyContainer: {
    width: SCREEN_WIDTH,
    height: CAROUSEL_HEIGHT,
    marginLeft: -16,
    marginRight: -16,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: _rs.fs(14),
    fontWeight: "500",
  },
});
