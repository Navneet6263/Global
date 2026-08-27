import type { UserStatus } from "@/lib/contracts/user";
import type { StatusTone } from "@/lib/contracts/common";

export const USER_STATUS_META: Record<UserStatus, { label: string; tone: StatusTone }> = {
  active: { label: "Active", tone: "success" },
  suspended: { label: "Suspended", tone: "critical" },
  invited: { label: "Invited", tone: "warning" },
};
