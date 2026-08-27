"use client";

import type { ReactNode } from "react";
import { Building2, IndianRupee, NotebookPen, type LucideIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Opportunity, SalesOwner } from "../contracts/crm";
import { STAGE_DEFAULT_PROBABILITY } from "../config/crm";
import {
  opportunityFormSchema,
  toStoredMobile,
  toTenDigits,
  type OpportunityFormValues,
} from "../schemas/opportunity.schema";
import { CrmAccountFields, CrmCommercialFields } from "./crm-opportunity-fields";
import { crmAccent } from "../accents";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export interface OpportunitySubmitPayload {
  company: string;
  city: string;
  industry: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  contactMobile: string;
  source: OpportunityFormValues["source"];
  estimatedValue: number;
  probability: number;
  expectedCloseDate: string;
  ownerId: string | null;
  nextFollowUpAt: string | null;
  notes: string;
}

interface CrmOpportunityFormProps {
  owners: readonly SalesOwner[];
  opportunity?: Opportunity;
  submitting?: boolean;
  onSubmit: (payload: OpportunitySubmitPayload) => void;
  onCancel: () => void;
}

export function CrmOpportunityForm({
  owners,
  opportunity,
  submitting,
  onSubmit,
  onCancel,
}: CrmOpportunityFormProps) {
  const form = useForm<OpportunityFormValues>({
    resolver: zodResolver(opportunityFormSchema),
    defaultValues: {
      company: opportunity?.company ?? "",
      city: opportunity?.city ?? "",
      industry: opportunity?.industry ?? "",
      contactName: opportunity?.contactName ?? "",
      contactTitle: opportunity?.contactTitle ?? "",
      contactEmail: opportunity?.contactEmail ?? "",
      contactMobile: opportunity ? toTenDigits(opportunity.contactMobile) : "",
      source: opportunity?.source ?? "INBOUND",
      estimatedValue: opportunity?.estimatedValue ?? 500000,
      probability: opportunity?.probability ?? STAGE_DEFAULT_PROBABILITY.NEW,
      expectedCloseDate: (opportunity?.expectedCloseDate ?? "2026-09-30").slice(0, 10),
      ownerId: opportunity?.ownerId ?? "unassigned",
      nextFollowUpAt: opportunity?.nextFollowUpAt?.slice(0, 10) ?? "",
      notes: opportunity?.notes ?? "",
    },
  });

  const submit = form.handleSubmit((values) => {
    const parsed = opportunityFormSchema.parse(values);
    onSubmit({
      company: parsed.company,
      city: parsed.city ?? "Mumbai",
      industry: parsed.industry ?? "Professional services",
      contactName: parsed.contactName,
      contactTitle: parsed.contactTitle ?? "Decision maker",
      contactEmail: parsed.contactEmail,
      contactMobile: toStoredMobile(parsed.contactMobile),
      source: parsed.source,
      estimatedValue: parsed.estimatedValue,
      probability: parsed.probability,
      expectedCloseDate: new Date(`${parsed.expectedCloseDate}T10:00:00.000Z`).toISOString(),
      ownerId: !parsed.ownerId || parsed.ownerId === "unassigned" ? null : parsed.ownerId,
      nextFollowUpAt: parsed.nextFollowUpAt
        ? new Date(`${parsed.nextFollowUpAt}T05:30:00.000Z`).toISOString()
        : null,
      notes: parsed.notes ?? "",
    });
  });

  return (
    <Form {...form}>
      <form onSubmit={submit} className="space-y-4">
        <FormSection
          title="Account & contact"
          hint="Who we are selling to"
          icon={Building2}
          accentId="openPipeline"
        >
          <CrmAccountFields />
        </FormSection>

        <FormSection
          title="Commercials & ownership"
          hint="Value, confidence and who drives it"
          icon={IndianRupee}
          accentId="weightedForecast"
        >
          <CrmCommercialFields owners={owners} />
        </FormSection>

        <FormSection
          title="Context"
          hint="Requirement, scope, competition"
          icon={NotebookPen}
          accentId="winRate"
          columns={1}
        >
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea rows={3} placeholder="Requirement, scope, competition…" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {opportunity ? "Save changes" : "Create opportunity"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function FormSection({
  title,
  hint,
  icon: Icon,
  accentId,
  columns = 2,
  children,
}: {
  title: string;
  hint: string;
  icon: LucideIcon;
  accentId: string;
  columns?: 1 | 2;
  children: ReactNode;
}) {
  const accent = crmAccent(accentId);

  return (
    <section
      className="rounded-[1.35rem] border border-white/80 p-4 shadow-[var(--shadow-card)]"
      style={{
        borderTop: `2px solid ${accent.edge}`,
        background: `linear-gradient(170deg, ${accent.fill} 0%, color-mix(in oklab, var(--card) 92%, transparent) 55%)`,
      }}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className="flex size-8 items-center justify-center rounded-xl border"
          style={{ background: accent.fill, borderColor: accent.edge, color: accent.colour }}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </div>
      </div>
      <div className={columns === 1 ? "grid gap-3" : "grid gap-3 sm:grid-cols-2"}>{children}</div>
    </section>
  );
}
