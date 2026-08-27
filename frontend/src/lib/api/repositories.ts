import type { Paginated, HealthComponent } from "@/lib/contracts/common";
import type { CaseQuery, VerificationCase } from "@/lib/contracts/case";
import type { ControlTowerSnapshot } from "@/lib/contracts/dashboard";
import type { ClientDraft, ClientOrganisation, ClientQuery } from "@/lib/contracts/client";
import type {
  CreateUserInput,
  CreatedUserResult,
  PlatformUser,
  UserQuery,
} from "@/lib/contracts/user";
import type { AuditEvent, AuditQuery } from "@/lib/contracts/audit";
import type { SecurityOverview } from "@/lib/contracts/security";
import type { AnalyticsQuery, ExecutiveAnalytics } from "@/lib/contracts/analytics";
import type { PlatformSettings } from "@/lib/contracts/settings";
import type { PlatformNotification } from "@/lib/contracts/notifications";

export interface DashboardRepository {
  getControlTower(): Promise<ControlTowerSnapshot>;
  getPlatformHealth(): Promise<readonly HealthComponent[]>;
}

export interface CaseRepository {
  list(query: CaseQuery): Promise<Paginated<VerificationCase>>;
  getById(id: string): Promise<VerificationCase | null>;
  facets(): Promise<{ clients: { value: string; label: string }[] }>;
}

export interface ClientRepository {
  list(query: ClientQuery): Promise<Paginated<ClientOrganisation>>;
  getById(id: string): Promise<ClientOrganisation | null>;
  create(draft: ClientDraft): Promise<ClientOrganisation>;
  setStatus(id: string, status: "active" | "suspended"): Promise<ClientOrganisation>;
}

export interface UserRepository {
  list(query: UserQuery): Promise<Paginated<PlatformUser>>;
  create(input: CreateUserInput): Promise<CreatedUserResult>;
  setStatus(id: string, status: "active" | "suspended"): Promise<PlatformUser>;
  resetPassword(id: string): Promise<{ temporaryPassword: string }>;
}

export interface AuditRepository {
  list(query: AuditQuery): Promise<Paginated<AuditEvent>>;
  actors(): Promise<string[]>;
  resourceTypes(): Promise<string[]>;
}

export interface SecurityRepository {
  getOverview(): Promise<SecurityOverview>;
  revokeSession(id: string): Promise<void>;
  revokeOtherSessions(): Promise<void>;
}

export interface AnalyticsRepository {
  getExecutive(query: AnalyticsQuery): Promise<ExecutiveAnalytics>;
}

export interface SettingsRepository {
  get(): Promise<PlatformSettings>;
}

export interface NotificationRepository {
  list(): Promise<readonly PlatformNotification[]>;
}

export interface SaplingApi {
  dashboard: DashboardRepository;
  cases: CaseRepository;
  clients: ClientRepository;
  users: UserRepository;
  audit: AuditRepository;
  security: SecurityRepository;
  analytics: AnalyticsRepository;
  settings: SettingsRepository;
  notifications: NotificationRepository;
}
