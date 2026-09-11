"use client";

import { useState } from "react";
import { Laptop, ShieldAlert } from "lucide-react";
import type { AuthEventType, SecurityOverview } from "@/lib/contracts/security";
import type { StatusTone } from "@/lib/contracts/common";
import { Section } from "@/components/layout/section";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/formatting";
import { PaginationBar } from "@/components/layout/pagination-bar";

const EVENT_META: Record<AuthEventType, { label: string; tone: StatusTone }> = {
  login_success: { label: "Login", tone: "success" },
  login_failure: { label: "Failed login", tone: "warning" },
  password_change: { label: "Password change", tone: "info" },
  session_revoked: { label: "Session revoked", tone: "neutral" },
  refresh_token_reuse: { label: "Token reuse", tone: "critical" },
  mfa_challenge: { label: "MFA challenge", tone: "review" },
};

interface SessionsPanelProps {
  overview: SecurityOverview;
  onRevoke: (id: string) => void;
  onRevokeOthers: () => void;
  busy: boolean;
  revokingId: string | undefined;
  revokingOthers: boolean;
}

export function SessionsPanel({
  overview,
  onRevoke,
  onRevokeOthers,
  busy,
  revokingId,
  revokingOthers,
}: SessionsPanelProps) {
  const otherSessionCount = overview.sessions.filter((session) => !session.isCurrent).length;
  return (
    <Section
      title="Active sessions"
      description="Devices currently holding a session for your platform identity."
      padded={false}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={onRevokeOthers}
          disabled={busy || otherSessionCount === 0}
          loading={revokingOthers}
        >
          Revoke all other sessions
        </Button>
      }
    >
      <ul className="divide-y divide-border">
        {overview.sessions.map((session) => (
          <li key={session.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Laptop className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-foreground">
                {session.deviceName ??
                  (session.isCurrent ? "Current browser session" : "Unnamed browser session")}
              </p>
              {session.userAgent ? (
                <p className="truncate text-[11px] text-muted-foreground" title={session.userAgent}>
                  {session.userAgent}
                </p>
              ) : null}
              <p className="text-[11px] text-muted-foreground/80">
                {session.locationLabel} · IP {session.ipAddress ?? "not recorded"} · Started{" "}
                {formatDateTime(session.startedAt)} · Expires {formatDateTime(session.expiresAt)}
              </p>
            </div>
            {session.isCurrent ? (
              <StatusBadge label="This device" tone="info" />
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRevoke(session.id)}
                disabled={busy}
                loading={busy && revokingId === session.id}
              >
                Revoke
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function AuthEventsPanel({ overview }: { overview: SecurityOverview }) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(overview.events.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const events = overview.events.slice((safePage - 1) * pageSize, safePage * pageSize);
  return (
    <Section
      title="Authentication activity"
      description="Recent sign-ins, credential changes and anomaly detections."
      padded={false}
    >
      <>
        <ul className="divide-y divide-border">
          {events.map((event) => {
            const meta = EVENT_META[event.type];
            return (
              <li key={event.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <StatusBadge label={meta.label} tone={meta.tone} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-foreground">{event.detail}</p>
                  {event.ipAddress || event.userAgent ? (
                    <p
                      className="truncate text-[11px] text-muted-foreground"
                      title={event.userAgent ?? undefined}
                    >
                      {event.locationLabel} ·{" "}
                      {event.ipAddress ? `IP ${event.ipAddress}` : "IP not recorded"}
                      {event.userAgent ? ` · ${event.userAgent}` : ""}
                    </p>
                  ) : null}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {formatDateTime(event.at)}
                </span>
              </li>
            );
          })}
        </ul>
        <PaginationBar
          page={safePage}
          pageSize={pageSize}
          total={overview.events.length}
          onPageChange={setPage}
          label="security events"
        />
      </>
    </Section>
  );
}

export function TokenReuseAlert({ overview }: { overview: SecurityOverview }) {
  if (!overview.refreshReuseDetected) return null;
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-xl border border-critical/25 bg-critical-soft/60 px-5 py-4">
      <ShieldAlert className="mt-0.5 size-4 text-critical-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-critical-foreground">
          Refresh token reuse detected
        </p>
        <p className="text-sm text-critical-foreground/85">
          A refresh token was replayed from an unrecognised device. The session family was
          invalidated automatically — review the activity log and rotate your password.
        </p>
      </div>
    </div>
  );
}
