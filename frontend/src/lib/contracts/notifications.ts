import type { StatusTone } from "./common";

export type NotificationKind = "sla" | "qa" | "client" | "system" | "finance";

export interface PlatformNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  at: string;
  read: boolean;
  route: string;
}

export const NOTIFICATION_TONE: Record<NotificationKind, StatusTone> = {
  sla: "warning",
  qa: "review",
  client: "info",
  system: "neutral",
  finance: "critical",
};
