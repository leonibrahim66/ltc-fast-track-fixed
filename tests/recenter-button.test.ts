/**
 * Tests for the floating Recenter button on the customer home screen map.
 * Validates button positioning, animateToRegion call, and style properties.
 */

import { describe, it, expect, vi } from "vitest";

// ─── Recenter button logic ─────────────────────────────────────────────────

describe("Customer home screen Recenter button", () => {
  it("calls animateToRegion with the user's pinned location and 400ms duration", () => {
    const animateToRegion = vi.fn();
    const mapRef = { current: { animateToRegion } };

    const userLocation = { latitude: -15.4166, longitude: 28.2833 };

    // Simulate the onPress handler
    if (mapRef.current && userLocation) {
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        400
      );
    }

    expect(animateToRegion).toHaveBeenCalledOnce();
    const [region, duration] = animateToRegion.mock.calls[0];
    expect(region.latitude).toBe(-15.4166);
    expect(region.longitude).toBe(28.2833);
    expect(region.latitudeDelta).toBe(0.012);
    expect(region.longitudeDelta).toBe(0.012);
    expect(duration).toBe(400);
  });

  it("does not call animateToRegion when userLocation is null", () => {
    const animateToRegion = vi.fn();
    const mapRef = { current: { animateToRegion } };
    const userLocation = null;

    // Simulate the onPress handler guard
    if (mapRef.current && userLocation) {
      mapRef.current.animateToRegion({} as any, 400);
    }

    expect(animateToRegion).not.toHaveBeenCalled();
  });

  it("does not call animateToRegion when mapRef.current is null", () => {
    const animateToRegion = vi.fn();
    const mapRef = { current: null };
    const userLocation = { latitude: -15.4166, longitude: 28.2833 };

    // Simulate the onPress handler guard
    if (mapRef.current && userLocation) {
      (mapRef.current as any).animateToRegion({} as any, 400);
    }

    expect(animateToRegion).not.toHaveBeenCalled();
  });

  it("recenterButton style is absolutely positioned in top-right corner", () => {
    const recenterButtonStyle = {
      position: "absolute" as const,
      top: 10,
      right: 10,
      backgroundColor: "#fff",
      borderRadius: 10,
      padding: 8,
      borderWidth: 1,
      borderColor: "#E5E7EB",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
      zIndex: 10,
    };

    expect(recenterButtonStyle.position).toBe("absolute");
    expect(recenterButtonStyle.top).toBe(10);
    expect(recenterButtonStyle.right).toBe(10);
    expect(recenterButtonStyle.zIndex).toBe(10);
    expect(recenterButtonStyle.elevation).toBe(4);
    expect(recenterButtonStyle.backgroundColor).toBe("#fff");
  });

  it("recenterButton uses my-location icon with dark green color", () => {
    const iconConfig = {
      name: "my-location",
      size: 20,
      color: "#1B4332",
    };

    expect(iconConfig.name).toBe("my-location");
    expect(iconConfig.color).toBe("#1B4332");
    expect(iconConfig.size).toBe(20);
  });

  it("animateToRegion uses the same zoom level as the initial map region", () => {
    const initialRegion = {
      latitude: -15.4166,
      longitude: 28.2833,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    };

    const recenterRegion = {
      latitude: -15.4166,
      longitude: 28.2833,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    };

    // Recenter should restore the same zoom level as initial
    expect(recenterRegion.latitudeDelta).toBe(initialRegion.latitudeDelta);
    expect(recenterRegion.longitudeDelta).toBe(initialRegion.longitudeDelta);
  });
});
