import type { Disposition } from "./dispositions";

/**
 * Standard Colour Code Matrix (client discrepancy matrix): for each component, the
 * situations a verifier may find and the colour they mean. GREEN verified clear,
 * YELLOW minor discrepancy, ORANGE (stored as AMBER) unable to verify / inaccessible /
 * more information required, RED discrepancy. The verifier picks the situation and the
 * colour (and the result it implies) follows.
 */
export type MatrixScenario = { id: string; text: string; colour: Disposition };

const rows = (
  prefix: string,
  list: ReadonlyArray<readonly [Disposition, string]>,
): MatrixScenario[] =>
  list.map(([colour, text], index) => ({
    id: `${prefix}-${index + 1}`,
    text,
    colour,
  }));

const EDUCATION = rows("edu", [
  ["GREEN", "All details verified"],
  [
    "RED",
    "Submission of fake / forged degree certificates, mark sheets or documents",
  ],
  ["RED", "Qualification purportedly attained from a fake university"],
  [
    "RED",
    "Qualification not attained although the candidate claims it on the BVF",
  ],
  ["RED", "Qualification not attained from the institute claimed on the BVF"],
  [
    "RED",
    "Enrolment / registration number does not match the candidate, or record not found at the college / university",
  ],
  ["RED", "Tampered / forged document"],
  ["RED", "Verification not obtained because the institution does not exist"],
  ["RED", "Inaccurate dates of attendance"],
  ["YELLOW", "Unrecognised university / private institute"],
  [
    "YELLOW",
    "Verification received from college and university is not consistent",
  ],
  [
    "YELLOW",
    "Mark sheets / degree issued but not approved by UGC (graduates and post-graduates)",
  ],
  [
    "AMBER",
    "Originals not available despite requests / follow-up over 45 days",
  ],
  ["AMBER", "HSC mark sheet not approved by the State Board (under-graduates)"],
  ["AMBER", "No response / records or institution not accessible"],
  [
    "AMBER",
    "University confirms only on original certificates, which the candidate has not provided",
  ],
  ["AMBER", "Mandatory documents / information not provided by the candidate"],
  ["AMBER", "Copies are blurred; clear copies required"],
]);

const EMPLOYMENT = rows("emp", [
  ["GREEN", "All details verified"],
  [
    "GREEN",
    "Period of employment differs by more than 5 days and up to 1 month",
  ],
  [
    "GREEN",
    "Remuneration differs by less than 10%, or the candidate stated less",
  ],
  ["GREEN", "Full and final settlement pending from the employer"],
  ["YELLOW", "Period of employment differs by more than 1 month"],
  ["YELLOW", "Remuneration overstated by more than 10%"],
  [
    "YELLOW",
    "Dual employment, or still employed with the company at the time of verification",
  ],
  ["YELLOW", "Overlap in period of employment (more than 5 days)"],
  [
    "YELLOW",
    "Not a direct employee (contractual / temporary / agency) though claimed on the BVF",
  ],
  [
    "YELLOW",
    "Absconding / left without notice / exit formalities not completed",
  ],
  [
    "YELLOW",
    "Gap between employments (more than 1 month) not declared on the BVF",
  ],
  ["RED", "Not an employee of the company"],
  [
    "RED",
    "Forged / tampered documents (relieving, experience or service letter)",
  ],
  [
    "RED",
    "Terminated for serious integrity issues (fraud, theft, misconduct, harassment, violence)",
  ],
  ["RED", "Major overstatement of designation"],
  ["RED", "Full and final settlement pending from the employee"],
  [
    "RED",
    "Contractual violation (bond, contract, confidentiality, travel bond)",
  ],
  [
    "RED",
    "Negative feedback / asked to resign / terminated for integrity, discipline or performance",
  ],
  ["RED", "Possible fake company"],
  ["AMBER", "Company at the stated address never existed (site visit)"],
  [
    "AMBER",
    "No response / company does not verify as policy / records not accessible",
  ],
  ["AMBER", "Mandatory documents / information not provided by the candidate"],
  ["AMBER", "Not eligible for rehire for reasons other than company policy"],
  ["AMBER", "Left midway through a project / improper handover"],
  ["AMBER", "Employment not verifiable: company closed or shifted"],
  ["AMBER", "Current employment needs additional details to verify"],
  ["AMBER", "Never reported to the stated supervisor (as per HR records)"],
]);

