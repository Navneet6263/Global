import { Building2, FileCheck2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CaseServicePackage } from "@/lib/backend-api/cases";

export function ServiceDetailsFields({
  pkg,
  details,
  onChange,
}: {
  pkg: CaseServicePackage;
  details: Record<string, string>;
  onChange: (details: Record<string, string>) => void;
}) {
  const vendor = pkg.serviceFamily === "VENDORCHECK";
  const leader = pkg.serviceFamily === "LEADERCHECK";
  const integrity = pkg.serviceFamily === "INTEGRITYCHECK";
  const fields = [
    ...(vendor
      ? [
          {
            key: "organisationName",
            label: "Registered business name",
            required: true,
            long: false,
            max: 180,
          },
          {
            key: "registrationNumber",
            label: "Company registration number",
            required: true,
            long: false,
            max: 80,
          },
          { key: "gstin", label: "GSTIN (if applicable)", required: false, long: false, max: 15 },
        ]
      : []),
    ...(leader
      ? [
          {
            key: "directorships",
            label: "Directorships and business interests",
            required: false,
            long: true,
            max: 2000,
          },
        ]
      : []),
    ...(leader || integrity
      ? [
          {
            key: "conflictOfInterest",
            label: "Declared conflicts of interest",
            required: false,
            long: true,
            max: 2000,
          },
          {
            key: "declaration",
            label: "Declaration / scope notes",
            required: false,
            long: true,
            max: 2000,
          },
        ]
      : []),
    ...(leader || integrity || vendor
      ? [
          {
            key: "referenceContacts",
            label: "Authorised reference / source contacts",
            required: false,
            long: true,
            max: 1000,
          },
        ]
      : []),
  ];
  if (!fields.length && !pkg.requiredDocuments?.length) return null;
  return (
    <section className="space-y-3 rounded-2xl border border-mint/20 bg-mint-soft/45 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Building2 className="size-4 text-mint-deep" />
        {pkg.name}
      </h3>
      {pkg.requiredDocuments?.length ? (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <FileCheck2 className="size-4 shrink-0" /> Required and reviewed before verification:{" "}
          {pkg.requiredDocuments.map((type) => type.replaceAll("_", " ")).join(", ")}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => {
          const id = `${pkg.id}-${field.key}`;
          const shared = {
            id,
            value: details[field.key] ?? "",
            maxLength: field.max,
            required: field.required,
            onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              onChange({ ...details, [field.key]: event.target.value }),
          };
          return (
            <div key={field.key} className={field.long ? "sm:col-span-2" : ""}>
              <Label htmlFor={id} className="mb-1 block text-xs">
                {field.label}
                {field.required ? " *" : ""}
              </Label>
              {field.long ? <Textarea {...shared} rows={2} /> : <Input {...shared} />}
            </div>
          );
        })}
      </div>
      {fields.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          These are declared details for human/source review, not automatically verified facts.
        </p>
      )}
    </section>
  );
}
