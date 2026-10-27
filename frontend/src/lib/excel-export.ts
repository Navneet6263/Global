import type { Workbook, Worksheet, Borders, Fill } from "exceljs";

/**
 * Styled .xlsx downloads (title, branded header, banded rows, colour-coded cells, filters,
 * frozen header, totals, print setup). ExcelJS is loaded only when someone downloads.
 */
const BRAND = "17324D";
const LINE = "D6DEE8";
const ZEBRA = "F4F7FB";

export const EXCEL_TONES = {
  ok: { fill: "DCF2E4", font: "1E7A43" },
  warn: { fill: "FCF0D6", font: "8F5A00" },
  danger: { fill: "FBE3E1", font: "B3261E" },
  info: { fill: "E3ECFA", font: "1F55A8" },
  neutral: { fill: "ECEFF3", font: "4C5866" },
} as const;
export type ExcelTone = keyof typeof EXCEL_TONES;

type ColumnType = "text" | "date" | "datetime" | "number" | "money" | "percent";
const FORMATS: Partial<Record<ColumnType, string>> = {
  date: "dd-mmm-yyyy",
  datetime: "dd-mmm-yyyy hh:mm",
  number: "#,##0",
  money: '"₹"#,##0.00',
  percent: "0%",
};

export interface ExcelColumn<Row> {
  label: string;
  value: (row: Row) => string | number | null | undefined;
  type?: ColumnType;
  width?: number;
  /** Colours the cell, e.g. a status or an overdue flag. */
  tone?: (row: Row) => ExcelTone | null;
}

export interface ExcelSheet<Row = Record<string, unknown>> {
  name: string;
  title?: string;
  columns: ExcelColumn<Row>[];
  rows: Row[];
  /** Columns (by label) to total at the bottom. */
  totals?: string[];
  note?: string;
}

/** ISO date or date-time → a Date Excel shows with the same wall-clock value (IST). */
function excelDate(value: string | number): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const ist = new Date(date.getTime() + 330 * 60_000);
  return new Date(
    Date.UTC(
      ist.getUTCFullYear(),
      ist.getUTCMonth(),
      ist.getUTCDate(),
      ist.getUTCHours(),
      ist.getUTCMinutes(),
    ),
  );
}

const thin = { style: "thin" as const, color: { argb: LINE } };
const box: Partial<Borders> = { top: thin, left: thin, bottom: thin, right: thin };
const solid = (argb: string): Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const letter = (n: number) => {
  let out = "";
  for (let i = n; i > 0; i = Math.floor((i - 1) / 26))
    out = String.fromCharCode(65 + ((i - 1) % 26)) + out;
  return out;
};
const numeric = (type?: ColumnType) => Boolean(type && type !== "text");

function cellValue<Row>(column: ExcelColumn<Row>, row: Row) {
  const raw = column.value(row);
  if (raw === null || raw === undefined || raw === "") return null;
  if (column.type === "date" || column.type === "datetime") return excelDate(raw);
  if (numeric(column.type)) return Number(raw);
  return String(raw);
}

function addSheet<Row>(workbook: Workbook, sheet: ExcelSheet<Row>, title: string, lines: string[]) {
  const ws: Worksheet = workbook.addWorksheet(sheet.name.slice(0, 31), {
    views: [{ showGridLines: false }],
  });
  const cols = sheet.columns;
  const last = letter(cols.length);
  ws.columns = cols.map((column) => {
    const longest = sheet.rows.slice(0, 500).reduce((max, row) => {
      const value = cellValue(column, row);
      const text =
        value instanceof Date ? "dd-mmm-yyyy hh:mm" : value === null ? "" : String(value);
      return Math.max(max, text.length);
    }, 0);
    return {
      width: Math.min(
        60,
        column.width ??
          Math.max(column.label.length + 2, longest + 2, numeric(column.type) ? 12 : 10),
      ),
    };
  });

  ws.mergeCells(`A1:${last}1`);
  Object.assign(ws.getCell("A1"), {
    value: sheet.title ?? title,
    font: { bold: true, size: 15, color: { argb: BRAND } },
  });
  ws.getRow(1).height = 24;
  lines.forEach((line, index) => {
    const r = index + 2;
    ws.mergeCells(`A${r}:${last}${r}`);
    Object.assign(ws.getCell(`A${r}`), {
      value: line,
      font: { size: 10, color: { argb: "5B6675" } },
    });
  });

  const headerIndex = lines.length + 3;
  const header = ws.getRow(headerIndex);
  cols.forEach((column, i) => {
    const cell = header.getCell(i + 1);
    cell.value = column.label;
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = solid(BRAND);
    cell.alignment = {
      vertical: "middle",
      horizontal: numeric(column.type) ? "right" : "left",
      wrapText: true,
    };
    cell.border = box;
  });
  header.height = 22;

  sheet.rows.forEach((row, index) => {
    const excelRow = ws.getRow(headerIndex + 1 + index);
    cols.forEach((column, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.value = cellValue(column, row);
      cell.border = box;
      cell.alignment = {
        vertical: "top",
        wrapText: !numeric(column.type),
        horizontal: numeric(column.type) ? "right" : "left",
      };
      const format = FORMATS[column.type ?? "text"];
      if (format) cell.numFmt = format;
      const tone = column.tone?.(row);
      if (tone) {
        cell.fill = solid(EXCEL_TONES[tone].fill);
        cell.font = { bold: true, color: { argb: EXCEL_TONES[tone].font } };
      } else if (index % 2) cell.fill = solid(ZEBRA);
    });
  });

  let lastRow = headerIndex + sheet.rows.length;
  if (sheet.totals?.length && sheet.rows.length) {
    lastRow += 1;
    const totalRow = ws.getRow(lastRow);
    cols.forEach((column, i) => {
      const cell = totalRow.getCell(i + 1);
      const col = letter(i + 1);
      if (i === 0) cell.value = "Total";
      else if (sheet.totals!.includes(column.label))
        cell.value = { formula: `SUM(${col}${headerIndex + 1}:${col}${lastRow - 1})` };
      const format = FORMATS[column.type ?? "text"];
      if (format) cell.numFmt = format;
      cell.font = { bold: true };
      cell.fill = solid("E3ECFA");
      cell.border = { ...box, top: { style: "double", color: { argb: BRAND } } };
      cell.alignment = { horizontal: numeric(column.type) ? "right" : "left" };
    });
  }

  if (sheet.rows.length)
    ws.autoFilter = {
      from: { row: headerIndex, column: 1 },
      to: { row: headerIndex + sheet.rows.length, column: cols.length },
    };
  ws.views = [{ state: "frozen", ySplit: headerIndex, showGridLines: false }];
  ws.pageSetup = {
    orientation: cols.length > 5 ? "landscape" : "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: `${headerIndex}:${headerIndex}`,
  };
  ws.headerFooter = { oddFooter: `&L${title.replace(/&/g, "&&")}&RPage &P of &N` };
  if (sheet.note) {
    const r = lastRow + 2;
    ws.mergeCells(`A${r}:${last}${r}`);
    Object.assign(ws.getCell(`A${r}`), {
      value: sheet.note,
      font: { italic: true, size: 9, color: { argb: "5B6675" } },
    });
  }
}

/** Builds the workbook and saves it as `fileName` (.xlsx). */
export async function downloadExcel({
  fileName,
  title,
  lines = [],
  sheets,
}: {
  fileName: string;
  title: string;
  lines?: string[];
  // Each sheet has its own row type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheets: ExcelSheet<any>[];
}) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sapling Global";
  workbook.created = new Date();
  for (const sheet of sheets) addSheet(workbook, sheet, title, lines);
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
