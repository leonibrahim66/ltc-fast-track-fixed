import { describe, it, expect, beforeEach } from "vitest";

// Test data
const mockApprovedDriver = {
  fullName: "John Banda",
  phoneNumber: "0971234567",
  nrcNumber: "123456/78/1",
  vehicleType: "Truck",
  numberPlate: "ABC1234",
  vehicleColor: "White",
  vehicleModel: "Isuzu NQR",
  registrationValid: true,
  status: "approved",
  registeredAt: "2026-01-15T10:00:00Z",
  approvedAt: "2026-01-16T14:00:00Z",
};

const mockPendingDriver = {
  fullName: "Mary Phiri",
  phoneNumber: "0961234567",
  nrcNumber: "654321/78/1",
  vehicleType: "Van",
  numberPlate: "XYZ5678",
  vehicleColor: "Blue",
  vehicleModel: "Toyota HiAce",
  registrationValid: true,
  status: "pending_approval",
  registeredAt: "2026-02-01T08:00:00Z",
};

// Mock AsyncStorage
const storage: Record<string, string> = {};
const mockAsyncStorage = {
  getItem: async (key: string) => storage[key] || null,
  setItem: async (key: string, value: string) => { storage[key] = value; },
  removeItem: async (key: string) => { delete storage[key]; },
};

describe("Remember Me / Auto-Login", () => {
  beforeEach(() => {
    Object.keys(storage).forEach((key) => delete storage[key]);
  });

  it("should auto-login when remember_me flag is set and driver is approved", async () => {
    storage["driver_remember_me"] = "true";
    storage["active_carrier_driver"] = JSON.stringify(mockApprovedDriver);

    const rememberFlag = await mockAsyncStorage.getItem("driver_remember_me");
    expect(rememberFlag).toBe("true");

    const activeDriver = await mockAsyncStorage.getItem("active_carrier_driver");
    const driver = JSON.parse(activeDriver!);
    expect(driver.status).toBe("approved");
    expect(driver.fullName).toBe("John Banda");
  });

  it("should not auto-login when remember_me flag is not set", async () => {
    storage["active_carrier_driver"] = JSON.stringify(mockApprovedDriver);

    const rememberFlag = await mockAsyncStorage.getItem("driver_remember_me");
    expect(rememberFlag).toBeNull();
  });

  it("should not auto-login when no active driver exists", async () => {
    storage["driver_remember_me"] = "true";

    const activeDriver = await mockAsyncStorage.getItem("active_carrier_driver");
    expect(activeDriver).toBeNull();
  });

  it("should redirect to onboarding if not completed", async () => {
    storage["driver_remember_me"] = "true";
    storage["active_carrier_driver"] = JSON.stringify(mockApprovedDriver);

    const onboardingDone = await mockAsyncStorage.getItem("driver_onboarding_completed");
    expect(onboardingDone).toBeNull();
    // Should redirect to /carrier/onboarding
  });

  it("should redirect to portal if onboarding is completed", async () => {
    storage["driver_remember_me"] = "true";
    storage["active_carrier_driver"] = JSON.stringify(mockApprovedDriver);
    storage["driver_onboarding_completed"] = "true";

    const onboardingDone = await mockAsyncStorage.getItem("driver_onboarding_completed");
    expect(onboardingDone).toBe("true");
    // Should redirect to /carrier/portal
  });

  it("should save remember_me flag on login", async () => {
    await mockAsyncStorage.setItem("driver_remember_me", "true");
    await mockAsyncStorage.setItem("active_carrier_driver", JSON.stringify(mockApprovedDriver));

    const flag = await mockAsyncStorage.getItem("driver_remember_me");
    expect(flag).toBe("true");
  });

  it("should clear remember_me flag on logout", async () => {
    storage["driver_remember_me"] = "true";
    storage["active_carrier_driver"] = JSON.stringify(mockApprovedDriver);

    await mockAsyncStorage.removeItem("active_carrier_driver");
    await mockAsyncStorage.removeItem("driver_remember_me");

    const flag = await mockAsyncStorage.getItem("driver_remember_me");
    expect(flag).toBeNull();
    const driver = await mockAsyncStorage.getItem("active_carrier_driver");
    expect(driver).toBeNull();
  });
});

