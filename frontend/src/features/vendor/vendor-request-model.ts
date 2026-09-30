import type { StatusTone } from "@/lib/contracts/common";
import type { VendorDecision, VendorRequestStatus } from "./vendor-contracts";

export const REASON_MIN = 5;
export const REASON_MAX = 1000;

/**
 * Mirrors the server rule: a rejection needs a reason of 5–1000 characters after
 * trimming; an approval remark is optional. The server remains the authority.
 */
export function decisionProblem(decision: VendorDecision, reason: string): string | null {
  const length = reason.trim().length;
  if (length > REASON_MAX) return `Keep it under ${REASON_MAX} characters.`;
  if (decision === "REJECTED" && length < REASON_MIN)
    return `A rejection reason of at least ${REASON_MIN} characters is required.`;
  return null;
}

export const REQUEST_STATUS_META: Record<VendorRequestStatus, { label: string; tone: StatusTone }> =
  {
    PENDING: { label: "Waiting for you", tone: "warning" },
    APPROVED: { label: "Approved", tone: "success" },
    REJECTED: { label: "Rejected", tone: "critical" },
  };

/** The sidebar status views; each is its own route and reads the same vendor-scoped API. */
export const VENDOR_LIST_VIEWS = [
  {
    view: "PENDING",
    status: "PENDING",
    to: "/vendor/pending",
    title: "Pending requests",
    description: "Documents waiting for your decision. Approve them, or reject them with a reason.",
  },
  {
    view: "APPROVED",
    status: "APPROVED",
    to: "/vendor/approved",
    title: "Approved requests",
    description: "Documents you approved. Open one to upload or replace its report.",
  },
  {
    view: "REJECTED",
    status: "REJECTED",
    to: "/vendor/rejected",
    title: "Rejected requests",
    description: "Documents you rejected, with the reason you gave SPOC-RM.",
  },
  {
    view: "ALL",
    status: undefined,
    to: "/vendor/all",
    title: "All requests",
    description: "Every document assigned to you, newest first.",
  },
] as const satisfies ReadonlyArray<{
  view: string;
  status: VendorRequestStatus | undefined;
  to: string;
  title: string;
  description: string;
}>;

export type VendorListView = (typeof VENDOR_LIST_VIEWS)[number]["view"];

export function vendorListView(view: VendorListView) {
  return VENDOR_LIST_VIEWS.find((item) => item.view === view) ?? VENDOR_LIST_VIEWS[3];
}

type CardTone = "mint" | "amber" | "rose" | "blue";
type Counts = { pending: number; approved: number; rejected: number };

/** The overview cards: amber while work waits, rose for rejections, mint when clear. */
export function vendorKpiCards(counts: Counts | undefined) {
  const value = (count: number | undefined) => (count === undefined ? "—" : count);
  const total = counts ? counts.pending + counts.approved + counts.rejected : undefined;
  const cards: Array<{
    view: VendorListView;
    label: string;
    value: string | number;
    detail: string;
    tone: CardTone;
  }> = [
    {
      view: "PENDING",
      label: "Pending",
      value: value(counts?.pending),
      detail: "Waiting for your decision",
      tone: counts?.pending ? "amber" : "mint",
    },
    {
      view: "APPROVED",
      label: "Approved",
      value: value(counts?.approved),
      detail: "Approved; upload a report on each",
      tone: "mint",
    },
    {
      view: "REJECTED",
      label: "Rejected",
      value: value(counts?.rejected),
      detail: "Sent back to SPOC-RM with a reason",
      tone: counts?.rejected ? "rose" : "mint",
    },
    {
      view: "ALL",
      label: "All requests",
      value: value(total),
      detail: "Everything assigned to you",
      tone: "blue",
    },
  ];
  return cards.map((card) => ({ ...card, to: vendorListView(card.view).to }));
}
