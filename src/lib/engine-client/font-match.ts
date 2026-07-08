/**
 * Replacement-text fonts for inline text editing.
 *
 * Liberation Sans/Serif are metrically compatible with Arial/Helvetica and
 * Times — the families that dominate real documents — and cover Latin,
 * Latin Extended, Greek, and Cyrillic. Font bytes are fetched lazily (only
 * the variants actually used by an edit) and embedded subsetted, so a
 * one-line edit adds a few KB to the output, not 400.
 */
import type { PDFDocument, PDFFont } from "pdf-lib";

export interface FontVariant {
  fontFamily: "sans" | "serif";
  bold: boolean;
  italic: boolean;
}

export function variantFile({ fontFamily, bold, italic }: FontVariant): string {
  const family = fontFamily === "serif" ? "LiberationSerif" : "LiberationSans";
  const style =
    bold && italic ? "BoldItalic" : bold ? "Bold" : italic ? "Italic" : "Regular";
  return `${family}-${style}.ttf`;
}

export function variantKey(v: FontVariant): string {
  return variantFile(v);
}

// Fetches from the site's static assets in the browser/worker; tests inject
// a filesystem-backed fetcher instead.
let fetcher = async (file: string): Promise<Uint8Array> => {
  const res = await fetch(`/fonts/${file}`);
  if (!res.ok) throw new Error(`Font ${file} unavailable (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
};

export function setFontFetcher(f: typeof fetcher): void {
  fetcher = f;
}

const bytesCache = new Map<string, Promise<Uint8Array>>();

async function fontBytes(file: string): Promise<Uint8Array> {
  let cached = bytesCache.get(file);
  if (!cached) {
    cached = fetcher(file).catch((err) => {
      bytesCache.delete(file); // don't cache failures
      throw err;
    });
    bytesCache.set(file, cached);
  }
  return cached;
}

/**
 * Embed the matching variant into the document (subsetted). The caller must
 * have registered fontkit on the document first.
 */
export async function embedVariant(
  doc: PDFDocument,
  variant: FontVariant,
): Promise<PDFFont> {
  const bytes = await fontBytes(variantFile(variant));
  return doc.embedFont(bytes, { subset: true });
}
