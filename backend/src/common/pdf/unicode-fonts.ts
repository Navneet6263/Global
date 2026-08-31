import "regenerator-runtime/runtime";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PDFDocument } from "pdf-lib";

let fontBytes: Promise<Uint8Array> | undefined;

function loadFont() {
  fontBytes ??= readFile(
    join(__dirname, "..", "..", "assets", "fonts", "NotoSansDevanagari.ttf"),
  ).catch(() =>
    readFile(
      join(process.cwd(), "src", "assets", "fonts", "NotoSansDevanagari.ttf"),
    ),
  );
  return fontBytes;
}

export async function embedUnicodeFonts(document: PDFDocument) {
  document.registerFontkit(fontkit);
  const bytes = await loadFont();
  const [regular, bold] = await Promise.all([
    document.embedFont(bytes, { subset: true }),
    document.embedFont(bytes, { subset: true }),
  ]);
  return { regular, bold };
}
