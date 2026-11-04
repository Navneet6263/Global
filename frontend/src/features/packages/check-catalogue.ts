/**
 * Every check a package can include, with the reference price and TAT from "Package and
 * Alacarte Price Reference For Portal". Reference prices only pre-fill the package builder;
 * Operations can set any price. Each check also says which document the candidate uploads
 * for it, and why, so a package always shows what its candidate will be asked for.
 *
 * A copy of backend/src/packages/check-catalogue.ts so the package builder can show the
 * candidate's documents as Operations edits; frontend/test/check-catalogue.test.mjs fails if
 * the two drift apart. The backend copy decides what is stored.
 */

export type CheckGroup =
  | "Identity"
  | "Address"
  | "Employment"
  | "Education"
  | "Court & police"
  | "Databases"
  | "Financial"
  | "Other";

export type CheckOptionKind = "LEVELS" | "ADDRESSES" | "IDS" | "COUNT" | "PANEL";

export type Choice = { value: string; label: string; price?: number };

export type CheckOptionRule = {
  kind: CheckOptionKind;
  label: string;
  choices?: readonly Choice[];
  /** COUNT only. */
  max?: number;
};

export type CatalogueCheck = {
  type: string;
  label: string;
  group: CheckGroup;
  /** Reference price (INR) from the price sheet. */
  price?: number;
  priceNote?: string;
  /** Reference TAT in working days. */
  tatDays?: number;
  option?: CheckOptionRule;
  /** The document the candidate uploads (IDS: the chosen IDs instead). */
  document?: string;
  /** Why that document is needed, or why none is. */
  why: string;
};

export type CheckOptions = {
  levels?: string[];
  addresses?: string[];
  ids?: string[];
  count?: number;
  panel?: string;
};

export const DOCUMENT_LABELS: Readonly<Record<string, string>> = {
  AADHAAR: "Aadhaar card",
  PAN: "PAN card",
  PASSPORT: "Passport",
  DRIVING_LICENCE: "Driving licence",
  ADDRESS_PROOF: "Address proof",
  EDUCATION_CERTIFICATE: "Education certificate / marksheet",
  EMPLOYMENT_PROOF: "Relieving / experience letter",
  BANK_PROOF: "Cancelled cheque / bank statement",
  OTHER: "Other document",
};

const ADDRESSES: CheckOptionRule = {
  kind: "ADDRESSES",
  label: "Addresses",
  choices: [
    { value: "CURRENT", label: "Current" },
    { value: "PERMANENT", label: "Permanent" },
  ],
};

