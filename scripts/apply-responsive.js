#!/usr/bin/env node
/**
 * apply-responsive.js
 *
 * Batch-transforms all TSX files that use StyleSheet.create to:
 * 1. Import getStaticResponsive from @/hooks/use-responsive (if not already imported)
 * 2. Insert `const _rs = getStaticResponsive();` before the first StyleSheet.create call
 * 3. Replace common hardcoded dimension patterns inside StyleSheet blocks with _rs helpers
 *
 * Patterns replaced inside StyleSheet.create({...}) blocks ONLY:
 *   fontSize: N          → fontSize: _rs.fs(N)
 *   lineHeight: N        → lineHeight: _rs.fs(N)   (only N > 2)
 *   padding*: N          → padding*: _rs.sp(N)
 *   margin*: N           → margin*: _rs.sp(N)
 *   gap: N               → gap: _rs.sp(N)
 *   borderRadius: N      → borderRadius: _rs.s(N)  (only 0 < N < 50)
 *   border*Radius: N     → border*Radius: _rs.s(N) (only 0 < N < 50)
 *   width: N             → width: _rs.s(N)         (only N > 2)
 *   height: N            → height: _rs.s(N)        (only N > 2)
 */

const fs = require("fs");
const path = require("path");

// Files already manually updated - skip them
const SKIP_FILES = new Set([
  "app/(auth)/welcome.tsx",
]);

function findFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".expo" || entry.name === "scripts") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath));
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      results.push(fullPath);
    }
  }
  return results;
}

