import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SUBSCRIPTION_PLANS } from "@/constants/app";

export interface Referral {
  id: string;
  referrerId: string;
  referredUserId: string;
  referredUserName: string;
  referredUserPlan?: string; // e.g., "res_basic", "com_premium"
  status: "pending" | "completed" | "expired";
  creditsAwarded: number;
  createdAt: string;
  completedAt?: string;
}

export interface ReferralStats {
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalCreditsEarned: number;
  availableCredits: number;
}

interface ReferralsContextType {
  referralCode: string;
  referrals: Referral[];
  stats: ReferralStats;
  credits: number;
  generateReferralCode: (userId: string) => string;
  addReferral: (referral: Omit<Referral, "id" | "createdAt">) => Promise<void>;
  completeReferral: (referralId: string, planId?: string) => Promise<void>;
  useCredits: (amount: number) => Promise<boolean>;
  addCredits: (amount: number) => Promise<void>;
  getReferralLink: () => string;
  calculateReferralReward: (planId: string) => number;
}

const ReferralsContext = createContext<ReferralsContextType | undefined>(undefined);

const STORAGE_KEYS = {
  REFERRAL_CODE: "ltc_referral_code",
  REFERRALS: "ltc_referrals",
  CREDITS: "ltc_credits",
};

// 15% referral reward percentage
const REFERRAL_PERCENTAGE = 0.15;

// Get plan price by plan ID
const getPlanPrice = (planId: string): number => {
  const plans: Record<string, number> = {
    res_basic: SUBSCRIPTION_PLANS.residential.basic.price,
    res_premium: SUBSCRIPTION_PLANS.residential.premium.price,
    com_basic: SUBSCRIPTION_PLANS.commercial.basic.price,
    com_premium: SUBSCRIPTION_PLANS.commercial.premium.price,
  };
  return plans[planId] || 100; // Default to basic residential if not found
};

export function ReferralsProvider({ children }: { children: ReactNode }) {
  const [referralCode, setReferralCode] = useState("");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [credits, setCredits] = useState(0);

  // Load data from storage
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [storedCode, storedReferrals, storedCredits] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.REFERRAL_CODE),
        AsyncStorage.getItem(STORAGE_KEYS.REFERRALS),
        AsyncStorage.getItem(STORAGE_KEYS.CREDITS),
      ]);

      if (storedCode) setReferralCode(storedCode);
      if (storedReferrals) setReferrals(JSON.parse(storedReferrals));
      if (storedCredits) setCredits(parseInt(storedCredits, 10));
    } catch (error) {
      console.error("Error loading referral data:", error);
    }
  };

  const saveReferrals = async (newReferrals: Referral[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.REFERRALS, JSON.stringify(newReferrals));
    } catch (error) {
      console.error("Error saving referrals:", error);
    }
  };

  const saveCredits = async (newCredits: number) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CREDITS, newCredits.toString());
    } catch (error) {
      console.error("Error saving credits:", error);
    }
  };

  const generateReferralCode = (userId: string): string => {
    // Generate a unique referral code based on user ID and timestamp
    const timestamp = Date.now().toString(36).toUpperCase();
    const userPart = userId.slice(0, 4).toUpperCase();
    const code = `LTC${userPart}${timestamp}`.slice(0, 10);
    
    setReferralCode(code);
    AsyncStorage.setItem(STORAGE_KEYS.REFERRAL_CODE, code);
    
    return code;
  };

  // Calculate 15% referral reward based on subscription plan
  const calculateReferralReward = (planId: string): number => {
    const planPrice = getPlanPrice(planId);
    return Math.round(planPrice * REFERRAL_PERCENTAGE);
  };

  const addReferral = async (referral: Omit<Referral, "id" | "createdAt">) => {
    const newReferral: Referral = {
      ...referral,
      id: `REF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };

    const updatedReferrals = [...referrals, newReferral];
    setReferrals(updatedReferrals);
    await saveReferrals(updatedReferrals);
  };

  const completeReferral = async (referralId: string, planId?: string) => {
    // Calculate reward based on the referred user's subscription plan (15%)
    const rewardAmount = planId ? calculateReferralReward(planId) : calculateReferralReward("res_basic");

    const updatedReferrals = referrals.map((ref) => {
      if (ref.id === referralId && ref.status === "pending") {
        return {
          ...ref,
          status: "completed" as const,
          referredUserPlan: planId,
          creditsAwarded: rewardAmount,
          completedAt: new Date().toISOString(),
        };
      }
      return ref;
    });

    setReferrals(updatedReferrals);
    await saveReferrals(updatedReferrals);

    // Award credits (15% of subscription)
    const newCredits = credits + rewardAmount;
    setCredits(newCredits);
    await saveCredits(newCredits);
  };

  const useCredits = async (amount: number): Promise<boolean> => {
    if (credits < amount) {
      return false;
    }

    const newCredits = credits - amount;
    setCredits(newCredits);
    await saveCredits(newCredits);
    return true;
  };

  const addCredits = async (amount: number) => {
    const newCredits = credits + amount;
    setCredits(newCredits);
    await saveCredits(newCredits);
  };

  const getReferralLink = (): string => {
    // In a real app, this would be a deep link or web URL
    return `https://ltcfasttrack.com/invite/${referralCode}`;
  };

  const stats: ReferralStats = {
    totalReferrals: referrals.length,
    completedReferrals: referrals.filter((r) => r.status === "completed").length,
    pendingReferrals: referrals.filter((r) => r.status === "pending").length,
    totalCreditsEarned: referrals
      .filter((r) => r.status === "completed")
      .reduce((sum, r) => sum + r.creditsAwarded, 0),
    availableCredits: credits,
  };

  return (
    <ReferralsContext.Provider
      value={{
        referralCode,
        referrals,
        stats,
        credits,
        generateReferralCode,
        addReferral,
        completeReferral,
        useCredits,
        addCredits,
        getReferralLink,
        calculateReferralReward,
      }}
    >
      {children}
    </ReferralsContext.Provider>
  );
}

export function useReferrals() {
  const context = useContext(ReferralsContext);
  if (context === undefined) {
    throw new Error("useReferrals must be used within a ReferralsProvider");
  }
  return context;
}
