import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";

/**
 * Collector-specific API routes
 * Handles zone assignments, document validation, and collector-specific data
 * 
 * NOTE: This router uses mock data for development. In production:
 * - Add zones table to database schema
 * - Add collector_profiles table with zone assignments
 * - Add document_expiry fields to user/collector profile
 * - Integrate with real notification service
 */

export const collectorRouter = router({
  /**
   * Get collector's assigned zone details with boundaries
   * Returns zone information including name, boundaries (GeoJSON), and metadata
   * 
   * TODO: Replace mock data with actual database queries when zones table is implemented
   */
  getZoneDetails: publicProcedure
    .input(
      z.object({
        collectorId: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          return {
            success: false,
            assigned: false,
            message: "Database not available",
          };
        }

        // Check if collector exists
        const collector = await db
          .select({
            id: users.id,
            name: users.name,
            role: users.role,
          })
          .from(users)
          .where(eq(users.id, parseInt(input.collectorId)))
          .limit(1);

        if (!collector.length) {
          return {
            success: false,
            assigned: false,
            message: "Collector not found",
          };
        }

        // TODO: Query zones table when implemented
        // const zoneAssignment = await db.select().from(zoneAssignments)
        //   .where(eq(zoneAssignments.collectorId, input.collectorId));
        // const zoneData = await db.select().from(zones)
        //   .where(eq(zones.id, zoneAssignment.zoneId));

        // Mock zone data for development
        const mockZones = {
          "1": {
            id: "zone_1",
            name: "Zone A - Central",
            boundaries: [
              { latitude: -15.4067, longitude: 28.2733 },
              { latitude: -15.4067, longitude: 28.2933 },
              { latitude: -15.4267, longitude: 28.2933 },
              { latitude: -15.4267, longitude: 28.2733 },
            ],
          },
          "2": {
            id: "zone_2",
            name: "Zone B - East",
            boundaries: [
              { latitude: -15.4167, longitude: 28.2833 },
              { latitude: -15.4167, longitude: 28.3033 },
              { latitude: -15.4367, longitude: 28.3033 },
              { latitude: -15.4367, longitude: 28.2833 },
            ],
          },
        };

        // Assign zone based on collector ID (mock logic)
        const zoneKey = (parseInt(input.collectorId) % 2 + 1).toString() as "1" | "2";
        const zone = mockZones[zoneKey];

        return {
          success: true,
          assigned: true,
          zone: {
            id: zone.id,
            name: zone.name,
            boundaries: zone.boundaries,
            center: {
              latitude: zone.boundaries[0].latitude + 0.01,
              longitude: zone.boundaries[0].longitude + 0.01,
            },
          },
        };
      } catch (error) {
        console.error("[Collector API] Error fetching zone details:", error);
        return {
          success: false,
          assigned: false,
          message: "Failed to fetch zone details",
        };
      }
    }),

  /**
   * Get households assigned to collector's zone
   * Returns list of households with coordinates for map display
   * 
   * TODO: Replace mock data with actual subscriptions/households table query
   */
  getZoneHouseholds: publicProcedure
    .input(
      z.object({
        collectorId: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          return {
            success: false,
            households: [],
            message: "Database not available",
          };
        }

        // Verify collector exists
        const collector = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, parseInt(input.collectorId)))
          .limit(1);

        if (!collector.length) {
          return {
            success: false,
            households: [],
            message: "Collector not found",
          };
        }

        // TODO: Query households/subscriptions table when implemented
        // const households = await db.select().from(subscriptions)
        //   .where(eq(subscriptions.zoneId, collectorZoneId));

        // Mock household data for development
        const mockHouseholds = [
          {
            id: "h1",
            name: "House 101",
            address: "Plot 101, Main Street",
            latitude: -15.4117,
            longitude: 28.2783,
            subscriptionStatus: "active",
            customerName: "John Doe",
            customerPhone: "+260 97 1234567",
          },
          {
            id: "h2",
            name: "House 102",
            address: "Plot 102, Main Street",
            latitude: -15.4147,
            longitude: 28.2813,
            subscriptionStatus: "active",
            customerName: "Jane Smith",
            customerPhone: "+260 97 2345678",
          },
          {
            id: "h3",
            name: "House 103",
            address: "Plot 103, Second Avenue",
            latitude: -15.4187,
            longitude: 28.2853,
            subscriptionStatus: "active",
            customerName: "Mike Johnson",
            customerPhone: "+260 97 3456789",
          },
          {
            id: "h4",
            name: "House 104",
            address: "Plot 104, Third Road",
            latitude: -15.4217,
            longitude: 28.2883,
            subscriptionStatus: "active",
            customerName: "Sarah Williams",
            customerPhone: "+260 97 4567890",
          },
        ];

        return {
          success: true,
          households: mockHouseholds,
          total: mockHouseholds.length,
        };
      } catch (error) {
        console.error("[Collector API] Error fetching zone households:", error);
        return {
          success: false,
          households: [],
          message: "Failed to fetch households",
        };
      }
    }),

  /**
   * Get collector's document status with expiry alerts
   * Checks all documents and returns expiry warnings
   * 
   * TODO: Add document_expiry fields to collector profile table
   * TODO: Integrate with push notification service for expiry alerts
   */
  getDocumentStatus: publicProcedure
    .input(
      z.object({
        collectorId: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          return {
            success: false,
            message: "Database not available",
          };
        }

        // Fetch collector
        const collector = await db
          .select({
            id: users.id,
            name: users.name,
          })
          .from(users)
          .where(eq(users.id, parseInt(input.collectorId)))
          .limit(1);

        if (!collector.length) {
          return {
            success: false,
            message: "Collector not found",
          };
        }

        // TODO: Query collector_documents table when implemented
        // const documents = await db.select().from(collectorDocuments)
        //   .where(eq(collectorDocuments.collectorId, input.collectorId));

        // Mock document data with expiry dates for development
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        // Mock expiry dates (for testing)
        const licenseExpiry = new Date();
        licenseExpiry.setDate(today.getDate() + 25); // Expiring in 25 days

        const registrationExpiry = new Date();
        registrationExpiry.setDate(today.getDate() + 90); // Valid for 90 days

        const documents = [
          {
            type: "license",
            name: "Driver's License",
            uploaded: true,
            expiry: licenseExpiry,
            status: "expiring" as "valid" | "expiring" | "expired" | "missing",
            daysUntilExpiry: 25,
          },
          {
            type: "registration",
            name: "Vehicle Registration",
            uploaded: true,
            expiry: registrationExpiry,
            status: "valid" as "valid" | "expiring" | "expired" | "missing",
            daysUntilExpiry: 90,
          },
          {
            type: "nrc",
            name: "National Registration Card",
            uploaded: true,
            expiry: null, // NRC typically doesn't expire
            status: "valid" as "valid" | "expiring" | "expired" | "missing",
            daysUntilExpiry: 0,
          },
        ];

        // Filter documents that need attention
        const alerts = documents.filter(
          (doc) =>
            doc.status === "expiring" ||
            doc.status === "expired" ||
            doc.status === "missing"
        );

        return {
          success: true,
          documents,
          alerts,
          hasAlerts: alerts.length > 0,
        };
      } catch (error) {
        console.error("[Collector API] Error fetching document status:", error);
        return {
          success: false,
          message: "Failed to fetch document status",
        };
      }
    }),
});
