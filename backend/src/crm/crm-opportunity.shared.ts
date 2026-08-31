import type { Actor } from "../common/auth/actor";

export const opportunitySelect = {
  publicId: true,
  companyName: true,
  city: true,
  industry: true,
  contactName: true,
  contactTitle: true,
  contactEmail: true,
  contactPhone: true,
  stage: true,
  source: true,
  estimatedValue: true,
  probability: true,
  expectedCloseDate: true,
  nextFollowUpAt: true,
  notes: true,
  lostReason: true,
  closedAt: true,
  onboardingHandoffAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { publicId: true, displayName: true, email: true } },
  client: { select: { publicId: true, displayName: true } },
} as const;

export function clientScope(actor: Actor) {
  return actor.clientId ? { clientId: actor.clientId } : {};
}

export function optionalText(value: string | null | undefined) {
  if (value === undefined) return undefined;
  return value?.trim() || null;
}
