import { BadRequestException } from "@nestjs/common";
import type { InitiationField } from "../workflow/initiation-fields";

/**
 * RHS (right-hand side) of a check from the BGV process document: what the source
 * confirmed, recorded by the verifier next to the LHS the candidate / Data Entry gave.
 */
export type VerifiedForm = {
  /** One entry per LHS entry (e.g. each previous employer). */
  repeatable: boolean;
  fields: readonly InitiationField[];
};

const YES_NO = ["Yes", "No"] as const;
const DATE = {
  key: "verificationDate",
  label: "Verification date",
  required: true,
  kind: "date",
} as const;
const extraCost: InitiationField[] = [
  { key: "extraCost", label: "Extra cost (₹)" },
  { key: "extraCostApproval", label: "Extra cost approval (mail / reference)" },
];

const SUBSTANCES = [
  "Amphetamines",
  "Cocaine metabolites",
  "Phencyclidine (PCP)",
  "Opiates",
  "Cannabinoids",
  "Barbiturates",
  "Diazepine",
  "Propoxyphene",
  "MDMA",
  "Benzodiazepines",
] as const;

const court = (prefix: string, label: string): InitiationField[] => [
  { key: `${prefix}Name`, label: `${label} name` },
  {
    key: `${prefix}Status`,
    label: `${label} status`,
    kind: "select",
    options: ["No records found", "Record found", "Not searched"],
  },
];

export const VERIFIED_FORMS: Readonly<Record<string, VerifiedForm>> = {
  EMPLOYMENT: {
    repeatable: true,
    fields: [
      {
        key: "employerName",
        label: "Employer name (confirmed)",
        required: true,
      },
      { key: "tenureFrom", label: "Tenure from (confirmed)", kind: "date" },
      { key: "tenureTo", label: "Tenure to (confirmed)", kind: "date" },
      { key: "designation", label: "Designation (confirmed)" },
      { key: "verifierName", label: "Verified by (name)", required: true },
      { key: "verifierDesignation", label: "Verifier designation" },
      { key: "verifierContact", label: "Verifier contact / email" },
      {
        key: "uanStatus",
        label: "UAN status",
        kind: "select",
        options: ["Matched", "Not matched", "Not available"],
      },
      {
        key: "method",
        label: "Method of verification",
        required: true,
        kind: "select",
        options: [
          "Email",
          "Online portal",
          "Site visit",
          "UAN",
          "Tax records",
          "Verbal",
          "Bank statement",
        ],
      },
      DATE,
      ...extraCost,
    ],
  },
  EDUCATION: {
    repeatable: true,
    fields: [
      {
        key: "institute",
        label: "Institute / university (confirmed)",
        required: true,
      },
      { key: "degree", label: "Degree / course (confirmed)" },
      { key: "passingYear", label: "Passing year (confirmed)", kind: "year" },
      { key: "rollNumber", label: "Roll / registration number" },
      {
        key: "verified",
        label: "Verified",
        required: true,
        kind: "select",
        options: YES_NO,
      },
      { key: "verifierName", label: "Verified by (name)" },
      { key: "verifierDesignation", label: "Verifier designation" },
      { key: "verifierContact", label: "Verifier contact" },
      {
        key: "method",
        label: "Method of verification",
        required: true,
        kind: "select",
        options: [
          "Email",
          "Online portal",
          "Online database",
          "Site visit",
          "Vendor",
        ],
      },
      DATE,
      ...extraCost,
    ],
  },
  ADDRESS: {
    repeatable: true,
    fields: [
      { key: "respondentName", label: "Respondent name", required: true },
      { key: "relationship", label: "Relationship with candidate" },
      {
        key: "addressConfirmed",
        label: "Address confirmed",
        required: true,
        kind: "select",
        options: YES_NO,
      },
      { key: "durationOfStay", label: "Duration of stay" },
      {
        key: "geoTagged",
        label: "Geo-tagged",
        kind: "select",
        options: YES_NO,
      },
      {
        key: "respondentSignature",
        label: "Respondent signature",
        kind: "select",
        options: YES_NO,
      },
      {
        key: "method",
        label: "Method of verification",
        required: true,
        kind: "select",
        options: [
          "Digital address link",
          "Physical visit",
          "Vendor visit",
          "Phone",
        ],
      },
      DATE,
    ],
  },
  COURT_RECORD: {
    repeatable: false,
    fields: [
      ...court("districtCourt", "District court"),
      ...court("highCourt", "High court"),
      ...court("supremeCourt", "Supreme court"),
      ...court("magistrateCourt", "Magistrate court"),
      ...court("sessionCourt", "Session court"),
      {
        key: "years",
        label: "Duration of records check",
        required: true,
        kind: "select",
        options: ["7", "10"],
      },
      {
        key: "method",
        label: "Mode of verification",
        required: true,
        kind: "select",
        options: ["Online court records", "Law firm", "Vendor"],
      },
      DATE,
    ],
  },
  CRIMINAL: {
    repeatable: false,
    fields: [
      { key: "policeStation", label: "Police station", required: true },
      { key: "respondentName", label: "Respondent name" },
      { key: "respondentContact", label: "Respondent contact" },
      { key: "respondentDesignation", label: "Respondent designation" },
      {
        key: "years",
        label: "Duration of records check",
        kind: "select",
        options: ["7", "10"],
      },
      {
        key: "method",
        label: "Method of verification",
        required: true,
        kind: "select",
        options: ["Law firm", "Police station visit", "PCC", "Vendor"],
      },
      { key: "challanReference", label: "Payment / challan reference (PCC)" },
      DATE,
    ],
  },
  GLOBAL_DATABASE: {
    repeatable: false,
    fields: [
      { key: "databases", label: "Databases searched", required: true },
      {
        key: "method",
        label: "Method of verification",
        required: true,
        kind: "select",
        options: ["Online database", "Vendor"],
      },
      DATE,
    ],
  },
  ADVERSE_MEDIA: {
    repeatable: false,
    fields: [
      ...[
        "Facebook",
        "Instagram",
        "LinkedIn",
        "X (Twitter)",
        "Snapchat",
        "WeChat",
      ].map((platform): InitiationField => ({
        key: platform.replace(/\W+/g, "").toLowerCase(),
        label: platform,
        kind: "select",
        options: ["No adverse content", "Adverse content", "No profile found"],
      })),
      DATE,
    ],
  },
  DRUG_TEST: {
    repeatable: false,
    fields: [
      {
        key: "panel",
        label: "Panel",
        required: true,
        kind: "select",
        options: Array.from({ length: 13 }, (_, i) => String(i + 3)),
      },
      {
        key: "collection",
        label: "Collection method",
        required: true,
        kind: "select",
        options: ["Home collection", "Lab collection", "Site visit collection"],
      },
      ...SUBSTANCES.map((name): InitiationField => ({
        key: `substance_${name.replace(/\W+/g, "").toLowerCase()}`,
        label: name,
        kind: "select",
        options: ["Negative", "Positive", "Not tested"],
      })),
      DATE,
    ],
  },
  IDENTITY: {
    repeatable: true,
    fields: [
      { key: "idType", label: "ID type", required: true },
      { key: "idNumber", label: "ID number (confirmed)", required: true },
      {
        key: "nameMatch",
        label: "Name matches",
        required: true,
        kind: "select",
        options: YES_NO,
      },
      {
        key: "method",
        label: "Method of verification",
        required: true,
        kind: "select",
        options: ["Government API", "Online portal", "Document check"],
      },
      DATE,
    ],
  },
  REFERENCE: {
    repeatable: true,
    fields: [
      { key: "refereeName", label: "Referee name", required: true },
      { key: "relationship", label: "Relationship / designation" },
      { key: "feedback", label: "Feedback summary", required: true },
      {
        key: "method",
        label: "Method of verification",
        required: true,
        kind: "select",
        options: ["Phone", "Email", "In person"],
      },
      DATE,
    ],
  },
};

