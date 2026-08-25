import { BriefcaseBusiness, CalendarDays, IndianRupee, Mail, Phone, UserRound } from "lucide-react";
import {
  cloneElement,
  type ComponentType,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";

import type { OpportunityDraft } from "@/components/crm/crm-utils";

export function OpportunityFields({
  form,
  update,
}: {
  form: OpportunityDraft;
  update: (key: keyof OpportunityDraft, value: string | number) => void;
}) {
  return (
    <>
      <FormSection title="Prospect" hint="Company and primary decision-maker">
        <Field label="Company name" required icon={BriefcaseBusiness}>
          <input
            value={form.companyName}
            onChange={(event) => update("companyName", event.target.value)}
            placeholder="e.g. Northstar Industries"
          />
        </Field>
        <Field label="Contact name" required icon={UserRound}>
          <input
            value={form.contactName}
            onChange={(event) => update("contactName", event.target.value)}
            placeholder="Primary contact"
          />
        </Field>
        <Field label="Work email" icon={Mail}>
          <input
            type="email"
            value={form.contactEmail}
            onChange={(event) => update("contactEmail", event.target.value)}
            placeholder="name@company.com"
          />
        </Field>
        <Field label="Phone" icon={Phone}>
          <input
            value={form.contactPhone}
            onChange={(event) => update("contactPhone", event.target.value)}
            placeholder="+91 98xxx xxxxx"
          />
        </Field>
      </FormSection>
      <FormSection title="Commercial forecast" hint="Value, confidence and expected close">
        <Field label="Estimated value" required icon={IndianRupee}>
          <input
            type="number"
            min="0"
            value={form.estimatedValue}
            onChange={(event) => update("estimatedValue", event.target.value)}
            placeholder="0"
          />
        </Field>
        <Field label="Expected close" icon={CalendarDays}>
          <input
            type="date"
            value={form.expectedCloseDate}
            onChange={(event) => update("expectedCloseDate", event.target.value)}
          />
        </Field>
        <label className="col-span-full block rounded-xl border border-border bg-secondary/25 px-4 py-3 text-[11px] font-semibold">
          Win probability{" "}
          <span className="float-right num text-orange-700">{form.probability}%</span>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={form.probability}
            onChange={(event) => update("probability", Number(event.target.value))}
            className="mt-3 w-full accent-orange-600"
          />
        </label>
        <label className="block text-[11px] font-semibold">
          Lead source
          <input
            value={form.source}
            onChange={(event) => update("source", event.target.value)}
            placeholder="Referral, website, event…"
            className={inputClass}
          />
        </label>
        <label className="col-span-full block text-[11px] font-semibold">
          Context
          <textarea
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
            placeholder="Qualification notes and next action"
            rows={3}
            className={`${inputClass} h-auto py-3`}
          />
        </label>
      </FormSection>
    </>
  );
}

const inputClass =
  "mt-1.5 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm font-normal outline-none transition placeholder:text-muted-foreground/60 focus:border-orange-300 focus:ring-4 focus:ring-orange-100";

function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h3 className="text-xs font-bold">{title}</h3>
        <p className="text-[10px] text-muted-foreground">{hint}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  icon: Icon,
  children,
}: {
  label: string;
  required?: boolean;
  icon: ComponentType<{ className?: string }>;
  children: ReactElement;
}) {
  return (
    <label className="block text-[11px] font-semibold">
      {label}
      {required ? <span className="text-red-500"> *</span> : null}
      <span className="relative mt-1.5 block">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        {cloneElement(children, {
          className: `${inputClass} mt-0 pl-9`,
        } as InputHTMLAttributes<HTMLInputElement>)}
      </span>
    </label>
  );
}
