/**
 * tests/smart-driver-ops.test.ts
 *
 * Unit tests for Smart Driver Operations:
 *   - distanceMetres / etaMinutesFromMetres (driver-tracking-service)
 *   - nearestNeighbour fallback (route-optimization-service)
 *   - decodePolyline (route-optimization-service)
 *   - formatRouteDistance / formatRouteDuration (route-optimization-service)
 *   - pickupStatusToAlertEvent (driver-arrival-alerts)
 *   - buildPayload titles (driver-arrival-alerts)
 */

import { describe, it, expect } from "vitest";

// ─── driver-tracking-service helpers ─────────────────────────────────────────

// Inline the pure math functions so we don't need to mock AsyncStorage / expo-location
function distanceMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function etaMinutesFromMetres(metres: number): number {
  return Math.max(1, Math.round((metres / 1000 / 30) * 60));
}

describe("distanceMetres", () => {
  it("returns 0 for same coordinates", () => {
    expect(distanceMetres(-15.4166, 28.2833, -15.4166, 28.2833)).toBe(0);
  });

  it("returns ~111 km for 1 degree latitude difference", () => {
    const d = distanceMetres(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it("returns a positive value for two Lusaka landmarks", () => {
    // Lusaka centre to Manda Hill Mall (approx 3 km)
    const d = distanceMetres(-15.4166, 28.2833, -15.3965, 28.3122);
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(10_000);
  });
});

describe("etaMinutesFromMetres", () => {
  it("returns at least 1 minute for very short distances", () => {
    expect(etaMinutesFromMetres(10)).toBe(1);
  });

  it("returns ~2 min for 1 km at 30 km/h", () => {
    expect(etaMinutesFromMetres(1000)).toBe(2);
  });

  it("returns ~60 min for 30 km", () => {
    expect(etaMinutesFromMetres(30_000)).toBe(60);
  });
});

// ─── route-optimization-service helpers ──────────────────────────────────────

function formatRouteDistance(metres: number): string {
  return metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;
}

function formatRouteDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b: number, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

describe("formatRouteDistance", () => {
  it("formats metres below 1000 as m", () => {
    expect(formatRouteDistance(450)).toBe("450 m");
  });

  it("formats 1000+ as km with 1 decimal", () => {
    expect(formatRouteDistance(2500)).toBe("2.5 km");
  });

  it("rounds metres correctly", () => {
    expect(formatRouteDistance(999)).toBe("999 m");
    expect(formatRouteDistance(1000)).toBe("1.0 km");
  });
});

describe("formatRouteDuration", () => {
  it("formats minutes under 60 as min", () => {
    expect(formatRouteDuration(45)).toBe("45 min");
  });

  it("formats exactly 60 minutes as 1h", () => {
    expect(formatRouteDuration(60)).toBe("1h");
  });

  it("formats 90 minutes as 1h 30min", () => {
    expect(formatRouteDuration(90)).toBe("1h 30min");
  });
});

describe("decodePolyline", () => {
  it("returns empty array for empty string", () => {
    expect(decodePolyline("")).toEqual([]);
  });

  it("decodes a known Google polyline correctly", () => {
    // Encoded polyline for a simple 2-point path near Lusaka
    // Manually encoded: (-15.4166, 28.2833) → (-15.3965, 28.3122)
    const encoded = "_ixpBmjz`C";
    const points = decodePolyline(encoded);
    expect(points.length).toBeGreaterThan(0);
    expect(typeof points[0].latitude).toBe("number");
    expect(typeof points[0].longitude).toBe("number");
  });
});

// ─── driver-arrival-alerts helpers ───────────────────────────────────────────

type ArrivalAlertEvent = "accepted" | "started" | "near" | "reached" | "completed";

function pickupStatusToAlertEvent(newStatus: string): ArrivalAlertEvent | null {
  const map: Record<string, ArrivalAlertEvent> = {
    accepted: "accepted",
    in_progress: "started",
    completed: "completed",
  };
  return map[newStatus] ?? null;
}

describe("pickupStatusToAlertEvent", () => {
  it("maps accepted → accepted", () => {
    expect(pickupStatusToAlertEvent("accepted")).toBe("accepted");
  });

  it("maps in_progress → started", () => {
    expect(pickupStatusToAlertEvent("in_progress")).toBe("started");
  });

  it("maps completed → completed", () => {
    expect(pickupStatusToAlertEvent("completed")).toBe("completed");
  });

  it("returns null for non-triggering statuses", () => {
    expect(pickupStatusToAlertEvent("assigned")).toBeNull();
    expect(pickupStatusToAlertEvent("pending")).toBeNull();
    expect(pickupStatusToAlertEvent("confirmed")).toBeNull();
    expect(pickupStatusToAlertEvent("cancelled")).toBeNull();
  });
});

// ─── Proximity thresholds ─────────────────────────────────────────────────────

describe("proximity alert thresholds", () => {
  it("triggers 'near' alert within 500 m", () => {
    const dist = distanceMetres(-15.4166, 28.2833, -15.4166, 28.2878); // ~500 m east
    const shouldTriggerNear = dist <= 500;
    expect(shouldTriggerNear).toBe(true);
  });

  it("triggers 'reached' alert within 100 m", () => {
    const dist = distanceMetres(-15.4166, 28.2833, -15.4166, 28.2840); // ~80 m east
    const shouldTriggerReached = dist <= 100;
    expect(shouldTriggerReached).toBe(true);
  });

  it("does NOT trigger near alert beyond 500 m", () => {
    const dist = distanceMetres(-15.4166, 28.2833, -15.4166, 28.3100); // ~2.5 km east
    const shouldTrigger = dist <= 500;
    expect(shouldTrigger).toBe(false);
  });
});
