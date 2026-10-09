import { OnboardingActivity } from "./OnboardingActivity";
import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AtSign,
  BadgeCheck,
  Ban,
  Copy,
  Download,
  Eye,
  MessageSquareText,
  Search,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { AssignCompanyRmDialog } from "@/features/operations/clients/CompanyRmBoard";
import {
  activateOnboarding,
  downloadOnboardingDocument,
  getOnboarding,
  listOnboarding,
  messageOnboarding,
  rejectOnboarding,
  reviewOnboardingDocument,
  updateOnboardingCommercial,
  type OnboardingDetail,
  type OnboardingDocument,
} from "@/lib/backend-api/onboarding";
import { DocChip, DocIcon, ProgressRing } from "./onboarding-ui";
import {
  daysSince,
  docRowClass,
  fileSize,
  initialsOf,
  onboardingStatus,
  shortDate,
  shortDay,
} from "./onboarding-format";
import {
  getClientPricing,
  setClientDiscount,
  type ClientPricingRow,
} from "@/lib/backend-api/packages";

export interface OnboardingSearch {
  company?: string;
  view?: "NEEDS_RM" | "SUBMITTED" | "IN_PROGRESS";
  status?: "ACTIVE" | "SUSPENDED";
  q?: string;
  page?: number;
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : "Try again");

