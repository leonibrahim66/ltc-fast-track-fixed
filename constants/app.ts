// App-wide constants and configuration

export const APP_CONFIG = {
  name: "LTC FAST TRACK",
  tagline: "Fast & Efficient Garbage Collection",
  currency: "ZMW",
  currencySymbol: "K",
  /**
   * DEV MODE — set to false before production release.
   * When true:
   *  - garbage_driver can log in with status = "pending_manager_approval"
   *  - zone_manager can log in with status = "pending_review"
   *  - Mock pickup data is generated when no real pickups exist
   *  - A warning banner is shown on all affected dashboards
   *  - Customers can request pickups and pin bin locations WITHOUT an active subscription
   * When false:
   *  - garbage_driver requires driverStatus = "active"
   *  - zone_manager requires status = "active" AND zone_id != null
   *  - Customers require an active subscription to request pickups
   */
  devMode: false,
  /**
   * SUBSCRIPTION GATE — set to true before production release.
   * When false: customers can request pickups without an active subscription (dev/testing).
   * When true: customers must have an active subscription to request pickups.
   * NOTE: This flag is independent of devMode so it can be toggled separately.
   */
  requireSubscriptionForPickup: false,
};

// Contact Information
export const CONTACTS = {
  // Phone Numbers
  supportPhone: "+260960500656",
  paymentPhone: "0960819993",
  mainPhone: "+260960819993",
  emergencyPhone: "+260960819993",
  
  // WhatsApp
  whatsappSupport: "https://wa.me/260960500656",
  whatsappGroup: "https://chat.whatsapp.com/FYxhfg58ftVIJdLrp3L4Uf",
  whatsappChannel: "https://whatsapp.com/channel/0029VbBI2c16hENx0dnt593o",
  whatsappBusinessNumber: "+260960819993",
  
  // Email Addresses
  emails: ["trashcash2025@gmail.com", "liquidmarketing99@gmail.com"],
  supportEmail: "trashcash2025@gmail.com",
  businessEmail: "liquidmarketing99@gmail.com",
  
  // Social Media
  facebook: "https://facebook.com/ltcfasttrack",
  twitter: "https://twitter.com/ltcfasttrack",
  instagram: "https://instagram.com/ltcfasttrack",
  linkedin: "https://linkedin.com/company/ltcfasttrack",
  tiktok: "https://tiktok.com/@ltcfasttrack",
  
  // Office Location
  officeAddress: "Plot 123, Cairo Road, Lusaka, Zambia",
  officeHours: "Monday - Friday: 8:00 AM - 5:00 PM",
  officeHoursSaturday: "Saturday: 8:00 AM - 1:00 PM",
  
  // Website
  website: "https://ltcfasttrack.com",
};

// Payment Configuration
export const PAYMENT = {
  merchantCode: "58939299",
  ussdCode: "*4466#",
  mobileMoneyProviders: [
    { id: "mtn", name: "MTN Mobile Money", color: "#FFCC00", receiverNumber: "+260960819993" },
    { id: "airtel", name: "Airtel Mobile Money", color: "#FF0000", receiverNumber: "20158560" },
    { id: "zamtel", name: "Zamtel Mobile Money", color: "#00A651", receiverNumber: "" },
  ],
  banks: [
    { id: "indo_zambian", name: "Indo Zambian Bank" },
    { id: "zanaco", name: "Zanaco Bank" },
    { id: "standard_chartered", name: "Standard Chartered Bank" },
    { id: "fnb", name: "FNB Bank" },
    { id: "access", name: "Access Bank" },
    { id: "absa", name: "Absa Bank" },
  ],
};

