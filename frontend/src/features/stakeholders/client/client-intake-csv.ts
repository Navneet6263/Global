export interface IntakeRow {
  fullName: string;
  email?: string;
  phone?: string;
  employeeCode?: string;
  externalRef?: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
}
export const intakeHeaders = "fullName,email,phone,employeeCode,externalRef,priority";

export function parseClientCsv(text: string): IntakeRow[] {
  if (text.length > 200_000) throw new Error("CSV must be smaller than 200 KB");
  const records: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closedQuote = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted) {
        quoted = false;
        closedQuote = true;
      } else {
        if (closedQuote || cell.trim())
          throw new Error("CSV has an unexpected quote inside a field");
        quoted = true;
      }
    } else if (!quoted && (char === "," || char === "\n" || char === "\r")) {
      row.push(cell.trim());
      cell = "";
      closedQuote = false;
      if (char !== ",") {
        if (row.some(Boolean)) records.push(row);
        row = [];
        if (char === "\r" && text[i + 1] === "\n") i++;
      }
    } else {
      if (!quoted && closedQuote && char.trim())
        throw new Error("CSV has text after a quoted field");
      cell += char;
    }
  }
  if (quoted) throw new Error("CSV has an unclosed quoted field");
  row.push(cell.trim());
  if (row.some(Boolean)) records.push(row);
  const headers = records.shift()?.map((value) => value.replace(/^\uFEFF/, "").toLowerCase()) ?? [];
  const allowed = intakeHeaders.toLowerCase().split(",");
  if (
    !headers.includes("fullname") ||
    !headers.some((value) => value === "email" || value === "phone")
  )
    throw new Error("Use the template headers: fullName and email or phone are required");
  if (headers.some((value) => !allowed.includes(value)) || new Set(headers).size !== headers.length)
    throw new Error("CSV has an unknown or duplicate column");
  if (records.length === 0 || records.length > 50)
    throw new Error("Import between 1 and 50 candidates at a time");
  const seen = new Set<string>();
  return records.map((values, index) => {
    const fail = (message: string): never => {
      throw new Error(`Row ${index + 2}: ${message}`);
    };
    if (values.length !== headers.length) fail("column count does not match the headers");
    const fields = Object.fromEntries(headers.map((key, i) => [key, values[i] ?? ""]));
    const fullName = fields["fullname"] ?? "";
    const email = fields["email"]?.toLowerCase() || undefined;
    const rawPhone = fields["phone"] || undefined;
    const digits = rawPhone?.replace(/[\s()+-]/g, "");
    const phone = digits
      ? `+91${digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits}`
      : undefined;
    const priority = fields["priority"]?.toUpperCase() || "NORMAL";
    if (fullName.length < 2 || fullName.length > 160) fail("name must be 2–160 characters");
    if (!email && !phone) fail("provide candidate email or mobile number");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("email is invalid");
    if (phone && !/^\+91[6-9]\d{9}$/.test(phone))
      fail("mobile must be 10 Indian digits starting with 6–9");
    if (!["LOW", "NORMAL", "HIGH", "URGENT"].includes(priority))
      fail("priority must be LOW, NORMAL, HIGH or URGENT");
    if ((fields["employeecode"]?.length ?? 0) > 64 || (fields["externalref"]?.length ?? 0) > 80)
      fail("employee code or reference is too long");
    const identity = JSON.stringify([fullName.toLowerCase(), email, phone, fields["externalref"]]);
    if (seen.has(identity)) fail("duplicate candidate row in this file");
    seen.add(identity);
    return {
      fullName,
      email,
      phone,
      priority: priority as IntakeRow["priority"],
      ...(fields["employeecode"] ? { employeeCode: fields["employeecode"] } : {}),
      ...(fields["externalref"] ? { externalRef: fields["externalref"] } : {}),
    };
  });
}
