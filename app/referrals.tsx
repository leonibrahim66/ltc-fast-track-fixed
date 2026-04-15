import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Share,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useReferrals, Referral } from "@/lib/referrals-context";
import { useAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import { APP_CONFIG, SUBSCRIPTION_PLANS } from "@/constants/app";

export default function ReferralsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const { 
    referralCode, 
    referrals, 
    stats, 
    credits,
    generateReferralCode,
    getReferralLink,
    calculateReferralReward,
  } = useReferrals();
  
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "history">("overview");

  // Generate referral code if not exists
  useEffect(() => {
    if (!referralCode && user?.id) {
      generateReferralCode(user.id);
    }
  }, [referralCode, user?.id, generateReferralCode]);

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(referralCode);
    setCopied(true);
    
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      const link = getReferralLink();
      await Share.share({
        message: `Join LTC FAST TRACK for fast garbage collection! Use my referral code: ${referralCode}\n\n${link}`,
        title: "Invite Friends to LTC FAST TRACK",
      });
      
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const getStatusColor = (status: Referral["status"]) => {
    switch (status) {
      case "completed": return "#22C55E";
      case "pending": return "#F59E0B";
      case "expired": return "#EF4444";
      default: return "#9CA3AF";
    }
  };

  const renderReferralItem = ({ item }: { item: Referral }) => (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-foreground font-medium">{item.referredUserName}</Text>
        <View 
          className="px-2 py-1 rounded-full"
          style={{ backgroundColor: `${getStatusColor(item.status)}20` }}
        >
          <Text 
            className="text-xs font-medium capitalize"
            style={{ color: getStatusColor(item.status) }}
          >
            {item.status}
          </Text>
        </View>
      </View>
      
      <View className="flex-row items-center justify-between">
        <Text className="text-muted text-sm">
          {new Date(item.createdAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </Text>
        {item.status === "completed" && (
          <Text className="text-success font-semibold">
            +{APP_CONFIG.currencySymbol}{item.creditsAwarded}
          </Text>
        )}
      </View>
    </View>
  );

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
          Refer &amp; Earn
        </Text>
        <Text className="text-muted">
          Invite friends and earn 15% of their subscription as credits
        </Text>
      </View>

      {/* Credits Balance Card */}
      <View className="mx-6 mt-4 bg-primary rounded-2xl p-5">
        <Text className="text-white/80 text-sm mb-1">Available Credits</Text>
        <Text className="text-white text-4xl font-bold">
          {APP_CONFIG.currencySymbol}{credits.toLocaleString()}
        </Text>
        <Text className="text-white/70 text-sm mt-2">
          Use credits towards your next pickup payment
        </Text>
      </View>

      {/* Referral Code Card */}
      <View className="mx-6 mt-4 bg-surface rounded-2xl p-4 border border-border">
        <Text className="text-muted text-sm mb-2">Your Referral Code</Text>
        <View className="flex-row items-center justify-between bg-background rounded-xl p-3">
          <Text className="text-foreground text-xl font-bold tracking-wider">
            {referralCode || "Generating..."}
          </Text>
          <TouchableOpacity
            onPress={handleCopyCode}
            className="bg-primary/10 px-3 py-2 rounded-lg flex-row items-center"
          >
            <MaterialIcons 
              name={copied ? "check" : "content-copy"} 
              size={18} 
              color={colors.primary} 
            />
            <Text className="text-primary font-medium ml-1">
              {copied ? "Copied!" : "Copy"}
            </Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity
          onPress={handleShare}
          className="mt-3 bg-primary py-3 rounded-xl flex-row items-center justify-center"
        >
          <MaterialIcons name="share" size={20} color="#fff" />
          <Text className="text-white font-semibold ml-2">Share Invite Link</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Grid */}
      <View className="mx-6 mt-4 flex-row gap-3">
        <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
          <MaterialIcons name="people" size={24} color={colors.primary} />
          <Text className="text-2xl font-bold text-foreground mt-2">
            {stats.totalReferrals}
          </Text>
          <Text className="text-muted text-sm">Total Invites</Text>
        </View>
        
        <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
          <MaterialIcons name="check-circle" size={24} color="#22C55E" />
          <Text className="text-2xl font-bold text-foreground mt-2">
            {stats.completedReferrals}
          </Text>
          <Text className="text-muted text-sm">Successful</Text>
        </View>
        
        <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
          <MaterialIcons name="monetization-on" size={24} color="#F59E0B" />
          <Text className="text-2xl font-bold text-foreground mt-2">
            {APP_CONFIG.currencySymbol}{stats.totalCreditsEarned}
          </Text>
          <Text className="text-muted text-sm">Earned</Text>
        </View>
      </View>

      {/* Tabs */}
      <View className="mx-6 mt-4 flex-row bg-surface rounded-xl p-1 border border-border">
        <TouchableOpacity
          onPress={() => setActiveTab("overview")}
          className={`flex-1 py-2 rounded-lg ${activeTab === "overview" ? "bg-primary" : ""}`}
        >
          <Text className={`text-center font-medium ${activeTab === "overview" ? "text-white" : "text-muted"}`}>
            How It Works
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab("history")}
          className={`flex-1 py-2 rounded-lg ${activeTab === "history" ? "bg-primary" : ""}`}
        >
          <Text className={`text-center font-medium ${activeTab === "history" ? "text-white" : "text-muted"}`}>
            Referral History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View className="flex-1 mx-6 mt-4">
        {activeTab === "overview" ? (
          <View>
            {/* How It Works Steps */}
            <View className="bg-surface rounded-xl p-4 border border-border mb-4">
              <View className="flex-row items-start mb-4">
                <View className="w-8 h-8 bg-primary rounded-full items-center justify-center">
                  <Text className="text-white font-bold">1</Text>
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-foreground font-medium">Share Your Code</Text>
                  <Text className="text-muted text-sm mt-1">
                    Share your unique referral code with friends and family
                  </Text>
                </View>
              </View>
              
              <View className="flex-row items-start mb-4">
                <View className="w-8 h-8 bg-primary rounded-full items-center justify-center">
                  <Text className="text-white font-bold">2</Text>
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-foreground font-medium">Friend Signs Up</Text>
                  <Text className="text-muted text-sm mt-1">
                    They create an account using your referral code
                  </Text>
                </View>
              </View>
              
              <View className="flex-row items-start mb-4">
                <View className="w-8 h-8 bg-primary rounded-full items-center justify-center">
                  <Text className="text-white font-bold">3</Text>
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-foreground font-medium">First Pickup Completed</Text>
                  <Text className="text-muted text-sm mt-1">
                    Your friend completes their first garbage pickup
                  </Text>
                </View>
              </View>
              
              <View className="flex-row items-start">
                <View className="w-8 h-8 bg-success rounded-full items-center justify-center">
                  <MaterialIcons name="check" size={20} color="#fff" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-foreground font-medium">You Both Earn!</Text>
                  <Text className="text-muted text-sm mt-1">
                    You get 15% of their subscription ({APP_CONFIG.currencySymbol}{calculateReferralReward("res_basic")}-{APP_CONFIG.currencySymbol}{calculateReferralReward("com_premium")})
                  </Text>
                </View>
              </View>
            </View>

            {/* Terms */}
            <View className="bg-warning/10 rounded-xl p-4">
              <View className="flex-row items-center mb-2">
                <MaterialIcons name="info" size={20} color="#F59E0B" />
                <Text className="text-warning font-medium ml-2">Terms &amp; Conditions</Text>
              </View>
              <Text className="text-muted text-sm">
                You earn 15% of your referral{"'s"} subscription plan as credits.
                Basic: {APP_CONFIG.currencySymbol}{calculateReferralReward("res_basic")} | Premium: {APP_CONFIG.currencySymbol}{calculateReferralReward("res_premium")} | Commercial: {APP_CONFIG.currencySymbol}{calculateReferralReward("com_basic")}-{APP_CONFIG.currencySymbol}{calculateReferralReward("com_premium")}.
                Maximum 20 referrals per month.
              </Text>
            </View>
          </View>
        ) : (
          <FlatList
            data={referrals}
            renderItem={renderReferralItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View className="items-center py-12">
                <MaterialIcons name="people-outline" size={64} color="#9CA3AF" />
                <Text className="text-muted text-center mt-4">
                  No referrals yet
                </Text>
                <Text className="text-muted text-center text-sm mt-2">
                  Share your code to start earning credits!
                </Text>
              </View>
            }
          />
        )}
      </View>
    </ScreenContainer>
  );
}
