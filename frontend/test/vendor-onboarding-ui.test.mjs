import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("PUBLIC_PATHS in platform-session.ts includes /vendor/signup for unauthenticated registration", async () => {
  const sessionSource = await readFile(
    new URL("../src/lib/auth/platform-session.ts", import.meta.url),
    "utf8",
  );
  assert.match(sessionSource, /"\/vendor\/signup"/);
  assert.match(sessionSource, /PUBLIC_PATHS\s*=\s*new Set\(/);
});

test("all vendor onboarding source files stay strictly below 300 lines", async () => {
  const files = [
    "../src/features/vendor-onboarding/api/vendor-onboarding-api.ts",
    "../src/features/vendor-onboarding/components/VendorStatusBanner.tsx",
    "../src/features/vendor-onboarding/components/VendorDocumentCard.tsx",
    "../src/features/vendor-onboarding/components/OpsVendorDocRow.tsx",
    "../src/features/vendor-onboarding/components/OpsVendorReviewDrawer.tsx",
    "../src/routes/vendor_.signup.tsx",
    "../src/routes/vendor_.onboarding.tsx",
    "../src/routes/operations.vendor-onboarding.tsx",
  ];

  for (const rel of files) {
    const content = await readFile(new URL(rel, import.meta.url), "utf8");
    const lineCount = content.split(/\r?\n/).length;
    assert.ok(lineCount < 300, `${rel} has ${lineCount} lines, must be strictly below 300 lines`);
  }
});

test("operational vendor workspace route /vendor redirects unapproved vendor to /vendor/onboarding", async () => {
  const vendorRoute = await readFile(new URL("../src/routes/vendor.tsx", import.meta.url), "utf8");
  assert.match(vendorRoute, /identity\.vendorStatus\s*!==\s*["']APPROVED["']/);
  assert.match(vendorRoute, /to:\s*["']\/vendor\/onboarding["']/);
});

test("login card offers Sign up as a Vendor leading to /vendor/signup", async () => {
  const loginCard = await readFile(
    new URL("../src/features/auth/components/login-card.tsx", import.meta.url),
    "utf8",
  );
  assert.match(loginCard, /Sign up as a Vendor/);
  assert.match(loginCard, /\/vendor\/signup/);
});
