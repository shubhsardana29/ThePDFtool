/**
 * Enumerate the raster images embedded in a PDF, with a preview and every
 * place each is drawn. Backs the "Replace Image" tool: the user picks an image
 * by its thumbnail and the op repoints that XObject to a new image, so the
 * page's existing draw operator renders the replacement at the same spot.
 */
import { PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream } from "pdf-lib";
import { decodeXObjectImage } from "./extract-images";

export interface DetectedImage {
  /** XObject indirect-reference key, e.g. "5 0 R" — stable id for the picker. */
  id: string;
  previewDataUrl: string;
  width: number;
  height: number;
  /** Every (page, resource-name) site that draws this image. */
  sites: { page: number; name: string }[];
}

function bytesToDataUrl(mime: string, data: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < data.length; i += chunk) {
    bin += String.fromCharCode(...data.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(bin)}`;
}

function dim(dict: PDFDict, key: string): number {
  const v = dict.lookup(PDFName.of(key));
  return v instanceof PDFNumber ? v.asNumber() : 0;
}

export async function detectImages(bytes: Uint8Array): Promise<DetectedImage[]> {
  const doc = await PDFDocument.load(bytes);
  const byRef = new Map<string, DetectedImage>();
  const pages = doc.getPages();

  for (let pi = 0; pi < pages.length; pi++) {
    const xobjects = pages[pi].node.Resources()?.lookup(PDFName.of("XObject"));
    if (!(xobjects instanceof PDFDict)) continue;

    for (const key of xobjects.keys()) {
      const name = key.asString().replace(/^\//, "");
      const ref = xobjects.get(key);
      const refKey = ref ? ref.toString() : `p${pi}:${name}`;
      const xobj = xobjects.lookup(key);
      if (!(xobj instanceof PDFRawStream)) continue;

      let entry = byRef.get(refKey);
      if (!entry) {
        const decoded = decodeXObjectImage(xobj);
        if (!decoded) continue; // only list images we can preview + replace
        entry = {
          id: refKey,
          previewDataUrl: bytesToDataUrl(decoded.mime, decoded.data),
          width: dim(xobj.dict, "Width"),
          height: dim(xobj.dict, "Height"),
          sites: [],
        };
        byRef.set(refKey, entry);
      }
      entry.sites.push({ page: pi, name });
    }
  }
  return [...byRef.values()];
}
