import { apiRequest } from "./client";

export interface Organisation {
  publicId: string;
  name: string;
  timezone: string;
  status: string;
}

export interface FieldPolicy {
  publicId: string;
  defaultRadiusMeters: number;
  maxAccuracyMeters: number;
  minimumPhotos: number;
  retentionDays: number;
  requireCheckout: boolean;
  outsideGeofencePolicy: "BLOCK" | "SUPERVISOR_APPROVAL" | "ALLOW_AND_FLAG";
  version: number;
  updatedAt: string;
}
export interface Branch {
  id: string;
  code: string;
  name: string;
  city?: string | null;
  isActive: boolean;
  fieldExecutiveCount: number;
  createdAt: string;
}
export interface ServicePackage {
  id: string;
  code: string;
  name: string;
  checks: string[];
  serviceFamily: string;
  requiredDocuments: string[];
  updatedAt: string;
  price?: string | number | null;
  tatHours: number;
  isActive: boolean;
  createdAt: string;
}

export function getOrganisation() {
  return apiRequest<Organisation>("/settings/organisation");
}

export interface AccessPolicy {
  publicId: string;
  opsUserCreationEnabled: boolean;
  /** Release reports after QC / manager approval and bill monthly. */
  releaseBeforePayment: boolean;
  version: number;
  updatedAt: string;
}

export function getAccessPolicy() {
  return apiRequest<AccessPolicy>("/settings/access-policy");
}
export function updateAccessPolicy(
  input: Pick<AccessPolicy, "opsUserCreationEnabled" | "version"> &
    Partial<Pick<AccessPolicy, "releaseBeforePayment">>,
) {
  return apiRequest<AccessPolicy>("/settings/access-policy", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function getFieldPolicy() {
  return apiRequest<FieldPolicy>("/settings/field-policy");
}
export function updateFieldPolicy(input: Omit<FieldPolicy, "publicId" | "updatedAt">) {
  return apiRequest<FieldPolicy>("/settings/field-policy", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
export function listBranches() {
  return apiRequest<{ items: Branch[] }>("/settings/branches");
}
export function createBranch(input: { code: string; name: string; city?: string }) {
  return apiRequest<Branch>("/settings/branches", { method: "POST", body: JSON.stringify(input) });
}
export function listServicePackages() {
  return apiRequest<{ items: ServicePackage[] }>("/settings/service-packages");
}
export function createServicePackage(input: {
  code: string;
  name: string;
  checks: string[];
  price?: number;
  tatHours: number;
  serviceFamily?: string;
  requiredDocuments?: string[];
}) {
  return apiRequest<ServicePackage>("/settings/service-packages", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePackageRequirements(
  id: string,
  input: { updatedAt: string; requiredDocuments: string[] },
) {
  return apiRequest(`/settings/service-packages/${id}/requirements`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** One Main Vendor with its Admin-set team limit and current team counts. */
export interface VendorTeamLimit {
  id: string;
  name: string;
  email: string;
  status: string;
  limit: number;
  /** Policy version for the optimistic save; 0 when no limit was ever set. */
  version: number;
  activeTeamUsers: number;
  inactiveTeamUsers: number;
}

export function listVendorTeamLimits() {
  return apiRequest<{ maxLimit: number; items: VendorTeamLimit[] }>("/settings/vendor-team-limits");
}

export function updateVendorTeamLimit(
  vendorId: string,
  input: { maxActiveUsers: number; version: number },
) {
  return apiRequest<{ id: string; limit: number; version: number; activeTeamUsers: number }>(
    `/settings/vendor-team-limits/${encodeURIComponent(vendorId)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}
