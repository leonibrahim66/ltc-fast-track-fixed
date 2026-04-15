import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { useServiceZones, ServiceZone } from "@/lib/service-zones-context";
import { useColors } from "@/hooks/use-colors";
import { APP_CONFIG } from "@/constants/app";

export default function ServiceZonesScreen() {
  const router = useRouter();
  const colors = useColors();
  const { zones, getZoneSurchargeText } = useServiceZones();
  const [selectedZone, setSelectedZone] = useState<ServiceZone | null>(null);

  const getTierColor = (tier: ServiceZone["tier"]) => {
    switch (tier) {
      case "standard": return "#22C55E";
      case "extended": return "#F59E0B";
      case "premium": return "#8B5CF6";
      default: return "#9CA3AF";
    }
  };

  const getTierIcon = (tier: ServiceZone["tier"]) => {
    switch (tier) {
      case "standard": return "check-circle";
      case "extended": return "add-circle";
      case "premium": return "star";
      default: return "help";
    }
  };

  const renderZoneCard = ({ item }: { item: ServiceZone }) => {
    const isSelected = selectedZone?.id === item.id;
    const tierColor = getTierColor(item.tier);

    return (
      <TouchableOpacity
        onPress={() => setSelectedZone(isSelected ? null : item)}
        className={`bg-surface rounded-xl p-4 mb-3 border ${
          isSelected ? "border-primary" : "border-border"
        }`}
      >
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center flex-1">
            <View
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: `${tierColor}20` }}
            >
              <MaterialIcons
                name={getTierIcon(item.tier) as any}
                size={24}
                color={tierColor}
              />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-foreground font-semibold">{item.name}</Text>
              <Text className="text-muted text-sm">{item.description}</Text>
            </View>
          </View>
          <MaterialIcons
            name={isSelected ? "expand-less" : "expand-more"}
            size={24}
            color="#9CA3AF"
          />
        </View>

        {/* Quick Stats */}
        <View className="flex-row mt-2">
          <View className="flex-1 bg-background rounded-lg p-2 mr-2">
            <Text className="text-muted text-xs">Response Time</Text>
            <Text className="text-foreground font-medium text-sm">
              {item.estimatedResponseTime}
            </Text>
          </View>
          <View className="flex-1 bg-background rounded-lg p-2">
            <Text className="text-muted text-xs">Pricing</Text>
            <Text
              className="font-medium text-sm"
              style={{ color: item.priceMultiplier > 1 ? "#F59E0B" : "#22C55E" }}
            >
              {getZoneSurchargeText(item)}
            </Text>
          </View>
        </View>

        {/* Expanded Details */}
        {isSelected && (
          <View className="mt-4 pt-4 border-t border-border">
            <Text className="text-foreground font-medium mb-2">
              Areas Covered:
            </Text>
            <View className="flex-row flex-wrap">
              {item.areas.map((area, index) => (
                <View
                  key={index}
                  className="bg-background px-3 py-1 rounded-full mr-2 mb-2"
                >
                  <Text className="text-muted text-sm">{area}</Text>
                </View>
              ))}
            </View>

            {item.priceMultiplier > 1 && (
              <View className="mt-3 bg-warning/10 rounded-lg p-3">
                <View className="flex-row items-center">
                  <MaterialIcons name="info" size={18} color="#F59E0B" />
                  <Text className="text-warning font-medium ml-2">
                    {Math.round((item.priceMultiplier - 1) * 100)}% surcharge applies
                  </Text>
                </View>
                <Text className="text-muted text-sm mt-1">
                  This zone is outside our standard service area. Additional charges
                  apply to cover extended travel distance.
                </Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-6 pt-4 pb-2">
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center mb-4"
        >
          <MaterialIcons name="arrow-back" size={24} color="#687076" />
          <Text className="text-muted ml-2">Back</Text>
        </TouchableOpacity>

        <Text className="text-2xl font-bold text-foreground mb-1">
          Service Areas
        </Text>
        <Text className="text-muted">
          View our coverage zones and pricing
        </Text>
      </View>

      {/* Map Legend */}
      <View className="mx-6 mt-4 bg-surface rounded-xl p-4 border border-border">
        <Text className="text-foreground font-semibold mb-3">Zone Types</Text>
        <View className="flex-row justify-between">
          <View className="items-center">
            <View
              className="w-10 h-10 rounded-full items-center justify-center mb-1"
              style={{ backgroundColor: "#22C55E20" }}
            >
              <MaterialIcons name="check-circle" size={24} color="#22C55E" />
            </View>
            <Text className="text-muted text-xs">Standard</Text>
            <Text className="text-foreground text-xs font-medium">No extra</Text>
          </View>
          <View className="items-center">
            <View
              className="w-10 h-10 rounded-full items-center justify-center mb-1"
              style={{ backgroundColor: "#F59E0B20" }}
            >
              <MaterialIcons name="add-circle" size={24} color="#F59E0B" />
            </View>
            <Text className="text-muted text-xs">Extended</Text>
            <Text className="text-foreground text-xs font-medium">+25%</Text>
          </View>
          <View className="items-center">
            <View
              className="w-10 h-10 rounded-full items-center justify-center mb-1"
              style={{ backgroundColor: "#8B5CF620" }}
            >
              <MaterialIcons name="star" size={24} color="#8B5CF6" />
            </View>
            <Text className="text-muted text-xs">Premium</Text>
            <Text className="text-foreground text-xs font-medium">+50%</Text>
          </View>
          <View className="items-center">
            <View
              className="w-10 h-10 rounded-full items-center justify-center mb-1"
              style={{ backgroundColor: "#EF444420" }}
            >
              <MaterialIcons name="cancel" size={24} color="#EF4444" />
            </View>
            <Text className="text-muted text-xs">Outside</Text>
            <Text className="text-foreground text-xs font-medium">+100%</Text>
          </View>
        </View>
      </View>

      {/* Zone List */}
      <View className="flex-1 px-6 mt-4">
        <Text className="text-foreground font-semibold mb-3">
          All Service Zones ({zones.length})
        </Text>
        <FlatList
          data={zones}
          renderItem={renderZoneCard}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      </View>

      {/* Pricing Example */}
      <View className="mx-6 mb-6 bg-primary/10 rounded-xl p-4">
        <View className="flex-row items-center mb-2">
          <MaterialIcons name="calculate" size={20} color={colors.primary} />
          <Text className="text-primary font-semibold ml-2">
            Pricing Example
          </Text>
        </View>
        <Text className="text-muted text-sm">
          For a {APP_CONFIG.currencySymbol}100 base pickup fee:
        </Text>
        <View className="mt-2">
          <Text className="text-foreground text-sm">
            • Standard Zone: {APP_CONFIG.currencySymbol}100
          </Text>
          <Text className="text-foreground text-sm">
            • Extended Zone: {APP_CONFIG.currencySymbol}125 (+{APP_CONFIG.currencySymbol}25)
          </Text>
          <Text className="text-foreground text-sm">
            • Premium Zone: {APP_CONFIG.currencySymbol}150 (+{APP_CONFIG.currencySymbol}50)
          </Text>
          <Text className="text-foreground text-sm">
            • Outside Service Area: {APP_CONFIG.currencySymbol}200 (+{APP_CONFIG.currencySymbol}100)
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
