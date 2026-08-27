"use client";

import { useNavigate } from "@tanstack/react-router";
import { Building2, GitBranch, Package, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { notifyPendingIntegration } from "@/lib/feedback/notify";

export function QuickCreateMenu() {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Quick create">
          <Plus className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Quick create
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void navigate({ to: "/admin/clients" })}>
          <Building2 className="size-4" aria-hidden />
          Add client
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void navigate({ to: "/admin/users" })}>
          <UserPlus className="size-4" aria-hidden />
          Create user ID
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void navigate({ to: "/admin/settings" })}>
          <GitBranch className="size-4" aria-hidden />
          Add branch
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => notifyPendingIntegration("Add service package")}>
          <Package className="size-4" aria-hidden />
          Add service package
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
