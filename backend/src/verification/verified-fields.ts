import { BadRequestException } from "@nestjs/common";
import type { InitiationField } from "../workflow/initiation-fields";
import { DIRECTORSHIP_DATABASES } from "./check-sources";

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

/**
 * Drug panel substances in the order of the Sample Report's 11-panel table. Keys of
 * substances recorded before this order existed are kept (e.g. "cannabinoids").
 */
export const DRUG_SUBSTANCES: ReadonlyArray<{ key: string; label: string }> = [
  { key: "amphetamines", label: "Amphetamines" },
  { key: "barbiturates", label: "Barbiturates" },
  { key: "benzodiazepines", label: "Benzodiazepines" },
  { key: "cocainemetabolites", label: "Cocaine" },
  { key: "cannabinoids", label: "Marijuana (THC)" },
  { key: "meperidine", label: "Meperidine" },
  { key: "methadone", label: "Methadone" },
  { key: "opiates", label: "Opiates" },
  { key: "oxycodone", label: "Oxycodone" },
  { key: "phencyclidinepcp", label: "Phencyclidine" },
  { key: "propoxyphene", label: "Propoxyphene" },
  { key: "mdma", label: "MDMA (Ecstasy)" },
  { key: "diazepine", label: "Diazepine" },
];

const RECORDS = ["No record found", "Record found", "Not searched"] as const;
const DISCLOSED = ["Yes", "No", "Not disclosed"] as const;

const court = (prefix: string, label: string): InitiationField[] => [
  { key: `${prefix}Name`, label: `${label} name`, group: "Courts searched" },
  {
    key: `${prefix}Status`,
    label: `${label} status`,
    kind: "select",
    options: ["No records found", "Record found", "Not searched"],
    group: "Courts searched",
  },
];

