/**
 * Unit tests for address-based zone filtering logic used in registration Step 5
 * and zone chip display on the customer Home screen.
 */
import { describe, it, expect } from "vitest";

// ── Replicated filtering logic (mirrors register.tsx filteredZones) ──────────
type Zone = { id: string; name: string; town?: string; province?: string };

function filterZonesByAddress(address: string, zones: Zone[]): Zone[] {
  if (!address.trim()) return zones;
  const keywords = address
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((w) => w.length > 2);
  if (keywords.length === 0) return zones;
  const matched = zones.filter((z) => {
    const haystack = [z.name, z.town, z.province]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return keywords.some((kw) => haystack.includes(kw));
  });
  return matched.length > 0 ? matched : zones;
}

// ── Sample zones ─────────────────────────────────────────────────────────────
const ZONES: Zone[] = [
  { id: "z1", name: "Lusaka Central Zone A", town: "Lusaka", province: "Lusaka" },
  { id: "z2", name: "Lusaka Central Zone B", town: "Lusaka", province: "Lusaka" },
  { id: "z3", name: "Kabulonga Residential", town: "Lusaka", province: "Lusaka" },
  { id: "z4", name: "Woodlands Area", town: "Lusaka", province: "Lusaka" },
  { id: "z5", name: "Ndola Central", town: "Ndola", province: "Copperbelt" },
];

describe("Address-based zone filtering", () => {
  it("returns all zones when address is empty", () => {
    expect(filterZonesByAddress("", ZONES)).toHaveLength(ZONES.length);
  });

  it("returns all zones when address is only whitespace", () => {
    expect(filterZonesByAddress("   ", ZONES)).toHaveLength(ZONES.length);
  });

  it("returns all zones when no keywords are long enough (< 3 chars)", () => {
    expect(filterZonesByAddress("A B", ZONES)).toHaveLength(ZONES.length);
  });

  it("filters by town keyword (Lusaka)", () => {
    const result = filterZonesByAddress("Plot 5, Lusaka", ZONES);
    // All 4 Lusaka zones should match; Ndola should not
    expect(result.every((z) => z.town === "Lusaka")).toBe(true);
    expect(result.find((z) => z.id === "z5")).toBeUndefined();
  });

  it("filters by zone name keyword (Kabulonga)", () => {
    // Use only the unique keyword so only zone z3 matches
    const result = filterZonesByAddress("Kabulonga Estate", ZONES);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("z3");
  });

  it("filters by zone name keyword (Woodlands)", () => {
    const result = filterZonesByAddress("Woodlands Estate", ZONES);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("z4");
  });

  it("filters by province keyword (Copperbelt)", () => {
    const result = filterZonesByAddress("Ndola, Copperbelt", ZONES);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("z5");
  });

  it("falls back to all zones when no match is found", () => {
    const result = filterZonesByAddress("Livingstone, Southern Province", ZONES);
    expect(result).toHaveLength(ZONES.length);
  });

  it("is case-insensitive", () => {
    const result = filterZonesByAddress("KABULONGA", ZONES);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("z3");
  });

  it("matches on partial keyword", () => {
    const result = filterZonesByAddress("woodlands", ZONES);
    expect(result.some((z) => z.id === "z4")).toBe(true);
  });

  it("handles comma-separated address correctly", () => {
    const result = filterZonesByAddress("Plot 123,Ndola,Copperbelt", ZONES);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("z5");
  });
});

// ── Zone chip logic (mirrors home screen zoneName derivation) ─────────────────
describe("Zone chip display logic", () => {
  it("shows zone name from assignedZoneName field", () => {
    const user: any = { assignedZoneName: "Lusaka Central Zone A" };
    const zoneName = user?.assignedZoneName || user?.zoneName || null;
    expect(zoneName).toBe("Lusaka Central Zone A");
  });

  it("falls back to zoneName field when assignedZoneName is absent", () => {
    const user: any = { zoneName: "Woodlands Area" };
    const zoneName = user?.assignedZoneName || user?.zoneName || null;
    expect(zoneName).toBe("Woodlands Area");
  });

  it("returns null when neither field is set", () => {
    const user: any = { fullName: "John" };
    const zoneName = user?.assignedZoneName || user?.zoneName || null;
    expect(zoneName).toBeNull();
  });

  it("does not show chip when user is null", () => {
    const user: any = null;
    const zoneName = user?.assignedZoneName || user?.zoneName || null;
    expect(zoneName).toBeNull();
  });
});
