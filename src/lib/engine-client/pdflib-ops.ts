import {
  PDFDict,
  PDFDocument,
  PDFName,
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

export const deletePages: EngineOp = async ([file], options) => {
  const src = await PDFDocument.load(file.data);
  const count = src.getPageCount();
  const remove = new Set(parsePageRanges(String(options.pages ?? ""), count));
  if (remove.size === 0) throw new Error("No pages selected to delete");
  if (remove.size >= count) throw new Error("Cannot delete every page");
  const keep: number[] = [];
  for (let i = 0; i < count; i++) if (!remove.has(i)) keep.push(i);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, keep);
  pages.forEach((p) => out.addPage(p));
  return [pdfFile(`${baseName(file.name)}-pages-removed.pdf`, await out.save())];
};

// [cols, rows, orientation] per pages-per-sheet.
const NUP_GRID: Record<number, [number, number, "landscape" | "portrait" | "source"]> = {
  2: [2, 1, "landscape"],
  4: [2, 2, "source"],
  6: [2, 3, "portrait"],
};

export const nUp: EngineOp = async ([file], options) => {
  const per = Number(options.perSheet ?? 2);
  const [cols, rows, orient] = NUP_GRID[per] ?? NUP_GRID[2];
  const src = await PDFDocument.load(file.data);
  const srcPages = src.getPages();
  const out = await PDFDocument.create();
  const embedded = await out.embedPages(srcPages);

  const first = srcPages[0].getSize();
  const long = Math.max(first.width, first.height);
  const short = Math.min(first.width, first.height);
  const sheetW = orient === "landscape" ? long : orient === "portrait" ? short : first.width;
  const sheetH = orient === "landscape" ? short : orient === "portrait" ? long : first.height;

  const margin = 18;
  const gap = 10;
  const cellW = (sheetW - 2 * margin - (cols - 1) * gap) / cols;
  const cellH = (sheetH - 2 * margin - (rows - 1) * gap) / rows;

  for (let start = 0; start < embedded.length; start += per) {
    const page = out.addPage([sheetW, sheetH]);
    for (let k = 0; k < per && start + k < embedded.length; k++) {
      const ep = embedded[start + k];
      const scale = Math.min(cellW / ep.width, cellH / ep.height);
      const w = ep.width * scale;
      const h = ep.height * scale;
      const col = k % cols;
      const row = Math.floor(k / cols);
      const x = margin + col * (cellW + gap) + (cellW - w) / 2;
      const yTop = margin + row * (cellH + gap);
      const y = sheetH - yTop - cellH + (cellH - h) / 2;
      page.drawPage(ep, { x, y, width: w, height: h });
    }
  }
  return [pdfFile(`${baseName(file.name)}-nup.pdf`, await out.save())];
};

