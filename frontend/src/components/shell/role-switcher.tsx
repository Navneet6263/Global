import { useNavigate, useLocation } from "@tanstack/react-router";
import { ArrowLeftRight, Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_DEFINITIONS, type Role } from "@/config/roles";
import { cachedIdentity } from "@/lib/auth/platform-session";
import { ROLE_HOME, rememberRole } from "@/lib/auth/role-home";

/** The role whose workspace the current page belongs to. */
function activeRole(roles: readonly Role[], pathname: string): Role | null {
  return (
    roles.find((role) => {
      const home = ROLE_HOME[role];
      return home ? pathname.startsWith(home.split("/").slice(0, 2).join("/")) : false;
    }) ?? null
  );
}

/**
 * "Working as" switch for people who hold more than one working role (for example RM +
 * Data Entry). Hidden for everyone else. The choice is remembered for the next sign-in.
 */
export function RoleSwitcher() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const roles = (cachedIdentity()?.roles ?? []).filter((role) => ROLE_HOME[role]);
  if (roles.length < 2) return null;
  const current = activeRole(roles, pathname) ?? roles[0]!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="role-switcher" aria-label="Switch role">
          <ArrowLeftRight aria-hidden />
          <span>
            <small>Working as</small>
            <strong>{ROLE_DEFINITIONS[current].label}</strong>
          </span>
          <ChevronDown aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-xl p-1.5">
        <DropdownMenuLabel>Switch role</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {roles.map((role) => (
          <DropdownMenuItem
            key={role}
            onSelect={() => {
              rememberRole(role);
              void navigate({ to: ROLE_HOME[role]! as "/" });
            }}
            className="flex items-start gap-2"
          >
            <Check
              aria-hidden
              className={`mt-0.5 size-4 shrink-0 ${role === current ? "text-blue-600" : "opacity-0"}`}
            />
            <span className="grid">
              <span className="text-[13px] font-semibold">{ROLE_DEFINITIONS[role].label}</span>
              <span className="text-[11px] text-slate-500">
                {ROLE_DEFINITIONS[role].description}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