/** Self sign-up companies for Operations (approve), the RM (help) and Platform Admin (view). */
export function OpsOnboardingBoard({
  search,
  onChange,
  canAssignRm,
}: {
  search: OnboardingSearch;
  onChange: (patch: Partial<OnboardingSearch>) => void;
  canAssignRm: boolean;
}) {
  const [text, setText] = useState(search.q ?? "");
  useEffect(() => setText(search.q ?? ""), [search.q]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if ((search.q ?? "") !== text.trim())
        onChange({ q: text.trim() || undefined, page: undefined });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [text, search.q, onChange]);

  const page = search.page ?? 1;
  const list = useQuery({
    queryKey: [
      "onboarding",
      "list",
      search.status ?? "ONBOARDING",
      search.view ?? "ALL",
      search.q ?? "",
      page,
    ],
    queryFn: () =>
      listOnboarding({
        status: search.status ?? "ONBOARDING",
        view: search.view ?? "ALL",
        search: search.q,
        page,
        pageSize: 20,
      }),
    placeholderData: keepPreviousData,
  });
  const counts = list.data?.counts;
  const tiles = [
    { key: undefined, label: "In onboarding", value: counts?.all, tone: "" },
    {
      key: "SUBMITTED" as const,
      label: "Ready for review",
      value: counts?.submitted,
      tone: "is-info",
    },
    { key: "NEEDS_RM" as const, label: "Need an RM", value: counts?.needsRm, tone: "is-warn" },
    { key: "IN_PROGRESS" as const, label: "Still filling in", value: counts?.inProgress, tone: "" },
  ];
  const statusView = search.status ?? "ONBOARDING";

  return (
    <>
      {statusView === "ONBOARDING" ? (
        <div className="onb-kpis" role="group" aria-label="Filter sign-ups">
          {tiles.map((tile) => (
            <button
              key={tile.label}
              type="button"
              className={`onb-kpi ${tile.tone}`}
              aria-pressed={search.view === tile.key}
              onClick={() => onChange({ view: tile.key, page: undefined })}
            >
              <span>{tile.label}</span>
              <strong className="num">{tile.value ?? "—"}</strong>
            </button>
          ))}
        </div>
      ) : null}

      <section className="client-panel mt-4" aria-label="Signed-up companies">
        <header className="client-queue-heading">
          <div className="ops-segment" role="group" aria-label="Status">
            {(
              [
                ["ONBOARDING", "Onboarding"],
                ["ACTIVE", "Approved"],
                ["SUSPENDED", "Rejected"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={statusView === value}
                onClick={() =>
                  onChange({
                    status: value === "ONBOARDING" ? undefined : value,
                    view: undefined,
                    page: undefined,
                  })
                }
              >
                {label}
              </button>
            ))}
          </div>
          <form
            className="client-queue-search ops-inline-search"
            onSubmit={(event) => {
              event.preventDefault();
              onChange({ q: text.trim() || undefined, page: undefined });
            }}
          >
            <input
              type="search"
              value={text}
              maxLength={80}
              onChange={(event) => setText(event.target.value)}
              placeholder="Search company, email or code"
              aria-label="Search companies"
            />
            <button type="submit" aria-label="Search">
              <Search aria-hidden />
            </button>
          </form>
        </header>

        {list.isPending ? (
          <ListSkeleton rows={5} />
        ) : list.isError ? (
          <ErrorState title="Sign-ups could not load" description={list.error.message} />
        ) : list.data.items.length ? (
          <ul className="onb-board-list" aria-label="Sign-up companies">
            {list.data.items.map((row) => {
              const status = onboardingStatus(row);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className="onb-row"
                    onClick={() => onChange({ company: row.id })}
                  >
                    <ProgressRing percent={row.progress.percent} light small />
                    <span className="onb-row-main min-w-0">
                      <strong>{row.displayName}</strong>
                      <small>
                        {row.contactName ?? "—"} · {row.contactEmail ?? "no email"}
                      </small>
                      <span className="onb-row-flags">
                        <span
                          className={`onb-chip ${status.className === "is-review" ? "is-pending" : status.className === "is-live" ? "is-approved" : status.className === "is-closed" ? "is-rejected" : "is-missing"}`}
                        >
                          {status.label}
                        </span>
                        {row.flags.personalEmail ? (
                          <span className="onb-chip is-warn">
                            <AtSign className="size-3" aria-hidden /> Personal email
                          </span>
                        ) : null}
                        {row.flags.possibleDuplicates.length ? (
                          <span
                            className="onb-chip is-rejected"
                            title={row.flags.possibleDuplicates.join(", ")}
                          >
                            <Copy className="size-3" aria-hidden /> Possible duplicate
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="onb-row-cell">
                      {row.rm ? (
                        <>
                          {row.rm.name}
                          <small>RM</small>
                        </>
                      ) : (
                        <span className="flow-pill is-bad">No RM yet</span>
                      )}
                    </span>
                    <span className="onb-row-cell">
                      {row.progress.documentsUploaded}/{row.progress.documentsRequired} uploaded
                      <small>{row.progress.documentsApproved} approved</small>
                    </span>
                    <span className="onb-row-cell">
                      {row.submittedAt
                        ? `Submitted ${shortDay(row.submittedAt)}`
                        : `Signed up ${shortDay(row.signedUpAt)}`}
                      <small>{daysSince(row.submittedAt ?? row.signedUpAt)} day(s) waiting</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flow-empty">
            <BadgeCheck aria-hidden />
            <p>
              {statusView === "ONBOARDING"
                ? "No companies waiting. New sign-ups appear here automatically."
                : "Nothing here yet."}
            </p>
          </div>
        )}

        {list.data && list.data.total > list.data.pageSize ? (
          <footer className="client-queue-footer">
            <span>
              {list.data.total} compan{list.data.total === 1 ? "y" : "ies"}
            </span>
            <div className="client-pagination">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => onChange({ page: page - 1 > 1 ? page - 1 : undefined })}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * list.data.pageSize >= list.data.total}
                onClick={() => onChange({ page: page + 1 })}
              >
                Next
              </Button>
            </div>
          </footer>
        ) : null}
      </section>

      {search.company ? (
        <CompanySheet
          clientId={search.company}
          canAssignRm={canAssignRm}
          onClose={() => onChange({ company: undefined })}
        />
      ) : null}
    </>
  );
}

function CompanySheet({
  clientId,
  canAssignRm,
  onClose,
}: {
  clientId: string;
  canAssignRm: boolean;
  onClose: () => void;
}) {
  const detail = useQuery({
    queryKey: ["onboarding", "detail", clientId],
    queryFn: () => getOnboarding(clientId),
  });
  const [assigning, setAssigning] = useState(false);
  const [decision, setDecision] = useState<"activate" | "reject" | null>(null);
  const company = detail.data;
  const open = company?.status === "ONBOARDING";
  return (
    <Sheet open onOpenChange={(value) => (!value ? onClose() : undefined)}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[min(1120px,100vw)] lg:overflow-hidden"
      >
        {detail.isPending ? (
          <ListSkeleton rows={6} />
        ) : detail.isError ? (
          <ErrorState title="Company could not load" description={detail.error.message} />
        ) : company ? (
          <div className="grid lg:h-full lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="grid content-start gap-4 border-slate-200 bg-slate-50 p-6 lg:overflow-y-auto lg:border-r">
              <SheetHeader className="p-0 text-left">
                <div className="flex items-start gap-3">
                  <span className="onb-rm-avatar" aria-hidden>
                    {initialsOf(company.displayName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-lg">{company.displayName}</SheetTitle>
                    <SheetDescription>
                      {company.code} · signed up {shortDate(company.signedUpAt)}
                    </SheetDescription>
                    <div className="onb-row-flags">
                      <DocStatus company={company} />
                      {!company.canManage && !company.canMessage ? (
                        <span className="onb-viewonly">
                          <Eye className="size-3.5" aria-hidden /> View only
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <ProgressRing percent={company.progress.percent} light small />
                </div>
              </SheetHeader>

              {company.flags.personalEmail || company.flags.possibleDuplicates.length ? (
                <div className="onb-note mt-4" role="note">
                  <ShieldCheck aria-hidden />
                  <div>
                    <strong>Check before approving</strong>
                    {company.flags.personalEmail ? "Signed up with a personal email address. " : ""}
                    {company.flags.possibleDuplicates.length
                      ? `Same email domain or GSTIN as: ${company.flags.possibleDuplicates.join(", ")}.`
                      : ""}
                  </div>
                </div>
              ) : null}

              <section className="onb-sheet-section" aria-label="Company">
                <h3>Company</h3>
                <dl className="onb-facts">
                  <dt>Legal name</dt>
                  <dd>{company.legalName}</dd>
                  <dt>Contact</dt>
                  <dd>
                    {company.contactName ?? "—"}
                    <br />
                    {company.contactEmail ?? ""}{" "}
                    {company.contactPhone ? `· ${company.contactPhone}` : ""}
                  </dd>
                  <dt>GSTIN</dt>
                  <dd>{company.gstin ?? "—"}</dd>
                  <dt>PAN</dt>
                  <dd>{company.pan ?? "—"}</dd>
                  <dt>Billing address</dt>
                  <dd>{company.billingAddress ?? "—"}</dd>
                  <dt>Submitted</dt>
                  <dd>{company.submittedAt ? shortDate(company.submittedAt) : "Not yet"}</dd>
                </dl>
              </section>

              <section className="onb-sheet-section" aria-label="Relationship manager">
                <h3>Relationship manager</h3>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {company.rm ? (
                    <div className="onb-rm">
                      <span className="onb-rm-avatar" aria-hidden>
                        {initialsOf(company.rm.name)}
                      </span>
                      <div>
                        <strong>{company.rm.name}</strong>
                        <small>{company.rm.email}</small>
                      </div>
                    </div>
                  ) : (
                    <span className="flow-pill is-bad">
                      No RM yet — assign one to guide the company
                    </span>
                  )}
                  {canAssignRm && open ? (
                    <Button size="sm" variant="outline" onClick={() => setAssigning(true)}>
                      <UserPlus className="size-3.5" aria-hidden />
                      {company.rm ? "Change RM" : "Assign RM"}
                    </Button>
                  ) : null}
                </div>
              </section>

              {company.canManage && open ? (
                <div className="grid gap-2">
                  <Button onClick={() => setDecision("activate")}>
                    <BadgeCheck className="size-4" aria-hidden /> Approve & activate
                  </Button>
                  <Button variant="outline" onClick={() => setDecision("reject")}>
                    <Ban className="size-4" aria-hidden /> Reject sign-up
                  </Button>
                  {!company.canSetPrice ? (
                    <p className="text-[12px] text-slate-500">
                      You are this company's RM: you can approve it yourself. Prices come from the
                      package list; discounts stay within the limit Operations set.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="grid content-start gap-2 p-6 lg:overflow-y-auto">
              <section className="onb-sheet-section" aria-label="Documents">
                <h3>
                  Documents · {company.progress.documentsApproved}/
                  {company.progress.documentsRequired} approved
                </h3>
                <ul className="onb-docs">
                  {company.documents.map((document) => (
                    <ReviewRow
                      key={document.type}
                      clientId={company.id}
                      document={document}
                      canReview={company.canManage && open}
                    />
                  ))}
                </ul>
              </section>

              <Commercial company={company} editable={company.canManage && open} />

              {company.canMessage && open ? <MessageBox company={company} /> : null}

              {company.canManage && open && company.rates.some((rate) => rate.active) ? (
                <PackageDiscounts clientId={company.id} />
              ) : null}

              <OnboardingActivity clientId={company.id} />
            </div>

            {assigning ? (
              <AssignCompanyRmDialog
                company={{
                  id: company.id,
                  code: company.code,
                  name: company.displayName,
                  version: company.version,
                  primaryRm: company.rm
                    ? { id: company.rm.id, name: company.rm.name, active: true }
                    : null,
                  primaryRmAssignedAt: company.rmAssignedAt,
                  mappedRms: [],
                  openCases: 0,
                  casesWithoutRm: 0,
                }}
                onClose={() => setAssigning(false)}
              />
            ) : null}
            {decision ? (
              <DecisionDialog company={company} kind={decision} onClose={() => setDecision(null)} />
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DocStatus({ company }: { company: OnboardingDetail }) {
  const status = onboardingStatus(company);
  const chip =
    status.className === "is-review"
      ? "is-pending"
      : status.className === "is-live"
        ? "is-approved"
        : status.className === "is-closed"
          ? "is-rejected"
          : "is-missing";
  return <span className={`onb-chip ${chip}`}>{status.label}</span>;
}

function useRefresh(clientId: string) {
  const queryClient = useQueryClient();
  return async (data?: OnboardingDetail) => {
    if (data) queryClient.setQueryData(["onboarding", "detail", clientId], data);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["onboarding", "list"] }),
      queryClient.invalidateQueries({ queryKey: ["onboarding", "activity", clientId] }),
      queryClient.invalidateQueries({ queryKey: ["navigation-counts"] }),
    ]);
  };
}

function ReviewRow({
  clientId,
  document,
  canReview,
}: {
  clientId: string;
  document: OnboardingDocument;
  canReview: boolean;
}) {
  const refresh = useRefresh(clientId);
  const [mode, setMode] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [notes, setNotes] = useState("");
  const [checked, setChecked] = useState(false);
  const mutation = useMutation({
    mutationFn: () =>
      reviewOnboardingDocument(clientId, document, {
        status: mode!,
        notes: notes.trim(),
        signaturesChecked: checked,
      }),
    onSuccess: async (data) => {
      toast.success(
        mode === "APPROVED" ? `${document.label} approved` : `${document.label} sent back`,
      );
      setMode(null);
      await refresh(data);
    },
    onError: (error) => toast.error("Review not saved", { description: messageOf(error) }),
  });
  const start = (value: "APPROVED" | "REJECTED") => {
    setMode(value);
    setChecked(false);
    setNotes(value === "APPROVED" ? "Checked against the original; details match." : "");
  };
  return (
    <li className={`onb-doc ${docRowClass(document.state)}`}>
      <DocIcon state={document.state} />
      <div className="min-w-0">
        <div className="onb-doc-title">
          {document.label}
          <DocChip state={document.state} />
          {!document.required ? <span className="onb-chip is-optional">Optional</span> : null}
        </div>
        {document.file ? (
          <div className="onb-doc-file">
            <button
              type="button"
              onClick={() =>
                void downloadOnboardingDocument(clientId, document).catch((error: unknown) =>
                  toast.error("Download failed", { description: messageOf(error) }),
                )
              }
              title={document.file.name}
            >
              <Download className="mr-1 inline size-3.5" aria-hidden />
              {document.file.name}
            </button>
            <span>
              {fileSize(document.file.sizeBytes)} · r{document.file.revision} ·{" "}
              {shortDate(document.file.uploadedAt)}
              {document.signed && document.signedAt
                ? ` · signed ${document.signedAt.slice(0, 10)}`
                : ""}
            </span>
          </div>
        ) : (
          <p className="onb-doc-hint">Not uploaded yet.</p>
        )}
        {document.file?.reviewNotes && document.state !== "PENDING" ? (
          <p className="onb-doc-hint">Review: {document.file.reviewNotes}</p>
        ) : null}
        {mode ? (
          <form
            className="mt-3 grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <textarea
              className="min-h-16 w-full rounded-[10px] border border-slate-300 p-2 text-[13px]"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              minLength={10}
              maxLength={1000}
              placeholder={
                mode === "REJECTED" ? "What must the company fix? (shown to them)" : "Review note"
              }
              aria-label="Review note"
              required
            />
            <label className="auth-check">
              <Checkbox checked={checked} onCheckedChange={(value) => setChecked(value === true)} />
              <span>
                I opened the file and checked it
                {document.signed ? ", including signatures and date" : ""}.
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                variant={mode === "REJECTED" ? "destructive" : "default"}
                disabled={notes.trim().length < 10 || (mode === "APPROVED" && !checked)}
                loading={mutation.isPending}
              >
                {mode === "APPROVED" ? "Approve" : "Send back"}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
      {canReview && document.state === "PENDING" && !mode ? (
        <div className="onb-doc-actions">
          <Button size="sm" variant="outline" onClick={() => start("REJECTED")}>
            Send back
          </Button>
          <Button size="sm" onClick={() => start("APPROVED")}>
            Approve
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function Commercial({ company, editable }: { company: OnboardingDetail; editable: boolean }) {
  const refresh = useRefresh(company.id);
  const priceLocked = !company.canSetPrice;
  const initial = useMemo(() => {
    const byId = new Map(company.rates.map((rate) => [rate.servicePackageId, rate]));
    return company.catalog.map((item) => {
      const rate = byId.get(item.id);
      return {
        id: item.id,
        name: item.name,
        active: rate?.active ?? false,
        unitPrice: String(rate?.unitPrice ?? item.price ?? ""),
        taxRate: String(rate?.taxRate ?? 18),
        tatHours: rate?.tatHours ?? null,
      };
    });
  }, [company]);
  const [rows, setRows] = useState(initial);
  const [terms, setTerms] = useState(company.billingTerms ?? "Net 30 days");
  useEffect(() => setRows(initial), [initial]);
  const mutation = useMutation({
    mutationFn: () =>
      updateOnboardingCommercial(company.id, {
        version: company.version,
        billingTerms: terms.trim(),
        packages: rows
          .filter(
            (row) => row.active || company.rates.some((rate) => rate.servicePackageId === row.id),
          )
          .map((row) => ({
            servicePackageId: row.id,
            unitPrice: Number(row.unitPrice || 0),
            taxRate: Number(row.taxRate || 0),
            ...(row.tatHours ? { tatHours: row.tatHours } : {}),
            active: row.active,
          })),
      }),
    onSuccess: async (data) => {
      toast.success("Packages & pricing saved");
      await refresh(data);
    },
    onError: (error) => toast.error("Not saved", { description: messageOf(error) }),
  });
  const patch = (id: string, change: Partial<(typeof rows)[number]>) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...change } : row)));
  return (
    <section className="onb-sheet-section" aria-label="Packages and pricing">
      <h3>Packages & pricing</h3>
      {editable ? (
        <>
          {priceLocked ? (
            <p className="text-[12.5px] text-slate-500">
              Tick the packages this company uses. Prices are the package list prices; give a
              discount in Discounts after saving.
            </p>
          ) : null}
          <label className="grid gap-1 text-[12px] font-semibold text-slate-600">
            Billing terms
            <Input
              value={terms}
              onChange={(event) => setTerms(event.target.value)}
              maxLength={200}
            />
          </label>
          <div className="grid gap-2">
            <div className="onb-rate text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span />
              <span>Package</span>
              <span>Price (₹)</span>
              <span>GST %</span>
            </div>
            {rows.map((row) => (
              <div key={row.id} className="onb-rate">
                <Checkbox
                  checked={row.active}
                  onCheckedChange={(value) => patch(row.id, { active: value === true })}
                  aria-label={`Enable ${row.name}`}
                />
                <span className="truncate">{row.name}</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={row.unitPrice}
                  onChange={(event) => patch(row.id, { unitPrice: event.target.value })}
                  aria-label={`${row.name} price`}
                  disabled={!row.active || priceLocked}
                  title={priceLocked ? "List price — give a discount below instead" : undefined}
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={row.taxRate}
                  onChange={(event) => patch(row.id, { taxRate: event.target.value })}
                  aria-label={`${row.name} GST`}
                  disabled={!row.active || priceLocked}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              loading={mutation.isPending}
              disabled={terms.trim().length < 2 || !rows.some((row) => row.active)}
              onClick={() => mutation.mutate()}
            >
              Save packages
            </Button>
          </div>
        </>
      ) : company.rates.some((rate) => rate.active) ? (
        <ul className="grid gap-1 text-[13px]">
          {company.rates
            .filter((rate) => rate.active)
            .map((rate) => (
              <li key={rate.servicePackageId}>
                {rate.name} — ₹{rate.unitPrice.toLocaleString("en-IN")} + {rate.taxRate}% GST
              </li>
            ))}
          <li className="text-muted-foreground">Terms: {company.billingTerms ?? "—"}</li>
        </ul>
      ) : (
        <p className="text-[13px] text-muted-foreground">Not set yet.</p>
      )}
    </section>
  );
}

function MessageBox({ company }: { company: OnboardingDetail }) {
  const refresh = useRefresh(company.id);
  const [message, setMessage] = useState("");
  const mutation = useMutation({
    mutationFn: () => messageOnboarding(company.id, message.trim()),
    onSuccess: async (data) => {
      toast.success("Message sent", { description: "Shown in their portal and emailed." });
      setMessage("");
      await refresh(data);
    },
    onError: (error) => toast.error("Not sent", { description: messageOf(error) }),
  });
  return (
    <section className="onb-sheet-section" aria-label="Message the company">
      <h3>Message the company</h3>
      {company.note ? (
        <p className="text-[12.5px] text-muted-foreground">Last message: {company.note}</p>
      ) : null}
      <textarea
        className="min-h-17.5 w-full rounded-[10px] border border-slate-300 p-2 text-[13px]"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        maxLength={500}
        placeholder="e.g. Please upload the signed DPA with the company stamp."
        aria-label="Message to the company"
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          disabled={message.trim().length < 5}
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          <MessageSquareText className="size-3.5" aria-hidden /> Send
        </Button>
      </div>
    </section>
  );
}

function DecisionDialog({
  company,
  kind,
  onClose,
}: {
  company: OnboardingDetail;
  kind: "activate" | "reject";
  onClose: () => void;
}) {
  const refresh = useRefresh(company.id);
  const [text, setText] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      kind === "activate"
        ? activateOnboarding(company.id, {
            version: company.version,
            note: text.trim() || undefined,
          })
        : rejectOnboarding(company.id, { version: company.version, reason: text.trim() }),
    onSuccess: async (data) => {
      toast.success(kind === "activate" ? `${company.displayName} is live` : "Sign-up rejected");
      await refresh(data);
      onClose();
    },
    onError: (error) =>
      toast.error(kind === "activate" ? "Not activated" : "Not rejected", {
        description: messageOf(error),
      }),
  });
  const blockers = [
    ...company.progress.missing,
    ...(company.progress.documentsApproved < company.progress.documentsRequired
      ? ["all required documents approved"]
      : []),
    ...(company.progress.commercialDone ? [] : ["packages & billing terms"]),
  ];
  const invalid = kind === "reject" && text.trim().length < 10;
  return (
    <Dialog open onOpenChange={(value) => (!value && !mutation.isPending ? onClose() : undefined)}>
      <DialogContent className="ops-dialog sm:max-w-130">
        <DialogHeader>
          <DialogTitle>
            {kind === "activate" ? "Approve and activate" : "Reject sign-up"}
          </DialogTitle>
          <DialogDescription>{company.displayName}</DialogDescription>
        </DialogHeader>
        {kind === "activate" ? (
          blockers.length ? (
            <div className="flow-callout is-warn">
              <span>
                Still open: {blockers.join(", ")}. Activation will be refused until these are done.
              </span>
            </div>
          ) : (
            <div className="flow-callout is-info">
              <span>
                The company can create cases right away. They and their RM are notified by email.
              </span>
            </div>
          )
        ) : (
          <div className="flow-callout is-warn">
            <span>The company and its users are suspended and emailed this reason.</span>
          </div>
        )}
        <label className="ops-field">
          <span>
            {kind === "activate" ? "Welcome note (optional)" : "Reason (shown to the company)"}
          </span>
          <textarea
            rows={3}
            maxLength={500}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant={kind === "reject" ? "destructive" : "default"}
            disabled={invalid}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {kind === "activate" ? "Approve & activate" : "Reject sign-up"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Per-package discount for this company: an RM up to the package limit, Operations any. */
function PackageDiscounts({ clientId }: { clientId: string }) {
  const pricing = useQuery({
    queryKey: ["client-pricing", clientId],
    queryFn: () => getClientPricing(clientId),
  });
  return (
    <section className="onb-sheet-section" aria-label="Discounts">
      <h3>Discounts</h3>
      {pricing.isError ? (
        <p className="text-[13px] text-red-600">{pricing.error.message}</p>
      ) : !pricing.data ? (
        <ListSkeleton rows={2} />
      ) : (
        <ul className="grid gap-2">
          {pricing.data.items.map((row) => (
            <DiscountRow key={row.packageId} clientId={clientId} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DiscountRow({ clientId, row }: { clientId: string; row: ClientPricingRow }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(String(row.discountPercent));
  const percent = Number(value || 0);
  const tooHigh = percent > row.yourLimitPercent;
  const save = useMutation({
    mutationFn: () => setClientDiscount(clientId, row.packageId, { discountPercent: percent }),
    onSuccess: async () => {
      toast.success(`${row.name}: ${percent}% discount saved`);
      await queryClient.invalidateQueries({ queryKey: ["client-pricing", clientId] });
    },
    onError: (error) => toast.error("Discount not saved", { description: messageOf(error) }),
  });
  const final = Math.round(row.listPrice * (100 - Math.min(Math.max(percent, 0), 100))) / 100;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_110px_120px_auto]">
      <span className="min-w-0">
        <strong className="block truncate text-[13.5px] text-slate-900">{row.name}</strong>
        <small className="text-[12px] text-slate-500">
          List ₹{row.listPrice.toLocaleString("en-IN")} · you can give up to {row.yourLimitPercent}%
        </small>
      </span>
      <label className="flex items-center gap-1 text-[12.5px] text-slate-600">
        <input
          type="number"
          min={0}
          max={row.yourLimitPercent}
          step="0.5"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label={`${row.name} discount percent`}
          aria-invalid={tooHigh}
          className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-right"
        />
        %
      </label>
      <span className="text-[13px] font-semibold text-slate-900">
        ₹{final.toLocaleString("en-IN")}
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={tooHigh || percent < 0 || percent === row.discountPercent}
        loading={save.isPending}
        onClick={() => save.mutate()}
      >
        Save
      </Button>
      {tooHigh ? (
        <small className="col-span-full text-[12px] text-red-600">
          Above your limit of {row.yourLimitPercent}%. Ask Operations for more.
        </small>
      ) : null}
    </li>
  );
}
