import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, FileText, KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/feedback/error-state";
import { TableSkeleton } from "@/components/feedback/skeletons";
import { StatusBadge } from "@/components/feedback/status-badge";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { Button } from "@/components/ui/button";
import type { TemporaryPasswordReceipt } from "@/features/users/components/temporary-password-dialog";
import { temporaryPassword } from "@/lib/auth/temporary-password";
import { DocChip } from "@/features/onboarding/onboarding-ui";
import { getOnboarding } from "@/lib/backend-api/onboarding";
import { downloadCaseReport } from "@/lib/backend-api/reports";
import {
  resetRmClientAdminPassword,
  type RmClientProfile,
} from "@/lib/backend-api/rm-client-profile";
import { formatInr } from "@/lib/formatting";
import { spocApi } from "../api/spoc-api";
import { HOLDER_LABEL, statusTone } from "../config/spoc-meta";
import type { SpocCaseRow } from "../contracts/spoc";
import { useSpocRecords } from "../hooks/use-spoc";
import { date, dateTime, label } from "../utils/spoc-format";
import { rememberClientReturn } from "./client-return";

const profileTone = (status: string) =>
  status === "ACTIVE" ? "success" : status === "SUSPENDED" ? "critical" : "warning";

export function Card({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      aria-label={title}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold text-slate-900">{title}</h3>
          {hint ? <p className="mt-0.5 text-[12px] text-slate-500">{hint}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Detail({ label: title, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{title}</dt>
      <dd className="mt-0.5 break-words text-[13px] font-medium text-slate-900">{children}</dd>
    </div>
  );
}

export type WorkPage = "records" | "mis" | "pricing" | "payments" | "setup";

/** A link to another RM page, opened for this client, that remembers where to come back. */
export function WorkLink({
  client,
  page,
  children,
}: {
  client: RmClientProfile["company"];
  page: WorkPage;
  children: ReactNode;
}) {
  const props = {
    onClick: () => rememberClientReturn({ id: client.id, name: client.name }),
    className:
      "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700",
  };
  const body = (
    <>
      {children}
      <ArrowUpRight className="size-3.5" aria-hidden />
    </>
  );
  if (page === "records")
    return (
      <Link to="/spoc-rm/records" search={{ domain: "cases", clientId: client.id }} {...props}>
        {body}
      </Link>
    );
  if (page === "mis")
    return (
      <Link to="/spoc-rm/mis" search={{ client: client.id }} {...props}>
        {body}
      </Link>
    );
  if (page === "setup")
    return (
      <Link to="/spoc-rm/onboarding" search={{ company: client.id }} {...props}>
        {body}
      </Link>
    );
  if (page === "pricing")
    return (
      <Link to="/spoc-rm/pricing" search={{ client: client.id }} {...props}>
        {body}
      </Link>
    );
  return (
    <Link to="/spoc-rm/payments" {...props}>
      {body}
    </Link>
  );
}

export function ProfileLogins({
  profile,
  onReceipt,
}: {
  profile: RmClientProfile;
  onReceipt: (receipt: TemporaryPasswordReceipt) => void;
}) {
  const reset = useMutation({
    mutationFn: async (user: RmClientProfile["users"][number]) => {
      const password = temporaryPassword();
      const result = await resetRmClientAdminPassword(profile.company.id, user.id, password);
      return { user, password, emailed: result.emailed === true };
    },
    onSuccess: ({ user, password, emailed }) =>
      onReceipt({
        kind: "reset",
        fullName: user.displayName,
        email: user.email,
        password,
        emailed,
      }),
    onError: (error: Error) => toast.error("Password not reset", { description: error.message }),
  });
  return (
    <Card
      title="Client Admin logins"
      hint="People at this company who start verifications and download reports. A reset signs them out and emails a new temporary password."
    >
      {profile.users.length ? (
        <ul className="grid gap-2" aria-label="Client Admin logins">
          {profile.users.map((user) => (
            <li
              key={user.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-4 py-3"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-50 text-[12.5px] font-bold text-blue-700">
                {user.displayName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("")}
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-[13.5px] text-slate-900">
                  {user.displayName}
                </strong>
                <small className="flex items-center gap-1 truncate text-[12px] text-slate-500">
                  <Mail className="size-3" aria-hidden />
                  {user.email}
                  {user.phone ? ` · ${user.phone}` : ""}
                </small>
                <small className="block text-[11.5px] text-slate-500">
                  {user.lastLoginAt
                    ? `Last signed in ${dateTime(user.lastLoginAt)}`
                    : "Never signed in"}
                  {user.mustChangePassword ? " · must set a new password" : ""}
                </small>
              </span>
              <StatusBadge label={label(user.status)} tone={profileTone(user.status)} />
              <Button
                size="sm"
                variant="outline"
                disabled={user.status !== "ACTIVE" || reset.isPending}
                loading={reset.isPending && reset.variables?.id === user.id}
                onClick={() => reset.mutate(user)}
                aria-label={`Reset password for ${user.displayName}`}
              >
                <KeyRound aria-hidden /> Reset password
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          No Client Admin login yet. Ask the Admin to create one in User IDs &amp; Access (role
          Client Admin, this company).
        </p>
      )}
    </Card>
  );
}

export function ProfileDocuments({ profile }: { profile: RmClientProfile }) {
  const detail = useQuery({
    queryKey: ["onboarding", "detail", profile.company.id],
    queryFn: () => getOnboarding(profile.company.id),
  });
  const documents = detail.data?.documents ?? [];
  return (
    <Card
      title="Documents"
      hint="Agreements and KYC for this company. Add, replace or review them in Company onboarding."
      action={
        <WorkLink client={profile.company} page="setup">
          Add or review documents
        </WorkLink>
      }
    >
      {detail.isError ? (
        <ErrorState
          description={detail.error.message}
          onRetry={() => void detail.refetch()}
          retrying={detail.isFetching}
        />
      ) : !detail.data ? (
        <TableSkeleton rows={5} />
      ) : (
        <ul className="grid gap-2" aria-label="Company documents">
          {documents.map((document) => (
            <li
              key={document.type}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
            >
              <span className="min-w-0">
                <strong className="block text-[13.5px] text-slate-900">{document.label}</strong>
                <small className="text-[12px] text-slate-500">
                  {document.file ? document.file.name : "Not uploaded yet"}
                  {document.required ? "" : " · optional"}
                </small>
              </span>
              <DocChip state={document.state} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ProfilePackages({ profile }: { profile: RmClientProfile }) {
  return (
    <Card
      title="Packages they can use"
      hint={
        profile.packages.agreement
          ? "Only the packages in this company's agreement."
          : "No agreement set, so every active package at its list price."
      }
      action={
        <div className="flex flex-wrap gap-2">
          <WorkLink client={profile.company} page="setup">
            Change packages
          </WorkLink>
          <WorkLink client={profile.company} page="pricing">
            Change discount
          </WorkLink>
        </div>
      }
    >
      {profile.packages.items.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="py-2 font-medium">Package</th>
                <th className="py-2 text-right font-medium">List price</th>
                <th className="py-2 text-right font-medium">Discount</th>
                <th className="py-2 text-right font-medium">They pay</th>
              </tr>
            </thead>
            <tbody>
              {profile.packages.items.map((pkg) => (
                <tr key={pkg.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 font-medium text-slate-900">{pkg.name}</td>
                  <td className="py-2.5 text-right">
                    {pkg.price === null ? "—" : formatInr(pkg.price)}
                  </td>
                  <td className="py-2.5 text-right">
                    {pkg.discountPercent ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[12px] font-semibold text-emerald-700">
                        −{pkg.discountPercent}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2.5 text-right font-semibold text-slate-900">
                    {pkg.price === null
                      ? "—"
                      : formatInr(Math.round(pkg.price * (1 - pkg.discountPercent / 100)))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[13px] text-slate-500">No active packages.</p>
      )}
    </Card>
  );
}

async function downloadLatestReport(row: SpocCaseRow) {
  const detail = await spocApi.caseDetail(row.id);
  const report = detail.reports.find((item) => item.canDownload);
  if (!report) throw new Error("No released report to download yet");
  await downloadCaseReport(row.id, report.id, row.caseNumber);
}

export function ProfileCases({ profile }: { profile: RmClientProfile }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const cases = useSpocRecords("cases", {
    clientId: profile.company.id,
    page,
    pageSize: 15,
    search: search.trim() || undefined,
  });
  const report = useMutation({
    mutationFn: downloadLatestReport,
    onError: (error: Error) => toast.error("Report not downloaded", { description: error.message }),
  });
  const data = cases.data;
  return (
    <Card
      title="Cases"
      hint="Every case of this company. Released reports download straight from here."
      action={
        <WorkLink client={profile.company} page="records">
          Open in Records
        </WorkLink>
      }
    >
      <input
        type="search"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        placeholder="Search candidate or case number"
        aria-label="Search cases"
        className="mb-3 h-9 w-full max-w-sm rounded-xl border border-slate-200 px-3 text-[13px] outline-none focus:border-blue-400"
      />
      {cases.isError ? (
        <ErrorState
          description={cases.error.message}
          onRetry={() => void cases.refetch()}
          retrying={cases.isFetching}
        />
      ) : !data ? (
        <TableSkeleton rows={5} />
      ) : data.items.length ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]" aria-label="Client cases">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="py-2 font-medium">Candidate</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">With</th>
                  <th className="py-2 font-medium">Checks</th>
                  <th className="py-2 font-medium">Due</th>
                  <th className="py-2 text-right font-medium">Report</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5">
                      <strong className="block text-slate-900">{row.candidateName}</strong>
                      <small className="text-[11.5px] text-slate-500">{row.caseNumber}</small>
                    </td>
                    <td className="py-2.5">
                      <StatusBadge label={label(row.status)} tone={statusTone(row.status)} />
                    </td>
                    <td className="py-2.5 text-slate-700">{HOLDER_LABEL[row.holderRole]}</td>
                    <td className="py-2.5 text-slate-700">
                      {row.checksCompleted}/{row.checksTotal}
                    </td>
                    <td
                      className={`py-2.5 ${row.overdue ? "font-semibold text-red-600" : "text-slate-700"}`}
                    >
                      {date(row.dueAt)}
                      {row.overdue ? " · overdue" : ""}
                    </td>
                    <td className="py-2.5 text-right">
                      {row.completedAt ? (
                        <Button
                          size="sm"
                          variant="outline"
                          loading={report.isPending && report.variables?.id === row.id}
                          onClick={() => report.mutate(row)}
                          aria-label={`Download report for ${row.candidateName}`}
                        >
                          <FileText aria-hidden /> PDF
                        </Button>
                      ) : (
                        <span className="text-[12px] text-slate-400">In progress</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.total > data.pageSize ? (
            <div className="mt-3">
              <PaginationBar
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPageChange={setPage}
                label="cases"
              />
            </div>
          ) : null}
        </>
      ) : (
        <p className="py-8 text-center text-[13px] text-slate-500">
          {search ? "No case matches this search." : "No cases yet."}
        </p>
      )}
    </Card>
  );
}

export function ProfileBilling({ profile }: { profile: RmClientProfile }) {
  const [page, setPage] = useState(1);
  const invoices = useSpocRecords("invoices", {
    clientId: profile.company.id,
    page,
    pageSize: 15,
  });
  const data = invoices.data;
  const due = data?.items.reduce((sum, row) => sum + row.balance, 0) ?? 0;
  return (
    <Card
      title="Invoices"
      hint="Bills raised to this company and what is still due."
      action={
        <WorkLink client={profile.company} page="payments">
          Record a payment
        </WorkLink>
      }
    >
      {invoices.isError ? (
        <ErrorState
          description={invoices.error.message}
          onRetry={() => void invoices.refetch()}
          retrying={invoices.isFetching}
        />
      ) : !data ? (
        <TableSkeleton rows={4} />
      ) : data.items.length ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]" aria-label="Invoices">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="py-2 font-medium">Invoice</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Due</th>
                  <th className="py-2 text-right font-medium">Total</th>
                  <th className="py-2 text-right font-medium">Paid</th>
                  <th className="py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 font-medium text-slate-900">{row.invoiceNumber}</td>
                    <td className="py-2.5">
                      <StatusBadge label={label(row.status)} tone={statusTone(row.status)} />
                    </td>
                    <td className="py-2.5 text-slate-700">{date(row.dueAt)}</td>
                    <td className="py-2.5 text-right">{formatInr(row.totalAmount)}</td>
                    <td className="py-2.5 text-right">{formatInr(row.paidAmount)}</td>
                    <td
                      className={`py-2.5 text-right font-semibold ${row.balance > 0 ? "text-amber-700" : "text-emerald-700"}`}
                    >
                      {formatInr(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="pt-3 text-right text-[12px] text-slate-500">
                    Due on this page
                  </td>
                  <td className="pt-3 text-right text-[14px] font-bold text-slate-900">
                    {formatInr(due)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {data.total > data.pageSize ? (
            <div className="mt-3">
              <PaginationBar
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPageChange={setPage}
                label="invoices"
              />
            </div>
          ) : null}
        </>
      ) : (
        <p className="py-8 text-center text-[13px] text-slate-500">No invoices yet.</p>
      )}
    </Card>
  );
}
