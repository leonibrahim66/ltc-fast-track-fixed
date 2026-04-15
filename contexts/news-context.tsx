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
    image: require("@/assets/news-images/garbage-truck.jpg"),
    title: "New Garbage Collection Routes",
    shortDescription: "Expanded service coverage across Lusaka",
    fullDescription:
      "We're excited to announce expanded garbage collection routes covering more areas in Lusaka. Our new service zones include Kabulonga, Roma, Woodlands Extension, and PHI. Residential subscribers can now enjoy twice-weekly pickups with our upgraded fleet of eco-friendly trucks.",
    category: "Trash Pickup Services",
    type: "news",
    isActive: true,
    order: 1,
    createdAt: new Date().toISOString(),
  },

  // ── Sponsor slide 1 — Mine Workers Union of Zambia (MUZ) ──
  {
    id: "sponsor-muz-1",
    image: require("@/assets/sponsors/muzflag.jpg"),
    title: "Mine Workers Union of Zambia",
    shortDescription: "Proudly supporting clean communities across Zambia since 1967",
    fullDescription:
      "The Mine Workers Union of Zambia (MUZ) is a proud sponsor of LTC Fast Track. Founded in 1967 under the motto 'Unity is Our Strength', MUZ represents thousands of mine workers across Zambia and is committed to improving the welfare of workers and their communities — including clean and healthy living environments.",
    category: "Announcement",
    type: "sponsor",
    isActive: true,
    order: 2,
    createdAt: new Date().toISOString(),
    sponsorDetails: {
      sponsorName: "Mine Workers Union of Zambia",
      sponsorType: "Community Partner",
      description:
        "Founded in 1967, the Mine Workers Union of Zambia (MUZ) has been championing the rights and welfare of mine workers for over five decades. MUZ advocates for improved wages, safe working conditions, gender equality, skills development, and community social responsibility. As a proud partner of LTC Fast Track, MUZ supports our mission to keep Zambian communities clean and green.",
      images: [
        require("@/assets/sponsors/muzflag.jpg") as any,
        require("@/assets/sponsors/muzforall.jpg") as any,
        require("@/assets/sponsors/muzlogo.png") as any,
      ],
      website: "https://www.muz.org.zm",
      contact: "+260 212 210 000",
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

  // ── Sponsor slide 2 — Garden Court Kitwe ──
  {
    id: "sponsor-garden-court-1",
    image: require("@/assets/sponsors/315476001.jpg"),
    title: "Garden Court Kitwe",
    shortDescription: "Premium hospitality in the heart of the Copperbelt",
    fullDescription:
      "Garden Court Kitwe is a premier hotel located in the heart of Kitwe, Zambia's Copperbelt Province. Offering world-class accommodation, fine dining, and conference facilities, Garden Court Kitwe is the preferred destination for business and leisure travellers. As an LTC Fast Track partner, they are committed to sustainable hospitality and a cleaner Zambia.",
    category: "Announcement",
    type: "sponsor",
    isActive: true,
    order: 4,
    createdAt: new Date().toISOString(),
    sponsorDetails: {
      sponsorName: "Garden Court Kitwe",
      sponsorType: "Corporate Partner",
      description:
        "Garden Court Kitwe is a leading hotel in Zambia's Copperbelt, offering premium rooms, a restaurant, conference facilities, and a pool terrace with stunning sunset views. As a corporate partner of LTC Fast Track, Garden Court Kitwe supports responsible waste management and environmental sustainability across the Copperbelt region.",
      images: [
        require("@/assets/sponsors/315476001.jpg") as any,
        require("@/assets/sponsors/566511384.jpg") as any,
        require("@/assets/sponsors/566512533.jpg") as any,
        require("@/assets/sponsors/200731246.jpg") as any,
      ],
      website: "https://www.tsogosun.com/garden-court-kitwe",
      contact: "+260 212 222 000",
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
