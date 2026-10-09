import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Info,
  Search,
  Sparkles,
  UserRoundCog,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { listAllUsers } from "@/lib/backend-api/users";
import {
  assignClientRm,
  clearClientRm,
  listClientRms,
  type ClientRmRow,
} from "@/lib/backend-api/workflow";
import { initials, istDateTime } from "../workspace/ops-queue-model";
import { IntakeRulesDialog } from "./IntakeRulesDialog";

export interface CompanySearch {
  view?: "without_rm" | "with_rm";
  q?: string;
  page?: number;
}

const PAGE = 15;

export function CompanyRmBoard({
  search,
  onChange,
}: {
  search: CompanySearch;
  onChange: (patch: Partial<CompanySearch>) => void;
}) {
  const [input, setInput] = useState(search.q ?? "");
  const [assigning, setAssigning] = useState<ClientRmRow>();
  const [ruling, setRuling] = useState<ClientRmRow>();
  useEffect(() => setInput(search.q ?? ""), [search.q]);
  const page = search.page ?? 1;
  const companies = useQuery({
    queryKey: ["workflow", "client-rms", search.view ?? "all", search.q ?? "", page],
    queryFn: ({ signal }) =>
      listClientRms({ view: search.view, search: search.q, page, pageSize: PAGE }, signal),
    placeholderData: keepPreviousData,
  });
  const queryClient = useQueryClient();
  const clear = useMutation({
    mutationFn: (row: ClientRmRow) => clearClientRm(row.id, row.version),
    onSuccess: async (_r, row) => {
      toast.success(`${row.name} no longer has a company RM`, {
        description: "Existing cases keep their RM. New cases will wait in Needs RM.",
      });
      await queryClient.invalidateQueries({ queryKey: ["workflow", "client-rms"] });
      await queryClient.invalidateQueries({ queryKey: ["navigation-counts"] });
    },
    onError: (error: Error) => toast.error("Not removed", { description: error.message }),
  });
  const data = companies.data;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE));
  const openWithoutRm = data?.items.reduce((sum, row) => sum + row.casesWithoutRm, 0) ?? 0;
  return (
    <>
      <section className="company-hero client-panel" aria-label="How company RMs work">
        <span className="company-hero-icon" aria-hidden>
          <Sparkles />
        </span>
        <div>
          <h2>One RM per company, assigned once</h2>
          <p>
            Every new case of a company goes to its RM automatically. When you assign or change the
            RM, you choose whether open cases move too. Every change is audited and the RM is
            notified.
          </p>
        </div>
        <dl className="company-hero-stats">
          <div className={data?.counts.withoutRm ? "is-bad" : "is-good"}>
            <dt>Companies without an RM</dt>
            <dd className="num">{data ? data.counts.withoutRm : "—"}</dd>
          </div>
          <div className={openWithoutRm ? "is-warn" : "is-good"}>
            <dt>Open cases without RM (this page)</dt>
            <dd className="num">{data ? openWithoutRm : "—"}</dd>
          </div>
        </dl>
      </section>
      <section className="client-panel" aria-label="Companies">
        <header className="client-queue-heading">
          <div className="ops-segment" role="group" aria-label="Filter companies">
            {[
              { value: undefined, label: "All companies" },
              { value: "without_rm" as const, label: "Without RM" },
              { value: "with_rm" as const, label: "With RM" },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                aria-pressed={search.view === item.value}
                onClick={() => onChange({ view: item.value, page: undefined })}
              >
                {item.label}
              </button>
            ))}
          </div>
          <form
            className="client-queue-search ops-inline-search"
            onSubmit={(event) => {
              event.preventDefault();
              onChange({ q: input.trim() || undefined, page: undefined });
            }}
          >
            <input
              type="search"
              value={input}
              maxLength={120}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Company name or code"
              aria-label="Search companies"
            />
            <button type="submit" aria-label="Search">
              <Search aria-hidden />
            </button>
          </form>
        </header>
        <div className="client-queue-feedback" role="status" aria-live="polite">
          {companies.isFetching ? "Updating…" : ""}
        </div>
        {companies.isError ? (
          <ErrorState
            description={companies.error.message}
            onRetry={() => void companies.refetch()}
            retrying={companies.isFetching}
          />
        ) : null}
        {companies.isPending ? <ListSkeleton rows={6} /> : null}
        {data ? (
          data.items.length ? (
            <ul className="company-list" aria-label="Company RM assignments">
              {data.items.map((row) => (
                <li key={row.id} className={row.primaryRm ? undefined : "is-missing"}>
                  <span className="company-name">
                    <span className="company-badge" aria-hidden>
                      <Building2 />
                    </span>
                    <span className="min-w-0">
                      <strong>{row.name}</strong>
                      <small>
                        {row.code}
                        {row.intakeRules?.clientReviewFirst ? " · Client reviews first" : ""}
                        {row.intakeRules?.defaultDataEntry
                          ? ` · Auto DE: ${row.intakeRules.defaultDataEntry.name}`
                          : ""}
                      </small>
                    </span>
                  </span>
                  <span className="company-rm">
                    {row.primaryRm ? (
                      <>
                        <span className="ops-avatar" aria-hidden>
                          {initials(row.primaryRm.name)}
                        </span>
                        <span className="min-w-0">
                          <strong>{row.primaryRm.name}</strong>
                          <small>
                            {row.primaryRm.active ? "Company RM" : "Inactive — choose another RM"}
                            {row.primaryRmAssignedAt
                              ? ` · since ${istDateTime(row.primaryRmAssignedAt)}`
                              : ""}
                          </small>
                        </span>
                      </>
                    ) : (
                      <span className="flow-pill is-bad">
                        <CircleAlert className="size-3" aria-hidden /> No company RM
                      </span>
                    )}
                  </span>
                  <span className="company-num">
                    <strong className="num">{row.openCases}</strong>
                    <small>open cases</small>
                  </span>
                  <span className="company-num">
                    <strong className={`num ${row.casesWithoutRm ? "ops-text-warn" : ""}`}>
                      {row.casesWithoutRm}
                    </strong>
                    <small>without RM</small>
                  </span>
                  <span className="flow-row-actions">
                    <Button
                      size="sm"
                      variant={row.primaryRm ? "outline" : "default"}
                      onClick={() => setAssigning(row)}
                    >
                      <UserRoundCog aria-hidden />
                      {row.primaryRm ? "Change RM" : "Assign RM"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRuling(row)}
                      aria-label={`Intake rules for ${row.name}`}
                    >
                      Intake rules
                    </Button>
                    {row.primaryRm ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={clear.isPending}
                        onClick={() => clear.mutate(row)}
                        aria-label={`Remove company RM from ${row.name}`}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flow-empty">
              <strong>
                {search.view === "without_rm" ? "Every company has an RM" : "No companies found"}
              </strong>
              {search.view === "without_rm"
                ? "New cases will reach an RM automatically."
                : "Try another search."}
            </div>
          )
        ) : null}
        <footer className="client-queue-footer">
          <span>{data ? `${data.total} companies` : ""}</span>
          <div className="client-pagination">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => onChange({ page: page - 1 })}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <span>
              Page {page} / {pages}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next page"
              disabled={page >= pages}
              onClick={() => onChange({ page: page + 1 })}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </footer>
      </section>
      {assigning ? (
        <AssignCompanyRmDialog company={assigning} onClose={() => setAssigning(undefined)} />
      ) : null}
      {ruling ? <IntakeRulesDialog company={ruling} onClose={() => setRuling(undefined)} /> : null}
    </>
  );
}

export function AssignCompanyRmDialog({
  company,
  onClose,
}: {
  company: ClientRmRow;
  onClose: () => void;
}) {
  const rms = useQuery({
    queryKey: ["users", "SPOC_RM", "all"],
    queryFn: () => listAllUsers("SPOC_RM"),
    staleTime: 60_000,
  });
  const [rmId, setRmId] = useState("");
  const [apply, setApply] = useState<"NONE" | "UNASSIGNED" | "ALL_OPEN">("UNASSIGNED");
  const [filter, setFilter] = useState("");
  const queryClient = useQueryClient();
  const options = (rms.data?.items ?? [])
    .filter((user) => user.status === "ACTIVE" && !user.client)
    .filter((user) =>
      `${user.displayName} ${user.email}`.toLowerCase().includes(filter.trim().toLowerCase()),
    )
    .sort((a, b) => {
      const aMapped = a.spocClients?.some((c) => c.id === company.id) ? 0 : 1;
      const bMapped = b.spocClients?.some((c) => c.id === company.id) ? 0 : 1;
      return aMapped - bMapped || a.displayName.localeCompare(b.displayName);
    });
  const mutation = useMutation({
    mutationFn: () =>
      assignClientRm(company.id, { rmUserId: rmId, version: company.version, apply }),
    onSuccess: async (result) => {
      const name = options.find((user) => user.id === rmId)?.displayName ?? "RM";
      toast.success(`${name} is now the RM for ${company.name}`, {
        description: result.casesMoved
          ? `${result.casesMoved} open case(s) moved to ${name}.`
          : "New cases will be assigned automatically.",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workflow"] }),
        queryClient.invalidateQueries({ queryKey: ["cases"] }),
        queryClient.invalidateQueries({ queryKey: ["navigation-counts"] }),
        queryClient.invalidateQueries({ queryKey: ["onboarding"] }),
      ]);
      onClose();
    },
    onError: (error: Error) => toast.error("RM not assigned", { description: error.message }),
  });
  const choices = [
    {
      value: "NONE" as const,
      title: "New cases only",
      detail: "Open cases keep their current RM.",
      help: "Only cases created from now on go to this RM. Every open case stays exactly where it is. Use it when you just want this RM for future work.",
    },
    {
      value: "UNASSIGNED" as const,
      title: "New cases + open cases without an RM",
      detail: `${company.casesWithoutRm} open case(s) waiting for an RM will move.`,
      help: "New cases go to this RM, and so do open cases that have no RM yet. Cases another RM is already handling are not touched. Safest for most companies, so it is recommended.",
      recommended: true,
    },
    {
      value: "ALL_OPEN" as const,
      title: "New cases + every open case",
      detail: `All ${company.openCases} open case(s) move to this RM, replacing any other RM.`,
      help: "Every open case of this company moves to this RM, even ones another RM is working on. Use it when the old RM is leaving or the whole company changes hands.",
    },
  ];
  return (
    <Dialog open onOpenChange={(open) => (!open && !mutation.isPending ? onClose() : undefined)}>
      <DialogContent className="ops-dialog sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{company.primaryRm ? "Change company RM" : "Assign company RM"}</DialogTitle>
          <DialogDescription>
            {company.name} · {company.openCases} open case(s)
            {company.primaryRm ? ` · current RM ${company.primaryRm.name}` : ""}
          </DialogDescription>
        </DialogHeader>
        <label className="ops-field">
          <span>Find RM</span>
          <input
            type="search"
            value={filter}
            maxLength={80}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Name or email"
          />
        </label>
        <div className="ops-rm-list" role="radiogroup" aria-label="RMs">
          {rms.isPending ? <p className="ops-dialog-note">Loading RMs…</p> : null}
          {rms.isError ? <p className="ops-dialog-note is-error">{rms.error.message}</p> : null}
          {rms.data && !options.length ? (
            <p className="ops-dialog-note">
              No active RM / SPOC users. Create one in user management first.
            </p>
          ) : null}
          {options.map((user) => {
            const current = user.id === company.primaryRm?.id;
            const mapped = user.spocClients?.some((c) => c.id === company.id);
            return (
              <label key={user.id} className={rmId === user.id ? "is-selected" : undefined}>
                <input
                  type="radio"
                  name="company-rm"
                  value={user.id}
                  checked={rmId === user.id}
                  disabled={current || mutation.isPending}
                  onChange={() => setRmId(user.id)}
                />
                <span className="ops-avatar" aria-hidden>
                  {initials(user.displayName)}
                </span>
                <span className="min-w-0 flex-1">
                  <strong>{user.displayName}</strong>
                  <small>
                    {user.email} · {user.spocClients?.length ?? 0} compan
                    {user.spocClients?.length === 1 ? "y" : "ies"}
                  </small>
                </span>
                {current ? (
                  <em>Current</em>
                ) : mapped ? (
                  <span className="flow-pill is-info">Already mapped</span>
                ) : null}
              </label>
            );
          })}
        </div>
        <fieldset className="apply-choices">
          <legend>Apply to</legend>
          {choices.map((choice) => (
            <label
              key={choice.value}
              className={apply === choice.value ? "is-selected" : undefined}
            >
              <input
                type="radio"
                name="apply"
                value={choice.value}
                checked={apply === choice.value}
                onChange={() => setApply(choice.value)}
              />
              <span>
                <strong>
                  {choice.title}
                  {choice.recommended ? (
                    <span className="flow-pill is-good ml-2">Recommended</span>
                  ) : null}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={`What does “${choice.title}” do? ${choice.help}`}
                        onClick={(event) => event.preventDefault()}
                        className="ml-1.5 inline-grid size-5 place-items-center rounded-full align-middle text-slate-400 hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                      >
                        <Info className="size-3.5" aria-hidden />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-72 text-[12.5px] leading-snug">
                      {choice.help}
                    </TooltipContent>
                  </Tooltip>
                </strong>
                <small>{choice.detail}</small>
              </span>
            </label>
          ))}
        </fieldset>
        {apply === "ALL_OPEN" && company.openCases - company.casesWithoutRm > 0 ? (
          <div className="flow-callout is-warn">
            <CircleAlert aria-hidden />
            <span>
              {company.openCases - company.casesWithoutRm} case(s) currently with another RM will
              move. Their documents, work and history stay with the case.
            </span>
          </div>
        ) : (
          <div className="flow-callout is-info">
            <CircleCheck aria-hidden />
            <span>The RM gets access to {company.name} automatically and is notified.</span>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!rmId} loading={mutation.isPending}>
            {company.primaryRm ? "Change RM" : "Assign RM"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
