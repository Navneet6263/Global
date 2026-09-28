import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { OversightSearch } from "@/features/admin-dashboard/components/oversight-ui";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import type { SpocDomain } from "../contracts/spoc";
import type { SpocRecordsSearch } from "../config/spoc-search";
import {
  BUCKET_LABEL,
  DOMAIN_META,
  DOMAIN_STATUSES,
  HOLDER_LABEL,
  SPOC_ROLE_META,
} from "../config/spoc-meta";
import { useSpocFilters } from "../hooks/use-spoc";
import { label } from "../utils/spoc-format";

const control =
  "h-9 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground outline-none focus:border-primary/45";

/** Which users can own a record in each domain (real role codes). */
const ownerRole: Partial<
  Record<SpocDomain, { role: string; key: "ownerId" | "assigneeId"; text: string }>
> = {
  cases: { role: "OPS_MANAGER", key: "ownerId", text: "All ops owners" },
  tasks: { role: "VERIFIER", key: "assigneeId", text: "All verifiers" },
  visits: { role: "FIELD_EXECUTIVE", key: "assigneeId", text: "All field executives" },
  opportunities: { role: "SALES_MANAGER", key: "ownerId", text: "All sales owners" },
};

export function SpocRecordFilters({
  domain,
  search,
  onChange,
}: {
  domain: SpocDomain;
  search: SpocRecordsSearch;
  onChange: (patch: Partial<SpocRecordsSearch>) => void;
}) {
  const options = useSpocFilters();
  const [text, setText] = useState(search.search ?? "");
  const debounced = useDebouncedValue(text.trim());
  useEffect(() => {
    if (debounced !== (search.search ?? ""))
      onChange({ search: debounced || undefined, page: undefined });
  }, [debounced, onChange, search.search]);

  const owner = ownerRole[domain];
  const owners =
    options.data?.users.filter((user) => owner && user.roles.includes(owner.role)) ?? [];
  const statuses = DOMAIN_STATUSES[domain];
  const drill = search.bucket
    ? `${SPOC_ROLE_META[search.bucketRole ?? DOMAIN_META[domain].role].label} · ${BUCKET_LABEL[search.bucket]}`
    : search.holderRole
      ? `With ${HOLDER_LABEL[search.holderRole]}`
      : search.activeOnly
        ? "Active cases only"
        : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <OversightSearch value={text} onChange={setText} placeholder={DOMAIN_META[domain].search} />
      {domain === "qa" ? (
        <select
          aria-label="QA view"
          className={control}
          value={search.view ?? "awaiting"}
          onChange={(event) =>
            onChange({ view: event.target.value as SpocRecordsSearch["view"], page: undefined })
          }
        >
          <option value="awaiting">Awaiting claim</option>
          <option value="claimed">Claimed, under review</option>
          <option value="rework">Rework decisions</option>
          <option value="decided">All decisions</option>
        </select>
      ) : (
        <select
          aria-label={domain === "opportunities" ? "Stage" : "Status"}
          className={control}
          value={search.status ?? ""}
          onChange={(event) =>
            onChange({ status: event.target.value || undefined, page: undefined })
          }
        >
          <option value="">{domain === "opportunities" ? "All stages" : "All statuses"}</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {label(status)}
            </option>
          ))}
        </select>
      )}
      {owner ? (
        <select
          aria-label="Owner"
          className={control}
          value={search[owner.key] ?? ""}
          onChange={(event) =>
            onChange({ [owner.key]: event.target.value || undefined, page: undefined })
          }
        >
          <option value="">{owner.text}</option>
          {owners.map((user) => (
            <option key={user.id} value={user.id}>
              {user.displayName}
            </option>
          ))}
        </select>
      ) : null}
      {domain === "cases" || domain === "tasks" ? (
        <select
          aria-label="SLA"
          className={control}
          value={search.sla ?? ""}
          onChange={(event) =>
            onChange({
              sla: (event.target.value || undefined) as SpocRecordsSearch["sla"],
              page: undefined,
            })
          }
        >
          <option value="">Any SLA</option>
          <option value="overdue">Overdue</option>
          {domain === "cases" ? (
            <option value="approaching">Due within 8h</option>
          ) : (
            <option value="dueToday">Due today</option>
          )}
          {domain === "cases" ? <option value="healthy">On track</option> : null}
        </select>
      ) : null}
      {domain === "opportunities" ? (
        <select
          aria-label="Follow-up"
          className={control}
          value={search.followUp ?? ""}
          onChange={(event) =>
            onChange({
              followUp: (event.target.value || undefined) as SpocRecordsSearch["followUp"],
              page: undefined,
            })
          }
        >
          <option value="">Any follow-up</option>
          <option value="overdue">Follow-up overdue</option>
          <option value="none">No follow-up set</option>
        </select>
      ) : null}
      {drill ? (
        <button
          type="button"
          onClick={() =>
            onChange({
              bucket: undefined,
              bucketRole: undefined,
              holderRole: undefined,
              activeOnly: undefined,
              page: undefined,
            })
          }
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-primary"
        >
          {drill}
          <X className="size-3.5" aria-label="Clear drill-down" />
        </button>
      ) : null}
    </div>
  );
}
