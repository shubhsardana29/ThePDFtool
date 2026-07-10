/**
 * Server-side upload validation. Everything here re-checks what the client
 * already enforced — extensions and magic bytes are validated independently
 * because the client can't be trusted.
 */

export type FileKind = "pdf" | "office-zip" | "office-ole" | "html";

const EXT_KIND: Record<string, FileKind> = {
  pdf: "pdf",
  docx: "office-zip",
  xlsx: "office-zip",
  pptx: "office-zip",
  odt: "office-zip",
  ods: "office-zip",
  odp: "office-zip",
  doc: "office-ole",
  xls: "office-ole",
  ppt: "office-ole",
  html: "html",
  htm: "html",
};

/** Which file extensions each server tool accepts. */
export const TOOL_INPUT_EXTS: Record<string, string[]> = {
  compress: ["pdf"],
  repair: ["pdf"],
  pdfa: ["pdf"],
  ocr: ["pdf"],
  protect: ["pdf"],
  unlock: ["pdf"],
  linearize: ["pdf"],
  "pdf-to-word": ["pdf"],
  "pdf-to-powerpoint": ["pdf"],
  "office-to-pdf": ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp"],
  "html-to-pdf": ["html", "htm"],
};

export function fileExtension(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

function startsWith(data: Uint8Array, bytes: number[]): boolean {
  return bytes.every((b, i) => data[i] === b);
}

/** Verify the file's leading bytes match what its extension claims. */
export function sniffMatchesExt(data: Uint8Array, ext: string): boolean {
  const kind = EXT_KIND[ext];
  if (!kind) return false;
  switch (kind) {
    case "pdf":
      return startsWith(data, [0x25, 0x50, 0x44, 0x46]); // %PDF
    case "office-zip":
      return startsWith(data, [0x50, 0x4b, 0x03, 0x04]); // PK..
    case "office-ole":
      return startsWith(data, [0xd0, 0xcf, 0x11, 0xe0]); // OLE2
    case "html": {
      // Text format — no magic bytes. Reject anything that looks binary.
      const head = data.subarray(0, 1024);
      return !head.includes(0);
    }
  }
}

/** Make an upload name safe for reuse in output filenames and headers. */
export function sanitizeName(name: string): string {
  const last = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = last.replace(/[^\w.\- ]/g, "_").trim();
  return (cleaned || "file").slice(0, 120);
}
