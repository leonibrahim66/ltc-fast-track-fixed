import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getAllZones, getZoneById, createZone, updateZone, deleteZone, getZoneStats, assignCollectorToZone, unassignCollectorFromZone } from "./db-zones";

// Zone status enum
const ZoneStatusEnum = z.enum(["active", "inactive"]);

// Zone creation schema
const ZoneCreateSchema = z.object({
  name: z.string().min(1, "Zone name is required"),
  city: z.string().min(1, "City is required"),
  description: z.string().optional(),
  boundaries: z.string().optional(), // JSON string of coordinates
});

// Zone update schema
const ZoneUpdateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  description: z.string().optional(),
  boundaries: z.string().optional(),
  status: ZoneStatusEnum.optional(),
});

// Collector assignment schema
const CollectorAssignmentSchema = z.object({
  collectorId: z.string(),
  zoneId: z.string(),
});

// Household reassignment schema
const HouseholdReassignmentSchema = z.object({
  householdIds: z.array(z.string()),
  targetZoneId: z.string(),
});

export const zoneRouter = router({
  /**
   * Get all zones with optional status filter
   */
  list: publicProcedure
    .input(
      z.object({
        status: z.enum(["all", "active", "inactive"]).default("all"),
      })
    )
    .query(async ({ input }) => {
      console.log("[Zone] Fetching zones with status:", input.status);

      const zones = await getAllZones(input.status);

      return {
        success: true,
        data: zones.map((z) => ({
          ...z,
          id: z.id.toString(),
          createdAt: z.createdAt.toISOString().split('T')[0],
        })),
        count: zones.length,
      };
    }),

  /**
   * Get zone details by ID
   */
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      console.log("[Zone] Fetching zone details:", input.id);

      const zone = await getZoneById(parseInt(input.id));

      if (!zone) {
        return {
          success: false,
          error: "Zone not found",
        };
      }

      return {
        success: true,
        data: {
          ...zone,
          id: zone.id.toString(),
          createdAt: zone.createdAt.toISOString().split('T')[0],
        },
      };
    }),

  /**
   * Create a new zone
   */
  create: publicProcedure
    .input(ZoneCreateSchema)
    .mutation(async ({ input }) => {
      console.log("[Zone] Creating zone:", input.name);

      const zoneId = await createZone({
        name: input.name,
        city: input.city,
        description: input.description,
        boundaries: input.boundaries,
        status: "active",
        householdCount: 0,
        collectorCount: 0,
      });

      const newZone = await getZoneById(zoneId);

      return {
        success: true,
        data: newZone ? {
          ...newZone,
          id: newZone.id.toString(),
          createdAt: newZone.createdAt.toISOString(),
        } : null,
        message: "Zone created successfully",
      };
    }),

  /**
   * Update an existing zone
   */
  update: publicProcedure
    .input(ZoneUpdateSchema)
    .mutation(async ({ input }) => {
      console.log("[Zone] Updating zone:", input.id);

      const { id, ...updateData } = input;
      await updateZone(parseInt(id), updateData);

      return {
        success: true,
        message: "Zone updated successfully",
      };
    }),

  /**
   * Delete a zone
   */
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      console.log("[Zone] Deleting zone:", input.id);

      await deleteZone(parseInt(input.id));

      return {
        success: true,
        message: "Zone deleted successfully",
      };
    }),

  /**
   * Get available collectors for assignment
   */
  getAvailableCollectors: publicProcedure.query(async () => {
    console.log("[Zone] Fetching available collectors");

    // TODO: Replace with actual database query
    // const collectors = await db.select().from(collectorsTable).where(...)

    // Mock data for development
    const collectors = [
      {
        id: "1",
        name: "John Mwale",
        phone: "+260 97 123 4567",
        vehicleType: "Truck",
        currentZone: "Lusaka Central Zone A",
        status: "assigned" as const,
      },
      {
        id: "2",
        name: "Mary Banda",
        phone: "+260 96 234 5678",
        vehicleType: "Light Truck",
        currentZone: null,
        status: "available" as const,
      },
      {
        id: "3",
        name: "Peter Phiri",
        phone: "+260 95 345 6789",
        vehicleType: "Tractor",
        currentZone: "Kabulonga Residential",
        status: "assigned" as const,
      },
      {
        id: "4",
        name: "Grace Tembo",
        phone: "+260 97 456 7890",
        vehicleType: "Foot Collector",
        currentZone: null,
        status: "available" as const,
      },
    ];

    return {
      success: true,
      data: collectors,
    };
  }),

  /**
   * Assign collector to zone
   */
  assignCollector: publicProcedure
    .input(CollectorAssignmentSchema)
    .mutation(async ({ input }) => {
      console.log("[Zone] Assigning collector:", {
        collectorId: input.collectorId,
        zoneId: input.zoneId,
      });

      await assignCollectorToZone(parseInt(input.collectorId), parseInt(input.zoneId));

      return {
        success: true,
        message: "Collector assigned successfully",
      };
    }),

  /**
   * Unassign collector from zone
   */
  unassignCollector: publicProcedure
    .input(z.object({ collectorId: z.string() }))
    .mutation(async ({ input }) => {
      console.log("[Zone] Unassigning collector:", input.collectorId);

      await unassignCollectorFromZone(parseInt(input.collectorId));

      return {
        success: true,
        message: "Collector unassigned successfully",
      };
    }),

  /**
   * Get households in a zone
   */
  getHouseholds: publicProcedure
    .input(z.object({ zoneId: z.string().optional() }))
    .query(async ({ input }) => {
      console.log("[Zone] Fetching households for zone:", input.zoneId);

      // TODO: Replace with actual database query
      // const households = await db.select().from(householdsTable).where(...)

      // Mock data for development
      const households = [
        {
          id: "1",
          address: "Plot 123, Cairo Road",
          customerName: "James Banda",
          phone: "+260 97 111 2222",
          subscriptionType: "Commercial" as const,
          currentZone: "Lusaka Central Zone A",
          status: "active" as const,
        },
        {
          id: "2",
          address: "House 45, Independence Avenue",
          customerName: "Sarah Mwale",
          phone: "+260 96 222 3333",
          subscriptionType: "Residential" as const,
          currentZone: "Lusaka Central Zone A",
          status: "active" as const,
        },
        {
          id: "3",
          address: "Plot 78, Church Road",
          customerName: "David Phiri",
          phone: "+260 95 333 4444",
          subscriptionType: "Commercial" as const,
          currentZone: "Lusaka Central Zone A",
          status: "active" as const,
        },
        {
          id: "4",
          address: "House 12, Nationalist Road",
          customerName: "Grace Tembo",
          phone: "+260 97 444 5555",
          subscriptionType: "Residential" as const,
          currentZone: "Lusaka Central Zone B",
          status: "active" as const,
        },
      ];

      const filteredHouseholds = input.zoneId
        ? households.filter((h) => h.currentZone === input.zoneId)
        : households;

      return {
        success: true,
        data: filteredHouseholds,
      };
    }),

  /**
   * Reassign households to a different zone
   */
  reassignHouseholds: publicProcedure
    .input(HouseholdReassignmentSchema)
    .mutation(async ({ input }) => {
      console.log("[Zone] Reassigning households:", {
        count: input.householdIds.length,
        targetZoneId: input.targetZoneId,
      });

      // TODO: Replace with actual database update
      // await db.update(householdsTable)
      //   .set({ zoneId: input.targetZoneId })
      //   .where(inArray(householdsTable.id, input.householdIds));

      return {
        success: true,
        message: `${input.householdIds.length} household(s) reassigned successfully`,
      };
    }),

  /**
   * Get zone statistics
   */
  getStats: publicProcedure.query(async () => {
    console.log("[Zone] Fetching zone statistics");

    const stats = await getZoneStats();

    return {
      success: true,
      data: stats,
    };
  }),
});
