import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Language = "en" | "bem" | "nya" | "toi";

export interface LanguageInfo {
  code: Language;
  name: string;
  nativeName: string;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "bem", name: "Bemba", nativeName: "Ichibemba" },
  { code: "nya", name: "Nyanja", nativeName: "Chinyanja" },
  { code: "toi", name: "Tonga", nativeName: "Chitonga" },
];

// Translation keys
type TranslationKey = 
  // Common
  | "common.welcome"
  | "common.loading"
  | "common.error"
  | "common.success"
  | "common.cancel"
  | "common.confirm"
  | "common.save"
  | "common.delete"
  | "common.edit"
  | "common.back"
  | "common.next"
  | "common.done"
  | "common.search"
  | "common.filter"
  | "common.all"
  | "common.none"
  // Auth
  | "auth.login"
  | "auth.logout"
  | "auth.register"
  | "auth.phone"
  | "auth.password"
  | "auth.forgotPassword"
  | "auth.createAccount"
  // Navigation
  | "nav.home"
  | "nav.pickups"
  | "nav.profile"
  | "nav.settings"
  // Home
  | "home.requestPickup"
  | "home.schedulePickup"
  | "home.trackPickup"
  | "home.recentPickups"
  | "home.noPickups"
  // Pickups
  | "pickups.title"
  | "pickups.pending"
  | "pickups.completed"
  | "pickups.scheduled"
  | "pickups.cancelled"
  | "pickups.status"
  | "pickups.location"
  | "pickups.notes"
  | "pickups.binType"
  | "pickups.residential"
  | "pickups.commercial"
  | "pickups.industrial"
  // Payments
  | "payments.title"
  | "payments.history"
  | "payments.amount"
  | "payments.method"
  | "payments.status"
  | "payments.confirmed"
  | "payments.pendingStatus"
  | "payments.failed"
  | "payments.receipt"
  // Profile
  | "profile.title"
  | "profile.editProfile"
  | "profile.notifications"
  | "profile.language"
  | "profile.about"
  | "profile.help"
  // Settings
  | "settings.title"
  | "settings.reminders"
  | "settings.reminderTime"
  | "settings.enableReminders"
  // Collector
  | "collector.dashboard"
  | "collector.earnings"
  | "collector.availablePickups"
  | "collector.myPickups"
  | "collector.completePickup"
  // Ratings
  | "ratings.rateCollector"
  | "ratings.yourRating"
  | "ratings.leaveComment"
  | "ratings.submit"
  // Time
  | "time.morning"
  | "time.afternoon"
  | "time.evening"
  | "time.today"
  | "time.tomorrow"
  | "time.thisWeek"
  | "time.thisMonth";

type Translations = Record<TranslationKey, string>;

// English translations (default)
const en: Translations = {
  // Common
  "common.welcome": "Welcome",
  "common.loading": "Loading...",
  "common.error": "Error",
  "common.success": "Success",
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.save": "Save",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.back": "Back",
  "common.next": "Next",
  "common.done": "Done",
  "common.search": "Search",
  "common.filter": "Filter",
  "common.all": "All",
  "common.none": "None",
  // Auth
  "auth.login": "Login",
  "auth.logout": "Logout",
  "auth.register": "Register",
  "auth.phone": "Phone Number",
  "auth.password": "Password",
  "auth.forgotPassword": "Forgot Password?",
  "auth.createAccount": "Create Account",
  // Navigation
  "nav.home": "Home",
  "nav.pickups": "Pickups",
  "nav.profile": "Profile",
  "nav.settings": "Settings",
  // Home
  "home.requestPickup": "Request Pickup",
  "home.schedulePickup": "Schedule Pickup",
  "home.trackPickup": "Track Pickup",
  "home.recentPickups": "Recent Pickups",
  "home.noPickups": "No pickups yet",
  // Pickups
  "pickups.title": "My Pickups",
  "pickups.pending": "Pending",
  "pickups.completed": "Completed",
  "pickups.scheduled": "Scheduled",
  "pickups.cancelled": "Cancelled",
  "pickups.status": "Status",
  "pickups.location": "Location",
  "pickups.notes": "Notes",
  "pickups.binType": "Bin Type",
  "pickups.residential": "Residential",
  "pickups.commercial": "Commercial",
  "pickups.industrial": "Industrial",
  // Payments
  "payments.title": "Payments",
  "payments.history": "Payment History",
  "payments.amount": "Amount",
  "payments.method": "Payment Method",
  "payments.status": "Status",
  "payments.confirmed": "Confirmed",
  "payments.pendingStatus": "Pending",
  "payments.failed": "Failed",
  "payments.receipt": "Receipt",
  // Profile
  "profile.title": "Profile",
  "profile.editProfile": "Edit Profile",
  "profile.notifications": "Notifications",
  "profile.language": "Language",
  "profile.about": "About",
  "profile.help": "Help & Support",
  // Settings
  "settings.title": "Settings",
  "settings.reminders": "Pickup Reminders",
  "settings.reminderTime": "Reminder Time",
  "settings.enableReminders": "Enable Reminders",
  // Collector
  "collector.dashboard": "Dashboard",
  "collector.earnings": "Earnings",
  "collector.availablePickups": "Available Pickups",
  "collector.myPickups": "My Pickups",
  "collector.completePickup": "Complete Pickup",
  // Ratings
  "ratings.rateCollector": "Rate Collector",
  "ratings.yourRating": "Your Rating",
  "ratings.leaveComment": "Leave a comment (optional)",
  "ratings.submit": "Submit Rating",
  // Time
  "time.morning": "Morning",
  "time.afternoon": "Afternoon",
  "time.evening": "Evening",
  "time.today": "Today",
  "time.tomorrow": "Tomorrow",
  "time.thisWeek": "This Week",
  "time.thisMonth": "This Month",
};

