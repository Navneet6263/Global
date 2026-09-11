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