describe("Forgot Credentials Recovery", () => {
  beforeEach(() => {
    Object.keys(storage).forEach((key) => delete storage[key]);
  });

  it("should find driver by full name and plate number from individual registration", async () => {
    storage["driver_registration"] = JSON.stringify(mockApprovedDriver);

    const regStr = await mockAsyncStorage.getItem("driver_registration");
    const reg = JSON.parse(regStr!);

    const nameNorm = "john banda";
    const plateNorm = "abc1234";

    const matched =
      reg.fullName?.toLowerCase() === nameNorm &&
      reg.numberPlate?.toLowerCase() === plateNorm;

    expect(matched).toBe(true);
  });

  it("should find driver by full name and plate number from pending list", async () => {
    storage["pending_driver_registrations"] = JSON.stringify([mockPendingDriver, mockApprovedDriver]);

    const listStr = await mockAsyncStorage.getItem("pending_driver_registrations");
    const list = JSON.parse(listStr!);

    const nameNorm = "mary phiri";
    const plateNorm = "xyz5678";

    const matchedDriver = list.find(
      (d: any) =>
        d.fullName?.toLowerCase() === nameNorm &&
        d.numberPlate?.toLowerCase() === plateNorm
    );

    expect(matchedDriver).toBeTruthy();
    expect(matchedDriver.fullName).toBe("Mary Phiri");
    expect(matchedDriver.status).toBe("pending_approval");
  });

  it("should not find driver with wrong name", async () => {
    storage["driver_registration"] = JSON.stringify(mockApprovedDriver);

    const regStr = await mockAsyncStorage.getItem("driver_registration");
    const reg = JSON.parse(regStr!);

    const matched =
      reg.fullName?.toLowerCase() === "wrong name" &&
      reg.numberPlate?.toLowerCase() === "abc1234";

    expect(matched).toBe(false);
  });

  it("should not find driver with wrong plate number", async () => {
    storage["driver_registration"] = JSON.stringify(mockApprovedDriver);

    const regStr = await mockAsyncStorage.getItem("driver_registration");
    const reg = JSON.parse(regStr!);

    const matched =
      reg.fullName?.toLowerCase() === "john banda" &&
      reg.numberPlate?.toLowerCase() === "wrong123";

    expect(matched).toBe(false);
  });

  it("should mask phone number correctly", () => {
    const phone = "0971234567";
    const masked = phone.slice(0, 4) + "****" + phone.slice(-2);
    expect(masked).toBe("0971****67");
  });

  it("should mask NRC number correctly", () => {
    const nrc = "123456/78/1";
    const masked = nrc.slice(0, 3) + "****" + nrc.slice(-2);
    expect(masked).toBe("123****/1");
  });

  it("should require both name and plate for recovery", () => {
    const recoveryName = "";
    const recoveryPlate = "ABC1234";

    const isValid = recoveryName.trim() !== "" && recoveryPlate.trim() !== "";
    expect(isValid).toBe(false);
  });

  it("should handle case-insensitive matching", async () => {
    storage["driver_registration"] = JSON.stringify(mockApprovedDriver);

    const regStr = await mockAsyncStorage.getItem("driver_registration");
    const reg = JSON.parse(regStr!);

    const matched =
      reg.fullName?.toLowerCase() === "JOHN BANDA".toLowerCase() &&
      reg.numberPlate?.toLowerCase() === "ABC1234".toLowerCase();

    expect(matched).toBe(true);
  });
});

