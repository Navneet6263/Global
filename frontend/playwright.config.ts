import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

const backendDirectory = fileURLToPath(new URL("../backend", import.meta.url));
const publicOnly = process.env.E2E_PUBLIC_ONLY === "true";
const frontendPort = process.env.E2E_FRONTEND_PORT ?? "8080";
const localFrontendOrigin = `http://localhost:${frontendPort}`;
const frontendServer = {
  command: `npm run dev -- --host localhost --port ${frontendPort}`,
  url: `${localFrontendOrigin}/auth`,
  env: {
    ...process.env,
    VITE_API_URL: "/api/v1",
    VITE_DEV_API_TARGET: "http://127.0.0.1:4100",
  },
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

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
    : publicOnly
      ? [frontendServer]
      : [
          {
            command: "npm run start:e2e",
            cwd: backendDirectory,
            url: "http://127.0.0.1:4100/api/v1/health/live",
            env: {
              ...process.env,
              PORT: "4100",
              WEB_ORIGIN: localFrontendOrigin,
            },
            reuseExistingServer: false,
            timeout: 180_000,
          },
          frontendServer,
        ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? localFrontendOrigin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
