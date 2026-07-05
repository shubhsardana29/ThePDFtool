/**
 * Parse a page-range expression like "1-3, 5, 8-10" into zero-based page
 * indices, validated against the document's page count.
 */
export function parsePageRanges(expr: string, pageCount: number): number[] {
  const indices: number[] = [];
  for (const part of expr.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) throw new Error(`Invalid page range: "${trimmed}"`);
    const start = parseInt(m[1], 10);
    const end = m[2] ? parseInt(m[2], 10) : start;
    if (start < 1 || end > pageCount || start > end) {
      throw new Error(
        `Page range "${trimmed}" is out of bounds (document has ${pageCount} pages)`,
      );
    }
    for (let p = start; p <= end; p++) indices.push(p - 1);
  }
  return indices;
}

/**
 * Split a range expression into groups, one per comma-separated part:
 * "1-3, 5" → [[0,1,2], [4]]. Empty expression → one group per page.
 */
export function parseRangeGroups(expr: string, pageCount: number): number[][] {
  const parts = expr
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return Array.from({ length: pageCount }, (_, i) => [i]);
  }
  return parts.map((part) => parsePageRanges(part, pageCount));
}

/** Strip directory components and the extension from an upload filename. */
export function baseName(name: string): string {
  const last = name.split(/[\\/]/).pop() ?? name;
  return last.replace(/\.[^.]+$/, "") || "document";
}