export const CHECK_CATALOGUE: readonly CatalogueCheck[] = [
  {
    type: "IDENTITY",
    label: "National ID check",
    group: "Identity",
    price: 100,
    tatDays: 3,
    option: {
      kind: "IDS",
      label: "IDs to verify",
      choices: [
        { value: "AADHAAR", label: "Aadhaar" },
        { value: "PAN", label: "PAN" },
        { value: "PASSPORT", label: "Passport" },
        { value: "DRIVING_LICENCE", label: "Driving licence" },
      ],
    },
    why: "Each ID is matched with the issuing authority's records.",
  },
  {
    type: "ADDRESS",
    label: "Residential address - physical",
    group: "Address",
    price: 350,
    tatDays: 10,
    option: ADDRESSES,
    document: "ADDRESS_PROOF",
    why: "The field visit confirms the address shown on the proof.",
  },
  {
    type: "DIGITAL_ADDRESS",
    label: "Residential address - digital",
    group: "Address",
    price: 200,
    tatDays: 5,
    option: ADDRESSES,
    document: "ADDRESS_PROOF",
    why: "The candidate confirms the address on a geo-tagged link; the proof is matched with it.",
  },
  {
    type: "CORPORATE_ADDRESS",
    label: "Corporate address verification",
    group: "Address",
    price: 500,
    tatDays: 7,
    why: "The company address is given at initiation; the candidate uploads nothing.",
  },
  {
    type: "EMPLOYMENT",
    label: "Employment credential check",
    group: "Employment",
    price: 250,
    tatDays: 12,
    option: { kind: "COUNT", label: "Employers to verify", max: 5 },
    document: "EMPLOYMENT_PROOF",
    why: "A letter for each employer, confirmed with that employer's HR.",
  },
  {
    type: "UAN_CHECK",
    label: "Digital employment check (UAN)",
    group: "Employment",
    price: 150,
    tatDays: 3,
    why: "Checked on the EPFO record with the UAN number; no document.",
  },
  {
    type: "EDUCATION",
    label: "Education credential check",
    group: "Education",
    price: 350,
    priceNote: "+ official fees as per actual",
    tatDays: 14,
    option: {
      kind: "LEVELS",
      label: "Qualifications to verify",
      choices: [
        { value: "HIGHEST", label: "Highest qualification" },
        { value: "10TH", label: "10th (SSC)" },
        { value: "12TH", label: "12th (HSC)" },
        { value: "DIPLOMA", label: "Diploma" },
        { value: "GRADUATION", label: "Graduation" },
        { value: "POST_GRADUATION", label: "Post graduation / MBA" },
        { value: "PHD", label: "PhD" },
      ],
    },
    document: "EDUCATION_CERTIFICATE",
    why: "A certificate or final marksheet for each qualification, sent to the board or university.",
  },
  {
    type: "CRIMINAL",
    label: "Police record check through court",
    group: "Court & police",
    price: 250,
    tatDays: 3,
    option: ADDRESSES,
    why: "Searched with the address details; no document.",
  },
  {
    type: "COURT_RECORD",
    label: "Criminal - court record check (CRC)",
    group: "Court & police",
    price: 200,
    tatDays: 3,
    option: ADDRESSES,
    why: "Court records are searched for each address; no document.",
  },
  {
    type: "GLOBAL_DATABASE",
    label: "Global database check",
    group: "Databases",
    price: 225,
    tatDays: 3,
    why: "Searched with name and date of birth; no document.",
  },
  {
    type: "INDIA_DATABASE",
    label: "Indian database check",
    group: "Databases",
    price: 250,
    tatDays: 3,
    why: "Searched with name and date of birth; no document.",
  },
  {
    type: "SOCIAL_MEDIA",
    label: "Social media check",
    group: "Databases",
    price: 300,
    tatDays: 5,
    why: "Public profiles are found from name, email and phone; no document.",
  },
  {
    type: "DIRECTORSHIP",
    label: "Directorship check",
    group: "Databases",
    price: 200,
    tatDays: 5,
    why: "MCA records are searched with the name and PAN; no document.",
  },
  {
    type: "CREDIT_CHECK",
    label: "Credit check (CIBIL)",
    group: "Financial",
    price: 250,
    tatDays: 3,
    document: "PAN",
    why: "The CIBIL report is pulled with the candidate's PAN.",
  },
  {
    type: "BANK_ACCOUNT",
    label: "Bank account verification",
    group: "Financial",
    price: 275,
    tatDays: 5,
    document: "BANK_PROOF",
    why: "The cheque or statement shows the account number and IFSC to verify.",
  },
  {
    type: "REFERENCE",
    label: "Professional reference check",
    group: "Other",
    price: 200,
    tatDays: 5,
    option: { kind: "COUNT", label: "References", max: 5 },
    why: "Name and phone of each referee; no document.",
  },
  {
    type: "DRUG_TEST",
    label: "Drug panel test",
    group: "Other",
    price: 850,
    tatDays: 5,
    option: {
      kind: "PANEL",
      label: "Panel",
      choices: [
        { value: "5", label: "5 panel", price: 850 },
        { value: "7", label: "7 panel", price: 950 },
        { value: "10", label: "10 panel", price: 1050 },
        { value: "12", label: "12 panel", price: 1250 },
      ],
    },
    why: "The ID is shown at sample collection; nothing to upload.",
  },
  ...(
    [
      ["RESUME_CONSISTENCY", "Resume consistency"],
      ["CONFLICT_OF_INTEREST", "Conflict of interest"],
      ["ANTI_BRIBERY", "Anti-bribery"],
      ["MISCONDUCT", "Misconduct"],
      ["ADVERSE_MEDIA", "Adverse media"],
      ["BUSINESS_INTEREST", "Business interest"],
      ["SANCTIONS", "Sanctions"],
      ["COMPANY_REGISTRATION", "Company registration"],
      ["GST_VALIDATION", "GST validation"],
      ["PAN_VALIDATION", "PAN validation"],
      ["MCA_VALIDATION", "MCA validation"],
    ] as const
  ).map(([type, label]): CatalogueCheck => ({
    type,
    label,
    group: "Other",
    ...(type === "PAN_VALIDATION"
      ? { document: "PAN", why: "The PAN is validated with the Income Tax records." }
      : { why: "Searched from the details given; no document." }),
  })),
];

