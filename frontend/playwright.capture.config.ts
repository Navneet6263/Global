import { defineConfig, devices } from "@playwright/test";

// On-demand capture of product screenshots for the public landing page (mocked API only).
const port = process.env.E2E_FRONTEND_PORT ?? "8190";
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["landing-capture.spec.ts"],
  timeout: 90_000,
  workers: 1,
  reporter: "list",
  webServer: {
    command: "node .output/server/index.mjs",
    url: `${origin}/auth`,
    env: { PORT: port, HOST: "127.0.0.1", NODE_ENV: "production" },
    reuseExistingServer: false,
    timeout: 60_000,
  },
  use: { baseURL: origin },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
