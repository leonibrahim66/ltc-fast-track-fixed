import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  Linking,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useNews } from "@/contexts/news-context";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { HomeNewsItem } from "@/types/news";

import { getStaticResponsive } from "@/hooks/use-responsive";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GALLERY_HEIGHT = 260;

export default function SponsorDetailScreen() {
  const router = useRouter();
  const colors = useColors();
  const params = useLocalSearchParams();
  const { homeNews } = useNews();

  const newsId = params.newsId as string;
  const flatListRef = useRef<FlatList>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [sponsorItem, setSponsorItem] = useState<HomeNewsItem | null>(null);

  useEffect(() => {
    const item = homeNews.find((n) => n.id === newsId && n.type === "sponsor");
    setSponsorItem(item ?? null);
  }, [newsId, homeNews]);

  const handleScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / SCREEN_WIDTH);
    setActiveImageIndex(index);
  };

  const openWebsite = () => {
    const url = sponsorItem?.sponsorDetails?.website;
    if (!url) return;
    Linking.openURL(url).catch(() =>
      Alert.alert("Cannot Open Link", "Unable to open the website at this time.")
    );
  };

  const callSponsor = () => {
    const phone = sponsorItem?.sponsorDetails?.contact;
    if (!phone) return;
    Linking.openURL(`tel:${phone.replace(/\s/g, "")}`).catch(() =>
      Alert.alert("Cannot Call", "Unable to initiate the call at this time.")
    );
  };

  if (!sponsorItem || !sponsorItem.sponsorDetails) {
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
          <Text style={[styles.emptyText, { color: colors.muted }]}>Sponsor not found</Text>
        </View>
      </ScreenContainer>
    );
  }

  const sponsor = sponsorItem.sponsorDetails;
  const images: any[] = sponsor.images.length > 0 ? sponsor.images : [sponsorItem.image];

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Image Gallery ─────────────────────────────────────────── */}
        <View style={styles.galleryContainer}>
          <FlatList
            ref={flatListRef}
            data={images}
            keyExtractor={(_, i) => String(i)}
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
            renderItem={({ item }) => (
              <Image
                source={typeof item === "string" ? { uri: item } : item}
                style={styles.galleryImage}
                resizeMode="cover"
              />
            )}
          />

          {/* Dark overlay at bottom of gallery */}
          <View style={styles.galleryBottomOverlay} />

          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButtonOverlay}
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {/* SPONSORED badge */}
          <View style={styles.sponsoredBadge}>
            <Text style={styles.sponsoredText}>SPONSORED</Text>
          </View>

          {/* Image count indicator */}
          {images.length > 1 && (
            <View style={styles.imageCountBadge}>
              <MaterialIcons name="photo-library" size={13} color="#fff" />
              <Text style={styles.imageCountText}>
                {activeImageIndex + 1}/{images.length}
              </Text>
            </View>
          )}

          {/* Dot indicators */}
          {images.length > 1 && (
            <View style={styles.dotContainer}>
              {images.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        index === activeImageIndex
                          ? "#F59E0B"
                          : "rgba(255,255,255,0.45)",
                      width: index === activeImageIndex ? 20 : 7,
                    },
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── Content ───────────────────────────────────────────────── */}
        <View style={styles.contentContainer}>

          {/* Sponsor type pill */}
          <View style={[styles.typePill, { backgroundColor: "#F59E0B" }]}>
            <Text style={styles.typePillText}>{sponsor.sponsorType}</Text>
          </View>

          {/* Sponsor name */}
          <Text style={[styles.sponsorName, { color: colors.foreground }]}>
            {sponsor.sponsorName}
          </Text>

          {/* Short description */}
          <Text style={[styles.shortDesc, { color: colors.foreground }]}>
            {sponsorItem.shortDescription}
          </Text>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Full description */}
          <Text style={[styles.fullDesc, { color: colors.foreground }]}>
            {sponsor.description}
          </Text>

          {/* ── Action Buttons ──────────────────────────────────────── */}
          <View style={styles.actionsContainer}>
            {sponsor.website ? (
              <TouchableOpacity
                onPress={openWebsite}
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                activeOpacity={0.8}
              >
                <MaterialIcons name="language" size={20} color="#fff" />
                <Text style={styles.actionBtnText}>Visit Website</Text>
              </TouchableOpacity>
            ) : null}

            {sponsor.contact ? (
              <TouchableOpacity
                onPress={callSponsor}
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: "transparent",
                    borderWidth: 1.5,
                    borderColor: colors.primary,
                  },
                ]}
                activeOpacity={0.8}
              >
                <MaterialIcons name="phone" size={20} color={colors.primary} />
                <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                  {sponsor.contact}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* ── Thumbnail Strip (if > 1 image) ──────────────────────── */}
          {images.length > 1 && (
            <View style={styles.thumbnailSection}>
              <Text style={[styles.thumbnailLabel, { color: colors.muted }]}>
                Gallery ({images.length} photos)
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.thumbnailRow}>
                  {images.map((img, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => {
                        setActiveImageIndex(index);
                        flatListRef.current?.scrollToIndex({ index, animated: true });
                      }}
                      style={[
                        styles.thumbnail,
                        index === activeImageIndex && styles.thumbnailActive,
                      ]}
                    >
                      <Image
                        source={typeof img === "string" ? { uri: img } : img}
                        style={styles.thumbnailImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* ── Disclaimer ──────────────────────────────────────────── */}
          <View style={[styles.disclaimer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialIcons name="info-outline" size={14} color={colors.muted} />
            <Text style={[styles.disclaimerText, { color: colors.muted }]}>
              This is a paid sponsorship. LTC Fast Track is not responsible for third-party products or services.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: _rs.sp(48),
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
  // Gallery
  galleryContainer: {
    width: SCREEN_WIDTH,
    height: GALLERY_HEIGHT,
    position: "relative",
  },
  galleryImage: {
    width: SCREEN_WIDTH,
    height: GALLERY_HEIGHT,
  },
  galleryBottomOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: _rs.s(80),
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  backButtonOverlay: {
    position: "absolute",
    top: 16,
    left: 16,
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  sponsoredBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(245,158,11,0.92)",
    paddingHorizontal: _rs.sp(10),
    paddingVertical: _rs.sp(5),
    borderRadius: _rs.s(8),
  },
  sponsoredText: {
    color: "#FFFFFF",
    fontSize: _rs.fs(10),
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  imageCountBadge: {
    position: "absolute",
    bottom: 36,
    right: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: _rs.sp(8),
    paddingVertical: _rs.sp(4),
    borderRadius: _rs.s(10),
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(4),
  },
  imageCountText: {
    color: "#FFFFFF",
    fontSize: _rs.fs(11),
    fontWeight: "600",
  },
  dotContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    gap: _rs.sp(5),
  },
  dot: {
    height: _rs.s(7),
    borderRadius: _rs.s(3.5),
  },
  // Content
  contentContainer: {
    padding: _rs.sp(20),
  },
  typePill: {
    alignSelf: "flex-start",
    paddingHorizontal: _rs.sp(12),
    paddingVertical: _rs.sp(5),
    borderRadius: _rs.s(12),
    marginBottom: _rs.sp(10),
  },
  typePillText: {
    color: "#FFFFFF",
    fontSize: _rs.fs(11),
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sponsorName: {
    fontSize: _rs.fs(26),
    fontWeight: "800",
    marginBottom: _rs.sp(8),
    lineHeight: _rs.fs(32),
  },
  shortDesc: {
    fontSize: _rs.fs(16),
    fontWeight: "600",
    lineHeight: _rs.fs(24),
    marginBottom: _rs.sp(16),
  },
  divider: {
    height: 1,
    marginVertical: _rs.sp(16),
  },
  fullDesc: {
    fontSize: _rs.fs(15),
    fontWeight: "400",
    lineHeight: _rs.fs(25),
    marginBottom: _rs.sp(24),
  },
  // Action buttons
  actionsContainer: {
    gap: _rs.sp(12),
    marginBottom: _rs.sp(24),
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: _rs.sp(14),
    borderRadius: _rs.s(14),
    gap: _rs.sp(8),
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: _rs.fs(15),
    fontWeight: "700",
  },
  // Thumbnail strip
  thumbnailSection: {
    marginBottom: _rs.sp(24),
  },
  thumbnailLabel: {
    fontSize: _rs.fs(13),
    fontWeight: "600",
    marginBottom: _rs.sp(10),
  },
  thumbnailRow: {
    flexDirection: "row",
    gap: _rs.sp(8),
  },
  thumbnail: {
    width: _rs.s(80),
    height: _rs.s(60),
    borderRadius: _rs.s(8),
    overflow: "hidden",
    opacity: 0.65,
  },
  thumbnailActive: {
    opacity: 1,
    borderWidth: 2.5,
    borderColor: "#F59E0B",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  // Disclaimer
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: _rs.sp(8),
    padding: _rs.sp(12),
    borderRadius: _rs.s(10),
    borderWidth: 1,
  },
  disclaimerText: {
    flex: 1,
    fontSize: _rs.fs(12),
    lineHeight: _rs.fs(18),
  },
});
