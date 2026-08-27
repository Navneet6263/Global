import { z } from "zod";
import { LEAD_SOURCES } from "../config/crm";
import type { LeadSource } from "../contracts/crm";

/** 10 digits, must start with 6-9. The +91 prefix is fixed in the UI. */
export const indianMobileSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile starting with 6, 7, 8 or 9");

export const opportunityFormSchema = z.object({
  company: z.string().trim().min(2, "Company name is required").max(120),
  city: z.string().trim().max(60).optional(),
  industry: z.string().trim().max(60).optional(),
  contactName: z.string().trim().min(2, "Contact name is required").max(80),
  contactTitle: z.string().trim().max(80).optional(),
  contactEmail: z.string().trim().email("Enter a valid work email"),
  contactMobile: indianMobileSchema,
  source: z.enum(LEAD_SOURCES as unknown as [LeadSource, ...LeadSource[]]),
  estimatedValue: z.coerce
    .number()
    .min(10_000, "Minimum ₹10,000")
    .max(500_000_000, "Value looks unrealistic"),
  probability: z.coerce.number().min(0, "0-100 only").max(100, "0-100 only"),
  expectedCloseDate: z.string().min(1, "Expected close date is required"),
  ownerId: z.string().optional(),
  nextFollowUpAt: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type OpportunityFormValues = z.input<typeof opportunityFormSchema>;
export type OpportunityFormOutput = z.output<typeof opportunityFormSchema>;

export const activityFormSchema = z.object({
  opportunityId: z.string().min(1, "Select an opportunity"),
  type: z.enum(["CALL", "EMAIL", "MEETING", "NOTE", "FOLLOW_UP"]),
  summary: z.string().trim().min(4, "Add a short summary").max(180),
  occurredAt: z.string().min(1, "When did this happen?"),
  nextFollowUpAt: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type ActivityFormValues = z.input<typeof activityFormSchema>;

export const markLostSchema = z.object({
  lostReason: z.string().min(2, "Select a lost reason"),
  competitor: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(600).optional(),
});

export const markWonSchema = z.object({
  finalValue: z.coerce.number().min(10_000, "Enter the final contracted value"),
  closedDate: z.string().min(1, "Closed date is required"),
  notes: z.string().trim().max(600).optional(),
});

export const rescheduleSchema = z.object({
  dueAt: z.string().min(1, "Pick a new date and time"),
  notes: z.string().trim().max(400).optional(),
});

/** Converts a 10-digit input into the stored +91XXXXXXXXXX form. */
export function toStoredMobile(tenDigits: string): string {
  return `+91${tenDigits.trim()}`;
}

export function toTenDigits(stored: string): string {
  return stored.replace(/^\+91/, "").trim();
}
