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
    "compact-workspace-headers.spec.ts",
    "operations-action-inbox.spec.ts",
    "case-initiation-layout.spec.ts",
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
