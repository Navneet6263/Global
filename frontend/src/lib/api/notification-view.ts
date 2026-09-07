import type { NotificationItem } from "@/lib/backend-api/notifications";
import type { PlatformNotification } from "@/lib/contracts/notifications";

export function notificationView(item: NotificationItem): PlatformNotification {
  const type = item.type.toLowerCase();
  return {
    id: item.id,
    kind: type.includes("sla")
      ? "sla"
      : type.includes("qa")
        ? "qa"
        : type.includes("client")
          ? "client"
          : type.includes("finance")
            ? "finance"
            : "system",
    title: item.title,
    body: item.body,
    at: item.createdAt,
    read: Boolean(item.readAt),
    route: item.href ?? "",
  };
}