// Bemba translations
const bem: Translations = {
  // Common
  "common.welcome": "Mwaiseni",
  "common.loading": "Nalolela...",
  "common.error": "Ubupusu",
  "common.success": "Fyabwino",
  "common.cancel": "Leka",
  "common.confirm": "Suminisha",
  "common.save": "Sunga",
  "common.delete": "Fufuta",
  "common.edit": "Alula",
  "common.back": "Bwela",
  "common.next": "Konse",
  "common.done": "Pwile",
  "common.search": "Fwaya",
  "common.filter": "Sanga",
  "common.all": "Fyonse",
  "common.none": "Takuli",
  // Auth
  "auth.login": "Ingila",
  "auth.logout": "Fuma",
  "auth.register": "Ilemba",
  "auth.phone": "Nambala ya Foni",
  "auth.password": "Icishibilo",
  "auth.forgotPassword": "Walilaba icishibilo?",
  "auth.createAccount": "Panga Akaunti",
  // Navigation
  "nav.home": "Kuŋanda",
  "nav.pickups": "Ukusenda",
  "nav.profile": "Umwine",
  "nav.settings": "Amasettings",
  // Home
  "home.requestPickup": "Lomba Ukusenda",
  "home.schedulePickup": "Panga Inshiku",
  "home.trackPickup": "Londolola Ukusenda",
  "home.recentPickups": "Ukusenda Kwakabici",
  "home.noPickups": "Takuli ukusenda",
  // Pickups
  "pickups.title": "Ukusenda Kwandi",
  "pickups.pending": "Nalelolela",
  "pickups.completed": "Pwile",
  "pickups.scheduled": "Yapangwa",
  "pickups.cancelled": "Yalekwa",
  "pickups.status": "Ubwikalo",
  "pickups.location": "Incende",
  "pickups.notes": "Amanotes",
  "pickups.binType": "Ubwafya bwa Bin",
  "pickups.residential": "Kuŋanda",
  "pickups.commercial": "Kwa Malonda",
  "pickups.industrial": "Kwa Ncito",
  // Payments
  "payments.title": "Amalipilo",
  "payments.history": "Imbiri ya Malipilo",
  "payments.amount": "Indalama",
  "payments.method": "Inshila ya Kulipila",
  "payments.status": "Ubwikalo",
  "payments.confirmed": "Yasuminishiwa",
  "payments.pendingStatus": "Nalelolela",
  "payments.failed": "Yafilwa",
  "payments.receipt": "Icipepala",
  // Profile
  "profile.title": "Umwine",
  "profile.editProfile": "Alula Umwine",
  "profile.notifications": "Amashiwi",
  "profile.language": "Ululimi",
  "profile.about": "Pa Ifwe",
  "profile.help": "Ubwafwilisho",
  // Settings
  "settings.title": "Amasettings",
  "settings.reminders": "Ukwibukisha",
  "settings.reminderTime": "Inshita ya Kwibukisha",
  "settings.enableReminders": "Tendeka Ukwibukisha",
  // Collector
  "collector.dashboard": "Dashboard",
  "collector.earnings": "Amafilwa",
  "collector.availablePickups": "Ukusenda Ukwabako",
  "collector.myPickups": "Ukusenda Kwandi",
  "collector.completePickup": "Pwa Ukusenda",
  // Ratings
  "ratings.rateCollector": "Pela Amanambala",
  "ratings.yourRating": "Amanambala Yenu",
  "ratings.leaveComment": "Lemba icebo (nga mulefwaya)",
  "ratings.submit": "Tuma",
  // Time
  "time.morning": "Ulucelo",
  "time.afternoon": "Akasuba",
  "time.evening": "Icungulo",
  "time.today": "Lelo",
  "time.tomorrow": "Mailo",
  "time.thisWeek": "Ino Mulungu",
  "time.thisMonth": "Uno Mweshi",
};

