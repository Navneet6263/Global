import { logout } from "@/lib/backend-api/auth";
import { clearDeviceOfflineData } from "./device-offline-data";
import { clearIdentity } from "./platform-session";

/**
 * Clears identity-bound device data before closing the authenticated session.
 * Cleanup is attempted for every store even if one store is unavailable.
 */
export async function endAuthenticatedSession(): Promise<void> {
  try {
    await clearDeviceOfflineData();
  } catch {
    throw new Error(
      "Secure device drafts could not be cleared. Sign out was stopped to protect account data.",
    );
  }
  try {
    await logout();
  } finally {
    clearIdentity();
  }
}
