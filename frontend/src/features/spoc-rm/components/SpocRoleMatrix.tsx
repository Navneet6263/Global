import { Link } from "@tanstack/react-router";
import { OversightPanel } from "@/features/admin-dashboard/components/oversight-ui";
import { cn } from "@/lib/utils";
import type { SpocRole, SpocRoleStatus } from "../contracts/spoc";
import {
  BUCKET_LABEL,
  SPOC_BUCKETS,
  SPOC_ROLE_META,
  bucketTarget,
  type SpocBucket,
} from "../config/spoc-meta";
import type { SpocScopeFilters } from "./SpocFilterBar";

const warnWhenPositive: readonly SpocBucket[] = ["overdue", "exceptions"];

function CellLink({
  role,
  bucket,
  value,
  scope,
}: {
  role: SpocRole;
  bucket: SpocBucket;
  value: number;
  scope: SpocScopeFilters;
}) {
  const target = bucketTarget(role, bucket);
  const className = cn(
    "num inline-flex min-w-9 justify-center rounded-full px-2 py-1 text-xs font-semibold transition hover:bg-primary/10 focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:outline-none",
    value > 0 && warnWhenPositive.includes(bucket)
      ? "bg-critical-soft text-critical-foreground"
      : "text-foreground",
  );
  const label = `${SPOC_ROLE_META[role].label} ${BUCKET_LABEL[bucket]}: ${value}`;
  if ("category" in target) {
    return (
      <Link
        to="/spoc-rm"
        search={{ ...scope, category: target.category }}
        className={className}
        aria-label={label}
      >
        {value}
      </Link>
    );
  }
  return (
    <Link
      to="/spoc-rm/records"
      search={{
        ...scope,
        domain: target.domain,
        bucket,
        bucketRole: target.bucketRole,
        status: target.status,
      }}
      className={className}
      aria-label={label}
    >
      {value}
    </Link>
  );
}

/** Cross-role status: which role holds how much work, and what is late or blocked. */
export function SpocRoleMatrix({
  rows,
  scope,
}: {
  rows: readonly SpocRoleStatus[];
  scope: SpocScopeFilters;
}) {
  return (
    <OversightPanel
      title="Work by role"
      description="Completed counts use the selected window. Select any number to open the records behind it."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-muted/35 text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
            <tr>
              <th className="px-5 py-3 font-semibold">Role</th>
              <th className="px-3 py-3 text-center font-semibold">Total</th>
              {SPOC_BUCKETS.map((bucket) => (
                <th key={bucket} className="px-3 py-3 text-center font-semibold">
                  {BUCKET_LABEL[bucket]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {rows.map((row) => {
              const meta = SPOC_ROLE_META[row.role];
              return (
                <tr key={row.role} className="transition hover:bg-mint-soft/25">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <meta.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">{meta.label}</p>
                        <p
                          className="mt-0.5 max-w-72 truncate text-[10px] text-muted-foreground"
                          title={row.basis}
                        >
                          {row.basis}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="num px-3 py-3 text-center text-xs font-semibold text-muted-foreground">
                    {row.total}
                  </td>
                  {SPOC_BUCKETS.map((bucket) => (
                    <td key={bucket} className="px-3 py-3 text-center">
                      <CellLink role={row.role} bucket={bucket} value={row[bucket]} scope={scope} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </OversightPanel>
  );
}
