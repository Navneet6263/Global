import { useId, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CircleAlert,
  CircleCheck,
  Clock3,
  FileUp,
  Info,
  Send,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Field, Input, SOFT, Textarea, type Tone } from "@/kit";
import { cn } from "@/lib/utils";
import {
  downloadMyDocument,
  submitMyOnboarding,
  updateMyCompany,
  uploadMyDocument,
  type OnboardingCompany,
  type OnboardingDocument,
  type OnboardingDocumentState,
} from "@/lib/backend-api/onboarding";
import { fileSize, shortDate } from "./onboarding-format";

const messageOf = (error: unknown) => (error instanceof Error ? error.message : "Try again");

const DOC_STATE: Record<
  OnboardingDocumentState,
  { label: string; tone: Tone; icon: typeof CircleCheck }
> = {
  MISSING: { label: "Not uploaded", tone: "neutral", icon: FileUp },
  PENDING: { label: "In review", tone: "note", icon: Clock3 },
  APPROVED: { label: "Approved", tone: "good", icon: CircleCheck },
  REJECTED: { label: "Re-upload needed", tone: "bad", icon: CircleAlert },
};

/** One checklist line: green tick when done, amber "Pending" chip while waiting. */
export function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center justify-between gap-2 py-2 text-sm">
      <span className={cn("flex min-w-0 items-center gap-2", ok ? "text-ink" : "text-dim")}>
        {ok ? (
          <CircleCheck className="size-4 shrink-0 text-good" aria-hidden />
        ) : (
          <span
            className="size-4 shrink-0 rounded-full border-2 border-dashed border-line"
            aria-hidden
          />
        )}
        <span className="min-w-0">{label}</span>
      </span>
      <Chip tone={ok ? "good" : "warn"}>{ok ? "Done" : "Pending"}</Chip>
    </li>
  );
}

const FIELDS = [
  ["legalName", "Registered (legal) name"],
  ["displayName", "Display name"],
  ["gstin", "GSTIN"],
  ["pan", "Company PAN"],
] as const;
const INPUT_PROPS: Record<string, Partial<React.InputHTMLAttributes<HTMLInputElement>>> = {
  legalName: { required: true, minLength: 2 },
  displayName: { required: true, minLength: 2 },
  gstin: { placeholder: "27ABCDE1234F1Z5", maxLength: 15, className: "font-mono uppercase" },
  pan: { placeholder: "ABCDE1234F", maxLength: 10, className: "font-mono uppercase" },
  contactName: { maxLength: 120 },
  contactPhone: { maxLength: 24, className: "font-mono" },
};

export function CompanyDetails({
  company,
  locked,
}: {
  company: OnboardingCompany;
  locked: boolean;
}) {
  const queryClient = useQueryClient();
  const id = useId();
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
  const input = (key: keyof typeof form, label: string) => (
    <Field label={label} htmlFor={`${id}-${key}`} key={key}>
      <Input
        id={`${id}-${key}`}
        value={form[key]}
        onChange={field(key)}
        disabled={locked}
        {...INPUT_PROPS[key]}
      />
    </Field>
  );
  return (
    <Card label="Company details">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Building2 className="size-4 text-dim" aria-hidden /> Company details
          </span>
        }
        description="As on your GST registration. Used on invoices and agreements."
        aside={
          company.progress.detailsDone ? (
            <Chip tone="good" dot>
              Complete
            </Chip>
          ) : (
            <Chip tone="warn" dot>
              Needed
            </Chip>
          )
        }
      />
      <form
        className="grid gap-3 p-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        {FIELDS.map(([key, label]) => input(key, label))}
        <Field label="Billing address" htmlFor={`${id}-billing`} className="sm:col-span-2">
          <Textarea
            id={`${id}-billing`}
            value={form.billingAddress}
            onChange={field("billingAddress")}
            maxLength={500}
            disabled={locked}
          />
        </Field>
        {input("contactName", "Contact person")}
        {input("contactPhone", "Contact phone")}
        {locked ? null : (
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" variant="primary" loading={mutation.isPending}>
              Save details
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}

export function DocumentRow({
  document,
  locked,
}: {
  document: OnboardingDocument;
  locked: boolean;
}) {
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
  const meta = DOC_STATE[document.state];
  const Icon = meta.icon;
  return (
    <li
      className={cn(
        "flex flex-wrap items-start gap-3 px-4 py-3.5 sm:flex-nowrap",
        document.state === "REJECTED" && "bg-bad-soft/40",
      )}
    >
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-md", SOFT[meta.tone])}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 font-semibold text-ink">
          {document.label}
          <Chip tone={meta.tone} dot>
            {meta.label}
          </Chip>
          {!document.required ? <Chip>Optional</Chip> : null}
        </div>
        <p className="mt-0.5 text-xs text-dim">{document.hint}</p>
        {document.file ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <button
              type="button"
              className="max-w-full truncate font-medium text-brand hover:underline"
              onClick={() => void downloadMyDocument(document)}
              title={document.file.name}
            >
              {document.file.name}
            </button>
            <span className="font-mono text-dim">
              {fileSize(document.file.sizeBytes)} · uploaded {shortDate(document.file.uploadedAt)}
            </span>
          </div>
        ) : null}
        {document.state === "REJECTED" && document.file?.reviewNotes ? (
          <p className="mt-2 rounded-md bg-bad-soft px-2.5 py-1.5 text-xs text-bad">
            <Info className="mr-1 inline size-3.5" aria-hidden />
            {document.file.reviewNotes}
          </p>
        ) : null}
      </div>
      {canUpload ? (
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-col sm:items-end">
          {document.signed ? (
            <label className="flex items-center gap-1.5 text-xs whitespace-nowrap text-dim">
              Signed on{" "}
              <Input
                type="date"
                className="h-8 w-auto font-mono text-xs"
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
            variant={document.state === "MISSING" ? "primary" : "secondary"}
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

export function SubmitCard({ company }: { company: OnboardingCompany }) {
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
    <Card label={company.submittedAt ? "Submitted" : "Submit for review"}>
      <CardHeader title={company.submittedAt ? "Submitted" : "Submit for review"} />
      <div className="flex flex-col gap-3 p-4">
        {company.submittedAt ? (
          <p className="text-sm text-dim">
            Sent {shortDate(company.submittedAt)}. Re-uploads go straight to the reviewer.
          </p>
        ) : ready ? (
          <>
            <p className="text-sm text-dim">
              Everything required is in. Add a note for Operations if needed.
            </p>
            <Textarea
              className="min-h-16"
              value={note}
              maxLength={500}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note"
              aria-label="Note for Operations"
            />
            <Button
              variant="primary"
              onClick={() => mutation.mutate()}
              loading={mutation.isPending}
            >
              <Send className="size-4" aria-hidden /> Submit for review
            </Button>
          </>
        ) : (
          <div className="flex flex-col gap-1.5 rounded-md bg-warn-soft px-3 py-2.5 text-sm text-ink">
            <span className="text-[11px] font-semibold tracking-wider text-warn uppercase">
              Still needed:
            </span>
            {company.progress.missing.map((item) => (
              <span key={item}>• {item}</span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
