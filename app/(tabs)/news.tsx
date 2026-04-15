import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Image,
  TouchableOpacity,
  Linking,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useNews } from "@/contexts/news-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const WHATSAPP_CHANNEL_URL = "https://whatsapp.com/channel/0029VbBI2c16hENx0dnt593o";

export default function NewsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { getActiveNavigationNews, loadNavigationNews } = useNews();
  const [refreshing, setRefreshing] = useState(false);

  const navigationNews = getActiveNavigationNews();

  const handleWhatsAppChannel = () => {
    Linking.openURL(WHATSAPP_CHANNEL_URL);
  };

  const handleNewsPress = (newsId: string) => {
    router.push(`/news-detail?newsId=${newsId}&source=navigation` as any);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNavigationNews();
    setRefreshing(false);
  };

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

  return (
    <ScreenContainer className="flex-1">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View className="px-4 pt-4 pb-2">
          <Text className="text-2xl font-bold text-foreground">News & Updates</Text>
          <Text className="text-sm text-muted mt-1">
            Stay updated with LTC Fast Track progress
          </Text>
        </View>

        {/* WhatsApp Channel Banner */}
        <TouchableOpacity
          onPress={handleWhatsAppChannel}
          className="mx-4 mb-4 bg-primary rounded-xl p-4"
          style={{ backgroundColor: "#25D366" }}
          activeOpacity={0.8}
        >
          <View className="flex-row items-center">
            <View className="w-12 h-12 rounded-full bg-white/20 items-center justify-center mr-3">
              <IconSymbol name="paperplane.fill" size={24} color="#fff" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-bold text-base">
                Follow Our WhatsApp Channel
              </Text>
              <Text className="text-white/90 text-sm mt-0.5">
                LTC Fast Track - Get instant updates
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* News List */}
        <View className="px-4 pb-24">
          <Text className="text-lg font-semibold text-foreground mb-3">
            Latest News
          </Text>

          {navigationNews.length === 0 ? (
            <View className="bg-surface rounded-xl p-8 items-center justify-center border border-border">
              <MaterialIcons name="article" size={48} color={colors.muted} />
              <Text className="text-muted text-center mt-3">
                No news available at the moment
              </Text>
            </View>
          ) : (
            navigationNews.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleNewsPress(item.id)}
                activeOpacity={0.7}
                className="mb-4 bg-surface rounded-xl overflow-hidden border border-border"
              >
                <Image
                  source={typeof item.image === "string" ? { uri: item.image } : item.image}
                  style={{ width: "100%", height: 180 }}
                  resizeMode="cover"
                />
                <View className="p-4">
                  {/* Category Badge */}
                  <View
                    style={{
                      backgroundColor: getCategoryColor(item.category),
                      alignSelf: "flex-start",
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 12,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "600" }}>
                      {item.category}
                    </Text>
                  </View>

                  {/* Date */}
                  <Text className="text-xs text-muted mb-1">
                    {formatDate(item.createdAt)}
                  </Text>

                  {/* Title */}
                  <Text className="text-lg font-semibold text-foreground mb-2">
                    {item.title}
                  </Text>

                  {/* Short Description */}
                  <Text className="text-sm text-muted leading-5" numberOfLines={2}>
                    {item.shortDescription}
                  </Text>

                  {/* Read More */}
                  <View className="flex-row items-center mt-3">
                    <Text className="text-primary font-medium text-sm">Read More</Text>
                    <MaterialIcons name="chevron-right" size={18} color={colors.primary} />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
