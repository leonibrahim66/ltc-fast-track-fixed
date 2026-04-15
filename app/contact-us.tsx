import { View, Text, ScrollView, TouchableOpacity, Linking, Alert } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { CONTACTS, APP_CONFIG } from "@/constants/app";

interface ContactItemProps {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  color?: string;
}

const ContactItem = ({ icon, title, subtitle, onPress, color = "primary" }: ContactItemProps) => (
  <TouchableOpacity
    onPress={() => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onPress();
    }}
    className="flex-row items-center bg-surface rounded-xl p-4 mb-3 border border-border active:opacity-80"
  >
    <View className={`w-12 h-12 rounded-full bg-${color}/10 items-center justify-center`}>
      <Text className="text-2xl">{icon}</Text>
    </View>
    <View className="flex-1 ml-3">
      <Text className="text-foreground font-semibold">{title}</Text>
      <Text className="text-muted text-sm">{subtitle}</Text>
    </View>
    <Text className="text-muted text-xl">→</Text>
  </TouchableOpacity>
);

export default function ContactUsScreen() {
  const handleCall = (number: string) => {
    const phoneUrl = `tel:${number.replace(/\s/g, "")}`;
    Linking.canOpenURL(phoneUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(phoneUrl);
        } else {
          Alert.alert("Error", "Phone calls are not supported on this device");
        }
      })
      .catch(() => Alert.alert("Error", "Could not open phone app"));
  };

  const handleWhatsApp = (url: string) => {
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert("WhatsApp Not Installed", "Please install WhatsApp to use this feature");
        }
      })
      .catch(() => Alert.alert("Error", "Could not open WhatsApp"));
  };

  const handleEmail = (email: string) => {
    const emailUrl = `mailto:${email}?subject=LTC FAST TRACK Inquiry`;
    Linking.openURL(emailUrl).catch(() =>
      Alert.alert("Error", "Could not open email app")
    );
  };

  const handleSocialMedia = (url: string) => {
    Linking.openURL(url).catch(() =>
      Alert.alert("Error", "Could not open link")
    );
  };

  const handleMaps = () => {
    const address = encodeURIComponent(CONTACTS.officeAddress);
    const mapsUrl = Platform.select({
      ios: `maps:0,0?q=${address}`,
      android: `geo:0,0?q=${address}`,
      default: `https://maps.google.com/?q=${address}`,
    });
    Linking.openURL(mapsUrl).catch(() =>
      Alert.alert("Error", "Could not open maps")
    );
  };

  return (
    <ScreenContainer className="px-4">
      {/* Header */}
      <View className="flex-row items-center mb-6">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
        >
          <Text className="text-foreground text-lg">←</Text>
        </TouchableOpacity>
        <View>
          <Text className="text-2xl font-bold text-foreground">Contact Us</Text>
          <Text className="text-muted">We are here to help</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Quick Contact Banner */}
        <View className="bg-primary rounded-2xl p-5 mb-6">
          <Text className="text-white text-lg font-bold mb-2">Need Help?</Text>
          <Text className="text-white/80 mb-4">
            Our support team is available to assist you with any questions or concerns.
          </Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => handleCall(CONTACTS.mainPhone)}
              className="flex-1 bg-white/20 py-3 rounded-xl active:opacity-80"
            >
              <Text className="text-white text-center font-semibold">📞 Call Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleWhatsApp(CONTACTS.whatsappSupport)}
              className="flex-1 bg-white/20 py-3 rounded-xl active:opacity-80"
            >
              <Text className="text-white text-center font-semibold">💬 WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Phone Numbers */}
        <Text className="text-lg font-bold text-foreground mb-3">📞 Phone Numbers</Text>
        <ContactItem
          icon="📱"
          title="Main Line"
          subtitle={CONTACTS.mainPhone}
          onPress={() => handleCall(CONTACTS.mainPhone)}
        />
        <ContactItem
          icon="🆘"
          title="Support Hotline"
          subtitle={CONTACTS.supportPhone}
          onPress={() => handleCall(CONTACTS.supportPhone)}
        />
        <ContactItem
          icon="💳"
          title="Payment Inquiries"
          subtitle={CONTACTS.paymentPhone}
          onPress={() => handleCall(CONTACTS.paymentPhone)}
        />

        {/* WhatsApp */}
        <Text className="text-lg font-bold text-foreground mb-3 mt-4">💬 WhatsApp</Text>
        <ContactItem
          icon="💬"
          title="WhatsApp Support"
          subtitle="Chat with our team"
          onPress={() => handleWhatsApp(CONTACTS.whatsappSupport)}
        />
        <ContactItem
          icon="👥"
          title="Community Group"
          subtitle="Join our WhatsApp group"
          onPress={() => handleWhatsApp(CONTACTS.whatsappGroup)}
        />
        <ContactItem
          icon="📢"
          title="News Channel"
          subtitle="Follow for updates"
          onPress={() => handleWhatsApp(CONTACTS.whatsappChannel)}
        />

        {/* Email */}
        <Text className="text-lg font-bold text-foreground mb-3 mt-4">✉️ Email</Text>
        <ContactItem
          icon="📧"
          title="Support Email"
          subtitle={CONTACTS.supportEmail}
          onPress={() => handleEmail(CONTACTS.supportEmail)}
        />
        <ContactItem
          icon="💼"
          title="Business Inquiries"
          subtitle={CONTACTS.businessEmail}
          onPress={() => handleEmail(CONTACTS.businessEmail)}
        />

        {/* Social Media */}
        <Text className="text-lg font-bold text-foreground mb-3 mt-4">🌐 Social Media</Text>
        <View className="flex-row flex-wrap gap-3 mb-4">
          <TouchableOpacity
            onPress={() => handleSocialMedia(CONTACTS.facebook)}
            className="bg-[#1877F2]/10 px-5 py-3 rounded-xl flex-row items-center active:opacity-80"
          >
            <Text className="text-xl mr-2">📘</Text>
            <Text className="text-[#1877F2] font-medium">Facebook</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleSocialMedia(CONTACTS.instagram)}
            className="bg-[#E4405F]/10 px-5 py-3 rounded-xl flex-row items-center active:opacity-80"
          >
            <Text className="text-xl mr-2">📸</Text>
            <Text className="text-[#E4405F] font-medium">Instagram</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleSocialMedia(CONTACTS.twitter)}
            className="bg-[#1DA1F2]/10 px-5 py-3 rounded-xl flex-row items-center active:opacity-80"
          >
            <Text className="text-xl mr-2">🐦</Text>
            <Text className="text-[#1DA1F2] font-medium">Twitter</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleSocialMedia(CONTACTS.tiktok)}
            className="bg-foreground/10 px-5 py-3 rounded-xl flex-row items-center active:opacity-80"
          >
            <Text className="text-xl mr-2">🎵</Text>
            <Text className="text-foreground font-medium">TikTok</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleSocialMedia(CONTACTS.linkedin)}
            className="bg-[#0A66C2]/10 px-5 py-3 rounded-xl flex-row items-center active:opacity-80"
          >
            <Text className="text-xl mr-2">💼</Text>
            <Text className="text-[#0A66C2] font-medium">LinkedIn</Text>
          </TouchableOpacity>
        </View>

        {/* Office Location */}
        <Text className="text-lg font-bold text-foreground mb-3 mt-2">📍 Office Location</Text>
        <TouchableOpacity
          onPress={handleMaps}
          className="bg-surface rounded-xl p-4 mb-3 border border-border active:opacity-80"
        >
          <View className="flex-row items-start">
            <Text className="text-3xl mr-3">🏢</Text>
            <View className="flex-1">
              <Text className="text-foreground font-semibold mb-1">{APP_CONFIG.name} Head Office</Text>
              <Text className="text-muted text-sm mb-2">{CONTACTS.officeAddress}</Text>
              <View className="bg-primary/10 rounded-lg p-3 mt-2">
                <Text className="text-primary font-medium mb-1">🕐 Office Hours</Text>
                <Text className="text-foreground text-sm">{CONTACTS.officeHours}</Text>
                <Text className="text-foreground text-sm">{CONTACTS.officeHoursSaturday}</Text>
                <Text className="text-muted text-sm">Sunday: Closed</Text>
              </View>
            </View>
          </View>
          <View className="flex-row items-center justify-center mt-3 pt-3 border-t border-border">
            <Text className="text-primary font-medium">📍 Open in Maps</Text>
          </View>
        </TouchableOpacity>

        {/* Website */}
        <Text className="text-lg font-bold text-foreground mb-3 mt-4">🌍 Website</Text>
        <ContactItem
          icon="🌐"
          title="Visit Our Website"
          subtitle={CONTACTS.website}
          onPress={() => handleSocialMedia(CONTACTS.website)}
        />

        {/* Emergency Contact */}
        <View className="bg-error/10 rounded-xl p-4 mt-4 mb-8 border border-error/30">
          <View className="flex-row items-center mb-2">
            <Text className="text-2xl mr-2">🚨</Text>
            <Text className="text-error font-bold">Emergency Contact</Text>
          </View>
          <Text className="text-foreground text-sm mb-3">
            For urgent matters outside office hours, please call our emergency line.
          </Text>
          <TouchableOpacity
            onPress={() => handleCall(CONTACTS.emergencyPhone)}
            className="bg-error py-3 rounded-xl active:opacity-80"
          >
            <Text className="text-white text-center font-bold">📞 {CONTACTS.emergencyPhone}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
