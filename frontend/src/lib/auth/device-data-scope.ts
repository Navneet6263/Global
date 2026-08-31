export type DeviceDataScope = string & { readonly __deviceDataScope: unique symbol };

export const deviceDataScopeStorageKey = "sapling.auth.device-data-scope";
let activeScope: DeviceDataScope | null = null;

export function createDeviceDataScope(tenantId: string, userId: string): DeviceDataScope {
  const tenant = tenantId.trim();
  const user = userId.trim();
  if (!tenant || !user) throw new Error("Authenticated device scope is unavailable");
  return `${tenant.length}:${tenant}${user.length}:${user}` as DeviceDataScope;
}

export function scopedDeviceRecordKey(scope: DeviceDataScope, recordId: string): string {
  if (!recordId) throw new Error("Offline record identity is unavailable");
  return `v2:${scope.length}:${scope}:${recordId}`;
}

export function activateDeviceDataScope(scope: DeviceDataScope): void {
  activeScope = scope;
  try {
    window.localStorage.setItem(deviceDataScopeStorageKey, scope);
  } catch {
    // Module memory still protects this tab when storage is unavailable.
  }
}

export function deactivateDeviceDataScope(): void {
  activeScope = null;
  try {
    window.localStorage.removeItem(deviceDataScopeStorageKey);
  } catch {
    // The in-tab scope is already inactive.
  }
}

export function assertActiveDeviceDataScope(scope: DeviceDataScope): void {
  let storedScope: string | null = activeScope;
  try {
    storedScope = window.localStorage.getItem(deviceDataScopeStorageKey);
  } catch {
    // Fall back to the in-tab scope when local storage is disabled.
  }
  if (storedScope !== scope) throw new Error("Offline storage belongs to another session");
}
