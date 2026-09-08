import { clearFieldDrafts, retainOnlyFieldDraftScope } from "@/features/field/offline-store";
import {
  clearVerifierDrafts,
  retainOnlyVerifierDraftScope,
} from "@/features/delivery/verifier/verifier-draft";
import {
  activateDeviceDataScope,
  currentDeviceDataScope,
  deactivateDeviceDataScope,
  type DeviceDataScope,
} from "./device-data-scope";
import { purgePrivateAppShell } from "@/lib/pwa/private-cache";
import { DeviceOperationQueue } from "./device-operation-queue";

const changes = new DeviceOperationQueue();

export function prepareDeviceOfflineData(scope: DeviceDataScope): Promise<void> {
  return changes.run(() => prepareScope(scope));
}

export function clearDeviceOfflineData(): Promise<void> {
  return changes.run(clearScope);
}

async function prepareScope(scope: DeviceDataScope): Promise<void> {
  if (typeof window === "undefined") return;
  // Loading the same account in another tab is not an ownership change.
  // Removing its shared marker would make every other tab redirect to sign-in.
  if (currentDeviceDataScope() === scope) {
    activateDeviceDataScope(scope);
    return;
  }
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
    await clearScope().catch(() => undefined);
    throw new Error("Secure offline storage could not be prepared for this account");
  }
}

async function clearScope(): Promise<void> {
  deactivateDeviceDataScope();
  await purgePrivateAppShell();
  if (typeof indexedDB === "undefined") return;
  const results = await Promise.allSettled([clearFieldDrafts(), clearVerifierDrafts()]);
  if (results.some((result) => result.status === "rejected")) {
    throw new Error("Secure device drafts could not be cleared");
  }
}
