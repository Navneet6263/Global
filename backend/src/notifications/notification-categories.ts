import type { Prisma } from "../generated/prisma/client";

/** Notification inbox categories, matched on the notification type in this order. */
export const NotificationCategories = [
  "urgent",
  "review",
  "finance",
  "work",
  "other",
] as const;
export type NotificationCategory = (typeof NotificationCategories)[number];

const RULES: Record<
  Exclude<NotificationCategory, "other">,
  { contains?: string[]; startsWith?: string[] }
> = {
  // Anything late, escalated or failed needs attention first.
  urgent: { contains: ["OVERDUE", "ESCALATED", "FAILED", "_DUE", "EXPIRY"] },
  review: {
    startsWith: [
      "QA_",
      "QC_",
      "FINAL_REVIEW",
      "REPORT_",
      "CLIENT_REVIEW",
      "CHECK_TL_REVIEW",
    ],
  },
  finance: {
    startsWith: [
      "INVOICE",
      "PAYMENT",
      "BILL",
      "COLLECTION",
      "CREDIT_NOTE",
      "PURCHASE_ORDER",
    ],
  },
  work: {
    startsWith: [
      "TASK_",
      "DATA_ENTRY_",
      "CHECK",
      "CASE_",
      "FIELD_VISIT_",
      "VENDOR_",
      "CLARIFICATION_",
      "DOCUMENT",
      "INSUFFICIENCY",
      "CORRECTION",
      "CONSENT",
      "SOURCE_",
      "STAGE_",
    ],
  },
};
const ORDERED = ["urgent", "review", "finance", "work"] as const;

const matches = (type: string, rule: (typeof RULES)[keyof typeof RULES]) =>
  (rule.contains ?? []).some((part) => type.includes(part)) ||
  (rule.startsWith ?? []).some((part) => type.startsWith(part));

export function categoryOf(type: string): NotificationCategory {
  const upper = type.toUpperCase();
  return ORDERED.find((name) => matches(upper, RULES[name])) ?? "other";
}

const ruleWhere = (
  rule: (typeof RULES)[keyof typeof RULES],
): Prisma.NotificationWhereInput => ({
  OR: [
    ...(rule.contains ?? []).map((part) => ({ type: { contains: part } })),
    ...(rule.startsWith ?? []).map((part) => ({ type: { startsWith: part } })),
  ],
});

/** Database filter for one category (earlier categories win, as in categoryOf). */
export function categoryWhere(
  category: NotificationCategory,
): Prisma.NotificationWhereInput {
  const at = ORDERED.indexOf(category as (typeof ORDERED)[number]);
  const earlier = at === -1 ? ORDERED : ORDERED.slice(0, at);
  return {
    AND: [
      ...(at === -1 ? [] : [ruleWhere(RULES[category as keyof typeof RULES])]),
      ...earlier.map((name) => ({ NOT: ruleWhere(RULES[name]) })),
    ],
  };
}
