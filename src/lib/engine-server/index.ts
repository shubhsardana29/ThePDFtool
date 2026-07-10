import { compress, pdfa, repair } from "./ghostscript";
import { htmlToPdf, officeToPdf } from "./gotenberg";
import { pdfToPowerpoint, pdfToWord } from "./libreoffice";
import { ocr } from "./ocr";
import { linearize, protect, unlock } from "./qpdf";
import type { ServerOp } from "./types";

export const SERVER_OPS: Record<string, ServerOp> = {
  compress,
  repair,
  pdfa,
  ocr,
  protect,
  unlock,
  linearize,
  "office-to-pdf": officeToPdf,
  "html-to-pdf": htmlToPdf,
  "pdf-to-word": pdfToWord,
  "pdf-to-powerpoint": pdfToPowerpoint,
};
