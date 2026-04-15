import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { APP_CONFIG, CONTACTS } from "@/constants/app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
export default function AboutScreen() {
  const router = useRouter();

  const openWhatsApp = () => {
    Linking.openURL(CONTACTS.whatsappSupport);
  };

  const openWhatsAppGroup = () => {
    Linking.openURL(CONTACTS.whatsappGroup);
  };

  const makeCall = () => {
    Linking.openURL(`tel:${CONTACTS.mainPhone}`);
  };

  const sendEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`);
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="flex-1 px-6 pt-8">
          {/* Back Button */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="mb-6"
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>

          {/* Logo and Title */}
          <View className="items-center mb-8">
            <View className="w-24 h-24 rounded-2xl overflow-hidden mb-4 shadow-lg">
              <Image
                source={require("@/assets/images/icon.png")}
                className="w-full h-full"
                resizeMode="cover"
              />
            </View>
            <Text className="text-3xl font-bold text-foreground">
              {APP_CONFIG.name}
            </Text>
            <Text className="text-lg text-primary font-medium mt-1">
              {APP_CONFIG.tagline}
            </Text>
          </View>

          {/* About Section */}
          <View className="bg-surface rounded-2xl p-6 mb-6 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-3">
              About Us
            </Text>
            <Text className="text-foreground leading-6 text-base">
              LTC FAST TRACK is one of the most fast and efficient garbage collection 
              apps that allows residents and commercial companies to pin trash pickup 
              locations, aiming at giving quick responses for garbage collection and 
              creating cleaner environments.
            </Text>
            <Text className="text-foreground leading-6 text-base mt-4">
              We are committed to making waste management easier and more accessible 
              for everyone in Zambia. Our platform connects customers with reliable 
              garbage collectors, ensuring timely and efficient waste disposal.
            </Text>
          </View>

          {/* Our Services */}
          <View className="bg-surface rounded-2xl p-6 mb-6 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-4">
              Our Services
            </Text>
            <ServiceItem
              icon="home"
              title="Residential Collection"
              description="Regular garbage pickup for homes and households"
            />
            <ServiceItem
              icon="business"
              title="Commercial Collection"
              description="Waste management for businesses and companies"
            />
            <ServiceItem
              icon="factory"
              title="Industrial Collection"
              description="Large-scale waste disposal for industrial facilities"
            />
            <ServiceItem
              icon="location-on"
              title="Location Pinning"
              description="Pin your exact bin location for accurate pickups"
            />
            <ServiceItem
              icon="schedule"
              title="Flexible Scheduling"
              description="Choose pickup times that work for you"
            />
          </View>

          {/* Contact Information */}
          <View className="bg-surface rounded-2xl p-6 mb-6 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-4">
              Contact Details
            </Text>

            <TouchableOpacity
              onPress={makeCall}
              className="flex-row items-center py-3 border-b border-border"
            >
              <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
                <MaterialIcons name="phone" size={20} color="#22C55E" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-sm text-muted">Phone</Text>
                <Text className="text-foreground font-medium">
                  {CONTACTS.mainPhone}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => sendEmail(CONTACTS.emails[0])}
              className="flex-row items-center py-3 border-b border-border"
            >
              <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
                <MaterialIcons name="email" size={20} color="#22C55E" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-sm text-muted">Email</Text>
                <Text className="text-foreground font-medium">
                  {CONTACTS.emails[0]}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => sendEmail(CONTACTS.emails[1])}
              className="flex-row items-center py-3 border-b border-border"
            >
              <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
                <MaterialIcons name="email" size={20} color="#22C55E" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-sm text-muted">Email (Alternative)</Text>
                <Text className="text-foreground font-medium">
                  {CONTACTS.emails[1]}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={openWhatsApp}
              className="flex-row items-center py-3"
            >
              <View className="w-10 h-10 rounded-full bg-success/10 items-center justify-center">
                <MaterialIcons name="chat" size={20} color="#22C55E" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-sm text-muted">WhatsApp Support</Text>
                <Text className="text-foreground font-medium">
                  {CONTACTS.supportPhone}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Quick Actions */}
          <View className="flex-row mb-6">
            <TouchableOpacity
              onPress={openWhatsApp}
              className="flex-1 bg-success py-4 rounded-xl mr-2 flex-row items-center justify-center"
              style={styles.button}
            >
              <MaterialIcons name="chat" size={20} color="#fff" />
              <Text className="text-white font-semibold ml-2">WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={makeCall}
              className="flex-1 bg-primary py-4 rounded-xl ml-2 flex-row items-center justify-center"
              style={styles.button}
            >
              <MaterialIcons name="phone" size={20} color="#fff" />
              <Text className="text-white font-semibold ml-2">Call Us</Text>
            </TouchableOpacity>
          </View>

          {/* Join Community */}
          <TouchableOpacity
            onPress={openWhatsAppGroup}
            className="bg-surface rounded-2xl p-5 border border-border flex-row items-center"
          >
            <View className="w-12 h-12 rounded-full bg-success/10 items-center justify-center">
              <MaterialIcons name="group" size={24} color="#22C55E" />
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-foreground font-semibold">
                Join Our Community
              </Text>
              <Text className="text-sm text-muted">
                Connect with other users on WhatsApp
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#22C55E" />
          </TouchableOpacity>

          {/* Version */}
          <View className="items-center mt-8">
            <Text className="text-muted text-sm">Version 1.0.0</Text>
            <Text className="text-muted text-xs mt-1">
              © 2025 LTC FAST TRACK. All rights reserved.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function ServiceItem({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <View className="flex-row items-start mb-4">
      <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
        <MaterialIcons name={icon as any} size={20} color="#22C55E" />
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-foreground font-medium">{title}</Text>
        <Text className="text-sm text-muted">{description}</Text>
      </View>
    </View>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  backButton: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
