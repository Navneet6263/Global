"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { navFor, type NavGroupId, type NavWorkspace } from "@/config/navigation";
import { NavItemLink } from "./nav-item-link";
import { sessionForNav } from "@/lib/auth/session";
import { isVisible } from "@/lib/permissions";
import { cn } from "@/lib/utils";

interface SidebarNavProps {
  onNavigate?: () => void;
  workspace?: NavWorkspace;
}

export function SidebarNav({ onNavigate, workspace = "platform-admin" }: SidebarNavProps) {
  const session = sessionForNav(workspace);
  const { groups, items: navItems } = navFor(workspace);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (id: NavGroupId) =>
    setCollapsed((current) => ({ ...current, [id]: !current[id] }));

  return (
    <nav aria-label={`${workspace} navigation`} className="space-y-5 px-3 py-4">
      {groups.map((group) => {
        const items = navItems.filter(
          (item) => item.group === group.id && isVisible(session, item),
        );
        if (items.length === 0) return null;
        const isOpen = !collapsed[group.id];

        return (
          <div key={group.id} className="space-y-1">
            <button
              type="button"
              onClick={() => toggle(group.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1 text-[11px] font-semibold tracking-[0.09em] text-muted-foreground uppercase transition-colors hover:text-foreground"
            >
              {group.label}
              <ChevronDown
                className={cn("size-3.5 transition-transform", isOpen ? "" : "-rotate-90")}
                aria-hidden
              />
            </button>
            {isOpen ? (
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavItemLink key={item.route} item={item} onNavigate={onNavigate} />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
