import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
const ink = rgb(0.12, 0.16, 0.14);
const muted = rgb(0.36, 0.4, 0.38);
export class ReportWriter {
  private page!: PDFPage;
  private y = 0;
  constructor(
    private readonly document: PDFDocument,
    private readonly regular: PDFFont,
    private readonly bold: PDFFont,
  ) {
    this.nextPage();
  }

  heading(text: string, size = 12) {
    this.ensure(42);
    this.text(text, size, true);
    this.space(4);
  }

  section(title: string, detail: string, color: [number, number, number]) {
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

  space(height = 12) {
    this.y -= height;
  }
  private ensure(height: number) {
    if (this.y - height < 65) this.nextPage();
  }
  private nextPage() {
    this.page = this.document.addPage([595, 842]);
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
