/**
 * Extract embedded raster images from a PDF.
 *
 * Reliable, lossless cases:
 *  - DCTDecode  → the stream bytes ARE a JPEG, written straight out as .jpg
 *  - JPXDecode  → JPEG 2000, written as .jp2
 *  - FlateDecode with DeviceGray/DeviceRGB (or ICCBased N=1/3), 8 bits/comp,
 *    and no predictor → decoded samples wrapped in a PNG
 *
 * Anything else (CMYK, indexed, 1-bit, predictor-filtered, masks) is skipped;
 * the op throws a friendly error if nothing extractable is found.
 */
import {
  PDFArray,
  PDFDict,
  PDFName,
  PDFRawStream,
  PDFDocument,
  decodePDFRawStream,
} from "pdf-lib";
import { zlibSync } from "fflate";
import { baseName } from "./pages";
import type { EngineFile, EngineOp } from "./types";

// ——— minimal PNG encoder (8-bit gray or RGB, no interlace) ———

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);
  const out = new Uint8Array(4 + body.length + 4);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(body, 4);
  dv.setUint32(4 + body.length, crc32(body));
  return out;
}

/** Wrap raw 8-bit samples (channels: 1 gray, 3 RGB) into a PNG. Exported for tests. */
export function encodePng(
  samples: Uint8Array,
  width: number,
  height: number,
  channels: 1 | 3,
): Uint8Array {
  const colorType = channels === 1 ? 0 : 2;
  // Prepend a filter byte (0 = none) to each scanline.
  const stride = width * channels;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    raw.set(samples.subarray(y * stride, y * stride + stride), y * (stride + 1) + 1);
  }
  const idat = zlibSync(raw, { level: 6 });

  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = colorType;
  // ihdr[10..12] = compression/filter/interlace = 0

  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", new Uint8Array(0))];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const png = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    png.set(p, off);
    off += p.length;
  }
  return png;
}

// ——— stream inspection helpers ———

function filterNames(dict: PDFDict): string[] {
  const f = dict.lookup(PDFName.of("Filter"));
  if (f instanceof PDFName) return [f.asString()];
  if (f instanceof PDFArray) return f.asArray().map((n) => n.toString());
  return [];
}

function num(dict: PDFDict, key: string): number | undefined {
  const v = dict.lookup(PDFName.of(key));
  return v && "asNumber" in v ? (v as { asNumber(): number }).asNumber() : undefined;
}

/** Resolve channel count for the simple color spaces we support (else null). */
function channelsFor(dict: PDFDict): 1 | 3 | null {
  const cs = dict.lookup(PDFName.of("ColorSpace"));
  const name = cs instanceof PDFName ? cs.asString() : undefined;
  if (name === "/DeviceGray" || name === "/CalGray") return 1;
  if (name === "/DeviceRGB" || name === "/CalRGB") return 3;
  if (cs instanceof PDFArray && cs.get(0)?.toString() === "/ICCBased") {
    const stream = cs.lookup(1);
    if (stream instanceof PDFRawStream) {
      const n = num(stream.dict, "N");
      if (n === 1) return 1;
      if (n === 3) return 3;
    }
  }
  return null;
}

export interface DecodedImage {
  ext: "jpg" | "jp2" | "png";
  mime: string;
  data: Uint8Array;
}

/** Decode one image XObject to a browser-friendly format, or null if unsupported. */
export function decodeXObjectImage(xobj: PDFRawStream): DecodedImage | null {
  const dict = xobj.dict;
  if (dict.lookup(PDFName.of("Subtype"))?.toString() !== "/Image") return null;
  const filters = filterNames(dict);

  if (filters.includes("/DCTDecode")) {
    return { ext: "jpg", mime: "image/jpeg", data: xobj.contents };
  }
  if (filters.includes("/JPXDecode")) {
    return { ext: "jp2", mime: "image/jp2", data: xobj.contents };
  }
  const width = num(dict, "Width");
  const height = num(dict, "Height");
  if (
    filters.includes("/FlateDecode") &&
    !dict.lookup(PDFName.of("DecodeParms")) &&
    num(dict, "BitsPerComponent") === 8 &&
    width &&
    height
  ) {
    const channels = channelsFor(dict);
    if (!channels) return null;
    try {
      const samples = decodePDFRawStream(xobj).decode();
      if (samples.length < width * height * channels) return null;
      return { ext: "png", mime: "image/png", data: encodePng(samples, width, height, channels) };
    } catch {
      return null;
    }
  }
  return null;
}

export const extractImages: EngineOp = async ([file]) => {
  const doc = await PDFDocument.load(file.data);
  const base = baseName(file.name);
  const outputs: EngineFile[] = [];
  const seen = new Set<PDFRawStream>();
  let index = 0;

  for (const page of doc.getPages()) {
    const resources = page.node.Resources();
    const xobjects = resources?.lookup(PDFName.of("XObject"));
    if (!(xobjects instanceof PDFDict)) continue;

    for (const key of xobjects.keys()) {
      const xobj = xobjects.lookup(key);
      if (!(xobj instanceof PDFRawStream) || seen.has(xobj)) continue;
      seen.add(xobj);
      const decoded = decodeXObjectImage(xobj);
      if (!decoded) continue;
      const n = ++index;
      outputs.push({
        name: `${base}-image-${String(n).padStart(3, "0")}.${decoded.ext}`,
        data: decoded.data,
        mime: decoded.mime,
      });
    }
  }

  if (outputs.length === 0) {
    throw new Error(
      "No extractable images were found. The PDF may have no raster images, or they use a format this tool doesn't decode yet (e.g. CMYK or indexed color).",
    );
  }
  return outputs;
};
