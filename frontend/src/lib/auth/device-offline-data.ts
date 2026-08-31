import { clearFieldDrafts, retainOnlyFieldDraftScope } from "@/features/field/offline-store";
import {
  clearVerifierDrafts,
  retainOnlyVerifierDraftScope,
} from "@/features/delivery/verifier/verifier-draft";
import {
  activateDeviceDataScope,
  deactivateDeviceDataScope,
  type DeviceDataScope,
} from "./device-data-scope";
import { purgePrivateAppShell } from "@/lib/pwa/private-cache";

export async function prepareDeviceOfflineData(scope: DeviceDataScope): Promise<void> {
  if (typeof window === "undefined") return;
  deactivateDeviceDataScope();
  await purgePrivateAppShell();
  if (typeof indexedDB === "undefined") {
    activateDeviceDataScope(scope);
    return;
  }
  try {
    await Promise.all([retainOnlyFieldDraftScope(scope), retainOnlyVerifierDraftScope(scope)]);
    activateDeviceDataScope(scope);
  } catch {
    await clearDeviceOfflineData().catch(() => undefined);
    throw new Error("Secure offline storage could not be prepared for this account");
  }
}

export async function clearDeviceOfflineData(): Promise<void> {
  deactivateDeviceDataScope();
  await purgePrivateAppShell();
  if (typeof indexedDB === "undefined") return;
  const results = await Promise.allSettled([clearFieldDrafts(), clearVerifierDrafts()]);
  if (results.some((result) => result.status === "rejected")) {
    throw new Error("Secure device drafts could not be cleared");
  }
}