// Nyanja translations
const nya: Translations = {
  // Common
  "common.welcome": "Takulandirani",
  "common.loading": "Kukonza...",
  "common.error": "Cholakwika",
  "common.success": "Zabwino",
  "common.cancel": "Lekani",
  "common.confirm": "Vomerezani",
  "common.save": "Sungani",
  "common.delete": "Chotsani",
  "common.edit": "Sinthani",
  "common.back": "Bwerani",
  "common.next": "Kupita",
  "common.done": "Kwatha",
  "common.search": "Sakani",
  "common.filter": "Sankhani",
  "common.all": "Zonse",
  "common.none": "Palibe",
  // Auth
  "auth.login": "Lowani",
  "auth.logout": "Tulukani",
  "auth.register": "Lembetsani",
  "auth.phone": "Nambala ya Foni",
  "auth.password": "Chinsinsi",
  "auth.forgotPassword": "Mwayiwala chinsinsi?",
  "auth.createAccount": "Pangani Akaunti",
  // Navigation
  "nav.home": "Kunyumba",
  "nav.pickups": "Kutenga",
  "nav.profile": "Mbiri",
  "nav.settings": "Zosintha",
  // Home
  "home.requestPickup": "Pemphani Kutenga",
  "home.schedulePickup": "Konzani Nthawi",
  "home.trackPickup": "Tsatirani Kutenga",
  "home.recentPickups": "Kutenga Kumene",
  "home.noPickups": "Palibe kutenga",
  // Pickups
  "pickups.title": "Kutenga Kwanga",
  "pickups.pending": "Kudikira",
  "pickups.completed": "Kwatha",
  "pickups.scheduled": "Kokonzedwa",
  "pickups.cancelled": "Koletsa",
  "pickups.status": "Momwe Zilili",
  "pickups.location": "Malo",
  "pickups.notes": "Mawu",
  "pickups.binType": "Mtundu wa Bin",
  "pickups.residential": "Kunyumba",
  "pickups.commercial": "Kwa Malonda",
  "pickups.industrial": "Kwa Ntchito",
  // Payments
  "payments.title": "Malipiro",
  "payments.history": "Mbiri ya Malipiro",
  "payments.amount": "Ndalama",
  "payments.method": "Njira ya Kulipira",
  "payments.status": "Momwe Zilili",
  "payments.confirmed": "Yavomerezedwa",
  "payments.pendingStatus": "Kudikira",
  "payments.failed": "Yalephera",
  "payments.receipt": "Pepala",
  // Profile
  "profile.title": "Mbiri",
  "profile.editProfile": "Sinthani Mbiri",
  "profile.notifications": "Zidziwitso",
  "profile.language": "Chilankhulo",
  "profile.about": "Za Ife",
  "profile.help": "Thandizo",
  // Settings
  "settings.title": "Zosintha",
  "settings.reminders": "Zokumbutsa",
  "settings.reminderTime": "Nthawi ya Kukumbutsa",
  "settings.enableReminders": "Yambitsani Zokumbutsa",
  // Collector
  "collector.dashboard": "Dashboard",
  "collector.earnings": "Ndalama",
  "collector.availablePickups": "Kutenga Kopezeka",
  "collector.myPickups": "Kutenga Kwanga",
  "collector.completePickup": "Maliza Kutenga",
  // Ratings
  "ratings.rateCollector": "Perekani Manambala",
  "ratings.yourRating": "Manambala Anu",
  "ratings.leaveComment": "Lembani mawu (ngati mukufuna)",
  "ratings.submit": "Tumizani",
  // Time
  "time.morning": "Mmawa",
  "time.afternoon": "Masana",
  "time.evening": "Madzulo",
  "time.today": "Lero",
  "time.tomorrow": "Mawa",
  "time.thisWeek": "Sabata Ino",
  "time.thisMonth": "Mwezi Uno",
};

