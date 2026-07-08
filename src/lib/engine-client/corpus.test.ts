/**
 * Real-world corpus tests: PDFs produced by Chromium print-to-PDF,
 * LibreOffice, and Ghostscript — three generator families with very
 * different content-stream styles (TJ arrays with kerning, Tm-per-line,
 * re-flattened streams).
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  PDFArray,
  PDFDocument,
  PDFRawStream,
  decodePDFRawStream,
} from "pdf-lib";
import { describe, expect, it } from "vitest";
import { removeTextInRegions } from "./content-edit";
import { tokenizeContentStream } from "./content-stream";
import { detectTextLines } from "./text-detect";
import type { PdfjsDocument } from "./render";

const FIXTURES = path.join(process.cwd(), "src/lib/engine-client/__fixtures__");

async function loadPdfjs(data: Uint8Array): Promise<PdfjsDocument> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: data.slice() }).promise;
  return doc as unknown as PdfjsDocument;
}

async function fixtureNames(): Promise<string[]> {
  return (await readdir(FIXTURES)).filter((f) => f.endsWith(".pdf"));
}

describe("tokenizer round-trips every fixture's content streams", async () => {
  for (const name of await fixtureNames()) {
    it(name, async () => {
      const doc = await PDFDocument.load(await readFile(path.join(FIXTURES, name)));
      let streams = 0;
      for (const page of doc.getPages()) {
        const contents = page.node.Contents();
        const rawStreams: PDFRawStream[] = [];
        if (contents instanceof PDFArray) {
          for (let i = 0; i < contents.size(); i++) {
            const s = contents.lookup(i);
            if (s instanceof PDFRawStream) rawStreams.push(s);
          }
        } else if (contents instanceof PDFRawStream) {
          rawStreams.push(contents);
        }
        for (const raw of rawStreams) {
          const bytes = decodePDFRawStream(raw).decode();
          const records = tokenizeContentStream(bytes);
          streams++;
          expect(records.length).toBeGreaterThan(0);
          // Offsets must be sane and strictly ordered.
          for (let i = 1; i < records.length; i++) {
            expect(records[i].start).toBeGreaterThanOrEqual(records[i - 1].end);
          }
          expect(records[records.length - 1].end).toBeLessThanOrEqual(bytes.length);
        }
      }
      expect(streams).toBeGreaterThan(0);
    });
  }
});

describe("inline text removal on real-generator PDFs", async () => {
  for (const name of await fixtureNames()) {
    it(`removes a detected line from ${name} without disturbing siblings`, async () => {
      const data = new Uint8Array(await readFile(path.join(FIXTURES, name)));

      // Detect lines the same way the UI does — on the first page with text.
      const pdfjsDoc = await loadPdfjs(data);
      let pageIndex = 0;
      let lines: Awaited<ReturnType<typeof detectTextLines>> = [];
      for (let p = 0; p < pdfjsDoc.numPages; p++) {
        lines = await detectTextLines(pdfjsDoc, p);
        if (lines.length > 2) {
          pageIndex = p;
          break;
        }
      }
      await pdfjsDoc.loadingTask.destroy();
      expect(lines.length).toBeGreaterThan(2);
      // Target a distinctive multi-word line.
      const target = lines
        .filter((l) => l.text.split(" ").length >= 4)
        .sort((a, b) => b.text.length - a.text.length)[0];
      expect(target).toBeDefined();

      // Remove it.
      const doc = await PDFDocument.load(data);
      const { removed, invisible } = removeTextInRegions(doc, doc.getPage(pageIndex), [
        { x: target.x, y: target.y, w: target.w, h: target.h, baseline: target.baseline },
      ]);
      expect(removed[0] + invisible[0]).toBeGreaterThan(0);
      const outBytes = await doc.save();

      // Verify: target text gone (unless invisible-neutralized), siblings intact.
      const outDoc = await loadPdfjs(outBytes);
      const outLines = await detectTextLines(outDoc, pageIndex);
      await outDoc.loadingTask.destroy();
      const outText = outLines.map((l) => l.text).join(" ");
      if (invisible[0] === 0) {
        expect(outText).not.toContain(target.text);
      }
      for (const line of lines) {
        if (line === target) continue;
        const survivor = outLines.find(
          (l) =>
            l.text === line.text &&
            Math.abs(l.x - line.x) < 0.5 &&
            Math.abs(l.baseline - line.baseline) < 0.5,
        );
        expect(survivor, `line "${line.text}" moved or vanished`).toBeDefined();
      }
    });
  }
});
