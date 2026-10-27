import {
  BarChart3,
  FolderOpen,
  IndianRupee,
  KeyRound,
  LayoutDashboard,
  Package,
  type LucideIcon,
} from "lucide-react";

export type ProfileTab = "overview" | "cases" | "reports" | "billing" | "packages" | "logins";
export const PROFILE_TABS: ReadonlyArray<{ id: ProfileTab; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "cases", label: "Cases", icon: FolderOpen },
  { id: "reports", label: "Reports & MIS", icon: BarChart3 },
  { id: "billing", label: "Billing", icon: IndianRupee },
  { id: "packages", label: "Packages", icon: Package },
  { id: "logins", label: "Logins", icon: KeyRound },
];