export const catalogueCheck = (type: string) =>
  CHECK_CATALOGUE.find((entry) => entry.type === type);

const choiceValues = (rule: CheckOptionRule) => (rule.choices ?? []).map((choice) => choice.value);

/** The default option for a check: one current address, Aadhaar, highest degree, 1. */
export function defaultOptions(type: string): CheckOptions | undefined {
  const rule = catalogueCheck(type)?.option;
  if (!rule) return undefined;
  if (rule.kind === "LEVELS") return { levels: ["HIGHEST"] };
  if (rule.kind === "ADDRESSES") return { addresses: ["CURRENT"] };
  if (rule.kind === "IDS") return { ids: ["AADHAAR"] };
  if (rule.kind === "COUNT") return { count: 1 };
  return { panel: "5" };
}

const KEY: Record<CheckOptionKind, keyof CheckOptions> = {
  LEVELS: "levels",
  ADDRESSES: "addresses",
  IDS: "ids",
  COUNT: "count",
  PANEL: "panel",
};

/**
 * Keeps only valid options for checks in the package; anything missing or invalid falls
 * back to the check's default, so every option-bearing check always has one.
 */
export function cleanCheckOptions(
  raw: unknown,
  checks: readonly string[],
): Record<string, CheckOptions> {
  const input =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Record<string, CheckOptions> = {};
  for (const type of checks) {
    const rule = catalogueCheck(type)?.option;
    if (!rule) continue;
    const given = input[type];
    const value =
      given && typeof given === "object"
        ? (given as Record<string, unknown>)[KEY[rule.kind]]
        : undefined;
    if (rule.kind === "COUNT") {
      const count = Number(value);
      out[type] =
        Number.isInteger(count) && count >= 1 && count <= (rule.max ?? 5)
          ? { count }
          : defaultOptions(type)!;
    } else if (rule.kind === "PANEL") {
      out[type] =
        typeof value === "string" && choiceValues(rule).includes(value)
          ? { panel: value }
          : defaultOptions(type)!;
    } else {
      const allowed = choiceValues(rule);
      const picked = Array.isArray(value) ? allowed.filter((choice) => value.includes(choice)) : [];
      out[type] = picked.length ? { [KEY[rule.kind]]: picked } : defaultOptions(type)!;
    }
  }
  return out;
}

export function parseCheckOptions(value: string | null | undefined, checks: readonly string[]) {
  try {
    return cleanCheckOptions(JSON.parse(value ?? "{}"), checks);
  } catch {
    return cleanCheckOptions({}, checks);
  }
}

const choiceLabel = (rule: CheckOptionRule | undefined, value: string) =>
  rule?.choices?.find((choice) => choice.value === value)?.label ?? value;

