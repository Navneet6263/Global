import type { SaplingApi } from "./repositories";
import { analyticsRepository, dashboardRepository } from "./http/dashboard-analytics";
import { caseRepository, clientRepository, userRepository } from "./http/entity-repositories";
import {
  auditRepository,
  notificationRepository,
  securityRepository,
  settingsRepository,
} from "./http/platform-repositories";

export const api: SaplingApi = {
  dashboard: dashboardRepository,
  cases: caseRepository,
  clients: clientRepository,
  users: userRepository,
  audit: auditRepository,
  security: securityRepository,
  analytics: analyticsRepository,
  settings: settingsRepository,
  notifications: notificationRepository,
};

export { API_BASE_URL } from "@/config/api";