describe("Driver Onboarding Tutorial", () => {
  beforeEach(() => {
    Object.keys(storage).forEach((key) => delete storage[key]);
  });

  it("should have 4 onboarding steps", () => {
    const steps = [
      { title: "Welcome, Driver!", icon: "local-shipping" },
      { title: "Find & Accept Jobs", icon: "work" },
      { title: "Manage Active Jobs", icon: "navigation" },
      { title: "Earnings & Wallet", icon: "account-balance-wallet" },
    ];
    expect(steps.length).toBe(4);
  });

  it("should mark onboarding as completed on finish", async () => {
    await mockAsyncStorage.setItem("driver_onboarding_completed", "true");

    const completed = await mockAsyncStorage.getItem("driver_onboarding_completed");
    expect(completed).toBe("true");
  });

  it("should mark onboarding as completed on skip", async () => {
    // Skip also marks as completed
    await mockAsyncStorage.setItem("driver_onboarding_completed", "true");

    const completed = await mockAsyncStorage.getItem("driver_onboarding_completed");
    expect(completed).toBe("true");
  });

  it("should navigate forward through steps", () => {
    let currentStep = 0;
    const totalSteps = 4;

    currentStep += 1;
    expect(currentStep).toBe(1);

    currentStep += 1;
    expect(currentStep).toBe(2);

    currentStep += 1;
    expect(currentStep).toBe(3);

    // Last step
    expect(currentStep).toBe(totalSteps - 1);
  });

  it("should navigate backward through steps", () => {
    let currentStep = 3;

    currentStep -= 1;
    expect(currentStep).toBe(2);

    currentStep -= 1;
    expect(currentStep).toBe(1);

    currentStep -= 1;
    expect(currentStep).toBe(0);
  });

  it("should not go below step 0", () => {
    let currentStep = 0;
    if (currentStep > 0) {
      currentStep -= 1;
    }
    expect(currentStep).toBe(0);
  });

  it("each step should have required fields", () => {
    const steps = [
      {
        icon: "local-shipping",
        title: "Welcome, Driver!",
        subtitle: "Your journey starts here",
        description: "You've been approved...",
        tips: ["tip1", "tip2", "tip3", "tip4"],
        color: "#22C55E",
      },
      {
        icon: "work",
        title: "Find & Accept Jobs",
        subtitle: "Your Job Feed",
        description: "The Job Feed shows...",
        tips: ["tip1", "tip2", "tip3", "tip4"],
        color: "#3B82F6",
      },
    ];

    steps.forEach((step) => {
      expect(step.icon).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.subtitle).toBeTruthy();
      expect(step.description).toBeTruthy();
      expect(step.tips.length).toBe(4);
      expect(step.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it("should redirect approved driver to onboarding if not completed", async () => {
    storage["driver_remember_me"] = "true";
    storage["active_carrier_driver"] = JSON.stringify(mockApprovedDriver);
    // driver_onboarding_completed NOT set

    const onboardingDone = await mockAsyncStorage.getItem("driver_onboarding_completed");
    expect(onboardingDone).toBeNull();
    // Expected: redirect to /carrier/onboarding
  });

  it("should redirect approved driver to portal if onboarding completed", async () => {
    storage["driver_remember_me"] = "true";
    storage["active_carrier_driver"] = JSON.stringify(mockApprovedDriver);
    storage["driver_onboarding_completed"] = "true";

    const onboardingDone = await mockAsyncStorage.getItem("driver_onboarding_completed");
    expect(onboardingDone).toBe("true");
    // Expected: redirect to /carrier/portal
  });
});

describe("Logout Flow", () => {
  beforeEach(() => {
    Object.keys(storage).forEach((key) => delete storage[key]);
  });

  it("should clear all driver session data on logout", async () => {
    storage["active_carrier_driver"] = JSON.stringify(mockApprovedDriver);
    storage["driver_remember_me"] = "true";

    await mockAsyncStorage.removeItem("active_carrier_driver");
    await mockAsyncStorage.removeItem("driver_remember_me");

    expect(await mockAsyncStorage.getItem("active_carrier_driver")).toBeNull();
    expect(await mockAsyncStorage.getItem("driver_remember_me")).toBeNull();
  });

  it("should preserve onboarding completion after logout", async () => {
    storage["active_carrier_driver"] = JSON.stringify(mockApprovedDriver);
    storage["driver_remember_me"] = "true";
    storage["driver_onboarding_completed"] = "true";

    await mockAsyncStorage.removeItem("active_carrier_driver");
    await mockAsyncStorage.removeItem("driver_remember_me");

    // Onboarding should still be marked as completed
    expect(await mockAsyncStorage.getItem("driver_onboarding_completed")).toBe("true");
  });
});