const CRIMINAL = rows("crim", [
  ["GREEN", "No record found"],
  ["RED", "Criminal record / negative record found"],
  ["AMBER", "Incomplete details or unclear copies provided"],
  ["AMBER", "Mandatory documents / information not provided by the candidate"],
  ["AMBER", "Cannot be verified by a third party in this region"],
  ["AMBER", "Possible match found; more information needed to confirm"],
]);

const REFERENCE = rows("ref", [
  ["GREEN", "Both references verified with positive feedback"],
  [
    "YELLOW",
    "Professional reference verified; personal reference is a relative",
  ],
  ["YELLOW", "Both references are relatives of the candidate"],
  [
    "YELLOW",
    "Personal reference verified; professional reference not reachable",
  ],
  [
    "YELLOW",
    "Professional reference verified; personal reference not reachable",
  ],
  ["RED", "Negative feedback"],
  ["AMBER", "Reference numbers not reachable; more references required"],
  [
    "AMBER",
    "Adverse remarks on performance, integrity, attitude, fraud or behaviour",
  ],
  ["AMBER", "Reference could not recall the candidate"],
]);

const ADDRESS = rows("addr", [
  ["GREEN", "Candidate resides / resided at the stated address"],
  ["RED", "Candidate has never resided at the stated address"],
  [
    "AMBER",
    "Mandatory information not provided by the candidate; more information required",
  ],
]);

const DATABASE = rows("db", [
  ["GREEN", "No record found"],
  ["RED", "Record found"],
  ["AMBER", "Possible match; more information needed to confirm"],
]);

const DRUG = rows("drug", [
  ["GREEN", "All panels negative"],
  ["RED", "One or more panels positive"],
  ["AMBER", "Sample not provided / test could not be completed"],
]);

const IDENTITY = rows("id", [
  ["GREEN", "Identity verified at the source"],
  ["RED", "Document fake / does not match the candidate"],
  ["AMBER", "Could not verify: source not reachable or details incomplete"],
]);

export const COLOUR_MATRIX: Readonly<
  Record<string, readonly MatrixScenario[]>
> = {
  EDUCATION,
  EMPLOYMENT,
  CRIMINAL,
  COURT_RECORD: CRIMINAL,
  REFERENCE,
  ADDRESS,
  GLOBAL_DATABASE: DATABASE,
  DIRECTORSHIP: DATABASE,
  ADVERSE_MEDIA: DATABASE,
  DRUG_TEST: DRUG,
  IDENTITY,
  PAN_VALIDATION: IDENTITY,
};

/** Industry colour names; AMBER is shown as Orange. */
export const COLOUR_NAMES: Readonly<Record<Disposition, string>> = {
  GREEN: "Green",
  YELLOW: "Yellow",
  AMBER: "Orange",
  RED: "Red",
  BLUE: "Blue",
  CLIENT_REVIEW: "Client review",
};

/** The result a colour implies (Green → clear, Yellow / Red → discrepancy, Orange → UTV). */
export const RESULT_FOR_COLOUR: Readonly<Record<Disposition, string>> = {
  GREEN: "CLEAR",
  BLUE: "CLEAR",
  YELLOW: "DISCREPANCY",
  RED: "DISCREPANCY",
  AMBER: "UNABLE_TO_VERIFY",
  CLIENT_REVIEW: "DISCREPANCY",
};

export const matrixFor = (checkType: string) =>
  COLOUR_MATRIX[checkType.toUpperCase()] ?? [];
