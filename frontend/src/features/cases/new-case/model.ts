import {
  Briefcase,
  GraduationCap,
  Home,
  IdCard,
  Scale,
  Users,
  type LucideIcon,
} from "lucide-react";
import { z } from "zod";

export type CheckKey =
  "identity" | "address" | "employment" | "education" | "criminal" | "reference";

export type Priority = (typeof priorities)[number];

export type CaseDraft = {
  candidate: string;
  email: string;
  phone: string;
  clientId: string;
  client: string;
  packageName: string;
  priority: Priority;
  checks: CheckKey[];
};

export const candidateSchema = z.object({
  candidate: z.string().trim().min(2, "Candidate name is required"),
  clientId: z.string().uuid("Choose a client"),
  client: z.string().trim().min(2, "Client is required"),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
  phone: z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .regex(/^\+?[0-9\s()-]{8,18}$/, "Enter a valid mobile number"),
  ]),
});

export const checkCatalog: Array<{
  key: CheckKey;
  label: string;
  tatDays: number;
  icon: LucideIcon;
}> = [
  { key: "identity", label: "Identity (Aadhaar / PAN)", tatDays: 0.6, icon: IdCard },
  { key: "address", label: "Address (physical)", tatDays: 5.2, icon: Home },
  { key: "employment", label: "Employment history", tatDays: 2.4, icon: Briefcase },
  { key: "education", label: "Education", tatDays: 3.1, icon: GraduationCap },
  { key: "criminal", label: "Criminal / Court", tatDays: 4.6, icon: Scale },
  { key: "reference", label: "Reference check", tatDays: 1.8, icon: Users },
];

export const defaultChecks: CheckKey[] = ["identity", "address", "employment", "education"];

export const packages: Array<{ name: string; checks: CheckKey[]; blurb: string }> = [
  { name: "Gig Basic", checks: ["identity", "address"], blurb: "2 checks · fastest TAT" },
  {
    name: "Standard+",
    checks: ["identity", "address", "employment", "education"],
    blurb: "4 checks · most used",
  },
  {
    name: "Leadership",
    checks: ["identity", "address", "employment", "education", "criminal", "reference"],
    blurb: "6 checks · full BGV",
  },
];

export const priorities = ["Standard", "Priority", "Critical"] as const;

export function estimatedTatDays(checks: CheckKey[], priority: Priority): number {
  const longestCheck = checkCatalog
    .filter((check) => checks.includes(check.key))
    .reduce((max, check) => Math.max(max, check.tatDays), 0);
  const multiplier = priority === "Critical" ? 0.6 : priority === "Priority" ? 0.8 : 1;
  return Math.max(1, Math.round(longestCheck * multiplier));
}

export function createEmptyCaseDraft(): CaseDraft {
  return {
    candidate: "",
    email: "",
    phone: "",
    clientId: "",
    client: "",
    packageName: "Standard+",
    priority: "Standard",
    checks: [...defaultChecks],
  };
}
