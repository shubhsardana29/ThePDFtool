import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { extractImages } from "./extract-images";
import { flatten } from "./flatten";
import { baseName, parsePageRanges, parseRangeGroups } from "./pages";
import type { EngineFile, EngineOp } from "./types";

const PAGE_SIZES: Record<string, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

function pdfFile(name: string, data: Uint8Array): EngineFile {
  return { name, data, mime: "application/pdf" };
}

export const editMetadata: EngineOp = async ([file], options) => {
  const doc = await PDFDocument.load(file.data);
  if (typeof options.title === "string") doc.setTitle(options.title);
  if (typeof options.author === "string") doc.setAuthor(options.author);
  if (typeof options.subject === "string") doc.setSubject(options.subject);
  if (typeof options.keywords === "string") {
    doc.setKeywords(
      options.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    );
  }
  return [pdfFile(`${baseName(file.name)}-metadata.pdf`, await doc.save())];
};

export const crop: EngineOp = async ([file], options) => {
  const box = options.box as
    | { x: number; y: number; w: number; h: number }
    | undefined;
  const doc = await PDFDocument.load(file.data);
  if (box && box.w > 0 && box.h > 0) {
    // box is in DISPLAYED top-left points (from the crop UI). Convert per page
    // so it maps correctly even on rotated pages, then set the CropBox.
    const { toPdfRect } = await import("./page-rotate");
    for (const page of doc.getPages()) {
      const r = toPdfRect(page, box.x, box.y, box.w, box.h);
      page.setCropBox(r.x, r.y, r.width, r.height);
    }
  }
  return [pdfFile(`${baseName(file.name)}-cropped.pdf`, await doc.save())];
};

export const merge: EngineOp = async (files) => {
  const out = await PDFDocument.create();
  for (const file of files) {
    const src = await PDFDocument.load(file.data);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return [pdfFile("merged.pdf", await out.save())];
};

export const split: EngineOp = async ([file], options) => {
  const src = await PDFDocument.load(file.data);
  const groups = parseRangeGroups(
    String(options.ranges ?? ""),
    src.getPageCount(),
  );
  const base = baseName(file.name);
  const outputs: EngineFile[] = [];
  for (let i = 0; i < groups.length; i++) {
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, groups[i]);
    pages.forEach((p) => out.addPage(p));
    outputs.push(pdfFile(`${base}-part${i + 1}.pdf`, await out.save()));
  }
  return outputs;
};

export const extract: EngineOp = async ([file], options) => {
  const src = await PDFDocument.load(file.data);
  const indices = parsePageRanges(
    String(options.pages ?? ""),
    src.getPageCount(),
  );
  if (indices.length === 0) throw new Error("No pages selected");
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
  return [pdfFile(`${baseName(file.name)}-extracted.pdf`, await out.save())];
};

export const rotate: EngineOp = async (files, options) => {
  const angle = parseInt(String(options.angle), 10);
  const outputs: EngineFile[] = [];
  for (const file of files) {
    const doc = await PDFDocument.load(file.data);
    const expr = String(options.pages ?? "").trim();
    const targets = expr
      ? new Set(parsePageRanges(expr, doc.getPageCount()))
      : null;
    doc.getPages().forEach((page, i) => {
      if (targets && !targets.has(i)) return;
      page.setRotation(degrees((page.getRotation().angle + angle) % 360));
    });
    outputs.push(
      pdfFile(`${baseName(file.name)}-rotated.pdf`, await doc.save()),
    );
  }
  return outputs;
};

/** options.order: zero-based original page indices in their new order. */
export const organize: EngineOp = async ([file], options) => {
  const order = options.order as number[];
  if (!Array.isArray(order) || order.length === 0) {
    throw new Error("No pages left in the document");
  }
  const src = await PDFDocument.load(file.data);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, order);
  pages.forEach((p) => out.addPage(p));
  return [pdfFile(`${baseName(file.name)}-organized.pdf`, await out.save())];
};

