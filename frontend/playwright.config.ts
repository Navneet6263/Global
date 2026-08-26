import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

const backendDirectory = fileURLToPath(new URL("../backend", import.meta.url));

export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: "npm run start:e2e",
          cwd: backendDirectory,
          url: "http://127.0.0.1:4100/api/v1/health/live",
          env: {
            ...process.env,
            PORT: "4100",
            WEB_ORIGIN: "http://localhost:8080",
          },
          reuseExistingServer: false,
          timeout: 180_000,
        },
        {
          command: "npm run dev -- --host localhost --port 8080",
          url: "http://localhost:8080/login",
          env: {
            ...process.env,
            VITE_API_URL: "http://127.0.0.1:4100/api/v1",
          },
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
