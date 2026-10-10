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

/** Report palette: navy headings, quiet grid, industry status colours. */
export const PALETTE = {
  ink: [0.1, 0.14, 0.2] as RGB,
  muted: [0.36, 0.4, 0.46] as RGB,
  navy: [0.09, 0.2, 0.32] as RGB,
  brand: [0.11, 0.3, 0.85] as RGB,
  grid: [0.79, 0.83, 0.88] as RGB,
  label: [0.93, 0.95, 0.97] as RGB,
  band: [0.86, 0.9, 0.95] as RGB,
  white: [1, 1, 1] as RGB,
  red: [0.78, 0.16, 0.16] as RGB,
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
const BOTTOM = 62;
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
    const right = pageWidth - LEFT;
    const { logo, title, subtitle, watermark } = this.options;
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
    if (logo) {
      const height = 26;
      const width = (logo.width / logo.height) * height;
      this.page.drawImage(logo, {
        x: LEFT,
        y: pageHeight - 50,
        width,
        height,
      });
    }
    this.write(
      title,
      right - this.widthOf(title, 9, true),
      pageHeight - 34,
      9,
      PALETTE.navy,
      true,
    );
    if (subtitle) {
      const text = this.fit(subtitle, 7.5, 330);
      this.write(
        text,
        right - this.widthOf(text, 7.5),
        pageHeight - 47,
        7.5,
        PALETTE.muted,
      );
    }
    this.page.drawRectangle({
      x: 0,
      y: pageHeight - 64,
      width: pageWidth,
      height: 2,
      color: rgb(...PALETTE.brand),
    });
    this.y = this.top;
  }

  space(height = 10) {
    this.y -= height;
  }

  ensure(height: number) {
    if (this.y - height < BOTTOM) this.newPage();
  }

  /** Full-width navy band with white text (executive summary title). */
  titleBar(text: string, size = 12) {
    const height = size + 14;
    this.ensure(height + 20);
    this.page.drawRectangle({
      x: LEFT,
      y: this.y - height,
      width: this.width,
      height,
      color: rgb(...PALETTE.navy),
    });
    this.write(
      text,
      LEFT + (this.width - this.widthOf(text, size, true)) / 2,
      this.y - height / 2 - size / 2 + 2,
      size,
      PALETTE.white,
      true,
    );
    this.y -= height + 10;
  }

  /** "Annexure III | Detailed Check Report – Education" with an optional status chip. */
  annexureBar(
    number: string,
    title: string,
    chip?: { text: string; fill: RGB; colour: RGB },
  ) {
    const chipWidth = chip
      ? Math.max(70, this.widthOf(chip.text, 8, true) + 18)
      : 0;
    const room = this.width - 92 - 20 - (chip ? chipWidth + 10 : 0);
    // Long titles wrap onto a second line instead of being cut.
    const lines = wrapToWidth(title, this.bold, 10, room).slice(0, 2);
    const height = lines.length > 1 ? 40 : 30;
    this.ensure(height + 60);
    const top = this.y;
    this.page.drawRectangle({
      x: LEFT,
      y: top - height,
      width: this.width,
      height,
      color: rgb(...PALETTE.band),
    });
    this.page.drawRectangle({
      x: LEFT,
      y: top - height,
      width: 92,
      height,
      color: rgb(...PALETTE.navy),
    });
    this.write(
      number,
      LEFT + (92 - this.widthOf(number, 9.5, true)) / 2,
      top - height / 2 - 3.5,
      9.5,
      PALETTE.white,
      true,
    );
    lines.forEach((line, index) => {
      this.write(
        this.fit(line, 10, room),
        LEFT + 92 + 10,
        top - height / 2 - 3.5 + (lines.length > 1 ? 6.5 - index * 13 : 0),
        10,
        PALETTE.navy,
        true,
      );
    });
    if (chip) {
      const x = LEFT + this.width - chipWidth - 7;
      const chipTop = top - height / 2 + 8;
      this.page.drawRectangle({
        x,
        y: chipTop - 16,
        width: chipWidth,
        height: 16,
        color: rgb(...chip.fill),
      });
      this.write(
        chip.text,
        x + (chipWidth - this.widthOf(chip.text, 8, true)) / 2,
        chipTop - 11,
        8,
        chip.colour,
        true,
      );
    }
    this.y -= height + 10;
  }

  /** Small navy heading with a hairline under it. */
  sectionLabel(text: string) {
    this.ensure(40);
    this.write(text, LEFT, this.y - 10, 10, PALETTE.navy, true);
    this.page.drawLine({
      start: { x: LEFT, y: this.y - 15 },
      end: { x: LEFT + this.width, y: this.y - 15 },
      thickness: 0.6,
      color: rgb(...PALETTE.grid),
    });
    this.y -= 24;
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

  /** Page footer on every page: left note and "Page n of N". */
  footers(left: string, right?: string) {
    const pages = this.document.getPages();
    pages.forEach((page, index) => {
      const end = page.getWidth() - LEFT;
      page.drawLine({
        start: { x: LEFT, y: 46 },
        end: { x: end, y: 46 },
        thickness: 0.5,
        color: rgb(...PALETTE.grid),
      });
      const note = this.fit(left, 7, 380);
      page.drawText(note, {
        x: LEFT,
        y: 32,
        size: 7,
        font: this.regular,
        color: rgb(...PALETTE.muted),
      });
      if (right)
        page.drawText(this.fit(right, 7, 380), {
          x: LEFT,
          y: 22,
          size: 7,
          font: this.regular,
          color: rgb(...PALETTE.muted),
        });
      const number = `Page ${index + 1} of ${pages.length}`;
      page.drawText(number, {
        x: end - this.regular.widthOfTextAtSize(number, 7.5),
        y: 32,
        size: 7.5,
        font: this.regular,
        color: rgb(...PALETTE.muted),
      });
    });
  }

  private headerCell(cell: Cell): Cell {
    const base = typeof cell === "string" ? { text: cell } : cell;
    return { fill: PALETTE.navy, colour: PALETTE.white, bold: true, ...base };
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
    if (keepTogether && full <= this.top - BOTTOM - 40 && full > this.remaining) {
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
