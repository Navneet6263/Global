import {
  PDFDocument,
  degrees,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
const ink = rgb(0.12, 0.16, 0.14);
const muted = rgb(0.36, 0.4, 0.38);
const brandBlue = rgb(0.11, 0.3, 0.85);
const rule = rgb(0.86, 0.89, 0.93);

export type Colour = [number, number, number];

export interface TableColumn {
  label: string;
  /** Width in points; the table spans 519pt. */
  width: number;
}

export interface WriterOptions {
  /** Brand logo drawn in the page header. */
  logo?: PDFImage;
  /** Right-aligned header caption, e.g. "Background verification report". */
  caption?: string;
  /** Faint diagonal word on every page, e.g. "INTERIM". */
  watermark?: string;
}

export class ReportWriter {
  private page!: PDFPage;
  private y = 0;
  constructor(
    private readonly document: PDFDocument,
    private readonly regular: PDFFont,
    private readonly bold: PDFFont,
    private readonly options: WriterOptions = {},
  ) {
    this.nextPage();
  }

  heading(text: string, size = 12) {
    this.ensure(42);
    this.text(text, size, true);
    this.space(4);
  }

  section(title: string, detail: string, color: Colour) {
    this.ensure(100);
    this.space(6);
    this.page.drawRectangle({
      x: 32,
      y: this.y - 30,
      width: 531,
      height: 44,
      color: rgb(...color),
      opacity: 0.1,
    });
    this.page.drawRectangle({
      x: 32,
      y: this.y - 30,
      width: 3,
      height: 44,
      color: rgb(...color),
    });
    this.heading(title, 12);
    this.text(detail, 8);
    this.space(8);
  }

  text(value: string, size = 9, strong = false) {
    const font = strong ? this.bold : this.regular;
    for (const line of wrapToWidth(value, font, size, 519)) {
      this.ensure(size + 6);
      this.page.drawText(line, {
        x: 38,
        y: this.y,
        size,
        font,
        color: strong ? ink : muted,
      });
      this.y -= size + 5;
    }
  }

  /**
   * A bordered table with a shaded header row. Cells wrap; a row never splits across
   * pages. `marks` puts a coloured square before the given column's text on each row.
   */
  table(
    columns: readonly TableColumn[],
    rows: ReadonlyArray<readonly string[]>,
    options: {
      size?: number;
      marks?: { column: number; colours: Array<Colour | null> };
    } = {},
  ) {
    const size = options.size ?? 8.5;
    const pad = 5;
    const lineHeight = size + 3.5;
    const drawRow = (
      cells: readonly string[],
      header: boolean,
      rowIndex: number,
    ) => {
      const font = header ? this.bold : this.regular;
      const lines = cells.map((cell, index) => {
        const markRoom =
          !header &&
          options.marks?.column === index &&
          options.marks.colours[rowIndex]
            ? 12
            : 0;
        return wrapToWidth(
          cell || "—",
          font,
          size,
          columns[index]!.width - pad * 2 - markRoom,
        );
      });
      const height =
        Math.max(...lines.map((cell) => cell.length)) * lineHeight + pad * 2;
      this.ensure(height + 2);
      const top = this.y + size;
      let x = 35;
      if (header)
        this.page.drawRectangle({
          x,
          y: top - height,
          width: 525,
          height,
          color: rgb(0.95, 0.96, 0.98),
        });
      columns.forEach((column, index) => {
        const mark =
          !header && options.marks?.column === index
            ? options.marks.colours[rowIndex]
            : null;
        if (mark)
          this.page.drawRectangle({
            x: x + pad,
            y: top - pad - size + 1,
            width: 8,
            height: 8,
            color: rgb(...mark),
          });
        lines[index]!.forEach((line, lineIndex) => {
          this.page.drawText(line, {
            x: x + pad + (mark ? 12 : 0),
            y: top - pad - size - lineIndex * lineHeight + 1.5,
            size,
            font,
            color: header ? ink : muted,
          });
        });
        x += column.width;
      });
      this.page.drawLine({
        start: { x: 35, y: top - height },
        end: { x: 560, y: top - height },
        thickness: 0.5,
        color: rule,
      });
      this.y -= height;
    };
    drawRow(
      columns.map((column) => column.label),
      true,
      -1,
    );
    rows.forEach((row, index) => drawRow(row, false, index));
    this.space(10);
  }

  space(height = 12) {
    this.y -= height;
  }
  private ensure(height: number) {
    if (this.y - height < 65) this.nextPage();
  }
  private nextPage() {
    this.page = this.document.addPage([595, 842]);
    const { logo, caption, watermark } = this.options;
    if (watermark)
      this.page.drawText(watermark, {
        x: 140,
        y: 300,
        size: 96,
        font: this.bold,
        color: rgb(0.85, 0.88, 0.95),
        rotate: degrees(35),
        opacity: 0.5,
      });
    if (logo) {
      // White header: brand wordmark on the left, caption on the right, blue rule.
      const height = 28;
      const width = (logo.width / logo.height) * height;
      this.page.drawImage(logo, { x: 38, y: 795, width, height });
      if (caption)
        this.page.drawText(caption, {
          x: 557 - this.regular.widthOfTextAtSize(caption, 9),
          y: 805,
          size: 9,
          font: this.regular,
          color: muted,
        });
      this.page.drawRectangle({
        x: 0,
        y: 784,
        width: 595,
        height: 2.5,
        color: brandBlue,
      });
      this.y = 756;
      return;
    }
    this.page.drawRectangle({
      x: 0,
      y: 790,
      width: 595,
      height: 52,
      color: rgb(0.08, 0.24, 0.19),
    });
    this.page.drawText("Sapling Global", {
      x: 38,
      y: 810,
      size: 18,
      font: this.bold,
      color: rgb(1, 1, 1),
    });
    this.y = 760;
  }
}

export function wrapToWidth(
  value: string,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  const words = Array.from(value)
    .filter(
      (character) => character.charCodeAt(0) >= 32 || /\s/.test(character),
    )
    .join("")
    .split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!word) continue;
    const proposed = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(proposed, size) <= width) {
      line = proposed;
      continue;
    }
    if (line) {
      lines.push(line);
      line = "";
    }
    for (const character of word) {
      if (line && font.widthOfTextAtSize(line + character, size) > width) {
        lines.push(line);
        line = "";
      }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
}
