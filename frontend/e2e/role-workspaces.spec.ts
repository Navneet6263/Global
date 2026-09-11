import { expect, test, type Page } from "@playwright/test";

type WorkspaceKey = "operations" | "crm" | "client" | "field" | "verifier" | "qa" | "finance";

type Workspace = {
  key: WorkspaceKey;
  localPart: string;
  path: string;
  title: RegExp;
  uiText: RegExp;
};

const workspaceKeys = new Set<WorkspaceKey>([
  "operations",
  "crm",
  "client",
  "field",
  "verifier",
  "qa",
  "finance",
]);
const enabled = process.env.E2E_ROLE_WORKSPACES === "true";
const tenantCode = process.env.E2E_ROLE_TENANT_CODE ?? process.env.E2E_TENANT_CODE;
const roleDomain = process.env.E2E_ROLE_DOMAIN?.trim().toLowerCase();
const rolePassword = process.env.E2E_ROLE_PASSWORD;
const emailMap = readEmailMap(process.env.E2E_ROLE_EMAIL_MAP);
const browserOrigin =
  process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_FRONTEND_PORT ?? "8080"}`;
const loginIntervalMs = Number(process.env.E2E_ROLE_LOGIN_INTERVAL_MS ?? 15_000);
let nextLoginAt = 0;

const workspaces: readonly Workspace[] = [
  {
    key: "operations",
    localPart: "operations",
    path: "/operations",
    title: /^Operations Dashboard \u2014 Sapling Global$/i,
    uiText: /Operations Dashboard/i,
  },
  {
    key: "crm",
    localPart: "crm",
    path: "/sales-crm",
    title: /^Revenue Command \u2014 Sapling Global Sales & CRM$/i,
    uiText: /Revenue command/i,
  },
  {
    key: "client",
    localPart: "client",
    path: "/client-portal",
    title: /^Client Portal \u2014 Sapling Global$/i,
    uiText: /Verification portfolio/i,
  },
  {
    key: "field",
    localPart: "field",
    path: "/field-executive",
    title: /^Field Visits \u2014 Sapling Global$/i,
    uiText: /Field Operations/i,
  },
  {
    key: "verifier",
    localPart: "verifier",
    path: "/verifier",
    title: /^Verifier Workbench \u2014 Sapling Global$/i,
    uiText: /Verification workbench/i,
  },
  {
    key: "qa",
    localPart: "qa",
    path: "/qa-review",
    title: /^Review queue \u2014 Sapling Global$/i,
    uiText: /Review queue/i,
  },
  {
    key: "finance",
    localPart: "finance",
    path: "/finance",
    title: /^Finance overview \u2014 Sapling Global$/i,
    uiText: /Finance overview/i,
  },
];

test.describe("role workspace boundaries", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!enabled, "Set E2E_ROLE_WORKSPACES=true to run role workspace smoke tests");

  for (const workspace of workspaces) {
    test(`${workspace.key} lands only in its authorised workspace`, async ({ page }) => {
      const failures: string[] = [];
      page.on("response", (response) => {
        if (response.status() >= 500) {
          failures.push(`${response.status()} ${response.request().method()} ${response.url()}`);
        }
      });

      await login(page, emailFor(workspace), required(rolePassword, "E2E_ROLE_PASSWORD"));
      await page.goto("/");
      await expect(page).toHaveURL(pathPattern(workspace.path), { timeout: 45_000 });
      await page.goto(workspace.path);
      await expect(page).toHaveURL(pathPattern(workspace.path));
      await expect(page).toHaveTitle(workspace.title);
      await expect(page.getByText(workspace.uiText).first()).toBeVisible();

      await page.goto("/admin");
      await expect(page).toHaveURL(pathPattern(workspace.path), { timeout: 45_000 });
      await page.goto(workspace.path);
      await expect(page).toHaveTitle(workspace.title);
      await expect(page.getByText(workspace.uiText).first()).toBeVisible();
      expect(failures, "workspace requests must not return HTTP 5xx").toEqual([]);
    });
  }
});

async function login(page: Page, email: string, password: string) {
  await waitForLoginWindow();
  const response = await page.request.post(
    `${browserOrigin.replace(/\/+$/, "")}/api/v1/auth/login`,
    {
      headers: { origin: browserOrigin },
      data: {
        tenantCode: required(tenantCode, "E2E_ROLE_TENANT_CODE or E2E_TENANT_CODE"),
        email,
        password,
      },
    },
  );
  const responseBody = await response.text();
  expect(response.status(), responseBody.slice(0, 500)).toBe(201);
}

async function waitForLoginWindow() {
  const delay = Math.max(0, nextLoginAt - Date.now());
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  nextLoginAt = Date.now() + loginIntervalMs;
}

function emailFor(workspace: Workspace): string {
  const mapped = emailMap[workspace.key];
  if (mapped) return mapped;
  const domain = required(roleDomain, "E2E_ROLE_DOMAIN or E2E_ROLE_EMAIL_MAP");
  return `${workspace.localPart}@${domain}`;
}

function readEmailMap(raw: string | undefined): Partial<Record<WorkspaceKey, string>> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [WorkspaceKey, string] => {
        const [key, email] = entry;
        return (
          workspaceKeys.has(key as WorkspaceKey) && typeof email === "string" && email.includes("@")
        );
      }),
    );
  } catch {
    throw new Error("E2E_ROLE_EMAIL_MAP must be a JSON object of workspace keys to emails");
  }
}

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function pathPattern(path: string): RegExp {
  return new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?(?:[?#].*)?$`);
}

test.beforeAll(() => {
  if (!enabled) return;
  required(tenantCode, "E2E_ROLE_TENANT_CODE or E2E_TENANT_CODE");
  required(rolePassword, "E2E_ROLE_PASSWORD");
  if (!Number.isFinite(loginIntervalMs) || loginIntervalMs < 12_500) {
    throw new Error("E2E_ROLE_LOGIN_INTERVAL_MS must be at least 12500");
  }
  if (!roleDomain && Object.keys(emailMap).length !== workspaces.length) {
    throw new Error("Set E2E_ROLE_DOMAIN or provide all seven entries in E2E_ROLE_EMAIL_MAP");
  }
});
