import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

export interface ExportColumn {
  key: string;
  header: string;
  formatter?: (value: any) => string;
}

/**
 * Convert data array to CSV string
 */
export function convertToCSV<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[]
): string {
  if (data.length === 0) return "";

  // Header row
  const headers = columns.map((col) => `"${col.header}"`).join(",");

  // Data rows
  const rows = data.map((item) => {
    return columns
      .map((col) => {
        const value = item[col.key];
        const formatted = col.formatter ? col.formatter(value) : String(value ?? "");
        // Escape quotes and wrap in quotes
        return `"${formatted.replace(/"/g, '""')}"`;
      })
      .join(",");
  });

  return [headers, ...rows].join("\n");
}

/**
 * Export data as CSV file
 */
export async function exportToCSV<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[],
  filename: string
): Promise<{ success: boolean; message: string; path?: string }> {
  try {
    const csv = convertToCSV(data, columns);
    const timestamp = new Date().toISOString().split("T")[0];
    const fullFilename = `${filename}_${timestamp}.csv`;

    if (Platform.OS === "web") {
      // For web, create a download link
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fullFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return { success: true, message: "File downloaded successfully" };
    }

    // For native, save to file system
    const fileUri = `${FileSystem.documentDirectory}${fullFilename}`;
    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Share the file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: `Export ${filename}`,
      });
    }

    return { success: true, message: "File exported successfully", path: fileUri };
  } catch (error) {
    console.error("Export error:", error);
    return { success: false, message: "Failed to export file" };
  }
}

/**
 * Export columns for transactions
 */
export const TRANSACTION_COLUMNS: ExportColumn[] = [
  { key: "id", header: "Transaction ID" },
  { key: "userId", header: "User ID" },
  { key: "amount", header: "Amount (K)", formatter: (v) => v?.toFixed(2) || "0.00" },
  { key: "type", header: "Type" },
  { key: "method", header: "Payment Method" },
  { key: "status", header: "Status" },
  { key: "reference", header: "Reference" },
  { key: "createdAt", header: "Date", formatter: (v) => new Date(v).toLocaleString() },
];

/**
 * Export columns for users
 */
export const USER_COLUMNS: ExportColumn[] = [
  { key: "id", header: "User ID" },
  { key: "fullName", header: "Full Name" },
  { key: "phone", header: "Phone Number" },
  { key: "role", header: "Role" },
  { key: "location", header: "Location" },
  { key: "subscriptionPlan", header: "Subscription" },
  { key: "subscriptionStatus", header: "Status" },
  { key: "createdAt", header: "Registered", formatter: (v) => new Date(v).toLocaleDateString() },
];

/**
 * Export columns for pickups
 */
export const PICKUP_COLUMNS: ExportColumn[] = [
  { key: "id", header: "Pickup ID" },
  { key: "customerId", header: "Customer ID" },
  { key: "collectorId", header: "Collector ID" },
  { key: "binType", header: "Bin Type" },
  { key: "status", header: "Status" },
  { key: "address", header: "Address" },
  { key: "scheduledDate", header: "Scheduled Date", formatter: (v) => v ? new Date(v).toLocaleDateString() : "N/A" },
  { key: "completedAt", header: "Completed", formatter: (v) => v ? new Date(v).toLocaleString() : "N/A" },
  { key: "rating", header: "Rating", formatter: (v) => v ? `${v}/5` : "N/A" },
];

/**
 * Export columns for disputes
 */
export const DISPUTE_COLUMNS: ExportColumn[] = [
  { key: "id", header: "Dispute ID" },
  { key: "pickupId", header: "Pickup ID" },
  { key: "customerId", header: "Customer ID" },
  { key: "issueType", header: "Issue Type" },
  { key: "description", header: "Description" },
  { key: "status", header: "Status" },
  { key: "resolution", header: "Resolution" },
  { key: "createdAt", header: "Reported", formatter: (v) => new Date(v).toLocaleString() },
  { key: "resolvedAt", header: "Resolved", formatter: (v) => v ? new Date(v).toLocaleString() : "Pending" },
];

/**
 * Export columns for subscriptions
 */
export const SUBSCRIPTION_COLUMNS: ExportColumn[] = [
  { key: "id", header: "User ID" },
  { key: "fullName", header: "Full Name" },
  { key: "phone", header: "Phone" },
  { key: "subscriptionPlan", header: "Plan" },
  { key: "subscriptionStatus", header: "Status" },
  { key: "subscriptionStartDate", header: "Start Date", formatter: (v) => v ? new Date(v).toLocaleDateString() : "N/A" },
  { key: "subscriptionEndDate", header: "End Date", formatter: (v) => v ? new Date(v).toLocaleDateString() : "N/A" },
];

/**
 * Generate summary report text
 */
export function generateSummaryReport(stats: {
  totalUsers: number;
  totalCollectors: number;
  totalRecyclers: number;
  totalCustomers: number;
  activePickups: number;
  completedPickups: number;
  pendingDisputes: number;
  totalRevenue: number;
  todayRevenue: number;
  newSubscriptions: number;
}): string {
  const date = new Date().toLocaleString();
  return `
LTC FAST TRACK - SUMMARY REPORT
Generated: ${date}
================================

USER STATISTICS
---------------
Total Users: ${stats.totalUsers}
Customers: ${stats.totalCustomers}
Collectors: ${stats.totalCollectors}
Recyclers: ${stats.totalRecyclers}

PICKUP STATISTICS
-----------------
Active Pickups: ${stats.activePickups}
Completed Pickups: ${stats.completedPickups}
Pending Disputes: ${stats.pendingDisputes}

REVENUE
-------
Total Revenue: K${stats.totalRevenue.toLocaleString()}
Today's Revenue: K${stats.todayRevenue.toLocaleString()}

SUBSCRIPTIONS
-------------
New Subscriptions: ${stats.newSubscriptions}

================================
End of Report
  `.trim();
}
