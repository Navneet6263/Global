import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Pencil, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  updateOnboardingCompany,
  uploadOnboardingDocument,
  type OnboardingDetail,
  type OnboardingDocument,
} from "@/lib/backend-api/onboarding";

const messageOf = (error: unknown) => (error instanceof Error ? error.message : "Try again");

/** The team uploads or replaces a company's document; a different colleague reviews it. */
export function TeamDocumentUpload({
  clientId,
  document,
  onDone,
}: {
  clientId: string;
  document: OnboardingDocument;
  onDone: (data: OnboardingDetail) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [signedOn, setSignedOn] = useState(document.signedAt?.slice(0, 10) ?? today);
  const upload = useMutation({
    mutationFn: (file: File) =>
      uploadOnboardingDocument(
        clientId,
        document.type,
        file,
        document.signed ? signedOn : undefined,
      ),
    onSuccess: async (data) => {
      toast.success(`${document.label} uploaded`, {
        description: "A different colleague must review it.",
      });
      await onDone(data);
    },
    onError: (error) => toast.error("Upload failed", { description: messageOf(error) }),
  });
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {document.signed ? (
        <label className="text-[12px] text-slate-500">
          Signed on{" "}
          <input
            type="date"
            value={signedOn}
            max={today}
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
  );
}

/** GSTIN, PAN, billing address and contact, filled in by the team for the company. */
export function CompanyDetailsForm({
  company,
  onDone,
}: {
  company: OnboardingDetail;
  onDone: (data: OnboardingDetail) => Promise<void>;
}) {
  const initial = {
    legalName: company.legalName,
    displayName: company.displayName,
    gstin: company.gstin ?? "",
    pan: company.pan ?? "",
    billingAddress: company.billingAddress ?? "",
    contactName: company.contactName ?? "",
    contactPhone: company.contactPhone ?? "",
  };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const save = useMutation({
    mutationFn: () => updateOnboardingCompany(company.id, { version: company.version, ...form }),
    onSuccess: async (data) => {
      toast.success("Company details saved");
      setOpen(false);
      await onDone(data);
    },
    onError: (error) => toast.error("Not saved", { description: messageOf(error) }),
  });
  if (!open)
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setForm(initial);
          setOpen(true);
        }}
      >
        <Pencil className="size-3.5" aria-hidden /> Edit details
      </Button>
    );
  const field = (key: keyof typeof form, label: string, maxLength: number) => (
    <label className="grid gap-1 text-[12px] font-semibold text-slate-600">
      {label}
      <Input
        value={form[key]}
        maxLength={maxLength}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
      />
    </label>
  );
  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {field("legalName", "Legal name", 180)}
      {field("displayName", "Display name", 120)}
      {field("gstin", "GSTIN", 15)}
      {field("pan", "PAN", 10)}
      {field("billingAddress", "Billing address", 500)}
      {field("contactName", "Contact person", 120)}
      {field("contactPhone", "Contact phone", 24)}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          loading={save.isPending}
          disabled={form.legalName.trim().length < 2 || form.displayName.trim().length < 2}
        >
          Save details
        </Button>
      </div>
    </form>
  );
}
