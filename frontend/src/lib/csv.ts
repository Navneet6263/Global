function safeCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const protectedValue = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

export function downloadCsv(
  filename: string,
  columns: readonly string[],
  rows: readonly (readonly unknown[])[],
) {
  const contents = [columns, ...rows].map((row) => row.map(safeCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
