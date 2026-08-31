import { expect, request, type APIRequestContext, type APIResponse } from "@playwright/test";
import { randomBytes } from "node:crypto";

export type CaseDetail = {
  status: string;
  version: number;
  checks: Array<{ publicId: string; status: string; type: string }>;
  consents: Array<{ publicId: string; status: string }>;
  documents: Array<{ status: string }>;
  clarifications: Array<{ status: string }>;
  qaReviews: Array<{ decision: string }>;
  reports: Array<{ status: string }>;
};

type ManagedUser = {
  id: string;
  status: string;
  version: number;
  email: string;
  temporaryPassword: string;
  password: string;
};

type WriteHeaders = () => Record<string, string>;

export async function expectJson<T = unknown>(response: APIResponse, status: number): Promise<T> {
  const text = await response.text();
  expect(response.status(), text.slice(0, 800)).toBe(status);
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function createRunUser(
  adminApi: APIRequestContext,
  input: {
    email: string;
    displayName: string;
    role: "VERIFIER" | "QA_REVIEWER";
    writeHeaders: WriteHeaders;
  },
): Promise<ManagedUser> {
  const temporaryPassword = strongRandomPassword("Temp1!");
  const password = strongRandomPassword("Final2@");
  const created = await expectJson<{
    id: string;
    status: string;
    version: number;
  }>(
    await adminApi.post("users", {
      headers: input.writeHeaders(),
      data: {
        email: input.email,
        displayName: input.displayName,
        roleCodes: [input.role],
        temporaryPassword,
      },
    }),
    201,
  );
  return { ...created, email: input.email, temporaryPassword, password };
}

export async function openForcedPasswordContext(input: {
  apiUrl: string;
  browserOrigin: string;
  tenantCode: string;
  user: ManagedUser;
  writeHeaders: WriteHeaders;
}): Promise<APIRequestContext> {
  const context = await request.newContext({
    baseURL: input.apiUrl,
    extraHTTPHeaders: { origin: input.browserOrigin },
  });
  const identity = { tenantCode: input.tenantCode, email: input.user.email };
  try {
    await expectJson(
      await context.post("auth/login", {
        data: { ...identity, password: input.user.temporaryPassword },
      }),
      201,
    );
    await expectJson(
      await context.post("auth/change-password", {
        headers: input.writeHeaders(),
        data: {
          currentPassword: input.user.temporaryPassword,
          newPassword: input.user.password,
        },
      }),
      201,
    );
    await expectJson(
      await context.post("auth/login", {
        data: { ...identity, password: input.user.password },
      }),
      201,
    );
    return context;
  } catch (error) {
    await context.dispose();
    throw error;
  }
}

export async function suspendRunUsers(
  adminApi: APIRequestContext,
  emails: string[],
  writeHeaders: WriteHeaders,
): Promise<void> {
  for (const email of emails) {
    const directory = await expectJson<{
      items: Array<{ id: string; email: string; status: string; version: number }>;
    }>(await adminApi.get(`users?search=${encodeURIComponent(email)}&page=1&pageSize=10`), 200);
    const user = directory.items.find(
      (item) => item.email.trim().toLowerCase() === email.toLowerCase(),
    );
    if (!user || user.status === "SUSPENDED") continue;
    const suspended = await expectJson<{ status: string }>(
      await adminApi.patch(`users/${user.id}`, {
        headers: writeHeaders(),
        data: { status: "SUSPENDED", version: user.version },
      }),
      200,
    );
    expect(suspended.status).toBe("SUSPENDED");
  }
}

export function getCase(api: APIRequestContext, caseId: string): Promise<CaseDetail> {
  return api.get(`cases/${caseId}`).then((response) => expectJson<CaseDetail>(response, 200));
}

export async function waitForPublishedReport(
  api: APIRequestContext,
  caseId: string,
): Promise<{
  id: string;
  authenticityCode: string;
  sha256: string;
  status: string;
}> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const reports = await expectJson<{
      items: Array<{
        id: string;
        status: string;
        versions: Array<{ authenticityCode: string; sha256: string }>;
      }>;
    }>(await api.get(`cases/${caseId}/reports`), 200);
    const published = reports.items.find(
      (item) => item.status === "PUBLISHED" && item.versions.length > 0,
    );
    if (published) {
      return {
        id: published.id,
        status: published.status,
        authenticityCode: published.versions[0]!.authenticityCode,
        sha256: published.versions[0]!.sha256,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("The approved case did not receive a published report within 30 seconds");
}

function strongRandomPassword(prefix: string): string {
  return `${prefix}${randomBytes(24).toString("base64url")}`;
}
