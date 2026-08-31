"use client";

import { useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/navigation/sidebar-nav";
import { BrandMark } from "./brand-mark";
import { AccountFooter } from "./account-footer";
import { TopToolbar } from "./top-toolbar";
import type { NavWorkspace } from "@/config/navigation";
import { WORKSPACE_PRESENTATION } from "@/config/workspace-presentation";

interface AdminShellProps {
  children: ReactNode;
  workspace?: NavWorkspace;
}

export function AdminShell({ children, workspace = "platform-admin" }: AdminShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const presentation = WORKSPACE_PRESENTATION[workspace];

  return (
    <div className="min-h-screen">
      <a
        href="#workspace-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
      >
        Skip to main content
      </a>

      <aside className="fixed inset-y-3 left-3 z-40 hidden w-[254px] flex-col overflow-hidden rounded-[28px] lg:flex glow-panel">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40"
          style={{
            background:
              "radial-gradient(120% 100% at 20% 0%, oklch(0.92 0.07 158 / 0.5), transparent 70%)",
          }}
        />
        <div className="relative flex h-16 shrink-0 items-center px-4">
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

      <div className="flex min-h-screen flex-col lg:pl-[276px]">
        <TopToolbar workspace={workspace} onOpenNav={() => setNavOpen(true)} />
        <main id="workspace-main" className="flex-1 px-4 pt-3 pb-6 lg:px-7 lg:pt-3 lg:pb-8">
          <div className="mx-auto w-full max-w-[1560px] space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
