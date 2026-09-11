import { parseAction, type ActionKind } from "@/features/operations/actions/action-inbox-model";

const tabs = [
  "overview",
  "checks",
  "documents",
  "clarifications",
  "field-visits",
  "reports",
  "timeline",
] as const;
export type CaseWorkspaceTab = (typeof tabs)[number];
export function caseWorkspaceSearch(search: Record<string, unknown>): {
  tab?: CaseWorkspaceTab;
  inbox?: ActionKind;
} {
  return {
    tab: tabs.includes(search["tab"] as CaseWorkspaceTab)
      ? (search["tab"] as CaseWorkspaceTab)
      : undefined,
    inbox: parseAction(search["inbox"]),
  };
}
