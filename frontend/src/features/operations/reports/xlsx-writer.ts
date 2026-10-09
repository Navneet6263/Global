/**
 * Minimal, dependency-free .xlsx writer for operational MIS downloads.
 * Produces one formatted worksheet per sheet: title rows, a frozen bold header with filter,
 * column widths and optional colour-coded cells. Strings are written as inline text, so cell
 * content can never execute as a spreadsheet formula.
 */
export type XlsxTone = "good" | "bad" | "warn" | "minor" | "info";
export type XlsxCell =
  string | number | null | undefined | { value: string | number; tone?: XlsxTone };

export interface XlsxSheet {
  name: string;
  title?: string;
  subtitle?: string;
  columns: Array<{ label: string; width?: number }>;
  rows: XlsxCell[][];
}

// Style ids defined in styles.xml below.
const STYLE = {
  body: 0,
  header: 1,
  title: 2,
  subtitle: 3,
  good: 4,
  bad: 5,
  warn: 6,
  minor: 7,
  info: 8,
};

const encoder = new TextEncoder();

export function buildXlsx(sheets: readonly XlsxSheet[]): Uint8Array<ArrayBuffer> {
  if (!sheets.length) throw new Error("At least one sheet is required");
  const names = uniqueSheetNames(sheets.map((sheet) => sheet.name));
  const files: Array<[string, string]> = [
    ["[Content_Types].xml", contentTypes(sheets.length)],
    [
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
        .map((name, i) => `<sheet name="${xml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join("")}</sheets>${definedNames(sheets, names)}</workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
        )
        .join(
          "",
        )}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ],
    ["xl/styles.xml", styles()],
    ...sheets.map((sheet, i): [string, string] => [
      `xl/worksheets/sheet${i + 1}.xml`,
      worksheet(sheet),
    ]),
  ];
  return zip(files.map(([name, text]) => [name, encoder.encode(text)]));
}

function headerRowIndex(sheet: XlsxSheet) {
  return (
    (sheet.title ? 1 : 0) + (sheet.subtitle ? 1 : 0) + (sheet.title || sheet.subtitle ? 1 : 0) + 1
  );
}

function definedNames(sheets: readonly XlsxSheet[], names: string[]) {
  const entries = sheets
    .map((sheet, i) => {
      if (!sheet.columns.length) return "";
      const header = headerRowIndex(sheet);
      const last = header + Math.max(sheet.rows.length, 1);
      const ref = `'${names[i]!.replaceAll("'", "''")}'!$A$${header}:$${column(sheet.columns.length - 1)}$${last}`;
      return `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${xml(ref)}</definedName>`;
    })
    .join("");
  return entries ? `<definedNames>${entries}</definedNames>` : "";
}

function worksheet(sheet: XlsxSheet) {
  const rows: string[] = [];
  let r = 0;
  const width = Math.max(sheet.columns.length, 1);
  if (sheet.title) rows.push(row(++r, [{ value: sheet.title }], STYLE.title));
  if (sheet.subtitle) rows.push(row(++r, [{ value: sheet.subtitle }], STYLE.subtitle));
  if (sheet.title || sheet.subtitle) r++;
  const header = ++r;
  rows.push(
    row(
      header,
      sheet.columns.map((c) => ({ value: c.label })),
      STYLE.header,
    ),
  );
  for (const values of sheet.rows) rows.push(row(++r, values, STYLE.body));
  const cols = sheet.columns
    .map((c, i) => {
      const longest = Math.max(
        c.label.length,
        ...sheet.rows.slice(0, 500).map((values) => text(values[i]).length),
      );
      const w = c.width ?? Math.min(48, Math.max(10, longest + 2));
      return `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`;
    })
    .join("");
  const last = Math.max(r, header + 1);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="${header}" topLeftCell="A${header + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${
    cols ? `<cols>${cols}</cols>` : ""
  }<sheetData>${rows.join("")}</sheetData><autoFilter ref="A${header}:${column(width - 1)}${last}"/></worksheet>`;
}

function row(index: number, values: XlsxCell[], base: number) {
  const cells = values
    .map((value, i) => {
      const ref = `${column(i)}${index}`;
      const raw = value !== null && typeof value === "object" ? value.value : value;
      const tone = value !== null && typeof value === "object" ? value.tone : undefined;
      const style = tone ? STYLE[tone] : base;
      if (raw === null || raw === undefined || raw === "")
        return style ? `<c r="${ref}" s="${style}"/>` : "";
      if (typeof raw === "number" && Number.isFinite(raw))
        return `<c r="${ref}" s="${style}"><v>${raw}</v></c>`;
      return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(String(raw))}</t></is></c>`;
    })
    .join("");
  return `<row r="${index}">${cells}</row>`;
}

function text(value: XlsxCell) {
  const raw = value !== null && typeof value === "object" ? value.value : value;
  return raw === null || raw === undefined ? "" : String(raw);
}

export function column(index: number) {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    name = String.fromCharCode(65 + m) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

export function xml(value: string) {
  return (
    value
      // XML 1.0 forbids these control characters; strip them from cell text.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
  );
}

export function uniqueSheetNames(names: string[]) {
  const used = new Set<string>();
  return names.map((name, i) => {
    let base =
      name
        .replace(/[[\]:*?/\\]/g, " ")
        .trim()
        .slice(0, 31) || `Sheet${i + 1}`;
    let candidate = base;
    let n = 2;
    while (used.has(candidate.toLowerCase())) {
      const suffix = ` (${n++})`;
      candidate = base.slice(0, 31 - suffix.length) + suffix;
    }
    used.add(candidate.toLowerCase());
    base = candidate;
    return base;
  });
}

function contentTypes(count: number) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${Array.from(
    { length: count },
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("")}</Types>`;
}

function styles() {
  const fill = (rgb: string) =>
    `<fill><patternFill patternType="solid"><fgColor rgb="FF${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
  // fonts: 0 body, 1 header (bold white), 2 title (bold 14), 3 subtitle (grey), 4 bold dark
  // fills: 0 none, 1 gray125 (required), 2 blue, 3 green, 4 red, 5 amber, 6 yellow, 7 light blue
  const xf = (font: number, fillId: number, border: number) =>
    `<xf numFmtId="0" fontId="${font}" fillId="${fillId}" borderId="${border}" xfId="0"${font ? ' applyFont="1"' : ""}${fillId ? ' applyFill="1"' : ""}${border ? ' applyBorder="1"' : ""}><alignment vertical="center"/></xf>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF0F172A"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF64748B"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font></fonts><fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fill("1D4ED8")}${fill("DCFCE7")}${fill("FEE2E2")}${fill("FEF3C7")}${fill("FEF9C3")}${fill("DBEAFE")}</fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFE2E8F0"/></left><right style="thin"><color rgb="FFE2E8F0"/></right><top style="thin"><color rgb="FFE2E8F0"/></top><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9">${[
    xf(0, 0, 1),
    xf(1, 2, 1),
    xf(2, 0, 0),
    xf(3, 0, 0),
    xf(4, 3, 1),
    xf(4, 4, 1),
    xf(4, 5, 1),
    xf(4, 6, 1),
    xf(4, 7, 1),
  ].join(
    "",
  )}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

// ---- ZIP (stored, no compression) ----
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries: Array<[string, Uint8Array]>): Uint8Array<ArrayBuffer> {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, 0, true);
    local.setUint16(12, 0x21, true); // 1980-01-01
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);
    chunks.push(new Uint8Array(local.buffer), nameBytes, data);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(10, 0, true);
    entry.setUint16(12, 0, true);
    entry.setUint16(14, 0x21, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  const parts = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
