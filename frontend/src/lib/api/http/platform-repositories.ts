import type {
  AuditRepository,
  NotificationRepository,
  SecurityRepository,
  SettingsRepository,
} from "../repositories";
import { listAuditEvents } from "@/lib/backend-api/audit";
import {
  listActiveSessions,
  listSecurityEvents,
  revokeActiveSession,
  revokeOtherSessions,
} from "@/lib/backend-api/auth";
import { listNotifications } from "@/lib/backend-api/notifications";
import { getFieldPolicy, listBranches, listServicePackages } from "@/lib/backend-api/settings";
import type { AuditCategory, AuditEvent } from "@/lib/contracts/audit";
import type { AuthEventType } from "@/lib/contracts/security";
import { cachedIdentity } from "@/lib/auth/platform-session";

function jsonObject(
  value?: string | null,
): Record<string, string | number | boolean | null> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, string | number | boolean | null>)
      : null;
  } catch {
    return null;
  }
}

function category(action: string, resource: string): AuditCategory {
  const value = `${action} ${resource}`.toLowerCase();
  if (value.includes("auth") || value.includes("user") || value.includes("session"))
    return "access";
  if (value.includes("client")) return "client";
  if (value.includes("document")) return "document";
  if (value.includes("policy") || value.includes("settings")) return "policy";
  if (value.includes("report")) return "report";
  if (value.includes("invoice") || value.includes("finance") || value.includes("payment"))
    return "finance";
  return "case";
}

export const auditRepository: AuditRepository = {
  async list(query) {
    const response = await listAuditEvents();
    let rows: AuditEvent[] = response.items.map((event) => ({
      id: event.id,
      requestId: event.requestId ?? "—",
      category: category(event.action, event.resourceType),
      action: event.action,
      actorName: event.actor?.displayName ?? "System",
      actorRole: event.actor ? "Platform user" : "System",
      resourceType: event.resourceType,
      resourceId: event.resourcePublicId ?? "—",
      at: event.createdAt,
      ipAddress: event.ipAddress ?? null,
      before: jsonObject(event.beforeJson),
      after: jsonObject(event.afterJson),
    }));
    const search = query.search?.toLowerCase();
    if (search)
      rows = rows.filter((row) =>
        [row.action, row.actorName, row.requestId, row.resourceId].some((value) =>
          value.toLowerCase().includes(search),
        ),
      );
    if (query.category && query.category !== "all")
      rows = rows.filter((row) => row.category === query.category);
    if (query.actor && query.actor !== "all")
      rows = rows.filter((row) => row.actorName === query.actor);
    if (query.resourceType && query.resourceType !== "all")
      rows = rows.filter((row) => row.resourceType === query.resourceType);
    if (query.from) rows = rows.filter((row) => Date.parse(row.at) >= Date.parse(query.from!));
    if (query.to)
      rows = rows.filter((row) => Date.parse(row.at) <= Date.parse(query.to!) + 86_399_999);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    return {
      rows: rows.slice((page - 1) * pageSize, page * pageSize),
      total: rows.length,
      page,
      pageSize,
    };
  },
  async actors() {
    const rows = (await listAuditEvents()).items.map(
      (event) => event.actor?.displayName ?? "System",
    );
    return [...new Set(rows)];
  },
  async resourceTypes() {
    return [...new Set((await listAuditEvents()).items.map((event) => event.resourceType))];
  },
};

function authEventType(action: string): AuthEventType {
  const normalized = action.toLowerCase();
  if (normalized.includes("reuse")) return "refresh_token_reuse";
  if (normalized.includes("password")) return "password_change";
  if (normalized.includes("revoke")) return "session_revoked";
  if (normalized.includes("fail")) return "login_failure";
  if (normalized.includes("mfa")) return "mfa_challenge";
  return "login_success";
}