function dataUrlBytes(dataUrl: string): { bytes: Uint8Array; png: boolean } {
  const [head, body] = dataUrl.split(",", 2);
  const bin = atob(body ?? "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, png: head.includes("image/png") };
}

/**
 * Swap existing images. options.replacements: [{ sites:[{page,name}], dataUrl }].
 * Repointing the page's XObject resource to a freshly embedded image means the
 * existing `Do` operator draws the new image at the original position/size.
 */
export const replaceImage: EngineOp = async ([file], options) => {
  const replacements = (options.replacements ?? []) as {
    sites: { page: number; name: string }[];
    dataUrl: string;
  }[];
  const doc = await PDFDocument.load(file.data);
  const pages = doc.getPages();
  for (const rep of replacements) {
    if (!rep.dataUrl || rep.sites.length === 0) continue;
    const { bytes, png } = dataUrlBytes(rep.dataUrl);
    const image = png ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    for (const site of rep.sites) {
      const page = pages[site.page];
      const xobjs = page?.node.Resources()?.lookup(PDFName.of("XObject"));
      if (xobjs instanceof PDFDict) xobjs.set(PDFName.of(site.name), image.ref);
    }
  }
  return [pdfFile(`${baseName(file.name)}-image-replaced.pdf`, await doc.save())];
};

export const sanitize: EngineOp = async ([file]) => {
  const doc = await PDFDocument.load(file.data);
  doc.setTitle("");
  doc.setAuthor("");
  doc.setSubject("");
  doc.setKeywords([]);
  doc.setProducer("");
  doc.setCreator("");
  // Drop the XMP metadata packet (a common place hidden data lingers).
  doc.catalog.delete(PDFName.of("Metadata"));
  return [pdfFile(`${baseName(file.name)}-sanitized.pdf`, await doc.save())];
};

export const flattenPdf: EngineOp = async ([file]) => {
  const doc = await PDFDocument.load(file.data);
  try {
    doc.getForm().flatten();
  } catch {
    // no form / already flat — nothing to do
  }
  return [pdfFile(`${baseName(file.name)}-flattened.pdf`, await doc.save())];
};

export const headerFooter: EngineOp = async ([file], options) => {
  const header = String(options.header ?? "");
  const footer = String(options.footer ?? "");
  const align = String(options.align ?? "center");
  const doc = await PDFDocument.load(file.data);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const total = doc.getPageCount();
  const today = new Date().toLocaleDateString();
  doc.getPages().forEach((page, i) => {
    const { width, height } = page.getSize();
    const sub = (t: string) =>
      t
        .replace(/\{page\}/g, String(i + 1))
        .replace(/\{pages\}/g, String(total))
        .replace(/\{date\}/g, today);
    const size = 10;
    const draw = (raw: string, y: number) => {
      if (!raw.trim()) return;
      const text = sub(raw);
      const tw = font.widthOfTextAtSize(text, size);
      const x = align === "left" ? 40 : align === "right" ? width - 40 - tw : (width - tw) / 2;
      page.drawText(text, { x, y, size, font, color: rgb(0.2, 0.2, 0.2) });
    };
    draw(header, height - 30);
    draw(footer, 20);
  });
  return [pdfFile(`${baseName(file.name)}-header-footer.pdf`, await doc.save())];
};

const TARGET_SIZES: Record<string, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

export const resize: EngineOp = async ([file], options) => {
  const [tw, th] = TARGET_SIZES[String(options.size ?? "a4")] ?? TARGET_SIZES.a4;
  const src = await PDFDocument.load(file.data);
  const out = await PDFDocument.create();
  const embedded = await out.embedPages(src.getPages());
  for (const ep of embedded) {
    const landscape = ep.width > ep.height;
    const pw = landscape ? Math.max(tw, th) : Math.min(tw, th);
    const ph = landscape ? Math.min(tw, th) : Math.max(tw, th);
    const page = out.addPage([pw, ph]);
    const scale = Math.min(pw / ep.width, ph / ep.height);
    const w = ep.width * scale;
    const h = ep.height * scale;
    page.drawPage(ep, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  }
  return [pdfFile(`${baseName(file.name)}-resized.pdf`, await out.save())];
};

export const bates: EngineOp = async ([file], options) => {
  const prefix = String(options.prefix ?? "");
  const start = Number(options.start ?? 1);
  const digits = Math.max(1, Math.min(12, Number(options.digits ?? 6)));
  const position = String(options.position ?? "bottom-right");
  const doc = await PDFDocument.load(file.data);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.getPages().forEach((page, i) => {
    const label = `${prefix}${String(start + i).padStart(digits, "0")}`;
    const size = 10;
    const tw = font.widthOfTextAtSize(label, size);
    const { width } = page.getSize();
    const x =
      position === "bottom-left"
        ? 40
        : position === "bottom-center"
          ? (width - tw) / 2
          : width - 40 - tw;
    page.drawText(label, { x, y: 20, size, font, color: rgb(0, 0, 0) });
  });
  return [pdfFile(`${baseName(file.name)}-bates.pdf`, await doc.save())];
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
  "delete-pages": deletePages,
  "n-up": nUp,
  bates,
  sanitize,
  "flatten-pdf": flattenPdf,
  "header-footer": headerFooter,
  resize,
  "replace-image": replaceImage,
  // edit and sign both stamp overlay items onto the document;
  // fill-form fills AcroForm fields (also via the flatten op)
  edit: flatten,
  sign: flatten,
  "fill-form": flatten,
};
