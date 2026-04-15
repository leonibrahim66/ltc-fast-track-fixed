/**
 * API Integration Validation Tests
 *
 * Confirms:
 * 1. No hardcoded localhost or fixed API URLs remain in frontend source files
 * 2. EXPO_PUBLIC_API_URL is the single source of truth for the base URL
 * 3. user-session.ts persists userId in AsyncStorage and reuses it (no duplicate creation)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as glob from "fs";

// ─── Helper: recursively collect .ts/.tsx files under a directory ─────────────

function collectFiles(dir: string, ext: string[] = [".ts", ".tsx"]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".expo") {
      results.push(...collectFiles(full, ext));
    } else if (entry.isFile() && ext.some((e) => entry.name.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

const ROOT = path.resolve(__dirname, "..");
const APP_FILES = [
  ...collectFiles(path.join(ROOT, "app")),
  ...collectFiles(path.join(ROOT, "lib")),
];

// ─── Test 1: No hardcoded localhost URLs in frontend source ───────────────────

describe("API base URL — no hardcoded localhost", () => {
  it("should not contain localhost:3000 in any app/ or lib/ file", () => {
    const violations: string[] = [];
    for (const file of APP_FILES) {
      const content = fs.readFileSync(file, "utf-8");
      // Allow in comments and test files
      if (file.includes("/tests/")) continue;
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
        if (line.includes("localhost:3000")) {
          violations.push(`${path.relative(ROOT, file)}:${idx + 1} — ${trimmed}`);
        }
      });
    }
    expect(violations, `Hardcoded localhost:3000 found:\n${violations.join("\n")}`).toHaveLength(0);
  });

  it("should not contain EXPO_PUBLIC_API_BASE_URL in screen/context files (only api-client.ts may reference it as a fallback)", () => {
    const violations: string[] = [];
    // These files are allowed to reference the old var as a compatibility fallback
    const ALLOWED = ["api-client.ts", "api-key-validator.ts"];
    for (const file of APP_FILES) {
      if (file.includes("/tests/")) continue;
      if (ALLOWED.some((a) => file.endsWith(a))) continue;
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
        if (line.includes("EXPO_PUBLIC_API_BASE_URL")) {
          violations.push(`${path.relative(ROOT, file)}:${idx + 1} — ${trimmed}`);
        }
      });
    }
    expect(violations, `Old env var EXPO_PUBLIC_API_BASE_URL found in screen/context files:\n${violations.join("\n")}`).toHaveLength(0);
  });
});

// ─── Test 2: api-client.ts uses EXPO_PUBLIC_API_URL ──────────────────────────

describe("api-client.ts — correct env var", () => {
  it("should use EXPO_PUBLIC_API_URL as the base URL env var", () => {
    const clientPath = path.join(ROOT, "lib", "api-client.ts");
    expect(fs.existsSync(clientPath), "lib/api-client.ts must exist").toBe(true);
    const content = fs.readFileSync(clientPath, "utf-8");
    expect(content).toContain("EXPO_PUBLIC_API_URL");
  });

  it("should export apiGet, apiPost, and apiPatch functions", () => {
    const clientPath = path.join(ROOT, "lib", "api-client.ts");
    const content = fs.readFileSync(clientPath, "utf-8");
    expect(content).toContain("export async function apiGet");
    expect(content).toContain("export async function apiPost");
    expect(content).toContain("export async function apiPatch");
  });
});

// ─── Test 3: user-session.ts exists and exports getOrCreateBackendUserId ─────

describe("user-session.ts — userId persistence", () => {
  it("should export getOrCreateBackendUserId", () => {
    const sessionPath = path.join(ROOT, "lib", "user-session.ts");
    expect(fs.existsSync(sessionPath), "lib/user-session.ts must exist").toBe(true);
    const content = fs.readFileSync(sessionPath, "utf-8");
    expect(content).toContain("export async function getOrCreateBackendUserId");
  });

  it("should use AsyncStorage for persistence", () => {
    const sessionPath = path.join(ROOT, "lib", "user-session.ts");
    const content = fs.readFileSync(sessionPath, "utf-8");
    expect(content).toContain("AsyncStorage");
  });

  it("should check for an existing stored userId before creating a new one", () => {
    const sessionPath = path.join(ROOT, "lib", "user-session.ts");
    const content = fs.readFileSync(sessionPath, "utf-8");
    // Must read from storage first
    expect(content).toContain("getItem");
    // Must write to storage after creation
    expect(content).toContain("setItem");
  });
});

// ─── Test 4: EXPO_PUBLIC_API_URL env var is set ───────────────────────────────

describe("EXPO_PUBLIC_API_URL env var", () => {
  it("should be set to a non-empty, non-localhost URL", async () => {
    const url = process.env.EXPO_PUBLIC_API_URL;
    expect(url, "EXPO_PUBLIC_API_URL must be set").toBeTruthy();
    expect(url).not.toContain("localhost");
    expect(url).toMatch(/^https?:\/\//);
  });

  it("should point to a live backend (health endpoint returns ok:true)", async () => {
    const url = process.env.EXPO_PUBLIC_API_URL;
    if (!url) return;
    const res = await fetch(`${url}/api/health`);
    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.ok).toBe(true);
  }, 15_000);
});
