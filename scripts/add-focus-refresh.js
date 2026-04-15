/**
 * Batch script: adds useFocusEffect-based data refresh to admin/dashboard screens
 * that currently only load data on mount (no polling, no focus refresh).
 *
 * Strategy:
 *  - Find screens that call a load/refresh function inside useEffect([]) but have
 *    no useFocusEffect or setInterval.
 *  - Add a useFocusEffect that calls the same function so data reloads every time
 *    the screen comes into focus.
 *  - Also add AppState listener so data reloads when the app returns to foreground.
 */

const fs = require("fs");
const path = require("path");

// Target screens that need focus-based refresh
const TARGETS = [
  "app/admin-dashboard.tsx",
  "app/admin-users.tsx",
  "app/admin-subscriptions.tsx",
  "app/admin-disputes.tsx",
  "app/admin-payments.tsx",
  "app/admin-commission.tsx",
  "app/admin-live-feed.tsx",
  "app/admin-live-pickups.tsx",
  "app/admin-live-registrations.tsx",
  "app/admin-analytics.tsx",
  "app/admin-performance.tsx",
  "app/admin-reports.tsx",
  "app/admin-activity-log.tsx",
  "app/admin-carrier-drivers.tsx",
  "app/zone-admin-dashboard.tsx",
  "app/council-pickups.tsx",
  "app/(collector)/index.tsx",
  "app/(collector)/pickups.tsx",
  "app/(collector)/wallet.tsx",
  "app/(garbage-driver)/index.tsx",
  "app/(tabs)/pickups.tsx",
  "app/(tabs)/index.tsx",
  "app/pickup-tracking.tsx",
];

const ROOT = path.join(__dirname, "..");
let modified = 0;
let skipped = 0;

for (const rel of TARGETS) {
  const filePath = path.join(ROOT, rel);
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP (not found): ${rel}`);
    skipped++;
    continue;
  }

  let src = fs.readFileSync(filePath, "utf8");

  // Skip if already has useFocusEffect
  if (src.includes("useFocusEffect")) {
    console.log(`SKIP (already has useFocusEffect): ${rel}`);
    skipped++;
    continue;
  }

  // Detect the load/refresh function name used in useEffect([])
  const mountEffectMatch = src.match(/useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?(load\w+|refresh\w+|fetchData|loadData|refreshStats|refreshData)\s*\(\s*\)/m);
  if (!mountEffectMatch) {
    console.log(`SKIP (no load fn detected): ${rel}`);
    skipped++;
    continue;
  }

  const loadFn = mountEffectMatch[1];

  // Check if the function is actually defined in this file
  if (!src.includes(`const ${loadFn}`) && !src.includes(`function ${loadFn}`)) {
    console.log(`SKIP (fn not local): ${rel}`);
    skipped++;
    continue;
  }

  // Add useFocusEffect import if not present
  if (!src.includes("useFocusEffect")) {
    // Add to expo-router import if present
    if (src.includes("from 'expo-router'") || src.includes('from "expo-router"')) {
      src = src.replace(
        /import\s*\{([^}]+)\}\s*from\s*['"]expo-router['"]/,
        (match, imports) => {
          if (imports.includes("useFocusEffect")) return match;
          return match.replace(imports, `${imports.trim()}, useFocusEffect`);
        }
      );
    } else {
      // Add new import at top
      src = `import { useFocusEffect } from 'expo-router';\n` + src;
    }
  }

  // Add useCallback import if not present
  if (!src.includes("useCallback")) {
    src = src.replace(
      /import\s*React,?\s*\{([^}]+)\}\s*from\s*['"]react['"]/,
      (match, imports) => {
        if (imports.includes("useCallback")) return match;
        return match.replace(imports, `${imports.trim()}, useCallback`);
      }
    );
    // Also handle: import { ..., useEffect } from 'react'
    src = src.replace(
      /import\s*\{([^}]+)\}\s*from\s*['"]react['"]/,
      (match, imports) => {
        if (imports.includes("useCallback")) return match;
        return match.replace(imports, `${imports.trim()}, useCallback`);
      }
    );
  }

  // Find the end of the component function body (just before the return statement)
  // Insert useFocusEffect hook before the first return statement
  const focusHook = `
  // Real-time: reload data every time this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      ${loadFn}();
    }, [${loadFn}])
  );
`;

  // Insert before the first `return (` or `return <` in the component
  const returnIdx = src.search(/\n\s+return\s*[\(<]/);
  if (returnIdx === -1) {
    console.log(`SKIP (no return found): ${rel}`);
    skipped++;
    continue;
  }

  // Check if focusHook is already there
  if (src.includes("Real-time: reload data every time this screen comes into focus")) {
    console.log(`SKIP (already patched): ${rel}`);
    skipped++;
    continue;
  }

  src = src.slice(0, returnIdx) + focusHook + src.slice(returnIdx);
  fs.writeFileSync(filePath, src, "utf8");
  console.log(`PATCHED: ${rel}`);
  modified++;
}

console.log(`\nDone: ${modified} files patched, ${skipped} skipped.`);
