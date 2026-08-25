export function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

export function riskTone(value?: string | null) {
  return ["HIGH", "CRITICAL"].includes(value ?? "")
    ? "bg-red-100 text-red-700"
    : value === "MEDIUM"
      ? "bg-amber-100 text-amber-700"
      : "bg-emerald-100 text-emerald-700";
}

export const qaChecklist = [
  "Candidate identity and case scope verified",
  "All check results and source summaries reviewed",
  "Supporting evidence is complete and readable",
  "Discrepancies and risk ratings are consistent",
  "Report language is factual and non-discriminatory",
];
