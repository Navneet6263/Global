"use client";

import { useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/navigation/sidebar-nav";
import { BrandMark } from "./brand-mark";
import { AccountFooter } from "./account-footer";
import { TopToolbar } from "./top-toolbar";
import { ViewOnlyBanner } from "./view-only-banner";
import type { NavWorkspace } from "@/config/navigation";
import { WORKSPACE_PRESENTATION } from "@/config/workspace-presentation";
import { WorkspaceHelp } from "@/features/help/workspace-help";
import { LearningIntro } from "@/features/help/help-launcher";

interface AdminShellProps {
  children: ReactNode;
  workspace?: NavWorkspace;
}

export function AdminShell({ children, workspace = "platform-admin" }: AdminShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const presentation = WORKSPACE_PRESENTATION[workspace];

  return (
    <WorkspaceHelp workspace={workspace}>
      <div className="min-h-screen">
        <a
          href="#workspace-main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
        >
          Skip to main content
        </a>

        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
          <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-4">
            <BrandMark workspace={workspace} />
          </div>
          <div className="relative min-h-0 flex-1 overflow-y-auto">
            <SidebarNav workspace={workspace} />
          </div>
          <div className="relative">
            <AccountFooter workspace={workspace} />
          </div>
        </aside>

        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetContent side="left" className="w-[288px] gap-0 bg-sidebar p-0">
            <SheetHeader className="h-16 shrink-0 justify-center border-b border-sidebar-border px-4">
              <SheetTitle className="sr-only">{presentation.label} navigation</SheetTitle>
              <BrandMark workspace={workspace} />
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <SidebarNav workspace={workspace} onNavigate={() => setNavOpen(false)} />
            </div>
            <AccountFooter workspace={workspace} />
          </SheetContent>
        </Sheet>

        <div className="flex min-h-screen min-w-0 flex-col lg:pl-[248px]">
          <TopToolbar workspace={workspace} onOpenNav={() => setNavOpen(true)} />
          <main id="workspace-main" className="min-w-0 flex-1 px-4 py-5 lg:p-6">
            <div className="mx-auto w-full max-w-[1560px] space-y-4">
              <LearningIntro />
              <ViewOnlyBanner />
              {children}
            </div>
          </main>
        </div>
      </div>
    </WorkspaceHelp>
  );
}
