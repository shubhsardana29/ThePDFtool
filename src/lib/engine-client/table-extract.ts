/**
 * Heuristic table extraction from a PDF's text layer, plus CSV and a minimal
 * XLSX writer. Pure functions (no pdfjs/DOM) so they're unit-testable; the
 * pdfjs-driven op lives in render.ts and feeds positioned text items in here.
 *
 * The grouping is best-effort: text runs are bucketed into rows by their
 * baseline y, and column anchors are found by clustering run x-positions.
 * Complex or irregular layouts won't map perfectly — this targets grid-like
 * tabular content.
 */
import { zipSync } from "fflate";

export interface PositionedText {
  str: string;
  x: number;
  y: number;
}

/** Group positioned text runs into a rectangular grid of rows × columns. */
export function groupIntoTable(items: PositionedText[], colTolerance = 12): string[][] {
  const byRow = new Map<number, PositionedText[]>();
  for (const it of items) {
    if (!it.str.trim()) continue;
    const key = Math.round(it.y);
    const row = byRow.get(key);
    if (row) row.push(it);
    else byRow.set(key, [it]);
  }
  // Rows top-to-bottom (PDF y grows upward), cells left-to-right.
  const rows = [...byRow.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, cells]) => cells.sort((a, b) => a.x - b.x));
  if (rows.length === 0) return [];

  // Column anchors: cluster all x-starts across every row.
  const xs = rows.flatMap((r) => r.map((c) => c.x)).sort((a, b) => a - b);
  const anchors: number[] = [];
  for (const x of xs) {
    if (anchors.length === 0 || x - anchors[anchors.length - 1] > colTolerance) {
      anchors.push(x);
    }
  }

  return rows.map((row) => {
    const cells = new Array<string>(anchors.length).fill("");
    for (const cell of row) {
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < anchors.length; i++) {
        const d = Math.abs(anchors[i] - cell.x);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      cells[best] = cells[best] ? `${cells[best]} ${cell.str}` : cell.str;
    }
    return cells;
  });
}

// ——— CSV ———

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

// ——— minimal XLSX (Office Open XML) ———

function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function colLetter(n: number): string {
  let s = "";
  n += 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function sheetXml(rows: string[][]): string {
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((val, c) =>
          val === ""
            ? ""
            : `<c r="${colLetter(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(val)}</t></is></c>`,
        )
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

export function buildXlsx(sheets: { name: string; rows: string[][] }[]): Uint8Array {
  const enc = (s: string) => new TextEncoder().encode(s);
  const safe = sheets.length ? sheets : [{ name: "Sheet1", rows: [] as string[][] }];

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    safe
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join("") +
    `</Types>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>` +
    safe.map((s, i) => `<sheet name="${xml(s.name).slice(0, 31)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
    `</sheets></workbook>`;

  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    safe
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join("") +
    `</Relationships>`;

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": enc(contentTypes),
    "_rels/.rels": enc(rootRels),
    "xl/workbook.xml": enc(workbook),
    "xl/_rels/workbook.xml.rels": enc(workbookRels),
  };
  safe.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = enc(sheetXml(s.rows));
  });
  return zipSync(files, { level: 6 });
}
