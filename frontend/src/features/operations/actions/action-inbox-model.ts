import {
  ClipboardCheck,
  FileCheck2,
  MapPin,
  MessageSquareText,
  Play,
  UserRoundCheck,
} from "lucide-react";

export const actionMeta = {
  documents: {
    label: "Documents to review",
    detail: "Fresh uploads & replacements",
    unit: "documents",
    icon: FileCheck2,
    tab: "documents",
    button: "Review documents",
    colour: "border-sky-200 bg-sky-50 text-sky-900",
    permission: "document:read",
  },
  start: {
    label: "Ready to start",
    detail: "Consent & document review ready",
    unit: "cases",
    icon: Play,
    tab: "checks",
    button: "Start & assign",
    colour: "border-emerald-200 bg-emerald-50 text-emerald-900",
    permission: "case:transition",
  },
  checks: {
    label: "Checks to assign",
    detail: "Active cases needing a verifier",
    unit: "checks",
    icon: UserRoundCheck,
    tab: "checks",
    button: "Assign checks",
    colour: "border-violet-200 bg-violet-50 text-violet-900",
    permission: "task:write",
  },
  field_assignment: {
    label: "Field assignment pending",
    detail: "Required physical visit not assigned",
    unit: "visits",
    icon: MapPin,
    tab: "field-visits",
    button: "Assign field visit",
    colour: "border-amber-200 bg-amber-50 text-amber-900",
    permission: "field-visit:write",
  },
  field_review: {
    label: "Field evidence to review",
    detail: "Submitted visits & exceptions",
    unit: "visits",
    icon: ClipboardCheck,
    tab: "field-visits",
    button: "Review field evidence",
    colour: "border-teal-200 bg-teal-50 text-teal-900",
    permission: "field-visit:write",
  },
  clarifications: {
    label: "Replies awaiting action",
    detail: "Responses ready for team review",
    unit: "replies",
    icon: MessageSquareText,
    tab: "clarifications",
    button: "Review response",
    colour: "border-rose-200 bg-rose-50 text-rose-900",
    permission: "clarification:read",
  },
} as const;

export type ActionKind = keyof typeof actionMeta;
export const actionKinds = Object.keys(actionMeta) as ActionKind[];
export function parseAction(value: unknown): ActionKind | undefined {
  return typeof value === "string" && Object.hasOwn(actionMeta, value)
    ? (value as ActionKind)
    : undefined;
}
export interface ActionInboxSearch {
  action?: ActionKind;
  page?: number;
  q?: string;
}
export function actionInboxSearch(search: Record<string, unknown>): ActionInboxSearch {
  const page = Number(search["page"]);
  return {
    action: parseAction(search["action"]),
    page: Number.isInteger(page) && page > 0 && page <= 100000 ? page : undefined,
    q: typeof search["q"] === "string" ? search["q"].slice(0, 120) : undefined,
  };
}
export interface ActionRow {
  id: string;
  caseNumber: string;
  candidateName: string;
  clientName: string;
  status: string;
  priority: string;
  version: number;
  dueAt: string | null;
  activityAt: string;
  quantity: number;
  checksComplete: number;
}
export interface ActionInboxData {
  summary: Array<{ action: ActionKind; cases: number; quantity: number }>;
  items: ActionRow[];
  total: number;
  page: number;
  pageSize: number;
  action: ActionKind;
  generatedAt: string;
}
