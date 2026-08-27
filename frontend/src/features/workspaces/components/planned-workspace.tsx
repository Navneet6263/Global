import { Link } from "@tanstack/react-router";
import { ArrowRight, Compass } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { ROLE_DEFINITIONS, type Role } from "@/config/roles";
import { PERMISSION_LABELS } from "@/config/permissions";
import type { Permission } from "@/config/permissions";

interface PlannedWorkspaceProps {
  title: string;
  description: string;
  role: Role;
  permissions: readonly Permission[];
  scope: readonly string[];
}

/**
 * Placeholder surface for workspaces whose detailed screens are designed in a
 * later phase. The route, roles and permissions already exist in the registry.
 */
export function PlannedWorkspace({
  title,
  description,
  role,
  permissions,
  scope,
}: PlannedWorkspaceProps) {
  const definition = ROLE_DEFINITIONS[role];

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        meta={<StatusBadge label="Phase 2 workspace" tone="review" />}
        actions={
          <Button asChild variant="outline">
            <Link to="/admin">
              Back to control tower
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Section
          title="What this workspace will own"
          description={definition.description}
          className="lg:col-span-2"
        >
          <ul className="space-y-3">
            {scope.map((entry) => (
              <li key={entry} className="flex gap-2.5 text-sm text-foreground">
                <Compass className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span className="text-muted-foreground">{entry}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Access already registered"
          description="Route, role and permission wiring is live."
        >
          <dl className="space-y-4 text-sm">
            <div className="space-y-1">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Primary role
              </dt>
              <dd className="text-foreground">{definition.label}</dd>
            </div>
            <div className="space-y-1.5">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Permissions
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {permissions.map((permission) => (
                  <StatusBadge
                    key={permission}
                    label={permission}
                    tone="neutral"
                    withDot={false}
                    className="font-mono text-[11px]"
                  />
                ))}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Scope model
              </dt>
              <dd className="text-muted-foreground">
                {definition.scopeFields.join(", ")} — enforced by the permission helpers.
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Example gate
              </dt>
              <dd className="text-muted-foreground">
                {PERMISSION_LABELS[permissions[0] ?? "case:read"]}
              </dd>
            </div>
          </dl>
        </Section>
      </div>
    </>
  );
}