/** What one check needs from the candidate: document types and the papers in each. */
function checkNeeds(type: string, options: CheckOptions | undefined) {
  const entry = catalogueCheck(type);
  if (!entry) return [];
  const rule = entry.option;
  if (rule?.kind === "IDS") {
    return (options?.ids ?? ["AADHAAR"]).map((id) => ({
      document: id,
      paper: DOCUMENT_LABELS[id] ?? id,
    }));
  }
  if (!entry.document) return [];
  const papers =
    rule?.kind === "LEVELS"
      ? (options?.levels ?? ["HIGHEST"]).map((level) => choiceLabel(rule, level))
      : rule?.kind === "ADDRESSES"
        ? (options?.addresses ?? ["CURRENT"]).map(
            (address) => `${choiceLabel(rule, address)} address`,
          )
        : rule?.kind === "COUNT" && (options?.count ?? 1) > 1
          ? Array.from({ length: options?.count ?? 1 }, (_, index) => `Employer ${index + 1}`)
          : [DOCUMENT_LABELS[entry.document] ?? entry.document];
  return papers.map((paper) => ({ document: entry.document!, paper }));
}

export type DocumentPlan = {
  /** One upload per document type, as the candidate portal asks for it. */
  uploads: Array<{
    type: string;
    label: string;
    /** What the one file must contain, e.g. ["Graduation", "Post graduation / MBA"]. */
    papers: string[];
    forChecks: string[];
    why: string[];
  }>;
  /** Checks that need no document, with the reason. */
  noDocument: Array<{ type: string; label: string; why: string }>;
  totalUploads: number;
  totalPapers: number;
};

/**
 * The documents a package asks its candidate for. The portal asks one upload per document
 * type, so papers of the same type (two employers, two degrees) go in one file. A document
 * two checks share (PAN for National ID and CIBIL) is asked for once.
 */
export function documentPlan(
  checks: readonly string[],
  options: Readonly<Record<string, CheckOptions>> = {},
  extraDocuments: readonly string[] = [],
): DocumentPlan {
  const uploads = new Map<string, DocumentPlan["uploads"][number]>();
  const noDocument: DocumentPlan["noDocument"] = [];
  for (const type of new Set(checks)) {
    const entry = catalogueCheck(type);
    const label = entry?.label ?? type;
    const needs = checkNeeds(type, options[type]);
    if (!needs.length) {
      noDocument.push({
        type,
        label,
        why: entry?.why ?? "No document needed.",
      });
      continue;
    }
    for (const need of needs) {
      const row = uploads.get(need.document) ?? {
        type: need.document,
        label: DOCUMENT_LABELS[need.document] ?? need.document,
        papers: [],
        forChecks: [],
        why: [],
      };
      if (!row.papers.includes(need.paper)) row.papers.push(need.paper);
      if (!row.forChecks.includes(label)) row.forChecks.push(label);
      if (entry && !row.why.includes(entry.why)) row.why.push(entry.why);
      uploads.set(need.document, row);
    }
  }
  for (const extra of extraDocuments) {
    if (uploads.has(extra)) continue;
    uploads.set(extra, {
      type: extra,
      label: DOCUMENT_LABELS[extra] ?? extra,
      papers: [DOCUMENT_LABELS[extra] ?? extra],
      forChecks: [],
      why: ["Added to this package by Operations."],
    });
  }
  const list = [...uploads.values()];
  return {
    uploads: list,
    noDocument,
    totalUploads: list.length,
    totalPapers: list.reduce((sum, row) => sum + row.papers.length, 0),
  };
}

/** The document types a package asks for: its checks' documents plus any extras. */
export function packageRequiredDocuments(
  checks: readonly string[],
  options: Readonly<Record<string, CheckOptions>>,
  extraDocuments: readonly string[] = [],
) {
  return documentPlan(checks, options, extraDocuments).uploads.map((row) => row.type);
}
