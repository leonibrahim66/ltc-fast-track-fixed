/**
 * News Types for LTC FAST TRACK
 * 
 * Two separate news systems:
 * 1. Home News - Auto-sliding carousel on Customer Home screen
 * 2. Navigation News - Full news feed accessible from bottom nav News tab
 */

export type NewsCategory = "Trash Pickup Services" | "Carrier Services" | "General" | "Announcement";
export type SlideType = "news" | "sponsor";

export interface SponsorDetails {
  sponsorName: string;
  sponsorType: string;
  description: string;
  images: (string | number | object)[];
  website?: string;
  contact?: string;
}

export interface HomeNewsItem {
  id: string;
  image: string; // Local asset path or URL
  title: string;
  shortDescription: string; // For carousel overlay
  fullDescription: string; // For detail screen
  category: NewsCategory;
  isActive: boolean;
  order: number; // Display order (lower number = higher priority)
  createdAt: string; // ISO date string
  type?: SlideType; // Default: "news", can be "sponsor"
  sponsorDetails?: SponsorDetails; // Additional data for sponsor slides
}

export interface NavigationNewsItem {
  id: string;
  image: string; // Local asset path or URL
  title: string;
  shortDescription: string; // Brief summary
  fullDescription: string; // Full article content
  category: NewsCategory;
  isActive: boolean;
  order: number; // Display order (lower number = higher priority)
  createdAt: string; // ISO date string
}

// AsyncStorage keys
export const HOME_NEWS_STORAGE_KEY = "HOME_NEWS";
export const NAVIGATION_NEWS_STORAGE_KEY = "NAVIGATION_NEWS";
