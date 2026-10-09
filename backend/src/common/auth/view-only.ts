import { Permission } from "./permissions";

/**
 * Platform Admin oversight is view-only (PLATFORM_ADMIN_VIEW_ONLY, default on): it reads
 * every workspace, may escalate cases, and still runs its own admin work (user IDs and
 * platform settings), but cannot change case data. A user that also holds an operational
 * role keeps that role's write access.
 */
export function isViewOnlyAdmin(
  roles: readonly string[],
  enabled: boolean,
): boolean {
  return (
    enabled &&
    roles.includes("PLATFORM_ADMIN") &&
    roles.every((role) => role === "PLATFORM_ADMIN")
  );
}

/**
 * Session permissions shown to a view-only admin: every read, plus its own admin work
 * (user IDs and settings). The UI hides every other write action.
 */
export const VIEW_ONLY_PERMISSIONS: readonly string[] = [
  ...Object.values(Permission).filter((permission) =>
    permission.endsWith(":read"),
  ),
  Permission.UserWrite,
  Permission.SettingsManage,
];
