"use client";

import { AUDIT_CATEGORY_META, type AuditEvent } from "@/lib/contracts/audit";
import { StatusBadge } from "@/components/feedback/status-badge";
import { formatDateTime } from "@/lib/formatting";

export function AuditList({ events }: { events: readonly AuditEvent[] }) {
  return (
    <ul className="divide-y divide-border">
      {events.map((event) => {
        const meta = AUDIT_CATEGORY_META[event.category];
        const changes = diffKeys(event);
        return (
          <li key={event.id} className="space-y-2 px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={meta.label} tone={meta.tone} />
              <span className="text-[13px] font-medium text-foreground">{event.action}</span>
              <span className="num text-[11px] text-muted-foreground">
                {event.resourceType}/{event.resourceId}
              </span>
              <span className="ml-auto text-[11px] text-muted-foreground">
                {formatDateTime(event.at)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {event.actorName} · {event.actorRole} · {event.locationLabel} · IP{" "}
              {event.ipAddress ?? "n/a"} · request <span className="num">{event.requestId}</span>
            </p>
            {changes.length > 0 ? (
              <ul className="space-y-1 rounded-xl border border-border bg-muted/35 px-3 py-2">
                {changes.map((key) => (
                  <li key={key} className="text-[11px] text-foreground/85">
                    <span className="font-medium">{key}</span>:{" "}
                    <span className="text-muted-foreground line-through">
                      {String(event.before?.[key] ?? "—")}
                    </span>{" "}
                    → <span className="text-foreground">{String(event.after?.[key] ?? "—")}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function diffKeys(event: AuditEvent): string[] {
  const keys = new Set([...Object.keys(event.before ?? {}), ...Object.keys(event.after ?? {})]);
  return [...keys].filter((key) => event.before?.[key] !== event.after?.[key]);
}
