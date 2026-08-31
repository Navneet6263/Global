"use client";

import { useFormContext } from "react-hook-form";
import type { LeadSource, SalesOwner } from "../contracts/crm";
import { LEAD_SOURCES, SOURCE_LABEL } from "../config/crm";
import type { OpportunityFormValues } from "../schemas/opportunity.schema";
import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Account and primary-contact inputs for the opportunity form. */
export function CrmAccountFields({
  leadSources = LEAD_SOURCES,
}: {
  leadSources?: readonly LeadSource[];
}) {
  const form = useFormContext<OpportunityFormValues>();

  return (
    <>
      <TextField name="company" label="Company" placeholder="Kotak Logistics Pvt Ltd" />
      <TextField name="city" label="City" placeholder="Mumbai" />
      <TextField name="industry" label="Industry" placeholder="Logistics" />
      <FormField
        control={form.control}
        name="source"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Lead source</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {leadSources.map((source) => (
                  <SelectItem key={source} value={source}>
                    {SOURCE_LABEL[source]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <TextField name="contactName" label="Contact name" placeholder="Nikhil Rao" />
      <TextField name="contactTitle" label="Designation" placeholder="Head of HR" />
      <TextField
        name="contactEmail"
        label="Work email"
        placeholder="nikhil.rao@company.in"
        type="email"
      />
      <FormField
        control={form.control}
        name="contactMobile"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Mobile</FormLabel>
            <FormControl>
              <div className="flex items-center gap-2">
                <span className="num rounded-lg border border-border bg-muted px-2.5 py-2 text-sm text-muted-foreground">
                  +91
                </span>
                <Input inputMode="numeric" maxLength={10} placeholder="9820012345" {...field} />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

/** Commercial value, probability, dates and ownership inputs. */
export function CrmCommercialFields({ owners }: { owners: readonly SalesOwner[] }) {
  const form = useFormContext<OpportunityFormValues>();

  return (
    <>
      <FormField
        control={form.control}
        name="estimatedValue"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Estimated value (₹)</FormLabel>
            <FormControl>
              <Input type="number" inputMode="numeric" {...field} />
            </FormControl>
            <FormDescription>Annual contract value in rupees.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="probability"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Probability (%)</FormLabel>
            <FormControl>
              <Input type="number" min={0} max={100} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <TextField name="expectedCloseDate" label="Expected close date" type="date" />
      <TextField name="nextFollowUpAt" label="Next follow-up" type="date" />
      <FormField
        control={form.control}
        name="ownerId"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>Sales owner</FormLabel>
            <Select value={field.value ?? "unassigned"} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {owners.map((owner) => (
                  <SelectItem key={owner.id} value={owner.id}>
                    {owner.name} · {owner.territory}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

function TextField({
  name,
  label,
  placeholder,
  type,
}: {
  name: keyof OpportunityFormValues;
  label: string;
  placeholder?: string;
  type?: string;
}) {
  const form = useFormContext<OpportunityFormValues>();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type={type}
              placeholder={placeholder}
              {...field}
              value={String(field.value ?? "")}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