// Tonga translations
const toi: Translations = {
  // Common
  "common.welcome": "Mwabonwa",
  "common.loading": "Kulindila...",
  "common.error": "Cilubizyo",
  "common.success": "Cabotu",
  "common.cancel": "Leka",
  "common.confirm": "Zumina",
  "common.save": "Bamba",
  "common.delete": "Mana",
  "common.edit": "Sinsya",
  "common.back": "Bweeda",
  "common.next": "Kuyaamina",
  "common.done": "Camana",
  "common.search": "Yanduula",
  "common.filter": "Salazya",
  "common.all": "Zyoonse",
  "common.none": "Kunyina",
  // Auth
  "auth.login": "Njila",
  "auth.logout": "Zwa",
  "auth.register": "Lemba",
  "auth.phone": "Nambala ya Foni",
  "auth.password": "Cisisi",
  "auth.forgotPassword": "Waluba cisisi?",
  "auth.createAccount": "Panga Akaunti",
  // Navigation
  "nav.home": "Kuŋanda",
  "nav.pickups": "Kutola",
  "nav.profile": "Mwini",
  "nav.settings": "Zyakusinsya",
  // Home
  "home.requestPickup": "Kumbila Kutola",
  "home.schedulePickup": "Bika Ciindi",
  "home.trackPickup": "Tobela Kutola",
  "home.recentPickups": "Kutola Kwacino",
  "home.noPickups": "Kunyina kutola",
  // Pickups
  "pickups.title": "Kutola Kwangu",
  "pickups.pending": "Kulindila",
  "pickups.completed": "Camana",
  "pickups.scheduled": "Cabikwa",
  "pickups.cancelled": "Calekwa",
  "pickups.status": "Mbubuti",
  "pickups.location": "Busena",
  "pickups.notes": "Mabala",
  "pickups.binType": "Musyobo wa Bin",
  "pickups.residential": "Kuŋanda",
  "pickups.commercial": "Kwa Malonda",
  "pickups.industrial": "Kwa Milimo",
  // Payments
  "payments.title": "Malipilo",
  "payments.history": "Makani aa Malipilo",
  "payments.amount": "Mali",
  "payments.method": "Nzila ya Kulipa",
  "payments.status": "Mbubuti",
  "payments.confirmed": "Yazuminwa",
  "payments.pendingStatus": "Kulindila",
  "payments.failed": "Yalezya",
  "payments.receipt": "Cipepala",
  // Profile
  "profile.title": "Mwini",
  "profile.editProfile": "Sinsya Mwini",
  "profile.notifications": "Zyakuzibya",
  "profile.language": "Mulaka",
  "profile.about": "Atala Andiswe",
  "profile.help": "Lugwasyo",
  // Settings
  "settings.title": "Zyakusinsya",
  "settings.reminders": "Zyakuyeezya",
  "settings.reminderTime": "Ciindi ca Kuyeezya",
  "settings.enableReminders": "Talisya Zyakuyeezya",
  // Collector
  "collector.dashboard": "Dashboard",
  "collector.earnings": "Zinjilwa",
  "collector.availablePickups": "Kutola Kuli",
  "collector.myPickups": "Kutola Kwangu",
  "collector.completePickup": "Mana Kutola",
  // Ratings
  "ratings.rateCollector": "Pa Manambala",
  "ratings.yourRating": "Manambala Aako",
  "ratings.leaveComment": "Lemba mabala (kuti wayanda)",
  "ratings.submit": "Tumina",
  // Time
  "time.morning": "Mafwumofwumo",
  "time.afternoon": "Masikati",
  "time.evening": "Mangolezya",
  "time.today": "Sunu",
  "time.tomorrow": "Jilo",
  "time.thisWeek": "Viki Eeli",
  "time.thisMonth": "Mwezi Ooyu",
};

const translations: Record<Language, Translations> = { en, bem, nya, toi };

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: TranslationKey) => string;
  languages: LanguageInfo[];
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const STORAGE_KEY = "ltc_language";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored && (stored === "en" || stored === "bem" || stored === "nya" || stored === "toi")) {
        setLanguageState(stored as Language);
      }
    } catch (error) {
      console.error("Failed to load language:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const setLanguage = useCallback(async (lang: Language) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, lang);
      setLanguageState(lang);
    } catch (error) {
      console.error("Failed to save language:", error);
    }
  }, []);

  const t = useCallback((key: TranslationKey): string => {
    return translations[language][key] || translations.en[key] || key;
  }, [language]);

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        t,
        languages: LANGUAGES,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
