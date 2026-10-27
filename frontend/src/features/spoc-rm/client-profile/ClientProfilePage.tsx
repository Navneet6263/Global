import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  FileSpreadsheet,
  FolderOpen,
  KeyRound,
  Loader2,
  Package,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { PresetReports } from "@/features/stakeholders/client/ClientMisReports";
import {
  TemporaryPasswordDialog,
  type TemporaryPasswordReceipt,
} from "@/features/users/components/temporary-password-dialog";
import { getRmClientProfile, type RmClientProfile } from "@/lib/backend-api/rm-client-profile";
import { cn } from "@/lib/utils";
import { PROFILE_TABS, type ProfileTab } from "./profile-tabs";
import { date, label } from "../utils/spoc-format";
import { downloadClientDossier } from "./client-dossier";
import { clearClientReturn } from "./client-return";
import {
  Card,
  Detail,
  ProfileBilling,
  ProfileCases,
  ProfileLogins,
  ProfilePackages,
  WorkLink,
} from "./ProfileSections";

/**
 * Everything about one client on one page for its RM: who they are, their cases and
 * reports, MIS, billing, packages and logins. Work that lives elsewhere opens there with
 * a "Back to <client>" bar.
 */
export function ClientProfilePage({
  clientId,
  tab,
  onTab,
}: {
  clientId: string;
  tab: ProfileTab;
  onTab: (tab: ProfileTab) => void;
}) {
  const profile = useQuery({
    queryKey: ["rm", "client-profile", clientId],
    queryFn: () => getRmClientProfile(clientId),
  });
  const [receipt, setReceipt] = useState<TemporaryPasswordReceipt | null>(null);
  // Back on the profile: the "Back to client" bar is no longer needed.
  useEffect(() => clearClientReturn(), []);
  const dossier = useMutation({
    mutationFn: (data: RmClientProfile) => downloadClientDossier(data),
    onSuccess: ({ cases, invoices }) =>
      toast.success("Client dossier downloaded", {
        description: `${cases} cases and ${invoices} invoices in one Excel file.`,
      }),
    onError: (error: Error) => toast.error("Download failed", { description: error.message }),
  });

  if (profile.isError)
    return (
      <div className="mx-auto max-w-[1400px] space-y-4">
        <BackLink />
        <ErrorState
          description={profile.error.message}
          onRetry={() => void profile.refetch()}
          retrying={profile.isFetching}
        />
      </div>
    );
  if (!profile.data)
    return (
      <div
        className="grid min-h-[50vh] place-items-center"
        role="status"
        aria-label="Loading client"
      >
        <Loader2 className="size-6 animate-spin text-blue-600" aria-hidden />
      </div>
    );

  const data = profile.data;
  const { company, numbers } = data;
  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <BackLink />
      <section className="relative overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/10">
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-blue-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 size-64 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-white/10 text-xl font-black ring-1 ring-white/15">
              {company.name.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-widest text-blue-300">
                {company.code} ·{" "}
                {company.source === "SELF_SIGNUP" ? "Self sign-up" : "Added by Sapling"}
              </p>
              <h1 className="mt-1 truncate text-3xl font-bold">{company.name}</h1>
              <p className="mt-1 truncate text-[12.5px] text-white/60">
                {[
                  company.legalName !== company.name ? company.legalName : null,
                  company.contactName,
                  company.contactEmail,
                  company.contactPhone,
                ]
                  .filter(Boolean)
                  .join(" · ") || "No contact details yet"}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 font-semibold",
                    company.status === "ACTIVE"
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "bg-amber-400/15 text-amber-300",
                  )}
                >
                  {label(company.status)}
                </span>
                <span className="text-white/55">
                  RM {company.rm ? company.rm.name : "not assigned"} · client since{" "}
                  {date(company.createdAt)}
                </span>
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[520px]">
            {[
              { label: "Open cases", value: numbers.openCases, tone: "text-white" },
              {
                label: "Overdue",
                value: numbers.overdueCases,
                tone: numbers.overdueCases ? "text-red-300" : "text-white",
              },
              { label: "Completed", value: numbers.completedCases, tone: "text-emerald-300" },
              {
                label: "Logins",
                value: data.users.length,
                tone: data.users.length ? "text-white" : "text-amber-300",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10"
              >
                <dt className="text-[11.5px] text-white/55">{item.label}</dt>
                <dd className={cn("mt-1 text-2xl font-bold", item.tone)}>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative mt-5 flex flex-wrap gap-2">
          <Button
            size="sm"
            className="bg-white text-slate-950 hover:bg-white/90"
            loading={dossier.isPending}
            onClick={() => dossier.mutate(data)}
          >
            <FileSpreadsheet aria-hidden /> Download client dossier (Excel)
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            onClick={() => onTab("cases")}
          >
            <FolderOpen aria-hidden /> Cases &amp; reports
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            onClick={() => onTab("reports")}
          >
            <BarChart3 aria-hidden /> MIS
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <nav
          className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 px-3 pt-2"
          aria-label="Client sections"
        >
          {PROFILE_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={tab === item.id}
              onClick={() => onTab(item.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-[12.5px] font-semibold transition",
                tab === item.id
                  ? "border-blue-600 text-slate-950"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              <item.icon className="size-3.5" aria-hidden />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="space-y-5 bg-slate-50/60 p-4 sm:p-6">
          {tab === "overview" ? <Overview profile={data} onTab={onTab} /> : null}
          {tab === "cases" ? <ProfileCases profile={data} /> : null}
          {tab === "reports" ? (
            <>
              <Card
                title="Client dossier"
                hint="One Excel file with a summary, every case, invoices with totals, packages and logins, colour-coded and ready to filter."
                action={
                  <Button
                    size="sm"
                    loading={dossier.isPending}
                    onClick={() => dossier.mutate(data)}
                  >
                    <FileSpreadsheet aria-hidden /> Download Excel
                  </Button>
                }
              >
                <p className="text-[12.5px] text-slate-600">
                  Final reports (PDF) download case by case from the Cases tab.
                </p>
              </Card>
              <Card title="MIS" hint="The same MIS the client sees, for any date range.">
                <PresetReports company={{ id: company.id, name: company.name }} />
              </Card>
            </>
          ) : null}
          {tab === "billing" ? <ProfileBilling profile={data} /> : null}
          {tab === "packages" ? <ProfilePackages profile={data} /> : null}
          {tab === "logins" ? <ProfileLogins profile={data} onReceipt={setReceipt} /> : null}
        </div>
      </section>
      <TemporaryPasswordDialog receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/spoc-rm/clients"
      className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-500 hover:text-slate-950"
    >
      <ArrowLeft className="size-3.5" aria-hidden /> My clients
    </Link>
  );
}

function Overview({
  profile,
  onTab,
}: {
  profile: RmClientProfile;
  onTab: (tab: ProfileTab) => void;
}) {
  const { company } = profile;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Card title="Company details">
        <dl className="grid gap-2 sm:grid-cols-2">
          <Detail label="Legal name">{company.legalName}</Detail>
          <Detail label="Code">{company.code}</Detail>
          <Detail label="Contact person">{company.contactName ?? "—"}</Detail>
          <Detail label="Contact email">{company.contactEmail ?? "—"}</Detail>
          <Detail label="Contact phone">{company.contactPhone ?? "—"}</Detail>
          <Detail label="SLA">
            {company.slaHours} hours ({Math.round(company.slaHours / 24)} days)
          </Detail>
          <Detail label="GSTIN">{company.gstin ?? "—"}</Detail>
          <Detail label="Company RM">
            {company.rm
              ? `${company.rm.name}${company.rm.since ? ` · since ${date(company.rm.since)}` : ""}`
              : "No company RM"}
          </Detail>
          <div className="sm:col-span-2">
            <Detail label="Billing address">{company.billingAddress ?? "—"}</Detail>
          </div>
        </dl>
      </Card>
      <div className="space-y-5">
        <Card
          title="Work for this client"
          hint="Opens the page with this client; a bar brings you back here."
        >
          <div className="flex flex-wrap gap-2">
            <WorkLink client={company} page="records">
              Cases in Records
            </WorkLink>
            <WorkLink client={company} page="mis">
              Company MIS
            </WorkLink>
            <WorkLink client={company} page="pricing">
              Client pricing
            </WorkLink>
            <WorkLink client={company} page="payments">
              Payments
            </WorkLink>
          </div>
        </Card>
        <Card title="At a glance">
          <ul className="space-y-2 text-[13px]">
            <Glance
              icon={FolderOpen}
              text={`${profile.numbers.openCases} open, ${profile.numbers.overdueCases} overdue`}
              onClick={() => onTab("cases")}
            />
            <Glance
              icon={Package}
              text={`${profile.packages.items.length} packages ${profile.packages.agreement ? "in their agreement" : "(all active)"}`}
              onClick={() => onTab("packages")}
            />
            <Glance
              icon={KeyRound}
              text={
                profile.users.length
                  ? `${profile.users.length} Client Admin login${profile.users.length > 1 ? "s" : ""}`
                  : "No Client Admin login yet"
              }
              onClick={() => onTab("logins")}
            />
            <Glance icon={Building2} text={`Status: ${label(company.status)}`} />
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Glance({
  icon: Icon,
  text,
  onClick,
}: {
  icon: LucideIcon;
  text: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-700">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="text-slate-700">{text}</span>
    </>
  );
  return (
    <li>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-slate-50"
        >
          {content}
        </button>
      ) : (
        <span className="flex items-center gap-3 px-2 py-1.5">{content}</span>
      )}
    </li>
  );
}
