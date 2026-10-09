import { useId } from "react";
import { CircleAlert, CircleCheck, Clock3, FileUp } from "lucide-react";
import type { OnboardingDocumentState } from "@/lib/backend-api/onboarding";

export function ProgressRing({
  percent,
  light = false,
  small = false,
  label = "done",
}: {
  percent: number;
  light?: boolean;
  small?: boolean;
  label?: string;
}) {
  const id = useId().replace(/:/g, "");
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const value = Math.max(0, Math.min(100, percent));
  return (
    <div
      className={`onb-ring ${light ? "is-light" : ""} ${small ? "is-small" : ""}`}
      role="img"
      aria-label={`${value}% ${label}`}
    >
      <svg viewBox="0 0 100 100" aria-hidden>
        <defs>
          <linearGradient id={`g${id}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={light ? "#1d4ed8" : "#86efac"} />
            <stop offset="100%" stopColor={light ? "#16a34a" : "#4ade80"} />
          </linearGradient>
        </defs>
        <circle className="track" cx="50" cy="50" r={radius} />
        <circle
          className="bar"
          cx="50"
          cy="50"
          r={radius}
          style={{ stroke: `url(#g${id})` }}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
        />
      </svg>
      <span className="onb-ring-label">
        <strong>{value}%</strong>
        <span>{label}</span>
      </span>
    </div>
  );
}

const DOC_STATE: Record<OnboardingDocumentState, { label: string; className: string }> = {
  MISSING: { label: "Not uploaded", className: "is-missing" },
  PENDING: { label: "In review", className: "is-pending" },
  APPROVED: { label: "Approved", className: "is-approved" },
  REJECTED: { label: "Re-upload needed", className: "is-rejected" },
};

export function DocChip({ state }: { state: OnboardingDocumentState }) {
  const meta = DOC_STATE[state];
  return <span className={`onb-chip ${meta.className}`}>{meta.label}</span>;
}

export function DocIcon({ state }: { state: OnboardingDocumentState }) {
  const Icon =
    state === "APPROVED"
      ? CircleCheck
      : state === "REJECTED"
        ? CircleAlert
        : state === "PENDING"
          ? Clock3
          : FileUp;
  return (
    <span className="onb-doc-icon">
      <Icon aria-hidden />
    </span>
  );
}
