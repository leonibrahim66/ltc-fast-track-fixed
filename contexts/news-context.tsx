import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  HomeNewsItem,
  NavigationNewsItem,
  HOME_NEWS_STORAGE_KEY,
  NAVIGATION_NEWS_STORAGE_KEY,
} from "@/types/news";

interface NewsContextType {
  homeNews: HomeNewsItem[];
  navigationNews: NavigationNewsItem[];
  loadHomeNews: () => Promise<void>;
  loadNavigationNews: () => Promise<void>;
  addHomeNews: (news: HomeNewsItem) => Promise<void>;
  addNavigationNews: (news: NavigationNewsItem) => Promise<void>;
  updateHomeNews: (news: HomeNewsItem) => Promise<void>;
  updateNavigationNews: (news: NavigationNewsItem) => Promise<void>;
  deleteHomeNews: (id: string) => Promise<void>;
  deleteNavigationNews: (id: string) => Promise<void>;
  getActiveHomeNews: () => HomeNewsItem[];
  getActiveNavigationNews: () => NavigationNewsItem[];
}

const NewsContext = createContext<NewsContextType | undefined>(undefined);

// ─── Sample Home News (carousel) ─────────────────────────────────────────────
const SAMPLE_HOME_NEWS: HomeNewsItem[] = [
  // ── News slide 1 ──
  {
    id: "home-1",
    image: require("@/assets/news-images/garbage truck1.jpg"),
    title: "New Garbage Collection Routes",
    shortDescription: "Expanded service coverage across Lusaka",
    fullDescription:
      "We're excited to announce expanded garbage collection routes covering more areas in Lusaka. Our new service zones include Rhodes park, Roma, Libala, and PHI. Residential subscribers can now enjoy twice-weekly pickups with our upgraded fleet of eco-friendly trucks.",
    category: "Trash Pickup Services",
    type: "news",
    isActive: true,
    order: 1,
    createdAt: new Date().toISOString(),
  },

  // ── Sponsor slide 1 — Channel Motorport Enterprise Ltd (CFM) ──
  {
    id: "sponsor-cfm-1",
    image: require("@/assets/sponsors/cfm vehicles1.jpg"),
    title: "Channel Five Motorport Enterprise Ltd",
    shortDescription: "Car Dealers In New And Quality Used Vehicles",
    fullDescription:
      "Channel Five Motorsport Enterprise Limited is an automotive trading and vehicle importation company specializing in the importation, sourcing, sale, and supply of new and quality used vehicles. The company connects customers in Zambia with reliable vehicles sourced from reputable international markets, providing a convenient and professional vehicle purchasing experience.",
    category: "Announcement",
    type: "sponsor",
    isActive: true,
    order: 2,
    createdAt: new Date().toISOString(),
    sponsorDetails: {
      sponsorName: "Channel Five Motorport Enterprise Ltd",
      sponsorType: "Transport Partner",
      description:
        "Channel Five Motorsport Enterprise Limited is a Zambian automotive importation and trading company specializing in the sourcing, importation and sale of new and quality used vehicles. We source vehicles from reputable international markets and provide customers with a convenient vehicle procurement solution tailored to their preferred specifications and budget. Our services cover passenger cars, SUVs, pickups, commercial vehicles and other automotive needs. With a focus on quality, transparency, competitive pricing and customer satisfaction, Channel Five Motorsport Enterprise Limited aims to become a trusted name in Zambia's automotive industry and a reliable partner for individuals, businesses and vehicle dealers.",
      images: [
        require("@/assets/sponsors/cfm vehicles1.jpg") as any,
        require("@/assets/sponsors/cfm-image2.jpg") as any,
        require("@/assets/sponsors/CFM LOGO.jpg") as any,
      ],
      website: "https://www.cfmenterprise.com",
      contact: "+260960500656",
    },
  },

  // ── News slide 2 ──
  {
    id: "home-2",
    image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663275322468/YGrFqlNfEehYjPKn.png",
    title: "Book Carrier Services Now Available",
    shortDescription: "Fast and reliable delivery across Zambia",
    fullDescription:
      "Introducing our new carrier booking service! Need to move household items, commercial goods, or bulk waste? Book a carrier directly from the app. Choose from vans, pickups, trucks, and heavy-duty vehicles. Real-time tracking, transparent pricing, and professional drivers guaranteed.",
    category: "Carrier Services",
    type: "news",
    isActive: true,
    order: 3,
    createdAt: new Date().toISOString(),
  },

  // ── Sponsor slide 2 — Liquid Airlines Ltd ──
  {
    id: "sponsor-liquid-airlines-1",
    image: require("@/assets/sponsors/liquid-airlines-plane.jpg"),
    title: "LIQUID AIRLINES LTD",
    shortDescription: "Where excellence takes flight",
    fullDescription:
      "Liquid Airlines provides comfortable and reliable air travel services for passengers travelling across Zambia and beyond.",    
    category: "Announcement",
    type: "sponsor",
    isActive: true,
    order: 4,
    createdAt: new Date().toISOString(),
    sponsorDetails: {
      sponsorName: "LIQUID AIRLINES LTD",
      sponsorType: "Travel Partner",
      description:
        "Liquid Airlines connects travellers to their destinations with comfortable aircraft, professional service, and convenient travel solutions.",
      images: [
        require("@/assets/sponsors/liquid-airlines-plane.jpg") as any,
        require("@/assets/sponsors/liquid-airlines-service.jpg") as any,
        require("@/assets/sponsors/liquid-airlines-van.jpg") as any,
        require("@/assets/sponsors/liquid-airlines-fortuner.jpg") as any,
      ],
      website: "https://www.liquidairlines.com/liquid-airllines-ltd",
      contact: "+260960819993",
    },
  },

  // ── News slide 3 ──
  {
    id: "home-3",
    image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663275322468/llhxVNBlehVpCGfK.png",
    title: "Same-Day Delivery Service",
    shortDescription: "Get your items delivered within hours",
    fullDescription:
      "Need urgent delivery? Our same-day carrier service is now live! Book before 2 PM and get your items delivered the same day. Perfect for businesses, moving homes, or emergency waste removal. Available in Lusaka and surrounding areas.",
    category: "Carrier Services",
    type: "news",
    isActive: true,
    order: 5,
    createdAt: new Date().toISOString(),
  },
];

