import { useEffect, useState } from "react";

import {
  opportunityStages,
  type OpportunityDetail,
  type OpportunityStage,
  type SalesOwner,
} from "@/lib/api/crm";
import { humanize } from "./crm-utils";

export type OpportunityEditInput = {
  version: number;
  companyName: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  source?: string;
  ownerId?: string;
  stage: OpportunityStage;
  estimatedValue: number;
  probability: number;
  expectedCloseDate?: string;
  nextFollowUpAt?: string;
  notes?: string;
  lostReason?: string;
  activitySummary: string;
};

export function OpportunityEditForm({
  item,
  owners,
  saving,
  onSave,
}: {
  item: OpportunityDetail;
  owners: SalesOwner[];
  saving: boolean;
  onSave: (input: OpportunityEditInput) => void;
}) {
  const [form, setForm] = useState(() => makeForm(item));
  useEffect(() => setForm(makeForm(item)), [item]);
  const set = (key: keyof typeof form, value: string | number) =>
    setForm((current) => ({ ...current, [key]: value }));
  const valid =
    form.companyName.trim().length >= 2 &&
    form.contactName.trim().length >= 2 &&
    Number(form.estimatedValue) >= 0 &&
    (form.stage !== "LOST" || form.lostReason.trim().length >= 2);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        onSave({
          version: item.version,
          companyName: form.companyName.trim(),
          contactName: form.contactName.trim(),
          estimatedValue: Number(form.estimatedValue),
          probability: Number(form.probability),
          stage: form.stage,
          activitySummary: `Opportunity details updated in ${humanize(form.stage)}`,
          ...(form.contactEmail.trim() ? { contactEmail: form.contactEmail.trim() } : {}),
          ...(form.contactPhone.trim() ? { contactPhone: form.contactPhone.trim() } : {}),
          ...(form.source.trim() ? { source: form.source.trim() } : {}),
          ...(form.ownerId ? { ownerId: form.ownerId } : {}),
          ...(form.expectedCloseDate ? { expectedCloseDate: form.expectedCloseDate } : {}),
          ...(form.nextFollowUpAt
            ? { nextFollowUpAt: new Date(form.nextFollowUpAt).toISOString() }
            : {}),
          ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
          ...(form.lostReason.trim() ? { lostReason: form.lostReason.trim() } : {}),
        });
      }}
      className="space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Company"
          value={form.companyName}
          onChange={(value) => set("companyName", value)}
        />
        <Field
          label="Contact"
          value={form.contactName}
          onChange={(value) => set("contactName", value)}
        />
        <Field
          label="Email"
          type="email"
          value={form.contactEmail}
          onChange={(value) => set("contactEmail", value)}
        />
        <Field
          label="Phone"
          value={form.contactPhone}
          onChange={(value) => set("contactPhone", value)}
        />
        <Field label="Source" value={form.source} onChange={(value) => set("source", value)} />
        <label className="text-[11px] font-semibold">
          Owner
          <select
            value={form.ownerId}
            onChange={(event) => set("ownerId", event.target.value)}
            className={control}
          >
            <option value="">Keep current owner</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-semibold">
          Stage
          <select
            value={form.stage}
            onChange={(event) => set("stage", event.target.value as OpportunityStage)}
            className={control}
          >
            {opportunityStages.map((stage) => (
              <option key={stage} value={stage}>
                {humanize(stage)}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Estimated value"
          type="number"
          value={form.estimatedValue}
          onChange={(value) => set("estimatedValue", value)}
        />
        <Field
          label="Expected close"
          type="date"
          value={form.expectedCloseDate}
          onChange={(value) => set("expectedCloseDate", value)}
        />
        <Field
          label="Next follow-up"
          type="datetime-local"
          value={form.nextFollowUpAt}
          onChange={(value) => set("nextFollowUpAt", value)}
        />
      </div>
      <label className="block text-[11px] font-semibold">
        Probability <span className="float-right text-orange-700">{form.probability}%</span>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={form.probability}
          onChange={(event) => set("probability", Number(event.target.value))}
          className="mt-2 w-full accent-orange-600"
        />
      </label>
      {form.stage === "LOST" ? (
        <TextArea
          label="Lost reason"
          required
          value={form.lostReason}
          onChange={(value) => set("lostReason", value)}
        />
      ) : null}
      <TextArea
        label="Commercial notes"
        value={form.notes}
        onChange={(value) => set("notes", value)}
      />
      <button
        disabled={!valid || saving}
        className="h-11 w-full rounded-xl bg-slate-950 text-xs font-semibold text-white disabled:opacity-40"
      >
        {saving ? "Saving…" : "Save opportunity"}
      </button>
    </form>
  );
}

const control =
  "mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-orange-300";
function Field({
  label,
  value,
  type = "text",
  onChange,
}: {
  label: string;
  value: string | number;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-[11px] font-semibold">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={control}
      />
    </label>
  );
}
function TextArea({
  label,
  value,
  required,
  onChange,
}: {
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[11px] font-semibold">
      {label}
      {required ? " *" : ""}
      <textarea
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${control} h-auto py-3`}
      />
    </label>
  );
}
function makeForm(item: OpportunityDetail) {
  return {
    companyName: item.companyName,
    contactName: item.contactName,
    contactEmail: item.contactEmail ?? "",
    contactPhone: item.contactPhone ?? "",
    source: item.source ?? "",
    ownerId: item.owner?.publicId ?? "",
    stage: item.stage,
    estimatedValue: String(item.estimatedValue),
    probability: item.probability,
    expectedCloseDate: item.expectedCloseDate?.slice(0, 10) ?? "",
    nextFollowUpAt: item.nextFollowUpAt?.slice(0, 16) ?? "",
    notes: item.notes ?? "",
    lostReason: item.lostReason ?? "",
  };
}
