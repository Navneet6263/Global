export function oversightLabel(value: string) {
  return (
    value
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
      // Keep acronyms readable: "QA_REVIEW" is shown as "QC Review".
      .replace(/\bQa\b/g, "QC")
      .replace(/\b(Rm|Spoc|Gst|Pan|Utv|Tat|Sla)\b/g, (word) => word.toUpperCase())
  );
}
