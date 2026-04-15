import { useState, useEffect } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin, AdminPermissions } from "@/lib/admin-context";
import { APP_CONFIG } from "@/constants/app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

interface QuickStat {
  id: string;
  label: string;
  value: number | string;
  icon: string;
  color: string;
  route?: string;
}

interface MenuItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  route: string;
  badge?: number;
  permission: keyof AdminPermissions;
  category?: string; // New: category for organization
}

interface Category {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  permissions: (keyof AdminPermissions)[];
}

export default function AdminPanelScreen() {
  const router = useRouter();
  const { adminUser, isAdminAuthenticated, logoutAdmin, stats, refreshStats, unreadNotifications, hasPermission, getRoleLabel } = useAdmin();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.replace("/admin-login" as any);
      return;
    }
    // Council admins have their own dedicated dashboard
    if (adminUser?.role === "council_admin") {
      router.replace("/council-admin-dashboard" as any);
      return;
    }
    refreshStats();
  }, [isAdminAuthenticated, adminUser?.role]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshStats();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout from the admin panel?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            await logoutAdmin();
            router.replace("/(auth)/welcome" as any);
          },
        },
      ]
    );
  };

  const quickStats: QuickStat[] = [
    {
      id: "users",
      label: "Total Users",
      value: stats.totalUsers,
      icon: "people",
      color: "#3B82F6",
      route: "/admin-users",
    },
    {
      id: "collectors",
      label: "Collectors",
      value: stats.totalCollectors,
      icon: "local-shipping",
      color: "#22C55E",
      route: "/admin-users?filter=collector",
    },
    {
      id: "pickups",
      label: "Active Pickups",
      value: stats.activePickups,
      icon: "pending-actions",
      color: "#F59E0B",
      route: "/admin-pickups",
    },
    {
      id: "disputes",
      label: "Open Disputes",
      value: stats.pendingDisputes,
      icon: "gavel",
      color: "#EF4444",
      route: "/admin-disputes",
    },
  ];

  // Define categories for Super Admin organization
  const categories: Category[] = [
    {
      id: "dashboard",
      title: "Dashboard & Overview",
      description: "Real-time metrics and system overview",
      icon: "dashboard",
      color: "#8B5CF6",
      permissions: ["dashboard"],
    },
    {
      id: "finance",
      title: "Finance Control",
      description: "Financial operations and revenue tracking",
      icon: "account-balance-wallet",
      color: "#22C55E",
      permissions: ["transactions", "subscriptions", "analytics", "exportData"],
    },
    {
      id: "support",
      title: "Support Service",
      description: "Customer support and communication",
      icon: "support-agent",
      color: "#3B82F6",
      permissions: ["users", "disputes", "pickups", "notifications", "performance"],
    },
    {
      id: "operations",
      title: "Operations Data Management",
      description: "Operational workflows and monitoring",
      icon: "settings-applications",
      color: "#F59E0B",
      permissions: ["users", "disputes", "pickups", "updates", "notifications", "performance"],
    },
    {
      id: "settings",
      title: "System Settings & Configuration",
      description: "App settings and system configuration",
      icon: "settings",
      color: "#8B5CF6",
      permissions: ["settings"],
    },
    {
      id: "developer",
      title: "Developer & API Tools",
      description: "API management and developer resources",
      icon: "code",
      color: "#EC4899",
      permissions: ["settings"],
    },
    {
      id: "zonemanagement",
      title: "Zone Management",
      description: "Manage zones, assign collectors, and organize households",
      icon: "location-on",
      color: "#10B981",
      permissions: ["zoneManagement"], // Special permission for zone managers
    },
  ];

  const menuItems: MenuItem[] = [
    // Dashboard & Overview
    {
      id: "live-feed",
      title: "Live Feed",
      description: "Real-time notifications and events",
      icon: "rss-feed",
      color: "#EF4444",
      route: "/admin-live-feed",
      permission: "dashboard",
      category: "dashboard",
    },
    {
      id: "dashboard",
      title: "Dashboard Overview",
      description: "View statistics and metrics",
      icon: "dashboard",
      color: "#8B5CF6",
      route: "/admin-dashboard",
      permission: "dashboard",
      category: "dashboard",
    },
    {
      id: "widgets",
      title: "Dashboard Widgets",
      description: "Customize dashboard with key metrics",
      icon: "widgets",
      color: "#F472B6",
      route: "/admin-widgets",
      permission: "dashboard",
      category: "dashboard",
    },

    // Finance Control
    {
      id: "commission-dashboard",
      title: "Commission Dashboard",
      description: "Total, daily, monthly commission and per-transaction breakdown",
      icon: "percent",
      color: "#22C55E",
      route: "/admin-commission-dashboard",
      permission: "transactions",
      category: "finance",
    },
    {
      id: "transactions",
      title: "Transaction Monitor",
      description: "Track payments and revenue",
      icon: "account-balance-wallet",
      color: "#22C55E",
      route: "/admin-transactions",
      permission: "transactions",
      category: "finance",
    },
    {
      id: "subscriptions",
      title: "Subscriptions",
      description: "Manage user subscriptions",
      icon: "card-membership",
      color: "#06B6D4",
      route: "/admin-subscriptions",
      badge: stats.expiringSubscriptions,
      permission: "subscriptions",
      category: "finance",
    },
    {
      id: "plans-editor",
      title: "Subscription Plans",
      description: "Edit subscription plans, pricing, and features",
      icon: "card-membership",
      color: "#F59E0B",
      route: "/admin-plans-editor",
      permission: "subscriptions",
      category: "finance",
    },
    {
      id: "subscription-approval",
      title: "Subscription Approvals",
      description: "Approve or reject subscription and affiliation requests",
      icon: "check-circle",
      color: "#10B981",
      route: "/admin-subscription-approval",
      permission: "subscriptions",
      category: "finance",
    },
    {
      id: "analytics",
      title: "Read Receipts",
      description: "Track update engagement metrics",
      icon: "analytics",
      color: "#6366F1",
      route: "/admin-analytics",
      permission: "analytics",
      category: "finance",
    },
    {
      id: "reports",
      title: "Export Reports",
      description: "Download data as CSV files",
      icon: "file-download",
      color: "#14B8A6",
      route: "/admin-reports",
      permission: "exportData",
      category: "finance",
    },
    {
      id: "scheduled-reports",
      title: "Scheduled Reports",
      description: "Configure auto-generated periodic reports",
      icon: "schedule",
      color: "#059669",
      route: "/admin-scheduled-reports",
      permission: "exportData",
      category: "finance",
    },

    // Support Service
    {
      id: "users",
      title: "User Management",
      description: "View and manage all registered users",
      icon: "people",
      color: "#8B5CF6",
      route: "/admin-users",
      permission: "users",
      category: "support",
    },
    {
      id: "live-registrations",
      title: "Users & Subscriptions",
      description: "New registrations and pending subscriptions",
      icon: "person-add",
      color: "#3B82F6",
      route: "/admin-live-registrations",
      permission: "users",
      category: "support",
    },
    {
      id: "chat",
      title: "Messages",
      description: "Chat with collectors in real-time",
      icon: "chat",
      color: "#6366F1",
      route: "/admin-chat",
      permission: "users",
      category: "support",
    },
    {
      id: "disputes",
      title: "Disputes & Complaints",
      description: "Review and resolve customer complaints",
      icon: "gavel",
      color: "#EF4444",
      route: "/admin-disputes",
      badge: stats.pendingDisputes,
      permission: "disputes",
      category: "support",
    },
    {
      id: "pickups",
      title: "Garbage Tracking",
      description: "Monitor pickup status and movements",
      icon: "local-shipping",
      color: "#F59E0B",
      route: "/admin-pickups",
      permission: "pickups",
      category: "support",
    },
    {
      id: "live-pickups",
      title: "Live Pickups",
      description: "Track active pickups in real-time",
      icon: "gps-fixed",
      color: "#22C55E",
      route: "/admin-live-pickups",
      permission: "pickups",
      category: "support",
    },
    {
      id: "geofencing",
      title: "Geofencing",
      description: "Manage service zones and track collector locations",
      icon: "location-on",
      color: "#10B981",
      route: "/admin-geofencing",
      permission: "pickups",
      category: "support",
    },
    {
      id: "pickups-map",
      title: "Pickups Map View",
      description: "Interactive map with collector and pickup locations",
      icon: "map",
      color: "#2563EB",
      route: "/admin-pickups-map",
      permission: "pickups",
      category: "support",
    },
    {
      id: "notifications",
      title: "Admin Notifications",
      description: "View system alerts and notifications",
      icon: "notifications",
      color: "#F97316",
      route: "/admin-notifications",
      badge: unreadNotifications,
      permission: "notifications",
      category: "support",
    },
    {
      id: "performance",
      title: "Collector Performance",
      description: "Monitor collector ratings and alerts",
      icon: "trending-up",
      color: "#10B981",
      route: "/admin-performance",
      permission: "performance",
      category: "support",
    },
    {
      id: "zone-management",
      title: "Zone Management",
      description: "Manage zones, assign Zone Managers, and reassign households",
      icon: "location-city",
      color: "#8B5CF6",
      route: "/zone-admin-dashboard",
      permission: "zoneManagement",
      category: "support",
    },
    {
      id: "driver-activity-log",
      title: "Driver Activity Log",
      description: "View driver registrations, approvals, and pickup events by zone",
      icon: "history",
      color: "#1E3A5F",
      route: "/admin-activity-log",
      permission: "zoneManagement",
      category: "support",
    },

    // Operations Data Management
    {
      id: "updates",
      title: "Featured Updates",
      description: "Create and manage app announcements",
      icon: "campaign",
      color: "#EC4899",
      route: "/admin-updates",
      permission: "updates",
      category: "operations",
    },
    {
      id: "news",
      title: "News Management",
      description: "Manage Home and Navigation news content",
      icon: "article",
      color: "#3B82F6",
      route: "/admin-news-management",
      permission: "updates",
      category: "operations",
    },
    {
      id: "carrier-drivers",
      title: "Carrier Driver Approvals",
      description: "Review, approve or reject carrier driver registrations",
      icon: "local-shipping",
      color: "#F97316",
      route: "/admin-carrier-drivers",
      permission: "users",
      category: "operations",
    },

    // System Settings & Configuration (Super Admin only)
    {
      id: "alerts",
      title: "Automated Alerts",
      description: "Configure alert rules and view triggers",
      icon: "notifications-active",
      color: "#DC2626",
      route: "/admin-alerts",
      permission: "settings",
      category: "settings",
    },
    {
      id: "notification-settings",
      title: "Email/SMS Settings",
      description: "Configure notification recipients and templates",
      icon: "email",
      color: "#0EA5E9",
      route: "/admin-notification-settings",
      permission: "settings",
      category: "settings",
    },
    {
      id: "activity-logs",
      title: "Activity Logs",
      description: "View admin action history and audit trail",
      icon: "history",
      color: "#7C3AED",
      route: "/admin-activity-logs",
      permission: "settings",
      category: "settings",
    },
    {
      id: "alert-settings",
      title: "Sound & Vibration Alerts",
      description: "Configure audio and haptic notifications",
      icon: "volume-up",
      color: "#7C3AED",
      route: "/admin-alert-settings",
      permission: "settings",
      category: "settings",
    },
    {
      id: "content-editor",
      title: "Content Manager",
      description: "Edit app content, featured updates, and images",
      icon: "edit",
      color: "#06B6D4",
      route: "/admin-content-editor",
      permission: "settings",
      category: "settings",
    },
    {
      id: "settings-editor",
      title: "App Settings",
      description: "Configure colors, maintenance mode, and versions",
      icon: "settings",
      color: "#8B5CF6",
      route: "/admin-settings-editor",
      permission: "settings",
      category: "settings",
    },

    // Developer & API Tools (Super Admin only)
    {
      id: "api-keys",
      title: "API Keys",
      description: "Manage API keys for third-party integrations",
      icon: "vpn-key",
      color: "#8B5CF6",
      route: "/admin-api-keys",
      permission: "settings",
      category: "developer",
    },
    {
      id: "webhooks",
      title: "Webhooks",
      description: "Configure webhooks for real-time events",
      icon: "webhook",
      color: "#EC4899",
      route: "/admin-webhooks",
      permission: "settings",
      category: "developer",
    },
    {
      id: "documentation",
      title: "API Documentation",
      description: "View API documentation and code examples",
      icon: "description",
      color: "#06B6D4",
      route: "/api-documentation",
      permission: "settings",
      category: "developer",
    },
    {
      id: "api-monitoring",
      title: "API Monitoring",
      description: "Real-time API performance metrics",
      icon: "trending-up",
      color: "#10B981",
      route: "/admin-api-monitoring",
      permission: "settings",
      category: "developer",
    },
    {
      id: "sandbox",
      title: "Developer Sandbox",
      description: "Test API endpoints with mock data",
      icon: "sandbox",
      color: "#F59E0B",
      route: "/developer-sandbox",
      permission: "settings",
      category: "developer",
    },
    {
      id: "usage-analytics",
      title: "API Usage Analytics",
      description: "Detailed endpoint and integration metrics",
      icon: "bar-chart",
      color: "#8B5CF6",
      route: "/api-usage-analytics",
      permission: "settings",
      category: "developer",
    },
    {
      id: "rate-limit-alerts",
      title: "Rate Limit Alerts",
      description: "Manage API rate limit notifications",
      icon: "alert-circle",
      color: "#EF4444",
      route: "/admin-rate-limit-alerts",
      permission: "settings",
      category: "developer",
    },
    {
      id: "webhook-retry",
      title: "Webhook Retry Dashboard",
      description: "Manage failed webhook deliveries",
      icon: "refresh-cw",
      color: "#F59E0B",
      route: "/admin-webhook-retry",
      permission: "settings",
      category: "developer",
    },
    {
      id: "cost-calculator",
      title: "API Cost Calculator",
      description: "Monitor and optimize API spending",
      icon: "dollar-sign",
      color: "#10B981",
      route: "/admin-api-cost-calculator",
      permission: "settings",
      category: "developer",
    },

    // Zone Management
    {
      id: "zone-dashboard",
      title: "Zone Management Dashboard",
      description: "Manage zones, assign collectors, and organize households",
      icon: "location-on",
      color: "#10B981",
      route: "/zone-admin-dashboard",
      permission: "zoneManagement",
      category: "zonemanagement",
    },
  ];

  // Filter categories and menu items based on permissions
  const visibleCategories = categories.filter((category) =>
    category.permissions.some((permission) => hasPermission(permission))
  );

  const getVisibleMenuItems = () => {
    if (selectedCategory) {
      return menuItems.filter(
        (item) => item.category === selectedCategory && hasPermission(item.permission)
      );
    }
    return menuItems.filter((item) => hasPermission(item.permission));
  };

  const visibleMenuItems = getVisibleMenuItems();

  // Check if user is Super Admin
  const isSuperAdmin = adminUser?.role === "superadmin";

  return (
    <ScreenContainer className="bg-background">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View className="px-6 pt-6 pb-4 border-b border-border">
          <View className="flex-row items-center justify-between mb-2">
            <View>
              <Text className="text-2xl font-bold text-foreground">
                {APP_CONFIG.name} Admin
              </Text>
              <Text className="text-sm text-muted mt-1">
                {adminUser?.fullName} • {getRoleLabel(adminUser?.role || "superadmin")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleLogout}
              className="bg-error px-4 py-2 rounded-lg"
            >
              <Text className="text-white font-semibold">Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Stats */}
        <View className="px-6 py-4">
          <Text className="text-lg font-semibold text-foreground mb-3">
            Quick Stats
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {quickStats.map((stat) => (
              <TouchableOpacity
                key={stat.id}
                onPress={() => stat.route && router.push(stat.route as any)}
                className="flex-1 min-w-[45%] bg-surface p-4 rounded-xl border border-border"
                style={{ minWidth: "45%" }}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <MaterialIcons
                    name={stat.icon as any}
                    size={24}
                    color={stat.color}
                  />
                  <Text
                    className="text-2xl font-bold"
                    style={{ color: stat.color }}
                  >
                    {stat.value}
                  </Text>
                </View>
                <Text className="text-sm text-muted">{stat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Categories (Super Admin only) */}
        {isSuperAdmin && (
          <View className="px-6 py-4 border-t border-border">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-semibold text-foreground">
                Categories
              </Text>
              {selectedCategory && (
                <TouchableOpacity
                  onPress={() => setSelectedCategory(null)}
                  className="px-3 py-1 bg-primary rounded-full"
                >
                  <Text className="text-white text-xs font-semibold">
                    Show All
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12 }}
            >
              {visibleCategories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  onPress={() =>
                    setSelectedCategory(
                      selectedCategory === category.id ? null : category.id
                    )
                  }
                  className={`px-4 py-3 rounded-xl border ${
                    selectedCategory === category.id
                      ? "bg-primary border-primary"
                      : "bg-surface border-border"
                  }`}
                  style={{ minWidth: 160 }}
                >
                  <View className="flex-row items-center gap-2 mb-1">
                    <MaterialIcons
                      name={category.icon as any}
                      size={20}
                      color={
                        selectedCategory === category.id
                          ? "#FFFFFF"
                          : category.color
                      }
                    />
                    <Text
                      className={`font-semibold ${
                        selectedCategory === category.id
                          ? "text-white"
                          : "text-foreground"
                      }`}
                    >
                      {category.title}
                    </Text>
                  </View>
                  <Text
                    className={`text-xs ${
                      selectedCategory === category.id
                        ? "text-white opacity-90"
                        : "text-muted"
                    }`}
                    numberOfLines={2}
                  >
                    {category.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Menu Items */}
        <View className="px-6 py-4 border-t border-border">
          <Text className="text-lg font-semibold text-foreground mb-3">
            {selectedCategory
              ? visibleCategories.find((c) => c.id === selectedCategory)?.title
              : "All Features"}
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {visibleMenuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => router.push(item.route as any)}
                className="flex-1 min-w-[45%] bg-surface p-4 rounded-xl border border-border"
                style={{ minWidth: "45%" }}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <MaterialIcons
                    name={item.icon as any}
                    size={28}
                    color={item.color}
                  />
                  {item.badge !== undefined && item.badge > 0 && (
                    <View className="bg-error px-2 py-1 rounded-full">
                      <Text className="text-white text-xs font-bold">
                        {item.badge}
                      </Text>
                    </View>
                  )}
                </View>
                <Text className="text-base font-semibold text-foreground mb-1">
                  {item.title}
                </Text>
                <Text className="text-xs text-muted" numberOfLines={2}>
                  {item.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
