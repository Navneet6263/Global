import type { ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { navFor, type NavWorkspace } from "@/config/navigation";
import { cachedIdentity } from "@/lib/auth/platform-session";
import { sessionForNav } from "@/lib/auth/session";
import { isVisible } from "@/lib/permissions";
import { PageHelpProvider } from "./help-context";

export function WorkspaceHelp({
  workspace,
  children,
}: {
  workspace: NavWorkspace;
  children: ReactNode;
}) {
  const identity = cachedIdentity();
  const path = useLocation({ select: (location) => location.pathname });
  const matched = [...navFor(workspace).items]
    .filter((item) => isVisible(sessionForNav(workspace), item))
    .sort((a, b) => b.route.length - a.route.length)
    .find((item) => path === item.route || path.startsWith(`${item.route}/`));
  return (
    <PageHelpProvider
      workspace={workspace}
      scope={`${identity?.tenantId ?? "anonymous"}:${identity?.userId ?? "anonymous"}`}
      title={matched?.label ?? "Workspace guide"}
      purpose={matched?.description ?? "Understand this page and your next step."}
    >
      {children}
    </PageHelpProvider>
  );
}