function drawCenteredText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  size: number,
  opacity: number,
  angleDeg: number,
) {
  const { width, height } = page.getSize();
  const tw = font.widthOfTextAtSize(text, size);
  const th = font.heightAtSize(size);
  const rad = (angleDeg * Math.PI) / 180;
  // pdf-lib rotates around the text origin (baseline left); offset the origin
  // so the rotated text stays centered on the page.
  const x = width / 2 - (tw / 2) * Math.cos(rad) + (th / 2) * Math.sin(rad);
  const y = height / 2 - (tw / 2) * Math.sin(rad) - (th / 2) * Math.cos(rad);
  page.drawText(text, {
    x,
    y,
    size,
    font,
    color: rgb(0.5, 0.5, 0.5),
    opacity,
    rotate: degrees(angleDeg),
  });
}

export const watermark: EngineOp = async (files, options) => {
  const text = String(options.text ?? "");
  const fontSize = Number(options.fontSize ?? 48);
  const opacity = Number(options.opacity ?? 0.25);
  const angle = options.diagonal ? 45 : 0;
  const outputs: EngineFile[] = [];
  for (const file of files) {
    const doc = await PDFDocument.load(file.data);
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    for (const page of doc.getPages()) {
      drawCenteredText(page, font, text, fontSize, opacity, angle);
    }
    outputs.push(
      pdfFile(`${baseName(file.name)}-watermarked.pdf`, await doc.save()),
    );
  }
  return outputs;
};

export const pageNumbers: EngineOp = async (files, options) => {
  const position = String(options.position ?? "bottom-center");
  const format = String(options.format ?? "n");
  const start = Number(options.start ?? 1);
  const outputs: EngineFile[] = [];
  for (const file of files) {
    const doc = await PDFDocument.load(file.data);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const total = doc.getPageCount();
    doc.getPages().forEach((page, i) => {
      const n = start + i;
      const label = format === "n-of-total" ? `${n} of ${total}` : String(n);
      const size = 11;
      const tw = font.widthOfTextAtSize(label, size);
      const { width } = page.getSize();
      const x =
        position === "bottom-left"
          ? 40
          : position === "bottom-right"
            ? width - 40 - tw
            : (width - tw) / 2;
      page.drawText(label, { x, y: 24, size, font, color: rgb(0.2, 0.2, 0.2) });
    });
    outputs.push(
      pdfFile(`${baseName(file.name)}-numbered.pdf`, await doc.save()),
    );
  }
  return outputs;
};

function isPng(data: Uint8Array): boolean {
  return (
    data.length > 4 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  );
}

export const imagesToPdf: EngineOp = async (files, options) => {
  const pageSize = String(options.pageSize ?? "fit");
  const margin = Number(options.margin ?? 0);
  const out = await PDFDocument.create();
  for (const file of files) {
    const image = isPng(file.data)
      ? await out.embedPng(file.data)
      : await out.embedJpg(file.data);
    const [pw, ph] =
      pageSize === "fit"
        ? [image.width + margin * 2, image.height + margin * 2]
        : PAGE_SIZES[pageSize];
    const page = out.addPage([pw, ph]);
    const maxW = pw - margin * 2;
    const maxH = ph - margin * 2;
    const scale = Math.min(maxW / image.width, maxH / image.height, 1);
    const w = image.width * scale;
    const h = image.height * scale;
    page.drawImage(image, {
      x: (pw - w) / 2,
      y: (ph - h) / 2,
      width: w,
      height: h,
    });
  }
  return [pdfFile("images.pdf", await out.save())];
};

export const PDFLIB_OPS: Record<string, EngineOp> = {
  merge,
  split,
  extract,
  rotate,
  organize,
  watermark,
  "page-numbers": pageNumbers,
  "images-to-pdf": imagesToPdf,
  "extract-images": extractImages,
  "edit-metadata": editMetadata,
  crop,
  // edit and sign both stamp overlay items onto the document;
  // fill-form fills AcroForm fields (also via the flatten op)
  edit: flatten,
  sign: flatten,
  "fill-form": flatten,
};
