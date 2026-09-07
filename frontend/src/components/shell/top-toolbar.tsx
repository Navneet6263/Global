"use client";

import { Link } from "@tanstack/react-router";
import { Menu, RefreshCw, ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { sessionForNav } from "@/lib/auth/session";
import type { NavWorkspace } from "@/config/navigation";
import { WORKSPACE_PRESENTATION } from "@/config/workspace-presentation";
import { initialsOf } from "@/lib/formatting";
import { notifySuccess } from "@/lib/feedback/notify";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GlobalSearch } from "./global-search";
import { NotificationsMenu } from "./notifications-menu";
import { QuickCreateMenu } from "./quick-create-menu";
import { HelpLauncher } from "@/features/help/help-launcher";

interface TopToolbarProps {
  onOpenNav: () => void;
  workspace?: NavWorkspace;
}

export function TopToolbar({ onOpenNav, workspace = "platform-admin" }: TopToolbarProps) {
  const session = sessionForNav(workspace);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const presentation = WORKSPACE_PRESENTATION[workspace];

  const refresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({ type: "active" }, { throwOnError: true });
      notifySuccess("Workspace refreshed", "Visible operational panels are up to date.");
    } catch {
      toast.error("Some panels could not refresh", {
        description: "Your existing data is kept. Retry the affected panel.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-transparent backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-7">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onOpenNav}
          aria-label="Open navigation"
        >
          <Menu className="size-4" aria-hidden />
        </Button>

        <div className="hidden min-w-0 lg:block">
          <p className="truncate text-[13px] font-medium text-foreground">{presentation.heading}</p>
          <p className="truncate text-[11px] text-muted-foreground">{session.scopeLabel}</p>
        </div>

        {presentation.search ? (
          <div className="ml-auto hidden flex-1 justify-center px-4 md:flex">
            <GlobalSearch workspace={workspace} />
          </div>
        ) : (
          <div className="ml-auto" />
        )}

        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          <HelpLauncher />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void refresh()}
                disabled={refreshing}
                aria-label="Refresh workspace data"
              >
                <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh all panels</TooltipContent>
          </Tooltip>
          <NotificationsMenu workspace={workspace} />
          {presentation.quickCreate ? <QuickCreateMenu /> : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" asChild aria-label="Account and security">
                <Link to={presentation.security as "/admin/security"}>
                  <ShieldCheck className="size-4" aria-hidden />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Account &amp; security</TooltipContent>
          </Tooltip>
          <Link
            to={presentation.security as "/admin/security"}
            aria-label={`Signed in as ${session.fullName}`}
            className="flex size-8 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary ring-1 ring-primary/20 transition-shadow hover:ring-primary/40"
          >
            {initialsOf(session.fullName)}
          </Link>
        </div>
      </div>
      {presentation.search ? (
        <div className="px-4 pb-3 md:hidden">
          <GlobalSearch workspace={workspace} />
        </div>
      ) : null}
    </header>
  );
}
