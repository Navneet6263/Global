"use client";

import { Activity, MoreHorizontal, ShieldCheck, ShieldOff, Pencil } from "lucide-react";
import type { PlatformUser } from "@/lib/contracts/user";
import { ROLE_DEFINITIONS } from "@/config/roles";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateTime, initialsOf } from "@/lib/formatting";
import { USER_STATUS_META } from "../user-status-meta";

interface UserTableProps {
  rows: readonly PlatformUser[];
  busyUserIds?: readonly string[];
  onToggleStatus: (user: PlatformUser) => void;
  onResetPassword: (user: PlatformUser) => void;
  onViewActivity: (user: PlatformUser) => void;
  onEditRoles: (user: PlatformUser) => void;
}

export function UserTable({
  rows,
  busyUserIds = [],
  onToggleStatus,
  onResetPassword,
  onViewActivity,
  onEditRoles,
}: UserTableProps) {
  const showMfa = rows.some((user) => user.mfaEnabled !== null);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
            <th scope="col" className="px-5 py-2.5">
              User
            </th>
            <th scope="col" className="px-3 py-2.5">
              Roles
            </th>
            <th scope="col" className="px-3 py-2.5">
              Scope
            </th>
            {showMfa ? (
              <th scope="col" className="px-3 py-2.5">
                MFA
              </th>
            ) : null}
            <th scope="col" className="px-3 py-2.5">
              Status
            </th>
            <th scope="col" className="px-3 py-2.5">
              Last login
            </th>
            <th scope="col" className="w-12 px-3 py-2.5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((user) => (
            <tr
              key={user.id}
              className="border-b border-border/70 last:border-0 hover:bg-accent/35"
            >
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                    {initialsOf(user.fullName)}
                  </span>
                  <span className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onViewActivity(user)}
                      className="block max-w-full cursor-pointer truncate text-left text-[13px] font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                    >
                      {user.fullName}
                    </button>
                    <span className="num block truncate text-[11px] text-muted-foreground">
                      {user.employeeId ? `${user.employeeId} · ${user.email}` : user.email}
                    </span>
                  </span>
                </div>
              </td>
              <td className="px-3 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {user.roles.map((role) => (
                    <StatusBadge
                      key={role}
                      label={ROLE_DEFINITIONS[role].label}
                      tone={role === "PLATFORM_ADMIN" ? "review" : "neutral"}
                      withDot={false}
                    />
                  ))}
                </div>
              </td>
              <td className="px-3 py-3 text-[12px] text-muted-foreground">
                {user.branchScope.length > 0 ? user.branchScope.join(", ") : "All branches"}
              </td>
              {showMfa ? (
                <td className="px-3 py-3">
                  {user.mfaEnabled === true ? (
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-success-foreground">
                      <ShieldCheck className="size-3.5" aria-hidden />
                      Enabled
                    </span>
                  ) : user.mfaEnabled === false ? (
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-critical-foreground">
                      <ShieldOff className="size-3.5" aria-hidden />
                      Off
                    </span>
                  ) : (
                    <span className="text-[12px] text-muted-foreground">Not available</span>
                  )}
                </td>
              ) : null}
              <td className="px-3 py-3">
                <StatusBadge
                  label={USER_STATUS_META[user.status].label}
                  tone={USER_STATUS_META[user.status].tone}
                />
              </td>
              <td className="px-3 py-3 text-[12px] text-muted-foreground">
                {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never"}
              </td>
              <td className="px-3 py-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      loading={busyUserIds.includes(user.id)}
                      aria-label={`Actions for ${user.fullName}`}
                    >
                      <MoreHorizontal className="size-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 rounded-2xl">
                    <DropdownMenuItem
                      disabled={busyUserIds.includes(user.id)}
                      onSelect={() => onEditRoles(user)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      Edit roles
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onViewActivity(user)}>
                      <Activity className="size-3.5" aria-hidden />
                      View activity timeline
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={busyUserIds.includes(user.id)}
                      onSelect={() => onResetPassword(user)}
                    >
                      Reset password
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={busyUserIds.includes(user.id)}
                      onSelect={() => onToggleStatus(user)}
                    >
                      {user.status === "suspended" ? "Reactivate access" : "Suspend access"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
