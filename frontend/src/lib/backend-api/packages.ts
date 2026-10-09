import { apiRequest } from "./client";

/** A service package with its list price and the most an RM may discount it. */
export interface PackageItem {
  id: string;
  code: string;
  name: string;
  serviceFamily: string;
  checks: string[];
  requiredDocuments: string[];
  price: number | null;
  tatHours: number;
  maxRmDiscountPercent: number;
  /** Price of each check on its own. */
  checkPrices: Record<string, number>;
  /** GST % on this package. */
  taxRate: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PackageInput {
  code: string;
  name: string;
  checks: string[];
  price?: number;
  tatHours: number;
  serviceFamily?: string;
  requiredDocuments?: string[];
  maxRmDiscountPercent?: number;
  checkPrices?: Record<string, number>;
  taxRate?: number;
}

export interface PackageUpdate {
  updatedAt: string;
  name?: string;
  price?: number;
  tatHours?: number;
  maxRmDiscountPercent?: number;
  checkPrices?: Record<string, number>;
  taxRate?: number;
  isActive?: boolean;
}

export interface PricingClient {
  id: string;
  name: string;
  status: string;
}

export interface ClientPricingRow {
  packageId: string;
  code: string;
  name: string;
  listPrice: number;
  maxRmDiscountPercent: number;
  /** 100 for Operations / Admin; the package limit for an RM. */
  yourLimitPercent: number;
  discountPercent: number;
  finalPrice: number;
  note: string | null;
  setBy: string | null;
  updatedAt: string | null;
}

export interface ClientPricing {
  client: { id: string; name: string };
  canSetAnyDiscount: boolean;
  items: ClientPricingRow[];
}

export function listPackages() {
  return apiRequest<{ items: PackageItem[] }>("/packages");
}

export function createPackage(input: PackageInput) {
  return apiRequest<PackageItem>("/packages", { method: "POST", body: JSON.stringify(input) });
}

export function updatePackage(id: string, input: PackageUpdate) {
  return apiRequest<PackageItem>(`/packages/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function listPricingClients() {
  return apiRequest<{ items: PricingClient[] }>("/client-pricing");
}

export function getClientPricing(clientId: string) {
  return apiRequest<ClientPricing>(`/client-pricing/${clientId}`);
}

export function setClientDiscount(
  clientId: string,
  packageId: string,
  input: { discountPercent: number; note?: string },
) {
  return apiRequest<{ packageId: string; discountPercent: number }>(
    `/client-pricing/${clientId}/${packageId}`,
    { method: "PUT", body: JSON.stringify(input) },
  );
}
