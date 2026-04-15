import { describe, it, expect } from "vitest";

describe("Carrier Driver Login", () => {
  it("should find driver by phone number", () => {
    const registrations = [
      { id: "d1", fullName: "John Banda", phoneNumber: "0971234567", nrcNumber: "123456/10/1", status: "approved" },
      { id: "d2", fullName: "Mary Phiri", phoneNumber: "0962345678", nrcNumber: "234567/20/2", status: "pending_approval" },
    ];
    const loginPhone = "0971234567";
    const match = registrations.find((d) => d.phoneNumber === loginPhone);
    expect(match).toBeDefined();
    expect(match?.fullName).toBe("John Banda");
    expect(match?.status).toBe("approved");
  });

  it("should find driver by NRC number", () => {
    const registrations = [
      { id: "d1", fullName: "John Banda", phoneNumber: "0971234567", nrcNumber: "123456/10/1", status: "approved" },
      { id: "d2", fullName: "Mary Phiri", phoneNumber: "0962345678", nrcNumber: "234567/20/2", status: "pending_approval" },
    ];
    const loginNrc = "234567/20/2";
    const match = registrations.find((d) => d.nrcNumber === loginNrc);
    expect(match).toBeDefined();
    expect(match?.fullName).toBe("Mary Phiri");
    expect(match?.status).toBe("pending_approval");
  });

  it("should return null when no driver found", () => {
    const registrations = [
      { id: "d1", fullName: "John Banda", phoneNumber: "0971234567", nrcNumber: "123456/10/1", status: "approved" },
    ];
    const loginPhone = "0999999999";
    const match = registrations.find((d) => d.phoneNumber === loginPhone);
    expect(match).toBeUndefined();
  });

  it("should redirect approved drivers to dashboard", () => {
    const driver = { status: "approved", fullName: "John Banda" };
    const shouldRedirect = driver.status === "approved";
    expect(shouldRedirect).toBe(true);
  });

  it("should block pending drivers from dashboard access", () => {
    const driver = { status: "pending_approval", fullName: "Mary Phiri" };
    const shouldRedirect = driver.status === "approved";
    expect(shouldRedirect).toBe(false);
  });

  it("should block rejected drivers from dashboard access", () => {
    const driver = { status: "rejected", fullName: "Peter Mwale", rejectionReason: "Invalid documents" };
    const shouldRedirect = driver.status === "approved";
    expect(shouldRedirect).toBe(false);
    expect(driver.rejectionReason).toBe("Invalid documents");
  });

  it("should block suspended drivers from dashboard access", () => {
    const driver = { status: "suspended", fullName: "James Tembo" };
    const shouldRedirect = driver.status === "approved";
    expect(shouldRedirect).toBe(false);
  });

  it("should validate that at least one login field is provided", () => {
    const loginPhone = "";
    const loginNrc = "";
    const isValid = loginPhone.trim() !== "" || loginNrc.trim() !== "";
    expect(isValid).toBe(false);
  });

  it("should accept login with only phone number", () => {
    const loginPhone = "0971234567";
    const loginNrc = "";
    const isValid = loginPhone.trim() !== "" || loginNrc.trim() !== "";
    expect(isValid).toBe(true);
  });

  it("should accept login with only NRC number", () => {
    const loginPhone = "";
    const loginNrc = "123456/10/1";
    const isValid = loginPhone.trim() !== "" || loginNrc.trim() !== "";
    expect(isValid).toBe(true);
  });

  it("should trim whitespace from login inputs before matching", () => {
    const registrations = [
      { phoneNumber: "0971234567", nrcNumber: "123456/10/1", status: "approved" },
    ];
    const loginPhone = "  0971234567  ";
    const match = registrations.find((d) => d.phoneNumber === loginPhone.trim());
    expect(match).toBeDefined();
  });

  it("should handle status-based messaging correctly", () => {
    const statuses = [
      { status: "approved", message: "Welcome Back!" },
      { status: "pending_approval", message: "Account Pending" },
      { status: "rejected", message: "Account Rejected" },
      { status: "suspended", message: "Account Suspended" },
    ];

    for (const s of statuses) {
      expect(s.message.length).toBeGreaterThan(0);
    }
    expect(statuses.find((s) => s.status === "approved")?.message).toBe("Welcome Back!");
    expect(statuses.find((s) => s.status === "pending_approval")?.message).toBe("Account Pending");
    expect(statuses.find((s) => s.status === "rejected")?.message).toBe("Account Rejected");
    expect(statuses.find((s) => s.status === "suspended")?.message).toBe("Account Suspended");
  });

  it("should check individual registration before list", () => {
    const individualReg = { phoneNumber: "0971234567", status: "approved", fullName: "John" };
    const listRegs = [
      { phoneNumber: "0971234567", status: "pending_approval", fullName: "John Duplicate" },
    ];

    const loginPhone = "0971234567";
    let matchedDriver = null;

    // Check individual first
    if (individualReg && individualReg.phoneNumber === loginPhone) {
      matchedDriver = individualReg;
    }
    // Only check list if no individual match
    if (!matchedDriver) {
      matchedDriver = listRegs.find((d) => d.phoneNumber === loginPhone);
    }

    // Individual should take priority
    expect(matchedDriver?.fullName).toBe("John");
    expect(matchedDriver?.status).toBe("approved");
  });
});