export const securityRepository: SecurityRepository = {
  async getOverview() {
    const [sessions, events] = await Promise.all([
      listActiveSessions(),
      listSecurityEvents({ limit: 30 }),
    ]);
    return {
      sessions: sessions.items.map((session) => ({
        id: session.id,
        device: session.deviceName ?? "Unknown device",
        browser: session.userAgent ?? "Unknown browser",
        operatingSystem: "—",
        ipAddress: session.ipAddress ?? "—",
        location: "—",
        startedAt: session.createdAt,
        lastSeenAt: session.createdAt,
        isCurrent: session.current,
      })),
      events: events.items.map((event) => ({
        id: event.id,
        type: authEventType(event.action),
        at: event.createdAt,
        ipAddress: event.ipAddress ?? "—",
        device: "Web session",
        detail: event.action.replaceAll(".", " "),
      })),
      refreshReuseDetected: events.items.some((event) =>
        event.action.toLowerCase().includes("reuse"),
      ),
      passwordUpdatedAt:
        events.items.find((event) => event.action.toLowerCase().includes("password"))?.createdAt ??
        new Date(0).toISOString(),
    };
  },
  async revokeSession(id) {
    await revokeActiveSession(id);
  },
  async revokeOtherSessions() {
    await revokeOtherSessions();
  },
};

export const notificationRepository: NotificationRepository = {
  async list() {
    const response = await listNotifications();
    return response.items.map((item) => ({
      id: item.id,
      kind: item.type.toLowerCase().includes("sla")
        ? "sla"
        : item.type.toLowerCase().includes("qa")
          ? "qa"
          : item.type.toLowerCase().includes("client")
            ? "client"
            : item.type.toLowerCase().includes("finance")
              ? "finance"
              : "system",
      title: item.title,
      body: item.body,
      at: item.createdAt,
      read: Boolean(item.readAt),
      route: item.href ?? "/admin",
    }));
  },
};

export const settingsRepository: SettingsRepository = {
  async get() {
    const [field, branches, packages] = await Promise.all([
      getFieldPolicy(),
      listBranches(),
      listServicePackages(),
    ]);
    const identity = cachedIdentity();
    return {
      organisation: {
        legalName: identity?.tenantName ?? "Sapling Global",
        brandName: identity?.tenantName ?? "Sapling Global",
        gstin: "",
        registeredAddress: "",
        supportEmail: "",
        supportPhone: "",
        timezoneLabel: "Asia/Kolkata",
      },
      branches: branches.items.map((branch) => ({
        id: branch.id,
        name: branch.name,
        city: branch.city ?? "",
        state: "",
        headOfBranch: "Not assigned",
        fieldExecutives: 0,
        status: branch.isActive ? "active" : "paused",
      })),
      packages: packages.items.map((item) => ({
        id: item.id,
        name: item.name,
        checks: item.checks.length,
        slaDays: Math.max(1, Math.round(item.tatHours / 24)),
        unitPrice: Number(item.price ?? 0),
        clientsUsing: 0,
        status: item.isActive ? "published" : "draft",
      })),
      fieldPolicy: [
        {
          id: "checkout",
          label: "Check-out required",
          description: "A second GPS fix closes every field visit.",
          enabled: field.requireCheckout,
        },
        {
          id: "geofence",
          label: "Geofence enforcement",
          description: `${field.defaultRadiusMeters} metre default radius with ${field.maxAccuracyMeters} metre accuracy.`,
          enabled: field.outsideGeofencePolicy === "BLOCK",
        },
      ],
      evidencePolicy: [
        {
          id: "photos",
          label: "Evidence photos",
          description: `${field.minimumPhotos} photo(s) required; retained for ${field.retentionDays} days.`,
          enabled: field.minimumPhotos > 0,
        },
      ],
      slaDefaults: packages.items.map((item) => ({
        id: item.id,
        checkLabel: item.name,
        standardHours: item.tatHours,
        escalationHours: Math.max(1, item.tatHours - 12),
      })),
      retention: [
        {
          id: "field-evidence",
          dataClass: "Field evidence",
          retentionMonths: Math.max(1, Math.round(field.retentionDays / 30)),
          disposalMethod: "Secure deletion",
        },
      ],
      notifications: [],
      clientAdministration: [],
    };
  },
};
