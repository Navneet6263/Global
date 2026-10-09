import { BadRequestException } from "@nestjs/common";

/**
 * Check-wise initiation (BGV process document, "Data Entry Supplier → Initiation"):
 * the details Data Entry records for each check before the case goes to verification.
 * Fields marked * in the document are required here.
 */
export type InitiationField = {
  key: string;
  label: string;
  required?: boolean;
  kind?: "text" | "select" | "email" | "phone" | "pincode" | "year" | "date";
  options?: readonly string[];
};

export type InitiationForm = {
  /** More than one entry, e.g. previous employers or addresses ("option Add"). */
  repeatable: boolean;
  fields: readonly InitiationField[];
};

const ID_TYPES = [
  "PAN",
  "Aadhaar",
  "Voter ID",
  "Passport",
  "Driving licence",
  "UAN",
] as const;

export const INITIATION_FORMS: Readonly<Record<string, InitiationForm>> = {
  ADDRESS: {
    repeatable: true,
    fields: [
      {
        key: "addressType",
        label: "Address type",
        required: true,
        kind: "select",
        options: ["Current", "Permanent", "Previous"],
      },
      { key: "address", label: "Address", required: true },
      { key: "city", label: "City", required: true },
      { key: "state", label: "State", required: true },
      { key: "pincode", label: "Pin code", required: true, kind: "pincode" },
      {
        key: "contactNumber",
        label: "Contact number",
        required: true,
        kind: "phone",
      },
      { key: "alternateNumber", label: "Alternate number", kind: "phone" },
      { key: "landmark", label: "Landmark" },
    ],
  },
  EMPLOYMENT: {
    repeatable: true,
    fields: [
      { key: "employerName", label: "Employer name", required: true },
      { key: "tenureFrom", label: "Tenure from", required: true, kind: "date" },
      { key: "tenureTo", label: "Tenure to", required: true, kind: "date" },
      { key: "designation", label: "Designation" },
      { key: "ctc", label: "CTC" },
      { key: "empCode", label: "Employee code", required: true },
      { key: "hrContact", label: "HR contact" },
      { key: "hrEmail", label: "HR email", kind: "email" },
      { key: "uan", label: "UAN" },
    ],
  },
  EDUCATION: {
    repeatable: true,
    fields: [
      { key: "institute", label: "Institute / college", required: true },
      { key: "university", label: "University" },
      { key: "degree", label: "Degree / course", required: true },
      {
        key: "passingYear",
        label: "Passing year",
        required: true,
        kind: "year",
      },
      { key: "rollNumber", label: "Roll number" },
    ],
  },
  CRIMINAL: {
    repeatable: true,
    fields: [
      {
        key: "addressBasis",
        label: "Search address",
        required: true,
        kind: "select",
        options: ["Current", "Permanent"],
      },
      {
        key: "years",
        label: "Years searched",
        required: true,
        kind: "select",
        options: ["7", "10"],
      },
    ],
  },
  COURT_RECORD: {
    repeatable: true,
    fields: [
      {
        key: "addressBasis",
        label: "Search address",
        required: true,
        kind: "select",
        options: ["Current", "Permanent"],
      },
      {
        key: "years",
        label: "Years searched",
        required: true,
        kind: "select",
        options: ["7", "10"],
      },
    ],
  },
  IDENTITY: {
    repeatable: true,
    fields: [
      {
        key: "idType",
        label: "ID type",
        required: true,
        kind: "select",
        options: ID_TYPES,
      },
      { key: "idNumber", label: "ID number", required: true },
    ],
  },
  PAN_VALIDATION: {
    repeatable: false,
    fields: [{ key: "idNumber", label: "PAN number", required: true }],
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
    ],
  },
  REFERENCE: {
    repeatable: true,
    fields: [
      { key: "name", label: "Reference name", required: true },
      { key: "relationship", label: "Relationship / designation" },
      { key: "phone", label: "Phone", required: true, kind: "phone" },
      { key: "email", label: "Email", kind: "email" },
    ],
  },
};

/** Checks without a form (e.g. database or drug checks) need no initiation details. */
export function needsInitiation(checkType: string) {
  return Boolean(INITIATION_FORMS[checkType.toUpperCase()]);
}

const PATTERNS: Partial<Record<NonNullable<InitiationField["kind"]>, RegExp>> =
  {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^\+?[0-9 ()-]{7,20}$/,
    pincode: /^[1-9][0-9]{5}$/,
    year: /^(19|20)[0-9]{2}$/,
    date: /^\d{4}-\d{2}-\d{2}$/,
  };

/** Validates and trims entries for one check; unknown keys are dropped. */
export function cleanInitiation(
  checkType: string,
  entries: ReadonlyArray<Record<string, unknown>>,
) {
  const form = INITIATION_FORMS[checkType.toUpperCase()];
  if (!form)
    throw new BadRequestException("This check needs no initiation details");
  if (!entries.length) throw new BadRequestException("Add at least one entry");
  if (!form.repeatable && entries.length > 1)
    throw new BadRequestException("This check takes a single entry");
  if (entries.length > 10) throw new BadRequestException("At most 10 entries");
  return entries.map((entry, index) => {
    const clean: Record<string, string> = {};
    for (const field of form.fields) {
      const raw = entry[field.key];
      const value = typeof raw === "string" ? raw.trim() : "";
      const where = form.repeatable ? ` (entry ${index + 1})` : "";
      if (!value) {
        if (field.required)
          throw new BadRequestException(`${field.label} is required${where}`);
        continue;
      }
      if (value.length > 300)
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
    if (clean.tenureFrom && clean.tenureTo && clean.tenureTo < clean.tenureFrom)
      throw new BadRequestException(
        `Tenure to must be after tenure from${form.repeatable ? ` (entry ${index + 1})` : ""}`,
      );
    return clean;
  });
}
