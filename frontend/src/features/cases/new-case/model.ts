import {
  Briefcase,
  FlaskConical,
  GraduationCap,
  Globe2,
  Home,
  IdCard,
  Scale,
  Users,
  type LucideIcon,
} from "lucide-react";
import { z } from "zod";

export type CheckKey =
  | "IDENTITY"
  | "ADDRESS"
  | "EMPLOYMENT"
  | "EDUCATION"
  | "CRIMINAL"
  | "COURT_RECORD"
  | "REFERENCE"
  | "GLOBAL_DATABASE"
  | "DRUG_TEST"
  | "RESUME_CONSISTENCY"
  | "CONFLICT_OF_INTEREST"
  | "ANTI_BRIBERY"
  | "MISCONDUCT"
  | "ADVERSE_MEDIA"
  | "DIRECTORSHIP"
  | "BUSINESS_INTEREST"
  | "SANCTIONS"
  | "COMPANY_REGISTRATION"
  | "GST_VALIDATION"
  | "PAN_VALIDATION"
  | "MCA_VALIDATION";

export type ServiceSelection = { servicePackageId: string; details?: Record<string, string> };

export type Priority = (typeof priorities)[number];

export type CaseDraft = {
  candidate: string;
  email: string;
  phone: string;
  clientId: string;
  client: string;
  servicePackageId: string;
  services?: ServiceSelection[];
  packageName: string;
  packageTatHours: number;
  priority: Priority;
  checks: CheckKey[];
};

export const candidateSchema = z
  .object({
    candidate: z.string().trim().min(2, "Candidate name is required"),
    clientId: z.string().uuid("Choose a client"),
    client: z.string().trim().min(2, "Client is required"),
    email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
    phone: z.union([
      z.literal(""),
      z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
    ]),
  })
  .refine((candidate) => Boolean(candidate.email.trim() || candidate.phone), {
    message: "Enter the candidate email or mobile number",
    path: ["phone"],
  });

export const checkCatalog: Array<{
  key: CheckKey;
  label: string;
  icon: LucideIcon;
}> = [
  { key: "IDENTITY", label: "Identity (Aadhaar / PAN)", icon: IdCard },
  { key: "ADDRESS", label: "Address (physical)", icon: Home },
  { key: "EMPLOYMENT", label: "Employment history", icon: Briefcase },
  { key: "EDUCATION", label: "Education", icon: GraduationCap },
  { key: "CRIMINAL", label: "Criminal record", icon: Scale },
  { key: "COURT_RECORD", label: "Court record", icon: Scale },
  { key: "REFERENCE", label: "Reference check", icon: Users },
  { key: "GLOBAL_DATABASE", label: "Global database", icon: Globe2 },
  { key: "DRUG_TEST", label: "Drug test", icon: FlaskConical },
];

export const priorities = ["Standard", "Priority", "Critical"] as const;

export function estimatedTatDays(packageTatHours: number, priority: Priority): number {
  const priorityCap = priority === "Critical" ? 24 : priority === "Priority" ? 48 : 120;
  return Math.max(1, Math.ceil(Math.min(packageTatHours, priorityCap) / 24));
}

export function createEmptyCaseDraft(): CaseDraft {
  return {
    candidate: "",
    email: "",
    phone: "",
    clientId: "",
    client: "",
    servicePackageId: "",
    services: [],
    packageName: "",
    packageTatHours: 0,
    priority: "Standard",
    checks: [],
  };
}
