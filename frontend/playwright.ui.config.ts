import { defineConfig, devices } from "@playwright/test";

// Browser-only regression suite: every selected spec intercepts API requests.
// Run `npm run build` first. Never start a backend or connect to a database here.
const port = process.env.E2E_FRONTEND_PORT ?? "8189";
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: [
    "client-workspace.spec.ts",
    "client-sidebar.spec.ts",
    "client-pages.spec.ts",
    "client-custom-export.spec.ts",
    "client-density.spec.ts",
    "client-workspace-enhancements.spec.ts",
    "client-case-activity.spec.ts",
    "compact-workspace-headers.spec.ts",
    "operations-action-inbox.spec.ts",
    "operations-overview.spec.ts",
    "operations-manager-pages.spec.ts",
    "workflow-v2.spec.ts",
    "step6-ui.spec.ts",
    "signup-onboarding.spec.ts",
    "case-360.spec.ts",
    "candidate-upload.spec.ts",
    "packages-pricing.spec.ts",
    "team-page.spec.ts",
    "rm-pages.spec.ts",
    "case-initiation-layout.spec.ts",
    "report-gaps.spec.ts",
    "gaps-pages.spec.ts",
    "vendor-checks.spec.ts",
    "verifier-navigation.spec.ts",
    "verifier-workspace.spec.ts",
    "verification-methods-ui.spec.ts",
    "qa-workspace-ui.spec.ts",
    "qa-review-sections.spec.ts",
    "qa-finance-navigation.spec.ts",
  ],
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  webServer: {
    command: "node .output/server/index.mjs",
    url: `${origin}/auth`,
    env: { PORT: port, HOST: "127.0.0.1", NODE_ENV: "production" },
    reuseExistingServer: false,
    timeout: 60_000,
  },
  use: { baseURL: origin, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
