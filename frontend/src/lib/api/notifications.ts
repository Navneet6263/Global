import { apiRequest } from "./client";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  href?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export function listNotifications() {
  return apiRequest<{ unread: number; items: NotificationItem[] }>("/notifications");
}

export function markNotificationRead(notificationId: string) {
  return apiRequest<{ read: true }>(`/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
}

export function markAllNotificationsRead() {
  return apiRequest<{ read: number }>("/notifications/read-all", { method: "POST" });
}