/** Any other check: a light, generic RHS. */
export const GENERIC_VERIFIED_FORM: VerifiedForm = {
  repeatable: false,
  fields: [
    { key: "sourceName", label: "Source checked", required: true },
    { key: "method", label: "Method of verification", required: true },
    DATE,
  ],
};

export const verifiedFormFor = (type: string) =>
  VERIFIED_FORMS[type.toUpperCase()] ?? GENERIC_VERIFIED_FORM;

const PATTERNS: Record<string, RegExp> = {
  year: /^(19|20)[0-9]{2}$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
};

/** Validates and trims RHS entries for one check; unknown keys are dropped. */
export function cleanVerified(
  type: string,
  entries: ReadonlyArray<Record<string, unknown>>,
) {
  const form = verifiedFormFor(type);
  if (!entries.length)
    throw new BadRequestException("Add the verified details");
  if (!form.repeatable && entries.length > 1)
    throw new BadRequestException("This check takes a single entry");
  if (entries.length > 10) throw new BadRequestException("At most 10 entries");
  return entries.map((entry, index) => {
    const where = form.repeatable ? ` (entry ${index + 1})` : "";
    const clean: Record<string, string> = {};
    for (const field of form.fields) {
      const raw = entry[field.key];
      const value = typeof raw === "string" ? raw.trim() : "";
      if (!value) {
        if (field.required)
          throw new BadRequestException(`${field.label} is required${where}`);
        continue;
      }
      if (value.length > 500)
        throw new BadRequestException(`${field.label} is too long${where}`);
      if (field.options && !field.options.includes(value))
        throw new BadRequestException(
          `${field.label}: choose one of the options${where}`,
        );
      const pattern = field.kind ? PATTERNS[field.kind] : undefined;
      if (pattern && !pattern.test(value))
        throw new BadRequestException(`${field.label} is not valid${where}`);
      clean[field.key] = value;
    }
    return clean;
  });
}

/**
 * Check-specific status wording from the process document (court / database checks say
 * "No records found / Record found", drug tests say "Negative / Positive").
 */
export function checkStatusLabel(
  type: string,
  result: string | null | undefined,
  disposition?: string | null,
): string {
  const kind = type.toUpperCase();
  const records = [
    "COURT_RECORD",
    "CRIMINAL",
    "GLOBAL_DATABASE",
    "ADVERSE_MEDIA",
    "SANCTIONS",
  ];
  if (disposition === "CLIENT_REVIEW") return "Client review";
  if (result === "UNABLE_TO_VERIFY") return "Unable to verify";
  if (kind === "DRUG_TEST") {
    if (result === "CLEAR") return "Negative";
    if (result === "DISCREPANCY") return "Positive";
  }
  if (records.includes(kind)) {
    if (result === "CLEAR") return "Verified — no records found";
    if (result === "DISCREPANCY") return "Discrepancy — record found";
  }
  if (result === "CLEAR")
    return disposition === "BLUE" ? "Verified (verbal)" : "Verified";
  if (result === "DISCREPANCY")
    return disposition === "YELLOW" ? "Minor discrepancy" : "Major discrepancy";
  return "In progress";
}
