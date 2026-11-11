import {
  degrees,
  rgb,
  type PDFDocument,
  type PDFEmbeddedPage,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { wrapToWidth } from "../common/pdf/document-writer";

export type RGB = [number, number, number];

/**
 * Report palette from the Sample Report: black text and table lines, light blue label
 * cells, a dark blue legend bar, the cyan company name in the footer.
 */
export const PALETTE = {
  ink: [0.05, 0.05, 0.05] as RGB,
  muted: [0.36, 0.4, 0.46] as RGB,
  navy: [0.12, 0.23, 0.45] as RGB,
  brand: [0.11, 0.3, 0.85] as RGB,
  grid: [0.15, 0.15, 0.15] as RGB,
  label: [0.776, 0.851, 0.945] as RGB,
  band: [0.776, 0.851, 0.945] as RGB,
  white: [1, 1, 1] as RGB,
  red: [0.78, 0.16, 0.16] as RGB,
  /** Company name in the footer. */
  cyan: [0.0, 0.69, 0.94] as RGB,
  /** Email and web links in the footer. */
  link: [0.02, 0.2, 0.8] as RGB,
};

/** Company footer printed on every page, as in the Sample Report. */
export const COMPANY_FOOTER = {
  name: "Sapling Global Assurance Private Limited",
  office: "A-43 SECTOR 67 NOIDA 201301",
  cin: "U74999UP2020PTC125447",
  email: "reachus@saplingglobal.com",
  web: "www.saplingglobal.com",
};

export interface CellStyle {
  fill?: RGB;
  colour?: RGB;
  bold?: boolean;
  align?: "left" | "center";
  size?: number;
}
export type Cell = string | ({ text: string; sub?: string } & CellStyle);
export interface Column {
  width: number;
}

type Line = {
  text: string;
  size: number;
  colour: RGB;
  bold: boolean;
};

const LEFT = 38;
const WIDTH = 519;
const TOP = 752;
/** Content stops above the company footer. */
const BOTTOM = 96;
const PAD = 5;

export interface LayoutOptions {
  logo?: PDFImage;
  /** Right side of the page header, e.g. "Employee Background Screening Report". */
  title: string;
  /** Second header line, e.g. candidate name and Sapling ID. */
  subtitle?: string;
  /** Faint diagonal word on every page, e.g. "DRAFT". */
  watermark?: string;
}

/**
 * Page layout for the background verification report: branded header, bordered tables
 * that never overflow (long cells continue on the next page), annexure title bars,
 * coloured status cells and proof figures.
 */
export class ReportLayout {
  page!: PDFPage;
  private y = TOP;
  /** Content width and top of the current page (landscape pages are wider). */
  private width = WIDTH;
  private top = TOP;

  constructor(
    private readonly document: PDFDocument,
    private readonly regular: PDFFont,
    private readonly bold: PDFFont,
    private readonly options: LayoutOptions,
  ) {
    this.newPage();
  }

  get remaining() {
    return this.y - BOTTOM;
  }

  get atTop() {
    return this.y >= this.top - 1;
  }

  /** A new page; proof figures of wide screenshots use landscape pages. */
  newPage(orientation: "portrait" | "landscape" = "portrait") {
    const [pageWidth, pageHeight] =
      orientation === "landscape" ? [842, 595] : [595, 842];
    this.page = this.document.addPage([pageWidth, pageHeight]);
    this.width = pageWidth - LEFT * 2;
    this.top = pageHeight - 90;
    const { logo, watermark } = this.options;
    // Double page border, as in the Sample Report.
    for (const [inset, thickness] of [
      [18, 1.4],
      [21.5, 0.5],
    ] as const)
      this.page.drawRectangle({
        x: inset,
        y: inset,
        width: pageWidth - inset * 2,
        height: pageHeight - inset * 2,
        borderColor: rgb(...PALETTE.ink),
        borderWidth: thickness,
      });
    if (watermark) {
      const size = watermark.length > 8 ? 64 : 96;
      this.page.drawText(watermark, {
        x:
          pageWidth / 2 -
          (this.regular.widthOfTextAtSize(watermark, size) * 0.82) / 2,
        y: pageHeight * 0.3,
        size,
        font: this.bold,
        color: rgb(0.88, 0.9, 0.95),
        rotate: degrees(35),
        opacity: 0.55,
      });
    }
    // The Sapling Global logo at the top right of every page.
    if (logo) {
      const height = 34;
      const width = (logo.width / logo.height) * height;
      this.page.drawImage(logo, {
        x: pageWidth - LEFT - width,
        y: pageHeight - 66,
        width,
        height,
      });
    }
    this.y = this.top;
  }

  space(height = 10) {
    this.y -= height;
  }

  ensure(height: number) {
    if (this.y - height < BOTTOM) this.newPage();
  }

  /** Centred, bold, underlined title (executive summary). */
  titleBar(text: string, size = 13) {
    this.ensure(size + 30);
    const width = this.widthOf(text, size, true);
    const x = LEFT + (this.width - width) / 2;
    this.write(text, x, this.y - size, size, PALETTE.ink, true);
    this.page.drawLine({
      start: { x, y: this.y - size - 2.5 },
      end: { x: x + width, y: this.y - size - 2.5 },
      thickness: 0.8,
      color: rgb(...PALETTE.ink),
    });
    this.y -= size + 14;
  }

  /** "Annexure III | Detailed Check Report – Education": a light blue and a plain cell. */
  annexureBar(number: string, title: string) {
    const left = 175;
    const room = this.width - left - PAD * 2;
    // Long titles wrap onto a second line instead of being cut.
    const lines = wrapToWidth(title, this.bold, 9.5, room).slice(0, 2);
    const height = lines.length > 1 ? 32 : 20;
    this.ensure(height + 60);
    const top = this.y;
    this.page.drawRectangle({
      x: LEFT,
      y: top - height,
      width: left,
      height,
      color: rgb(...PALETTE.label),
    });
    for (const [x, width] of [
      [LEFT, left],
      [LEFT + left, this.width - left],
    ] as const)
      this.page.drawRectangle({
        x,
        y: top - height,
        width,
        height,
        borderColor: rgb(...PALETTE.grid),
        borderWidth: 0.6,
      });
    this.write(
      number,
      LEFT + PAD,
      top - height / 2 - 3.3,
      9.5,
      PALETTE.ink,
      true,
    );
    lines.forEach((line, index) => {
      this.write(
        this.fit(line, 9.5, room),
        LEFT + left + PAD,
        top - height / 2 - 3.3 + (lines.length > 1 ? 6 - index * 12 : 0),
        9.5,
        PALETTE.ink,
        true,
      );
    });
    this.y -= height + 12;
  }

  /** Bold heading, e.g. "Annexures Details:" (underlined in the Sample Report). */
  sectionLabel(text: string, underline = false) {
    this.ensure(40);
    this.write(text, LEFT, this.y - 10, 10, PALETTE.ink, true);
    if (underline)
      this.page.drawLine({
        start: { x: LEFT, y: this.y - 12.5 },
        end: { x: LEFT + this.widthOf(text, 10, true), y: this.y - 12.5 },
        thickness: 0.8,
        color: rgb(...PALETTE.ink),
      });
    this.y -= 22;
  }

  /**
   * Table whose first column is one merged cell per group, centred over the group's rows
   * (the Sample Report's annexure index: "Employment I" spans its report and its email
   * response). A group is kept on one page.
   */
  groupedTable(
    columns: readonly Column[],
    groups: ReadonlyArray<{
      label: Cell;
      rows: ReadonlyArray<readonly Cell[]>;
    }>,
    size = 8.5,
  ) {
    const [first, ...rest] = columns;
    if (!first) return;
    const lineHeight = (line: Line) => line.size + 3.2;
    const heightOf = (cell: Cell, width: number) =>
      this.linesOf(cell, width - PAD * 2, size).reduce(
        (sum, line) => sum + lineHeight(line),
        0,
      ) +
      PAD * 2;
    for (const group of groups) {
      const heights = group.rows.map((row) =>
        Math.max(
          ...rest.map((column, index) =>
            heightOf(row[index] ?? "", column.width),
          ),
        ),
      );
      const rowsHeight = heights.reduce((sum, height) => sum + height, 0);
      const labelHeight = heightOf(group.label, first.width);
      // A tall label stretches the last row so the merged cell still fits.
      if (labelHeight > rowsHeight && heights.length)
        heights[heights.length - 1]! += labelHeight - rowsHeight;
      const total = Math.max(rowsHeight, labelHeight);
      if (total > this.remaining) this.newPage();
      const top = this.y;
      this.cellAt(LEFT, top, first.width, total, group.label, size);
      let rowTop = top;
      group.rows.forEach((row, at) => {
        let x = LEFT + first.width;
        rest.forEach((column, index) => {
          this.cellAt(
            x,
            rowTop,
            column.width,
            heights[at]!,
            row[index] ?? "",
            size,
          );
          x += column.width;
        });
        rowTop -= heights[at]!;
      });
      this.y -= total;
    }
    this.y -= 8;
  }

  /**
   * Photos side by side, as in the Sample Report: a row of bold captions and the photos
   * under them, `perRow` to a row. A row is kept on one page.
   */
  photoGrid(
    photos: ReadonlyArray<{ image: PDFImage; caption: string }>,
    perRow = 3,
  ) {
    const column = this.width / perRow;
    const room = column - 10;
    const size = 8.5;
    for (let at = 0; at < photos.length; at += perRow) {
      const row = photos.slice(at, at + perRow);
      const captions: Cell[] = Array.from({ length: perRow }, (_, index) => ({
        text: row[index]?.caption.toUpperCase() ?? " ",
        bold: true,
        align: "center",
      }));
      const captionHeight = Math.max(
        18,
        ...captions.map(
          (cell) =>
            this.linesOf(cell, room, size).reduce(
              (sum, line) => sum + line.size + 3.2,
              0,
            ) +
            PAD * 2,
        ),
      );
      const scaled = row.map(({ image }) => {
        const scale = Math.min(room / image.width, 300 / image.height);
        return { width: image.width * scale, height: image.height * scale };
      });
      const photoHeight = Math.max(...scaled.map((item) => item.height)) + 10;
      if (captionHeight + photoHeight > this.remaining) this.newPage();
      const top = this.y;
      captions.forEach((cell, index) => {
        const x = LEFT + index * column;
        this.cellAt(x, top, column, captionHeight, cell, size);
        this.page.drawRectangle({
          x,
          y: top - captionHeight - photoHeight,
          width: column,
          height: photoHeight,
          borderColor: rgb(...PALETTE.grid),
          borderWidth: 0.6,
        });
        const photo = row[index];
        const box = scaled[index];
        if (photo && box)
          this.page.drawImage(photo.image, {
            x: x + (column - box.width) / 2,
            y: top - captionHeight - 5 - box.height,
            width: box.width,
            height: box.height,
          });
      });
      this.y -= captionHeight + photoHeight;
    }
    this.y -= 8;
  }

  /** One bordered cell of a fixed size, text centred vertically. */
  private cellAt(
    x: number,
    top: number,
    width: number,
    height: number,
    cell: Cell,
    size: number,
  ) {
    const style = typeof cell === "object" ? cell : undefined;
    if (style?.fill)
      this.page.drawRectangle({
        x,
        y: top - height,
        width,
        height,
        color: rgb(...style.fill),
      });
    const lines = this.linesOf(cell, width - PAD * 2, size);
    const block = lines.reduce((sum, line) => sum + line.size + 3.2, 0);
    let lineTop = top - (height - block) / 2;
    for (const line of lines) {
      const lineX =
        style?.align === "center"
          ? x + (width - this.widthOf(line.text, line.size, line.bold)) / 2
          : x + PAD;
      this.write(
        line.text,
        lineX,
        lineTop - line.size,
        line.size,
        line.colour,
        line.bold,
      );
      lineTop -= line.size + 3.2;
    }
    this.page.drawRectangle({
      x,
      y: top - height,
      width,
      height,
      borderColor: rgb(...PALETTE.grid),
      borderWidth: 0.6,
    });
  }

  paragraph(
    text: string,
    options: {
      size?: number;
      colour?: RGB;
      bold?: boolean;
      align?: "left" | "center";
    } = {},
  ) {
    const size = options.size ?? 9;
    const font = options.bold ? this.bold : this.regular;
    for (const line of wrapToWidth(text, font, size, this.width)) {
      this.ensure(size + 5);
      const x =
        options.align === "center"
          ? LEFT + (this.width - this.widthOf(line, size, options.bold)) / 2
          : LEFT;
      this.write(
        line,
        x,
        this.y - size,
        size,
        options.colour ?? PALETTE.ink,
        options.bold,
      );
      this.y -= size + 4;
    }
  }

  /**
   * Bordered table. `header` rows repeat on every page the table spans. A row is kept
   * on one page when it fits on a page; a taller row continues line by line.
   */
  table(
    columns: readonly Column[],
    rows: ReadonlyArray<readonly Cell[]>,
    options: {
      header?: readonly Cell[];
      size?: number;
      labelColumn?: boolean;
      /** Centre every cell vertically (summary tables). */
      middle?: boolean;
    } = {},
  ) {
    const size = options.size ?? 8.5;
    const header = options.header?.map((cell) => this.headerCell(cell));
    const drawHeader = () => {
      if (header)
        this.row(columns, header, size, false, undefined, options.middle);
    };
    drawHeader();
    rows.forEach((row) => {
      const styled = row.map((cell, index) =>
        options.labelColumn && index === 0 && typeof cell === "string"
          ? { text: cell, fill: PALETTE.label, bold: true, colour: PALETTE.ink }
          : cell,
      );
      this.row(columns, styled, size, true, drawHeader, options.middle);
    });
    this.y -= 8;
  }

  /** Image or PDF page with a border and a caption under it. */
  figure(
    source: { image: PDFImage } | { page: PDFEmbeddedPage },
    caption: string,
    detail: string,
    maxHeight: number,
  ) {
    const item = "image" in source ? source.image : source.page;
    const room = this.width - 16;
    const captionHeight = 30;
    const usable = Math.min(maxHeight, this.top - BOTTOM - captionHeight - 16);
    // Small screenshots are enlarged (up to 3x) so the proof fills its page.
    const scale = Math.min(room / item.width, usable / item.height, 3);
    const width = item.width * scale;
    const height = item.height * scale;
    this.ensure(height + captionHeight + 16);
    const top = this.y;
    const x = LEFT + (this.width - width) / 2;
    this.page.drawRectangle({
      x: x - 5,
      y: top - height - 10,
      width: width + 10,
      height: height + 10,
      borderColor: rgb(...PALETTE.grid),
      borderWidth: 0.8,
      color: rgb(1, 1, 1),
    });
    const box = { x, y: top - height - 5, width, height };
    if ("image" in source) this.page.drawImage(source.image, box);
    else this.page.drawPage(source.page, box);
    this.y = top - height - 16;
    const title = this.fit(caption, 8.5, this.width);
    this.write(
      title,
      LEFT + (this.width - this.widthOf(title, 8.5, true)) / 2,
      this.y - 8,
      8.5,
      PALETTE.ink,
      true,
    );
    const small = this.fit(detail, 7, this.width);
    this.write(
      small,
      LEFT + (this.width - this.widthOf(small, 7)) / 2,
      this.y - 19,
      7,
      PALETTE.muted,
    );
    this.y -= captionHeight;
  }

  /**
   * Company footer on every page (Sample Report): company name, registered office, CIN,
   * email and web, then the page number. A small note (authenticity code, draft or
   * internal copy) sits just above it.
   */
  footers(left: string, right?: string) {
    const pages = this.document.getPages();
    pages.forEach((page, index) => {
      const centre = page.getWidth() / 2;
      const line = (
        parts: Array<{
          text: string;
          bold?: boolean;
          colour?: RGB;
          underline?: boolean;
        }>,
        y: number,
        size: number,
      ) => {
        const widths = parts.map((part) =>
          (part.bold ? this.bold : this.regular).widthOfTextAtSize(
            part.text,
            size,
          ),
        );
        let x = centre - widths.reduce((sum, width) => sum + width, 0) / 2;
        parts.forEach((part, at) => {
          const font = part.bold ? this.bold : this.regular;
          const colour = rgb(...(part.colour ?? PALETTE.ink));
          page.drawText(part.text, { x, y, size, font, color: colour });
          if (part.bold)
            page.drawText(part.text, {
              x: x + 0.3,
              y,
              size,
              font,
              color: colour,
            });
          if (part.underline)
            page.drawLine({
              start: { x, y: y - 1.2 },
              end: { x: x + widths[at]!, y: y - 1.2 },
              thickness: 0.4,
              color: colour,
            });
          x += widths[at]!;
        });
      };
      const note = this.fit(
        [left, right].filter(Boolean).join(" · "),
        6.5,
        500,
      );
      line([{ text: note, colour: PALETTE.muted }], 88, 6.5);
      line(
        [{ text: COMPANY_FOOTER.name, bold: true, colour: PALETTE.cyan }],
        74,
        9,
      );
      line(
        [
          { text: "Registered Office: ", bold: true },
          { text: COMPANY_FOOTER.office },
        ],
        64,
        7.5,
      );
      line([{ text: `CIN: ${COMPANY_FOOTER.cin}` }], 55, 7);
      line(
        [
          { text: "email-", bold: true, colour: PALETTE.link, underline: true },
          { text: COMPANY_FOOTER.email, colour: PALETTE.link, underline: true },
          { text: "  I  " },
          { text: "web: ", bold: true, colour: PALETTE.link, underline: true },
          { text: COMPANY_FOOTER.web, colour: PALETTE.link, underline: true },
        ],
        45,
        7.5,
      );
      line([{ text: String(index + 1) }], 33, 8);
    });
  }

  private headerCell(cell: Cell): Cell {
    const base = typeof cell === "string" ? { text: cell } : cell;
    return { fill: PALETTE.label, colour: PALETTE.ink, bold: true, ...base };
  }

  private linesOf(cell: Cell, width: number, size: number): Line[] {
    const value = typeof cell === "string" ? { text: cell } : cell;
    const cellSize = value.size ?? size;
    const colour = value.colour ?? PALETTE.ink;
    const bold = value.bold ?? false;
    const font = bold ? this.bold : this.regular;
    const lines: Line[] = [];
    for (const paragraph of (value.text ?? "—").split("\n"))
      for (const text of wrapToWidth(paragraph || " ", font, cellSize, width))
        lines.push({ text, size: cellSize, colour, bold });
    if (value.sub)
      for (const text of wrapToWidth(
        value.sub,
        this.regular,
        cellSize - 1.5,
        width,
      ))
        lines.push({
          text,
          size: cellSize - 1.5,
          colour: PALETTE.muted,
          bold: false,
        });
    return lines;
  }

  private row(
    columns: readonly Column[],
    cells: readonly Cell[],
    size: number,
    keepTogether: boolean,
    onBreak?: () => void,
    middle = false,
  ) {
    const lineHeight = (line: Line) => line.size + 3.2;
    const lines = columns.map((column, index) =>
      this.linesOf(cells[index] ?? "", column.width - PAD * 2, size),
    );
    const heightOf = (list: Line[]) =>
      list.reduce((sum, line) => sum + lineHeight(line), 0);
    const full = Math.max(...lines.map(heightOf)) + PAD * 2;
    if (
      keepTogether &&
      full <= this.top - BOTTOM - 40 &&
      full > this.remaining
    ) {
      this.newPage();
      onBreak?.();
    }
    const offsets = lines.map(() => 0);
    for (;;) {
      if (this.remaining < size + PAD * 2 + 4) {
        this.newPage();
        onBreak?.();
      }
      const available = this.remaining - PAD * 2;
      const taken = lines.map((list, index) => {
        let used = 0;
        let count = 0;
        for (let at = offsets[index]!; at < list.length; at += 1) {
          const next = lineHeight(list[at]!);
          if (used + next > available) break;
          used += next;
          count += 1;
        }
        return { count, used };
      });
      const height = Math.max(...taken.map((part) => part.used)) + PAD * 2;
      const top = this.y;
      let x = LEFT;
      columns.forEach((column, index) => {
        const cell = cells[index];
        const style = typeof cell === "object" ? cell : undefined;
        if (style?.fill)
          this.page.drawRectangle({
            x,
            y: top - height,
            width: column.width,
            height,
            color: rgb(...style.fill),
          });
        const part = lines[index]!.slice(
          offsets[index],
          offsets[index]! + taken[index]!.count,
        );
        const block = taken[index]!.used;
        let lineTop =
          style?.align === "center" || middle
            ? top - (height - block) / 2
            : top - PAD;
        for (const line of part) {
          const lineX =
            style?.align === "center"
              ? x +
                (column.width - this.widthOf(line.text, line.size, line.bold)) /
                  2
              : x + PAD;
          this.write(
            line.text,
            lineX,
            lineTop - line.size,
            line.size,
            line.colour,
            line.bold,
          );
          lineTop -= lineHeight(line);
        }
        this.page.drawRectangle({
          x,
          y: top - height,
          width: column.width,
          height,
          borderColor: rgb(...PALETTE.grid),
          borderWidth: 0.6,
        });
        offsets[index]! += taken[index]!.count;
        x += column.width;
      });
      this.y -= height;
      if (offsets.every((offset, index) => offset >= lines[index]!.length))
        break;
      this.newPage();
      onBreak?.();
    }
  }

  private widthOf(text: string, size: number, bold = false) {
    return (
      (bold ? this.bold : this.regular).widthOfTextAtSize(text, size) +
      (bold ? 0.35 : 0)
    );
  }

  /** Shortens text with an ellipsis to fit a width. */
  private fit(text: string, size: number, width: number) {
    if (this.regular.widthOfTextAtSize(text, size) <= width) return text;
    let out = text;
    while (
      out.length > 1 &&
      this.regular.widthOfTextAtSize(`${out}…`, size) > width
    )
      out = out.slice(0, -1);
    return `${out}…`;
  }

  /** The font has one weight; bold is drawn twice, a fraction of a point apart. */
  private write(
    text: string,
    x: number,
    y: number,
    size: number,
    colour: RGB,
    bold = false,
  ) {
    const font = bold ? this.bold : this.regular;
    const clean = Array.from(text)
      .filter((character) => character.charCodeAt(0) >= 32)
      .join("");
    this.page.drawText(clean, { x, y, size, font, color: rgb(...colour) });
    if (bold)
      this.page.drawText(clean, {
        x: x + 0.35,
        y,
        size,
        font,
        color: rgb(...colour),
      });
  }
}
