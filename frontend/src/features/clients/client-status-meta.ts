import type { ClientStatus } from "@/lib/contracts/client";
import type { StatusTone } from "@/lib/contracts/common";

export const CLIENT_STATUS_META: Record<ClientStatus, { label: string; tone: StatusTone }> = {
  active: { label: "Active", tone: "success" },
  suspended: { label: "Suspended", tone: "critical" },
  onboarding: { label: "Onboarding", tone: "warning" },
};
