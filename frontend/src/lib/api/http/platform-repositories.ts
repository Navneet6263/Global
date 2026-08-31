import type {
  AuditRepository,
  NotificationRepository,
  SecurityRepository,
  SettingsRepository,
} from "../repositories";
import { getAuditFacets, listAuditEvents } from "@/lib/backend-api/audit";
import {
  listActiveSessions,
  listSecurityEvents,
  revokeActiveSession,
  revokeOtherSessions,
} from "@/lib/backend-api/auth";
import { listNotifications } from "@/lib/backend-api/notifications";
import {
  getFieldPolicy,
  getOrganisation,
  listBranches,
  listServicePackages,
} from "@/lib/backend-api/settings";
import type { AuditCategory, AuditEvent } from "@/lib/contracts/audit";
import type { AuthEventType } from "@/lib/contracts/security";

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
    const response = await listAuditEvents({
      search: query.search,
      category: query.category,
      actor: query.actor,
      resourceType: query.resourceType,
      from: query.from,
      to: query.to,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 15,
    });
    const rows: AuditEvent[] = response.items.map((event) => ({
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
      locationLabel: event.locationLabel ?? "Location unavailable",
      before: jsonObject(event.beforeJson),
      after: jsonObject(event.afterJson),
    }));
    return {
      rows,
      total: response.total,
      page: response.page,
      pageSize: response.pageSize,
    };
  },
  async actors() {
    return (await getAuditFacets()).actors;
  },
  async resourceTypes() {
    return (await getAuditFacets()).resourceTypes;
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
        deviceName: session.deviceName ?? null,
        userAgent: session.userAgent ?? null,
        ipAddress: session.ipAddress ?? null,
        locationLabel: session.locationLabel ?? "Location unavailable",
        startedAt: session.createdAt,
        expiresAt: session.expiresAt,
        isCurrent: session.current,
      })),
      events: events.items.map((event) => ({
        id: event.id,
        type: authEventType(event.action),
        at: event.createdAt,
        ipAddress: event.ipAddress ?? null,
        locationLabel: event.locationLabel ?? "Location unavailable",
        userAgent:
          typeof jsonObject(event.afterJson)?.["userAgent"] === "string"
            ? (jsonObject(event.afterJson)?.["userAgent"] as string)
            : null,
        detail: event.action.replaceAll(".", " "),
      })),
      refreshReuseDetected: events.items.some((event) =>
        event.action.toLowerCase().includes("reuse"),
      ),
      passwordUpdatedAt: sessions.passwordChangedAt,
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
    const [organisation, field, branches, packages] = await Promise.all([
      getOrganisation(),
      getFieldPolicy(),
      listBranches(),
      listServicePackages(),
    ]);
    return {
      organisation: {
        id: organisation.publicId,
        name: organisation.name,
        timezone: organisation.timezone,
        status: organisation.status,
      },
      branches: branches.items.map((branch) => ({
        id: branch.id,
        code: branch.code,
        name: branch.name,
        city: branch.city ?? "",
        fieldExecutives: branch.fieldExecutiveCount,
        status: branch.isActive ? "active" : "paused",
      })),
      packages: packages.items.map((item) => ({
        id: item.id,
        name: item.name,
        checks: item.checks.length,
        tatHours: item.tatHours,
        unitPrice: item.price == null ? null : Number(item.price),
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
          label: "Block outside-geofence completion",
          description: `${field.defaultRadiusMeters} metre radius and ${field.maxAccuracyMeters} metre accuracy; switch off to require supervisor review.`,
          enabled: field.outsideGeofencePolicy === "BLOCK",
        },
      ],
      fieldPolicyConfig: {
        defaultRadiusMeters: field.defaultRadiusMeters,
        maxAccuracyMeters: field.maxAccuracyMeters,
        minimumPhotos: field.minimumPhotos,
        retentionDays: field.retentionDays,
        requireCheckout: field.requireCheckout,
        outsideGeofencePolicy: field.outsideGeofencePolicy,
        version: field.version,
      },
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
      })),
      retention: [
        {
          id: "field-evidence",
          dataClass: "Field evidence",
          retentionDays: field.retentionDays,
        },
      ],
    };
  },
};