// Subscription Plans
export const SUBSCRIPTION_PLANS = {
  residential: {
    basic: {
      id: "res_basic",
      name: "Basic",
      price: 100,
      pickups: 4,
      description: "4 pickups per month",
    },
    premium: {
      id: "res_premium",
      name: "Premium",
      price: 180,
      pickups: -1, // unlimited
      description: "Unlimited pickups per month",
    },
  },
  commercial: {
    basic: {
      id: "com_basic",
      name: "Basic",
      price: 350,
      pickups: 4,
      description: "4 pickups per month",
    },
    premium: {
      id: "com_premium",
      name: "Premium",
      price: 500,
      pickups: -1, // unlimited
      description: "Unlimited pickups per month",
    },
  },
  industrial: {
    basic: {
      id: "ind_basic",
      name: "Basic Industrial",
      price: 2000,
      pickups: 8,
      description: "8 pickups per month with large bins",
      features: [
        "8 scheduled pickups per month",
        "Large industrial bins (1100L)",
        "Priority scheduling",
        "Dedicated account manager",
        "Monthly waste reports",
      ],
    },
    premium: {
      id: "ind_premium",
      name: "Premium Industrial",
      price: 3500,
      pickups: -1, // unlimited
      description: "Unlimited pickups with premium industrial services",
      features: [
        "Unlimited pickups per month",
        "Extra-large bins (1100L-2200L)",
        "Same-day emergency pickups",
        "Hazardous waste handling",
        "24/7 priority support",
        "Dedicated collection team",
        "Detailed waste analytics",
        "Compliance documentation",
      ],
    },
  },
};

// User Roles
export const USER_ROLES = {
  RESIDENTIAL: "residential",
  COMMERCIAL: "commercial",
  INDUSTRIAL: "industrial",
  /** @deprecated Use ZONE_MANAGER instead */
  COLLECTOR: "collector",
  ZONE_MANAGER: "zone_manager",
  RECYCLER: "recycler",
  DRIVER: "driver",
  GARBAGE_DRIVER: "garbage_driver",
  ADMIN: "admin",
} as const;

// Recycling Categories
export const RECYCLING_CATEGORIES = [
  { id: "plastic", name: "Plastics", unit: "tons", minOrder: 0.5 },
  { id: "metal", name: "Metals & Scrap", unit: "tons", minOrder: 0.5 },
  { id: "paper", name: "Paper & Cardboard", unit: "tons", minOrder: 1 },
  { id: "glass", name: "Glass", unit: "tons", minOrder: 0.5 },
  { id: "organic", name: "Organic Waste", unit: "tons", minOrder: 2 },
  { id: "electronics", name: "E-Waste", unit: "kg", minOrder: 50 },
  { id: "mixed", name: "Mixed Recyclables", unit: "tons", minOrder: 1 },
] as const;

// Recycling Pricing (per ton/kg)
export const RECYCLING_PRICING = {
  plastic: 500,
  metal: 800,
  paper: 300,
  glass: 400,
  organic: 200,
  electronics: 50, // per kg
  mixed: 350,
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

// Transport Categories for Collectors
export const TRANSPORT_CATEGORIES = [
  { id: "heavy_truck", name: "Heavy Truck", requiresVehicle: true, icon: "🚛", capacity: "5+ tons" },
  { id: "light_truck", name: "Light Truck", requiresVehicle: true, icon: "🚚", capacity: "1-5 tons" },
  { id: "small_carrier", name: "Small Carrier", requiresVehicle: false, icon: "🛺", capacity: "Up to 1 ton" },
] as const;

// Collector Affiliation Fees (One-time registration fee)
export const COLLECTOR_AFFILIATION_FEES = {
  foot_collector: {
    id: "foot_collector",
    name: "Foot Collector",
    fee: 150,
    description: "Walk-based collection in local areas",
    icon: "🚶",
  },
  small_carrier: {
    id: "small_carrier",
    name: "Small Carrier",
    fee: 250,
    description: "Bicycle, wheelbarrow, or small cart",
    icon: "🛺",
  },
  light_truck: {
    id: "light_truck",
    name: "Light Truck",
    fee: 350,
    description: "Pickup trucks and small vans (1-5 tons)",
    icon: "🚚",
  },
  heavy_truck: {
    id: "heavy_truck",
    name: "Heavy Truck",
    fee: 500,
    description: "Large trucks and lorries (5+ tons)",
    icon: "🚛",
  },
} as const;

export type CollectorType = keyof typeof COLLECTOR_AFFILIATION_FEES;

// Pickup Status — full driver lifecycle
export const PICKUP_STATUS = {
  PENDING: "pending",
  ASSIGNED: "assigned",
  ACCEPTED: "accepted",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
} as const;

export type PickupStatus = (typeof PICKUP_STATUS)[keyof typeof PICKUP_STATUS];
