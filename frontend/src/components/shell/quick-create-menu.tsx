"use client";

import { useNavigate } from "@tanstack/react-router";
import { Building2, GitBranch, LayoutGrid, Package, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function QuickCreateMenu() {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Platform shortcuts">
          <LayoutGrid className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Platform shortcuts
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void navigate({ to: "/admin/clients" })}>
          <Building2 className="size-4" aria-hidden />
          Manage clients
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void navigate({ to: "/admin/users" })}>
          <UserPlus className="size-4" aria-hidden />
          Manage user IDs
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void navigate({ to: "/admin/settings" })}>
          <GitBranch className="size-4" aria-hidden />
          Manage branches
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void navigate({ to: "/admin/settings" })}>
          <Package className="size-4" aria-hidden />
          Manage service packages
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
