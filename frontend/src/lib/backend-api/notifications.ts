import { apiRequest } from "./client";

export type NotificationCategory = "urgent" | "review" | "finance" | "work" | "other";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  href?: string | null;
  readAt?: string | null;
  createdAt: string;
  /** Inbox category (older servers may not send it). */
  category?: NotificationCategory;
}

export interface NotificationPage {
  unread: number;
  total?: number;
  counts?: Record<NotificationCategory, { total: number; unread: number }>;
  nextCursor?: string | null;
  items: NotificationItem[];
}

export interface NotificationFilter {
  cursor?: string | undefined;
  limit?: number;
  unread?: boolean;
  category?: NotificationCategory | undefined;
  search?: string | undefined;
}

/** One page of the inbox, newest first; pass `cursor` (the previous nextCursor) for more. */
export function listNotifications(filter: NotificationFilter = {}) {
  const params = new URLSearchParams();
  if (filter.cursor) params.set("cursor", filter.cursor);
  if (filter.limit) params.set("limit", String(filter.limit));
  if (filter.unread) params.set("unread", "true");
  if (filter.category) params.set("category", filter.category);
  if (filter.search?.trim()) params.set("search", filter.search.trim());
  const query = params.toString();
  return apiRequest<NotificationPage>(`/notifications${query ? `?${query}` : ""}`);
}

export function markNotificationRead(notificationId: string) {
  return apiRequest<{ read: true }>(`/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
}

export function markNotificationUnread(notificationId: string) {
  return apiRequest<{ read: false }>(`/notifications/${notificationId}/unread`, {
    method: "PATCH",
  });
}

export function markAllNotificationsRead() {
  return apiRequest<{ read: number }>("/notifications/read-all", { method: "POST" });
}
