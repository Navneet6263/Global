import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Check as Tick, MessageSquareText, PartyPopper } from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  ErrorText,
  Loading,
  Meter,
  SOFT,
  type Tone,
} from "@/kit";
import { cn } from "@/lib/utils";
import { getMyOnboarding, type OnboardingCompany } from "@/lib/backend-api/onboarding";
import { cachedIdentity, clearIdentity } from "@/lib/auth/platform-session";
import { Check, CompanyDetails, DocumentRow, SubmitCard } from "./ClientOnboardingParts";
import { onboardingStatus } from "./onboarding-format";

const JOURNEY = ["Account", "Company details", "Documents", "Operations review", "Live"];

function journeyIndex(company: OnboardingCompany) {
  if (company.status === "ACTIVE") return 5;
  if (company.submittedAt) return 3;
  if (company.progress.detailsDone && company.progress.documentsUploaded > 0) return 2;
  return 1;
}

function statusTone(company: OnboardingCompany): Tone {
  if (company.status === "ACTIVE") return "good";
  if (company.status === "SUSPENDED") return "bad";
  if (company.submittedAt) return "note";
  return "brand";
}

export function ClientOnboardingPage() {
  const query = useQuery({ queryKey: ["onboarding", "me"], queryFn: getMyOnboarding });
  const company = query.data;

  // Approved while this tab had the old (onboarding) session: reload the identity once.
  useEffect(() => {
    if (company?.status === "ACTIVE" && cachedIdentity()?.clientStatus === "ONBOARDING") {
      clearIdentity();
    }
  }, [company?.status]);

  if (query.isPending) return <Loading>Loading your onboarding…</Loading>;
  if (query.isError)
    return (
      <Card label="Onboarding could not load">
        <ErrorText onRetry={() => void query.refetch()} retrying={query.isFetching}>
          Onboarding could not load: {query.error.message}
        </ErrorText>
      </Card>
    );
  if (!company) return null;

  const status = onboardingStatus(company);
  const step = journeyIndex(company);
  const locked = company.status !== "ONBOARDING";
  const percent = Math.max(
    0,
    Math.min(100, company.status === "ACTIVE" ? 100 : company.progress.percent),
  );
  const progress = company.progress;

  return (
    <div className="flex flex-col gap-4 pb-10">
      <Card label="Onboarding progress" className="overflow-hidden">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
          <div className="min-w-0">
            <Chip tone={statusTone(company)} dot>
              {status.label}
            </Chip>
            <h1 className="mt-3 text-[22px] font-bold tracking-tight text-ink">
              {company.status === "ACTIVE"
                ? `${company.displayName} is live`
                : `Welcome, ${company.displayName}`}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-dim">
              {company.status === "ACTIVE"
                ? "Onboarding is approved. You can create verification cases and invite candidates."
                : company.status === "SUSPENDED"
                  ? "This sign-up was not approved. Contact your RM or support for details."
                  : company.submittedAt
                    ? "Thanks — Operations is reviewing your documents. You will be notified by email and here."
                    : "Complete your company details and upload the documents below, then submit for review. Your RM can help at any step."}
            </p>
            <ol
              className="mt-5 grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-5"
              aria-label="Journey"
            >
              {JOURNEY.map((label, index) => {
                const done = index < step;
                const current = index === step;
                return (
                  <li
                    key={label}
                    aria-current={current ? "step" : undefined}
                    className="flex min-w-0 flex-col gap-1.5"
                  >
                    <span
                      className={cn(
                        "h-1 rounded-full",
                        done ? "bg-good" : current ? "bg-brand-bright" : "bg-subtle",
                      )}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-xs",
                        done || current ? "font-semibold text-ink" : "text-dim",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "grid size-4 shrink-0 place-items-center rounded-full font-mono text-[10px]",
                          done
                            ? "bg-good text-brand-fg"
                            : current
                              ? "bg-brand text-brand-fg"
                              : "bg-subtle text-dim",
                        )}
                      >
                        {done ? <Tick className="size-3" /> : index + 1}
                      </span>
                      <span className="truncate">{label}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-line bg-subtle/50 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-semibold tracking-wider text-dim uppercase">
                Progress
              </span>
              <span className="font-mono text-xs text-dim">
                {progress.documentsUploaded}/{progress.documentsRequired} docs
              </span>
            </div>
            <strong className="font-mono text-[30px] leading-none font-semibold text-ink tabular-nums">
              {percent}%
            </strong>
            <Meter
              value={percent}
              tone={percent >= 100 ? "good" : "brand"}
              label={`${percent}% done`}
            />
          </div>
        </div>
      </Card>

      {company.status === "ACTIVE" ? (
        <div
          className={cn("flex gap-3 rounded-lg px-4 py-3 text-sm text-ink", SOFT.good)}
          role="status"
        >
          <PartyPopper className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="text-ink">
            <strong className="block font-semibold">You are all set.</strong>
            {company.note ?? "Create your first verification from the dashboard."}
            <div className="mt-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => window.location.assign("/client-portal")}
              >
                Open dashboard
              </Button>
            </div>
          </div>
        </div>
      ) : company.note ? (
        <div
          className={cn(
            "flex gap-3 rounded-lg px-4 py-3 text-sm",
            SOFT[company.status === "SUSPENDED" ? "bad" : "brand"],
          )}
          role="status"
        >
          <MessageSquareText className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="text-ink">
            <strong className="block font-semibold">Message from Sapling Global</strong>
            {company.note}
          </div>
        </div>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 gap-4">
          <CompanyDetails company={company} locked={locked} />
          <Card label="Documents">
            <CardHeader
              title="Documents"
              description="PDF, JPG or PNG up to 10 MB. Required items are reviewed by Operations."
              aside={
                <Chip tone="brand">
                  <span className="font-mono">
                    {progress.documentsApproved}/{progress.documentsRequired}
                  </span>{" "}
                  approved
                </Chip>
              }
            />
            <ul className="divide-y divide-line">
              {company.documents.map((document) => (
                <DocumentRow key={document.type} document={document} locked={locked} />
              ))}
            </ul>
          </Card>
        </div>

        <aside className="grid min-w-0 gap-4">
          <Card label="Your relationship manager">
            <CardHeader title="Your relationship manager" />
            <div className="p-4">
              {company.rm ? (
                <div className="flex items-center gap-3">
                  <Avatar name={company.rm.name} className="size-10 text-sm" />
                  <div className="flex min-w-0 flex-col">
                    <strong className="truncate font-semibold text-ink">{company.rm.name}</strong>
                    <a
                      className="truncate text-sm text-brand hover:underline"
                      href={`mailto:${company.rm.email}`}
                    >
                      {company.rm.email}
                    </a>
                    {company.rm.phone ? (
                      <small className="font-mono text-xs text-dim">{company.rm.phone}</small>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-dim">
                  An RM will be assigned shortly to guide your onboarding.
                </p>
              )}
            </div>
          </Card>

          <Card label="Checklist">
            <CardHeader title="Checklist" />
            <ul className="divide-y divide-line px-4 py-1">
              <Check ok={progress.detailsDone} label="Company details" />
              <Check
                ok={progress.documentsUploaded === progress.documentsRequired}
                label={`Required documents (${progress.documentsUploaded}/${progress.documentsRequired})`}
              />
              <Check ok={Boolean(company.submittedAt)} label="Submitted for review" />
              <Check ok={progress.rmAssigned} label="RM assigned" />
              <Check ok={progress.commercialDone} label="Packages & pricing set" />
              <Check ok={company.status === "ACTIVE"} label="Approved by Operations" />
            </ul>
          </Card>

          {company.packages.length ? (
            <Card label="Your packages">
              <CardHeader title="Your packages" />
              <ul className="grid gap-2 p-4 text-sm text-ink">
                {company.packages.map((item) => (
                  <li key={item.name} className="flex items-center gap-2">
                    <BadgeCheck className="size-4 shrink-0 text-good" aria-hidden /> {item.name}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {company.status === "ONBOARDING" ? <SubmitCard company={company} /> : null}
        </aside>
      </div>
    </div>
  );
}