/** Referee questions of the Sample Report's reference annexure, in order. */
export const REFERENCE_QUESTIONS: ReadonlyArray<{
  key: string;
  label: string;
}> = [
  {
    key: "association",
    label: "How were you associated with the candidate and during what period?",
  },
  {
    key: "responsibilities",
    label:
      "Describe the primary job responsibility of the candidate during this association period",
  },
  { key: "strengths", label: "What are the candidate's strengths?" },
  {
    key: "improvementAreas",
    label:
      "What are the areas the candidate may focus on for self-improvement?",
  },
  {
    key: "interpersonal",
    label:
      "Comment on the candidate's interpersonal involvement within and outside the team",
  },
  {
    key: "compliance",
    label:
      "How is the candidate's general attitude towards complying with rules and regulations?",
  },
  {
    key: "integrity",
    label:
      "Comment on the sincerity, integrity and general reputation of the candidate",
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
        group: "Employment as confirmed",
      },
      {
        key: "employerAddress",
        label: "Company address",
        group: "Employment as confirmed",
      },
      {
        key: "tenureFrom",
        label: "Tenure from (confirmed)",
        kind: "date",
        group: "Employment as confirmed",
      },
      {
        key: "tenureTo",
        label: "Tenure to (confirmed)",
        kind: "date",
        group: "Employment as confirmed",
      },
      {
        key: "designation",
        label: "Designation (confirmed)",
        group: "Employment as confirmed",
      },
      {
        key: "ctc",
        label: "CTC in INR (confirmed)",
        group: "Employment as confirmed",
      },
      {
        key: "empCode",
        label: "Employee code (confirmed)",
        group: "Employment as confirmed",
      },
      {
        key: "reasonForLeaving",
        label: "Reason for leaving",
        group: "Exit and conduct",
      },
      {
        key: "reportingManager",
        label: "Reporting manager (name and designation)",
        group: "Exit and conduct",
      },
      {
        key: "integrityIssues",
        label: "Any disciplinary / integrity / performance issues?",
        kind: "select",
        options: DISCLOSED,
        group: "Exit and conduct",
      },
      {
        key: "rehireEligible",
        label: "Eligible for rehire",
        kind: "select",
        options: DISCLOSED,
        group: "Exit and conduct",
      },
      {
        key: "verifierName",
        label: "Verified by (name)",
        required: true,
        group: "Referee",
      },
      {
        key: "verifierDesignation",
        label: "Verifier designation",
        group: "Referee",
      },
      {
        key: "verifierContact",
        label: "Verifier contact / email",
        group: "Referee",
      },
      {
        key: "refereeComments",
        label: "Referee's comments",
        kind: "long",
        group: "Referee",
      },
      {
        key: "uanStatus",
        label: "UAN status",
        kind: "select",
        options: ["Matched", "Not matched", "Not available"],
        group: "Method",
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
        group: "Method",
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
        label: "Institute / college (confirmed)",
        required: true,
        group: "Qualification as confirmed",
      },
      {
        key: "university",
        label: "University / board (confirmed)",
        group: "Qualification as confirmed",
      },
      {
        key: "degree",
        label: "Degree / course (confirmed)",
        group: "Qualification as confirmed",
      },
      {
        key: "passingYear",
        label: "Passing year (confirmed)",
        kind: "year",
        group: "Qualification as confirmed",
      },
      {
        key: "rollNumber",
        label: "Roll / registration number",
        group: "Qualification as confirmed",
      },
      {
        key: "resultStatus",
        label: "Result",
        kind: "select",
        options: ["Passed", "Failed", "Not disclosed"],
        group: "Qualification as confirmed",
      },
      {
        key: "verified",
        label: "Verified",
        required: true,
        kind: "select",
        options: YES_NO,
        group: "Qualification as confirmed",
      },
      {
        key: "verifierName",
        label: "Verified by (name)",
        group: "Referee",
      },
      {
        key: "verifierDesignation",
        label: "Verifier designation",
        group: "Referee",
      },
      { key: "verifierContact", label: "Verifier contact", group: "Referee" },
      {
        key: "refereeComments",
        label: "Referee's comments",
        kind: "long",
        group: "Referee",
      },
      {
        key: "method",
        label: "Method of verification",
        required: true,
        kind: "select",
        options: [
          "Email",
          "Online portal",
          "Online database",
          "Written response",
          "Site visit",
          "Vendor",
        ],
        group: "Method",
      },
      DATE,
      ...extraCost,
    ],
  },
  ADDRESS: {
    repeatable: true,
    fields: [
      {
        key: "addressConfirmed",
        label: "Address confirmed",
        required: true,
        kind: "select",
        options: YES_NO,
        group: "Residence",
      },
      {
        key: "durationOfStay",
        label: "Duration of stay",
        group: "Residence",
      },
      {
        key: "natureOfResidence",
        label: "Nature of residence",
        kind: "select",
        options: [
          "Rented",
          "Owned",
          "Family owned",
          "Hostel",
          "PG",
          "Company provided",
          "Other",
        ],
        group: "Residence",
      },
      {
        key: "residencyProof",
        label: "Residency proof (address / ID)",
        kind: "select",
        options: [
          "Aadhaar",
          "Voter ID",
          "Passport",
          "Driving licence",
          "Utility bill",
          "Rent agreement",
          "Not disclosed",
        ],
        group: "Residence",
      },
      {
        key: "residencyProofNumber",
        label: "Residency proof number",
        group: "Residence",
      },
      {
        key: "respondentName",
        label: "Respondent name",
        required: true,
        group: "Respondent",
      },
      {
        key: "relationship",
        label: "Relationship with candidate",
        group: "Respondent",
      },
      {
        key: "respondentContact",
        label: "Respondent contact number",
        group: "Respondent",
      },
      {
        key: "respondentSignature",
        label: "Respondent signature",
        kind: "select",
        options: YES_NO,
        group: "Respondent",
      },
      {
        key: "closureTime",
        label: "Closure time (HH:MM)",
        kind: "time",
        group: "Closure",
      },
      {
        key: "geoTagged",
        label: "Geo-tagged",
        kind: "select",
        options: YES_NO,
        group: "Closure",
      },
      {
        key: "latLong",
        label: "Latitude, longitude",
        group: "Closure",
      },
      {
        key: "remarks",
        label: "Remarks",
        kind: "long",
        group: "Closure",
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
        group: "Closure",
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
        group: "Method",
      },
      {
        key: "method",
        label: "Mode of verification",
        required: true,
        kind: "select",
        options: ["Online court records", "Law firm", "Vendor"],
        group: "Method",
      },
      DATE,
    ],
  },
  CRIMINAL: {
    repeatable: false,
    fields: [
      {
        key: "policeStation",
        label: "Police station",
        required: true,
        group: "Police record",
      },
      {
        key: "respondentName",
        label: "Respondent name",
        group: "Police record",
      },
      {
        key: "respondentContact",
        label: "Respondent contact",
        group: "Police record",
      },
      {
        key: "respondentDesignation",
        label: "Respondent designation",
        group: "Police record",
      },
      {
        key: "years",
        label: "Duration of records check",
        kind: "select",
        options: ["7", "10"],
        group: "Method",
      },
      {
        key: "method",
        label: "Method of verification",
        required: true,
        kind: "select",
        options: ["Law firm", "Police station visit", "PCC", "Vendor"],
        group: "Method",
      },
      {
        key: "challanReference",
        label: "Payment / challan reference (PCC)",
        group: "Method",
      },
      DATE,
    ],
  },
  GLOBAL_DATABASE: {
    repeatable: false,
    fields: [
      {
        key: "indiaDatabases",
        label: "Indian specific database searches",
        required: true,
        kind: "select",
        options: RECORDS,
        group: "Results",
      },
      {
        key: "globalSanctions",
        label: "Global sanctions check (incl. OFAC)",
        required: true,
        kind: "select",
        options: RECORDS,
        group: "Results",
      },
      {
        key: "databases",
        label: "Other databases searched",
        group: "Results",
      },
      {
        key: "matchDetails",
        label: "Record details (if found)",
        kind: "long",
        group: "Results",
      },
      {
        key: "method",
        label: "Method of verification",
        required: true,
        kind: "select",
        options: ["Online database", "Vendor"],
        group: "Method",
      },
      DATE,
    ],
  },
  DIRECTORSHIP: {
    repeatable: false,
    fields: [
      ...DIRECTORSHIP_DATABASES.map((database): InitiationField => ({
        key: database.key,
        label: database.name,
        required: true,
        kind: "select",
        options: RECORDS,
        group: "Results",
      })),
      {
        key: "matchDetails",
        label: "Record details (if found)",
        kind: "long",
        group: "Results",
      },
      {
        key: "method",
        label: "Method of verification",
        required: true,
        kind: "select",
        options: ["Online database", "MCA portal", "Vendor"],
        group: "Method",
      },
      DATE,
    ],
  },
  ADVERSE_MEDIA: {
    repeatable: false,
    fields: [
      {
        key: "internetSearches",
        label: "Internet searches",
        required: true,
        kind: "select",
        options: RECORDS,
        group: "Web and media",
      },
      {
        key: "mediaSearches",
        label: "Media searches",
        required: true,
        kind: "select",
        options: RECORDS,
        group: "Web and media",
      },
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
        group: "Social media",
      })),
      {
        key: "matchDetails",
        label: "Adverse content details (if found)",
        kind: "long",
        group: "Social media",
      },
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
        group: "Test",
      },
      {
        key: "collection",
        label: "Collection method",
        required: true,
        kind: "select",
        options: ["Home collection", "Lab collection", "Site visit collection"],
        group: "Test",
      },
      { key: "labName", label: "Laboratory", group: "Test" },
      ...DRUG_SUBSTANCES.map((substance): InitiationField => ({
        key: `substance_${substance.key}`,
        label: substance.label,
        kind: "select",
        options: ["Negative", "Positive", "Not tested"],
        group: "Panel results",
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
      {
        key: "refereeName",
        label: "Name of referee",
        required: true,
        group: "Referee",
      },
      {
        key: "relationship",
        label: "Relationship with candidate",
        group: "Referee",
      },
      { key: "designation", label: "Designation", group: "Referee" },
      {
        key: "organisation",
        label: "Organisation name and address",
        group: "Referee",
      },
      { key: "refereeContact", label: "Contact details", group: "Referee" },
      ...REFERENCE_QUESTIONS.map((question): InitiationField => ({
        key: question.key,
        label: question.label,
        kind: "long",
        group: "Referee's answers",
      })),
      {
        key: "feedback",
        label: "Remark (overall feedback)",
        required: true,
        kind: "long",
        group: "Referee's answers",
      },
      {
        key: "method",
        label: "Method of verification",
        required: true,
        kind: "select",
        options: ["Phone", "Email", "In person"],
        group: "Method",
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
  time: /^([01]\d|2[0-3]):[0-5]\d$/,
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
