import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DOCUMENT_TYPES, SERVICE_FAMILIES } from "./service-policy-options";

export function RequiredDocumentFields({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <fieldset className="rounded-2xl border border-mint/20 bg-mint-soft/40 p-4">
      <legend className="px-1 text-xs font-semibold">Required reviewed documents</legend>
      <p className="mb-3 text-xs text-muted-foreground">
        Every selected document is required before verification can start. Select only what this
        service needs.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {DOCUMENT_TYPES.map((type) => (
          <label key={type} className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={value.includes(type)}
              onCheckedChange={() =>
                onChange(
                  value.includes(type) ? value.filter((item) => item !== type) : [...value, type],
                )
              }
            />
            {type.replaceAll("_", " ")}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ServiceFamilyField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor="service-family" className="mb-1.5 block text-xs">
        Service family
      </Label>
      <select
        id="service-family"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
      >
        {SERVICE_FAMILIES.map((family) => (
          <option key={family}>{family}</option>
        ))}
      </select>
    </div>
  );
}