function transformBlock(block) {
  let b = block;

  // fontSize: NUMBER
  b = b.replace(/\bfontSize:\s*(\d+(?:\.\d+)?)\b/g, (m, n) => {
    if (parseFloat(n) <= 0) return m;
    return `fontSize: _rs.fs(${n})`;
  });

  // lineHeight: NUMBER (skip tiny values like 1, 1.5)
  b = b.replace(/\blineHeight:\s*(\d+(?:\.\d+)?)\b/g, (m, n) => {
    if (parseFloat(n) <= 2) return m;
    return `lineHeight: _rs.fs(${n})`;
  });

  // padding properties
  for (const prop of ["padding", "paddingHorizontal", "paddingVertical", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight"]) {
    const re = new RegExp(`\\b${prop}:\\s*(\\d+(?:\\.\\d+)?)\\b`, "g");
    b = b.replace(re, (m, n) => {
      if (parseFloat(n) <= 0) return m;
      return `${prop}: _rs.sp(${n})`;
    });
  }

  // margin properties
  for (const prop of ["margin", "marginHorizontal", "marginVertical", "marginTop", "marginBottom", "marginLeft", "marginRight"]) {
    const re = new RegExp(`\\b${prop}:\\s*(\\d+(?:\\.\\d+)?)\\b`, "g");
    b = b.replace(re, (m, n) => {
      if (parseFloat(n) <= 0) return m;
      return `${prop}: _rs.sp(${n})`;
    });
  }

  // gap: NUMBER
  b = b.replace(/\bgap:\s*(\d+(?:\.\d+)?)\b/g, (m, n) => {
    if (parseFloat(n) <= 0) return m;
    return `gap: _rs.sp(${n})`;
  });

  // borderRadius (skip fully-round values >= 50 and 0)
  b = b.replace(/\bborderRadius:\s*(\d+(?:\.\d+)?)\b/g, (m, n) => {
    const num = parseFloat(n);
    if (num <= 0 || num >= 50) return m;
    return `borderRadius: _rs.s(${n})`;
  });

  // border*Radius variants
  for (const prop of ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius", "borderTopEndRadius", "borderTopStartRadius", "borderBottomEndRadius", "borderBottomStartRadius"]) {
    const re = new RegExp(`\\b${prop}:\\s*(\\d+(?:\\.\\d+)?)\\b`, "g");
    b = b.replace(re, (m, n) => {
      const num = parseFloat(n);
      if (num <= 0 || num >= 50) return m;
      return `${prop}: _rs.s(${n})`;
    });
  }

  // width: NUMBER (skip 1-2px borders, skip percentages)
  b = b.replace(/\bwidth:\s*(\d+(?:\.\d+)?)\b(?!\s*[%])/g, (m, n) => {
    if (parseFloat(n) <= 2) return m;
    return `width: _rs.s(${n})`;
  });

  // height: NUMBER (skip 1-2px dividers)
  b = b.replace(/\bheight:\s*(\d+(?:\.\d+)?)\b(?!\s*[%])/g, (m, n) => {
    if (parseFloat(n) <= 2) return m;
    return `height: _rs.s(${n})`;
  });

  return b;
}

function transformStyleSheetBlocks(content) {
  let result = content;
  let searchFrom = 0;
  let transformCount = 0;

  while (true) {
    const createIdx = result.indexOf("StyleSheet.create(", searchFrom);
    if (createIdx === -1) break;

    const openBrace = result.indexOf("{", createIdx);
    if (openBrace === -1) break;

    // Find matching closing brace
    let depth = 0;
    let i = openBrace;
    while (i < result.length) {
      if (result[i] === "{") depth++;
      else if (result[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
      i++;
    }

    const blockContent = result.slice(openBrace, i + 1);
    const transformed = transformBlock(blockContent);
    if (transformed !== blockContent) {
      transformCount++;
      result = result.slice(0, openBrace) + transformed + result.slice(i + 1);
    }
    searchFrom = openBrace + transformed.length;
  }

  return { result, transformCount };
}

function addResponsiveSetup(content) {
  let result = content;

  // Add import if not present
  if (!result.includes("getStaticResponsive") && !result.includes("useResponsive")) {
    const importMatches = [...result.matchAll(/^import\s+.+from\s+['"][^'"]+['"];?\s*$/gm)];
    if (importMatches.length > 0) {
      const lastImport = importMatches[importMatches.length - 1];
      const insertPos = lastImport.index + lastImport[0].length;
      result = result.slice(0, insertPos) + '\nimport { getStaticResponsive } from "@/hooks/use-responsive";' + result.slice(insertPos);
    }
  }

  // Add _rs const before first StyleSheet.create (if not already there)
  if (!result.includes("const _rs = getStaticResponsive()")) {
    // Try to find "const styles = StyleSheet.create" pattern first
    let ssIdx = result.indexOf("const styles = StyleSheet.create");
    if (ssIdx === -1) ssIdx = result.indexOf("const style = StyleSheet.create");
    if (ssIdx === -1) ssIdx = result.indexOf("StyleSheet.create(");

    if (ssIdx !== -1) {
      const lineStart = result.lastIndexOf("\n", ssIdx) + 1;
      result = result.slice(0, lineStart) + "const _rs = getStaticResponsive();\n" + result.slice(lineStart);
    }
  }

  return result;
}

// Main
const projectRoot = path.join(__dirname, "..");
const allFiles = [
  ...findFiles(path.join(projectRoot, "app")),
  ...findFiles(path.join(projectRoot, "screens")),
  ...findFiles(path.join(projectRoot, "components")),
];

let processedCount = 0;
let skippedCount = 0;
let errorCount = 0;

for (const filePath of allFiles) {
  const relPath = path.relative(projectRoot, filePath);

  if (SKIP_FILES.has(relPath)) {
    skippedCount++;
    continue;
  }

  try {
    const content = fs.readFileSync(filePath, "utf8");

    if (!content.includes("StyleSheet.create(")) {
      continue;
    }

    let updated = addResponsiveSetup(content);
    const { result, transformCount } = transformStyleSheetBlocks(updated);
    updated = result;

    if (updated !== content) {
      fs.writeFileSync(filePath, updated, "utf8");
      processedCount++;
      console.log(`✅ ${relPath} (${transformCount} blocks)`);
    }
  } catch (err) {
    console.error(`❌ ${relPath}: ${err.message}`);
    errorCount++;
  }
}

console.log(`\nDone: ${processedCount} files updated, ${skippedCount} skipped, ${errorCount} errors`);
