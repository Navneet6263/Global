import {
  BarChart3,
  CalendarDays,
  FileCheck2,
  History,
  Inbox,
  KeyRound,
  LayoutDashboard,
  ReceiptIndianRupee,
  RotateCcw,
  ShieldAlert,
  UserRoundCheck,
  WalletCards,
} from "lucide-react";
import type { NavItem, NavWorkspace, WorkspaceNavigation } from "./navigation.types";

function item(
  workspace: "qa-reviewer" | "finance",
  label: string,
  description: string,
  route: string,
  icon: NavItem["icon"],
  group: NavItem["group"] = "work",
): NavItem {
  return {
    workspace,
    label,
    description,
    route,
    icon,
    group,
    roles: [workspace === "qa-reviewer" ? "QA_REVIEWER" : "FINANCE_MANAGER"],
    permission:
      route === "/change-password"
        ? "notification:read"
        : workspace === "qa-reviewer"
          ? "qa:review"
          : "finance:read",
  };
}
const security = (workspace: "qa-reviewer" | "finance") =>
  item(
    workspace,
    "Account Security",
    "Password, sessions and sign-in activity",
    "/change-password",
    KeyRound,
    "account",
  );

export const QA_FINANCE_NAVIGATION: Partial<Record<NavWorkspace, WorkspaceNavigation>> = {
  "qa-reviewer": {
    groups: [
      { id: "command", label: "Workspace", defaultOpen: true },
      { id: "work", label: "Quality review", defaultOpen: true },
      { id: "account", label: "Account", defaultOpen: true },
    ],
    items: [
      item(
        "qa-reviewer",
        "QA overview",
        "Workload, overdue cases and review priorities",
        "/qa-review/overview",
        LayoutDashboard,
        "command",
      ),
      item(
        "qa-reviewer",
        "Review queue",
        "All awaiting cases; filter to those available to claim",
        "/qa-review",
        Inbox,
      ),
      item(
        "qa-reviewer",
        "My reviews",
        "Cases currently reserved for your review",
        "/qa-review/mine",
        UserRoundCheck,
      ),
      item(
        "qa-reviewer",
        "Corrections",
        "Track cases returned for verification rework",
        "/qa-review/corrections",
        RotateCcw,
      ),
      item(
        "qa-reviewer",
        "Decision history",
        "Your saved approvals and return decisions",
        "/qa-review/history",
        History,
      ),
      security("qa-reviewer"),
    ],
  },
  finance: {
    groups: [
      { id: "command", label: "Workspace", defaultOpen: true },
      { id: "work", label: "Billing & collections", defaultOpen: true },
      { id: "account", label: "Account", defaultOpen: true },
    ],
    items: [
      item(
        "finance",
        "Finance overview",
        "Billed, collected and outstanding balances",
        "/finance",
        BarChart3,
        "command",
      ),
      item(
        "finance",
        "Invoices",
        "Issue invoices, record payments and inspect the ledger",
        "/finance/invoices",
        ReceiptIndianRupee,
      ),
      {
        ...item(
          "finance",
          "Ready for billing",
          "Prepare invoices from approved report charges",
          "/finance/billing",
          FileCheck2,
        ),
        permission: "finance:write",
      },
      item(
        "finance",
        "Collections",
        "Overdue invoices first; open an invoice to record payment",
        "/finance/collections",
        WalletCards,
      ),
      item(
        "finance",
        "Credit control",
        "Client limits and explicit new-case holds",
        "/finance/credit",
        ShieldAlert,
      ),
      item(
        "finance",
        "Statements",
        "Download a client ledger for an Indian calendar month",
        "/finance/statements",
        CalendarDays,
      ),
      security("finance"),
    ],
  },
};
