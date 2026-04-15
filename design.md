# LTC Fast Track — Mobile App Design

## Overview

**LTC Fast Track** is a logistics and transport coordination mobile app for Zambia, built for the Mine Workers Union of Zambia (MUZ) community. The app connects drivers/carriers with customers for waste collection and transport services, featuring a financial engine with 10% commission, mobile money withdrawals, and a news carousel with sponsor integration.

---

## Screen List

| Screen | Route | Description |
|--------|-------|-------------|
| Home / News Feed | `(tabs)/index` | News carousel, sponsor banners (MUZ, Garden Court Kitwe), quick actions |
| Driver Dashboard | `(tabs)/driver-dashboard` | Booking management, earnings, online/offline toggle |
| Carrier Portal | `carrier/portal` | Carrier-specific dashboard with KPIs, earnings overview, vehicle info |
| Collector Map | `collector-map` | Zone-based map showing active collectors |
| Driver Register | `driver-register` | Driver onboarding form with document upload |
| Withdrawal | `withdraw` | Mobile money withdrawal (MTN/Airtel/Zamtel) |
| Finance Dashboard | `finance-dashboard` | Admin-only financial overview |
| News Detail | `news-detail` | Full article view |
| Auth Screens | `(auth)/*` | Login, registration, OAuth callback |

---

## Primary Content and Functionality

### Home Screen
- **News Carousel**: Auto-scrolling cards with MUZ news, Garden Court Kitwe hotel promotions
- **Sponsor Banners**: MUZ logo, Garden Court Kitwe images (200731246.jpg, 315476001.jpg, 566511384.jpg, 566512533.jpg)
- **Quick Actions**: Book a pickup, register as driver, view map
- **Category Badges**: Color-coded news categories

### Driver Dashboard
- **Booking Queue**: Pending, accepted, in-progress bookings
- **Earnings Summary**: Today, this week, total earnings
- **Online/Offline Toggle**: Animated status indicator
- **Accept/Reject Controls**: Per-booking action buttons
- **Status Updates**: Arrived, picked up, in transit, delivered

### Carrier Portal
- **KPI Cards**: Total deliveries, active deliveries, revenue
- **Earnings Overview Card**: Progress bar, daily/weekly breakdown
- **Vehicle Information**: Plate number, vehicle type, verification status
- **Quick Actions**: Withdraw, view history, support

### Collector Map
- **Zone Polygons**: Colored service zones on Google Maps
- **Collector Markers**: Real-time positions of active collectors
- **Zone Filtering**: Toggle visibility by zone

### Withdrawal Screen
- **Provider Selection**: MTN Mobile Money, Airtel Money, Zamtel Kwacha
- **Amount Input**: With available balance display
- **10% Commission**: Automatically calculated and displayed
- **Transaction History**: Recent withdrawal records

### Finance Dashboard (Admin)
- **Revenue Overview**: Total earnings, commission collected
- **Driver Payouts**: Pending and completed withdrawals
- **Transaction Logs**: Filterable financial records

---

## Key User Flows

### Driver Onboarding
1. User taps "Register as Driver" → `driver-register` screen
2. Fill in personal info, vehicle details
3. Upload documents (NRC, driver's license, vehicle photo)
4. Submit → Pending approval state
5. Admin approves → Driver receives notification → Can go online

### Booking Flow
1. Customer books pickup → Notification to available drivers
2. Driver sees booking in dashboard → Taps "Accept"
3. Driver taps "Arrived" → "Picked Up" → "In Transit" → "Delivered"
4. Booking marked complete → Earnings credited to wallet

### Withdrawal Flow
1. Driver taps "Withdraw" from dashboard
2. Select mobile money provider (MTN/Airtel/Zamtel)
3. Enter amount (min K50, max K5000)
4. 10% commission deducted automatically
5. Confirm → Processing → Completed notification

---

## Color Choices

| Token | Value | Usage |
|-------|-------|-------|
| Primary Green | `#1B5E20` | App primary, MUZ brand green |
| Accent Orange | `#F59E0B` | Earnings, highlights, MUZ flag orange |
| Success | `#22C55E` | Online status, completed bookings |
| Error | `#EF4444` | Rejected, failed transactions |
| Background | `#FFFFFF` (light) / `#151718` (dark) | Screen backgrounds |
| Surface | `#F5F5F5` (light) / `#1E2022` (dark) | Cards, elevated surfaces |

---

## Typography

- **Headers**: Bold, 24-32px
- **Body**: Regular, 14-16px
- **Captions**: 12px, muted color
- **Amounts**: Bold monospace-style for financial figures

---

## Navigation Structure

```
Root Stack
├── (tabs)
│   ├── index (Home/News)
│   ├── driver-dashboard
│   └── collector-map
├── (auth)
│   ├── login
│   └── register
├── carrier/
│   └── portal
├── driver-register
├── withdraw
├── finance-dashboard
└── news-detail
```