// ─── Sample Navigation News (full feed) ──────────────────────────────────────
const SAMPLE_NAVIGATION_NEWS: NavigationNewsItem[] = [
  {
    id: "nav-1",
    image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663275322468/ztHEfZhFNIGXXVIr.png",
    title: "LTC Fast Track Expands Fleet",
    shortDescription: "20 new eco-friendly trucks added to our collection fleet",
    fullDescription:
      "LTC Fast Track is proud to announce the addition of 20 brand new eco-friendly garbage trucks to our fleet. These state-of-the-art vehicles feature GPS tracking, reduced emissions, and increased capacity. This expansion allows us to serve more customers and reduce collection times across all service zones.",
    category: "Announcement",
    isActive: true,
    order: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: "nav-2",
    image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663275322468/bltUnhxjsnFNPHIn.png",
    title: "Meet Our Carrier Drivers",
    shortDescription: "Professional, vetted, and ready to serve",
    fullDescription:
      "All LTC carrier drivers undergo thorough background checks, vehicle inspections, and customer service training. Our drivers are equipped with GPS-enabled smartphones for real-time tracking and direct communication with customers. Safety and professionalism are our top priorities.",
    category: "Carrier Services",
    isActive: true,
    order: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: "nav-3",
    image: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663275322468/tSOTUlbSFqyvxDiI.png",
    title: "Customer Satisfaction at 98%",
    shortDescription: "Thank you for trusting LTC Fast Track",
    fullDescription:
      "We're thrilled to report that our customer satisfaction rating has reached 98% this quarter! Thank you to all our subscribers for your continued trust and feedback. We're committed to maintaining the highest standards in garbage collection and carrier services across Zambia.",
    category: "General",
    isActive: true,
    order: 3,
    createdAt: new Date().toISOString(),
  },
  {
    id: "nav-4",
    image: require("@/assets/news-images/garbage-truck.jpg"),
    title: "Recycling Program Launch",
    shortDescription: "Earn rewards for recycling with LTC",
    fullDescription:
      "Starting next month, LTC Fast Track will launch a comprehensive recycling rewards program. Separate your plastics, metals, and paper, and earn credits toward your subscription fees. Recycling companies can also partner with us for bulk collection services. Together, we can make Zambia cleaner and greener.",
    category: "Trash Pickup Services",
    isActive: true,
    order: 4,
    createdAt: new Date().toISOString(),
  },
];

