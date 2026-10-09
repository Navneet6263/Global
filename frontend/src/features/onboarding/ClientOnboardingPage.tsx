import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Building2,
  CircleCheck,
  Circle,
  Info,
  MessageSquareText,
  PartyPopper,
  Send,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import {
  downloadMyDocument,
  getMyOnboarding,
  submitMyOnboarding,
  updateMyCompany,
  uploadMyDocument,
  type OnboardingCompany,
  type OnboardingDocument,
} from "@/lib/backend-api/onboarding";
import { cachedIdentity, clearIdentity } from "@/lib/auth/platform-session";
import { DocChip, DocIcon, ProgressRing } from "./onboarding-ui";
import {
  docRowClass,
  fileSize,
  initialsOf,
  onboardingStatus,
  shortDate,
} from "./onboarding-format";

const JOURNEY = ["Account", "Company details", "Documents", "Operations review", "Live"];

function journeyIndex(company: OnboardingCompany) {
  if (company.status === "ACTIVE") return 5;
  if (company.submittedAt) return 3;
  if (company.progress.detailsDone && company.progress.documentsUploaded > 0) return 2;
  return 1;
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : "Try again");

export function ClientOnboardingPage() {
  const query = useQuery({ queryKey: ["onboarding", "me"], queryFn: getMyOnboarding });
  const company = query.data;

  // Approved while this tab had the old (onboarding) session: reload the identity once.
  useEffect(() => {
    if (company?.status === "ACTIVE" && cachedIdentity()?.clientStatus === "ONBOARDING") {
      clearIdentity();
    }
  }, [company?.status]);

  if (query.isPending) return <ListSkeleton rows={6} />;
  if (query.isError)
    return <ErrorState title="Onboarding could not load" description={query.error.message} />;
  if (!company) return null;

  const status = onboardingStatus(company);
  const step = journeyIndex(company);
  const locked = company.status !== "ONBOARDING";

  return (
    <div className="pb-10">
      <section className="onb-hero" aria-label="Onboarding progress">
        <div>
          <span className={`onb-status ${status.className}`}>
            <i aria-hidden /> {status.label}
          </span>
          <h1 className="mt-3">
            {company.status === "ACTIVE"
              ? `${company.displayName} is live`
              : `Welcome, ${company.displayName}`}
          </h1>
          <p>
            {company.status === "ACTIVE"
              ? "Onboarding is approved. You can create verification cases and invite candidates."
              : company.status === "SUSPENDED"
                ? "This sign-up was not approved. Contact your RM or support for details."
                : company.submittedAt
                  ? "Thanks — Operations is reviewing your documents. You will be notified by email and here."
                  : "Complete your company details and upload the documents below, then submit for review. Your RM can help at any step."}
          </p>
          <ol className="onb-journey" aria-label="Journey">
            {JOURNEY.map((label, index) => (
              <li
                key={label}
                className={index < step ? "is-done" : index === step ? "is-current" : ""}
                aria-current={index === step ? "step" : undefined}
              >
                <span>{label}</span>
              </li>
            ))}
          </ol>
        </div>
        <ProgressRing percent={company.status === "ACTIVE" ? 100 : company.progress.percent} />
      </section>

      {company.status === "ACTIVE" ? (
        <div className="onb-note is-good mt-4" role="status">
          <PartyPopper aria-hidden />
          <div>
            <strong>You are all set.</strong>
            {company.note ?? "Create your first verification from the dashboard."}
            <div className="mt-2">
              <Button size="sm" onClick={() => window.location.assign("/client-portal")}>
                Open dashboard
              </Button>
            </div>
          </div>
        </div>
      ) : company.note ? (
        <div
          className={`onb-note mt-4 ${company.status === "SUSPENDED" ? "is-bad" : ""}`}
          role="status"
        >
          <MessageSquareText aria-hidden />
          <div>
            <strong>Message from Sapling Global</strong>
            {company.note}
          </div>
        </div>
      ) : null}

      <div className="onb-layout">
        <div className="grid gap-4">
          <CompanyDetails company={company} locked={locked} />
          <section className="client-panel" aria-labelledby="onb-docs-title">
            <header className="client-panel-head">
              <div>
                <h2 id="onb-docs-title">Documents</h2>
                <p className="ops-subtle">
                  PDF, JPG or PNG up to 10 MB. Required items are reviewed by Operations.
                </p>
              </div>
              <span className="flow-pill is-info">
                {company.progress.documentsApproved}/{company.progress.documentsRequired} approved
              </span>
            </header>
            <ul className="onb-docs">
              {company.documents.map((document) => (
                <DocumentRow key={document.type} document={document} locked={locked} />
              ))}
            </ul>
          </section>
        </div>

        <aside className="onb-side">
          <section className="client-panel" aria-labelledby="onb-rm-title">
            <h2 id="onb-rm-title" className="mb-3 text-sm font-semibold">
              Your relationship manager
            </h2>
            {company.rm ? (
              <div className="onb-rm">
                <span className="onb-rm-avatar" aria-hidden>
                  {initialsOf(company.rm.name)}
                </span>
                <div className="min-w-0">
                  <strong>{company.rm.name}</strong>
                  <a href={`mailto:${company.rm.email}`}>{company.rm.email}</a>
                  {company.rm.phone ? <small>{company.rm.phone}</small> : null}
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">
                An RM will be assigned shortly to guide your onboarding.
              </p>
            )}
          </section>

          <section className="client-panel" aria-labelledby="onb-checklist-title">
            <h2 id="onb-checklist-title" className="mb-3 text-sm font-semibold">
              Checklist
            </h2>
            <ul className="onb-checks">
              <Check ok={company.progress.detailsDone} label="Company details" />
              <Check
                ok={company.progress.documentsUploaded === company.progress.documentsRequired}
                label={`Required documents (${company.progress.documentsUploaded}/${company.progress.documentsRequired})`}
              />
              <Check ok={Boolean(company.submittedAt)} label="Submitted for review" />
              <Check ok={company.progress.rmAssigned} label="RM assigned" />
              <Check ok={company.progress.commercialDone} label="Packages & pricing set" />
              <Check ok={company.status === "ACTIVE"} label="Approved by Operations" />
            </ul>
          </section>

          {company.packages.length ? (
            <section className="client-panel" aria-labelledby="onb-packages-title">
              <h2 id="onb-packages-title" className="mb-2 text-sm font-semibold">
                Your packages
              </h2>
              <ul className="grid gap-1.5 text-[13px]">
                {company.packages.map((item) => (
                  <li key={item.name} className="flex items-center gap-2">
                    <BadgeCheck className="size-4 text-emerald-600" aria-hidden /> {item.name}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {company.status === "ONBOARDING" ? <SubmitCard company={company} /> : null}
        </aside>
      </div>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={ok ? "is-ok" : "is-wait"}>
      {ok ? <CircleCheck aria-hidden /> : <Circle aria-hidden />}
      <span>{label}</span>
    </li>
  );
}

function CompanyDetails({ company, locked }: { company: OnboardingCompany; locked: boolean }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    legalName: company.legalName,
    displayName: company.displayName,
    gstin: company.gstin ?? "",
    pan: company.pan ?? "",
    billingAddress: company.billingAddress ?? "",
    contactName: company.contactName ?? "",
    contactPhone: company.contactPhone ?? "",
  });
  const mutation = useMutation({
    mutationFn: () =>
      updateMyCompany({
        version: company.version,
        ...form,
        gstin: form.gstin.trim().toUpperCase(),
        pan: form.pan.trim().toUpperCase(),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["onboarding", "me"], data);
      toast.success("Company details saved");
    },
    onError: (error) => toast.error("Not saved", { description: messageOf(error) }),
  });
  const field =
    (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));
  return (
    <section className="client-panel" aria-labelledby="onb-company-title">
      <header className="client-panel-head">
        <div>
          <h2 id="onb-company-title" className="flex items-center gap-2">
            <Building2 className="size-4" aria-hidden /> Company details
          </h2>
          <p className="ops-subtle">
            As on your GST registration. Used on invoices and agreements.
          </p>
        </div>
        {company.progress.detailsDone ? (
          <span className="onb-chip is-approved">Complete</span>
        ) : (
          <span className="onb-chip is-warn">Needed</span>
        )}
      </header>
      <form
        className="onb-form"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <label>
          <span>Registered (legal) name</span>
          <Input
            value={form.legalName}
            onChange={field("legalName")}
            required
            minLength={2}
            disabled={locked}
          />
        </label>
        <label>
          <span>Display name</span>
          <Input
            value={form.displayName}
            onChange={field("displayName")}
            required
            minLength={2}
            disabled={locked}
          />
        </label>
        <label>
          <span>GSTIN</span>
          <Input
            value={form.gstin}
            onChange={field("gstin")}
            placeholder="27ABCDE1234F1Z5"
            maxLength={15}
            className="uppercase"
            disabled={locked}
          />
        </label>
        <label>
          <span>Company PAN</span>
          <Input
            value={form.pan}
            onChange={field("pan")}
            placeholder="ABCDE1234F"
            maxLength={10}
            className="uppercase"
            disabled={locked}
          />
        </label>
        <label className="is-wide">
          <span>Billing address</span>
          <textarea
            value={form.billingAddress}
            onChange={field("billingAddress")}
            maxLength={500}
            disabled={locked}
          />
        </label>
        <label>
          <span>Contact person</span>
          <Input
            value={form.contactName}
            onChange={field("contactName")}
            maxLength={120}
            disabled={locked}
          />
        </label>
        <label>
          <span>Contact phone</span>
          <Input
            value={form.contactPhone}
            onChange={field("contactPhone")}
            maxLength={24}
            disabled={locked}
          />
        </label>
        {locked ? null : (
          <div className="is-wide flex justify-end">
            <Button type="submit" loading={mutation.isPending}>
              Save details
            </Button>
          </div>
        )}
      </form>
    </section>
  );
}

function DocumentRow({ document, locked }: { document: OnboardingDocument; locked: boolean }) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [signedOn, setSignedOn] = useState(
    document.signedAt ? document.signedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
  );
  const upload = useMutation({
    mutationFn: (file: File) =>
      uploadMyDocument(document.type, file, document.signed ? signedOn : undefined),
    onSuccess: (result) => {
      queryClient.setQueryData(["onboarding", "me"], result.company);
      toast.success(`${document.label} uploaded`);
    },
    onError: (error) => toast.error("Upload failed", { description: messageOf(error) }),
  });
  const canUpload = !locked && document.state !== "APPROVED";
  return (
    <li className={`onb-doc ${docRowClass(document.state)}`}>
      <DocIcon state={document.state} />
      <div className="min-w-0">
        <div className="onb-doc-title">
          {document.label}
          <DocChip state={document.state} />
          {!document.required ? <span className="onb-chip is-optional">Optional</span> : null}
        </div>
        <p className="onb-doc-hint">{document.hint}</p>
        {document.file ? (
          <div className="onb-doc-file">
            <button
              type="button"
              onClick={() => void downloadMyDocument(document)}
              title={document.file.name}
            >
              {document.file.name}
            </button>
            <span>
              {fileSize(document.file.sizeBytes)} · uploaded {shortDate(document.file.uploadedAt)}
            </span>
          </div>
        ) : null}
        {document.state === "REJECTED" && document.file?.reviewNotes ? (
          <p className="onb-doc-review">
            <Info className="mr-1 inline size-3.5" aria-hidden />
            {document.file.reviewNotes}
          </p>
        ) : null}
      </div>
      {canUpload ? (
        <div className="onb-doc-actions">
          {document.signed ? (
            <label className="text-[12px] text-muted-foreground">
              Signed on{" "}
              <input
                type="date"
                value={signedOn}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setSignedOn(event.target.value)}
                aria-label={`${document.label} signing date`}
              />
            </label>
          ) : null}
          <input
            ref={input}
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            hidden
            aria-label={`Upload ${document.label}`}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) upload.mutate(file);
            }}
          />
          <Button
            size="sm"
            variant={document.state === "MISSING" ? "default" : "outline"}
            loading={upload.isPending}
            onClick={() => input.current?.click()}
          >
            <Upload className="size-3.5" aria-hidden />
            {document.state === "MISSING" ? "Upload" : "Replace"}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function SubmitCard({ company }: { company: OnboardingCompany }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      submitMyOnboarding({ version: company.version, note: note.trim() || undefined }),
    onSuccess: (data) => {
      queryClient.setQueryData(["onboarding", "me"], data);
      toast.success("Submitted for review", {
        description: "Operations and your RM have been notified.",
      });
    },
    onError: (error) => toast.error("Not submitted", { description: messageOf(error) }),
  });
  const ready = company.progress.clientDone;
  return (
    <section className="client-panel onb-submit" aria-labelledby="onb-submit-title">
      <h2 id="onb-submit-title" className="text-sm font-semibold">
        {company.submittedAt ? "Submitted" : "Submit for review"}
      </h2>
      {company.submittedAt ? (
        <p className="text-[13px] text-muted-foreground">
          Sent {shortDate(company.submittedAt)}. Re-uploads go straight to the reviewer.
        </p>
      ) : ready ? (
        <>
          <p className="text-[13px] text-muted-foreground">
            Everything required is in. Add a note for Operations if needed.
          </p>
          <textarea
            className="min-h-16 w-full rounded-[10px] border border-slate-300 p-2 text-[13px]"
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional note"
            aria-label="Note for Operations"
          />
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
            <Send className="size-4" aria-hidden /> Submit for review
          </Button>
        </>
      ) : (
        <div className="onb-missing">
          <span>Still needed:</span>
          {company.progress.missing.map((item) => (
            <span key={item}>• {item}</span>
          ))}
        </div>
      )}
    </section>
  );
}