export function NewsProvider({ children }: { children: ReactNode }) {
  const [homeNews, setHomeNews] = useState<HomeNewsItem[]>([]);
  const [navigationNews, setNavigationNews] = useState<NavigationNewsItem[]>([]);

  // Load Home News from storage
  const loadHomeNews = async () => {
    try {
      const stored = await AsyncStorage.getItem(HOME_NEWS_STORAGE_KEY);
      if (stored) {
        setHomeNews(JSON.parse(stored));
      } else {
        await AsyncStorage.setItem(HOME_NEWS_STORAGE_KEY, JSON.stringify(SAMPLE_HOME_NEWS));
        setHomeNews(SAMPLE_HOME_NEWS);
      }
    } catch (error) {
      console.error("Error loading home news:", error);
      setHomeNews(SAMPLE_HOME_NEWS);
    }
  };

  // Load Navigation News from storage
  const loadNavigationNews = async () => {
    try {
      const stored = await AsyncStorage.getItem(NAVIGATION_NEWS_STORAGE_KEY);
      if (stored) {
        setNavigationNews(JSON.parse(stored));
      } else {
        await AsyncStorage.setItem(NAVIGATION_NEWS_STORAGE_KEY, JSON.stringify(SAMPLE_NAVIGATION_NEWS));
        setNavigationNews(SAMPLE_NAVIGATION_NEWS);
      }
    } catch (error) {
      console.error("Error loading navigation news:", error);
      setNavigationNews(SAMPLE_NAVIGATION_NEWS);
    }
  };

  const addHomeNews = async (news: HomeNewsItem) => {
    const updated = [...homeNews, news];
    setHomeNews(updated);
    await AsyncStorage.setItem(HOME_NEWS_STORAGE_KEY, JSON.stringify(updated));
  };

  const addNavigationNews = async (news: NavigationNewsItem) => {
    const updated = [...navigationNews, news];
    setNavigationNews(updated);
    await AsyncStorage.setItem(NAVIGATION_NEWS_STORAGE_KEY, JSON.stringify(updated));
  };

  const updateHomeNews = async (news: HomeNewsItem) => {
    const updated = homeNews.map((item) => (item.id === news.id ? news : item));
    setHomeNews(updated);
    await AsyncStorage.setItem(HOME_NEWS_STORAGE_KEY, JSON.stringify(updated));
  };

  const updateNavigationNews = async (news: NavigationNewsItem) => {
    const updated = navigationNews.map((item) => (item.id === news.id ? news : item));
    setNavigationNews(updated);
    await AsyncStorage.setItem(NAVIGATION_NEWS_STORAGE_KEY, JSON.stringify(updated));
  };

  const deleteHomeNews = async (id: string) => {
    const updated = homeNews.filter((item) => item.id !== id);
    setHomeNews(updated);
    await AsyncStorage.setItem(HOME_NEWS_STORAGE_KEY, JSON.stringify(updated));
  };

  const deleteNavigationNews = async (id: string) => {
    const updated = navigationNews.filter((item) => item.id !== id);
    setNavigationNews(updated);
    await AsyncStorage.setItem(NAVIGATION_NEWS_STORAGE_KEY, JSON.stringify(updated));
  };

  const getActiveHomeNews = () => {
    return homeNews.filter((item) => item.isActive).sort((a, b) => a.order - b.order);
  };

  const getActiveNavigationNews = () => {
    return navigationNews.filter((item) => item.isActive).sort((a, b) => a.order - b.order);
  };

useEffect(() => {
  loadHomeNews();
  loadNavigationNews();
}, []);

  return (
    <NewsContext.Provider
      value={{
        homeNews,
        navigationNews,
        loadHomeNews,
        loadNavigationNews,
        addHomeNews,
        addNavigationNews,
        updateHomeNews,
        updateNavigationNews,
        deleteHomeNews,
        deleteNavigationNews,
        getActiveHomeNews,
        getActiveNavigationNews,
      }}
    >
      {children}
    </NewsContext.Provider>
  );
}

export function useNews() {
  const context = useContext(NewsContext);
  if (!context) {
    throw new Error("useNews must be used within NewsProvider");
  }
  return context;
}
