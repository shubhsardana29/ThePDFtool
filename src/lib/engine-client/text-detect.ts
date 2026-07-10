/**
 * Detection of editable text lines for the "Edit text" mode.
 *
 * Groups pdfjs text runs into visual lines (like extractPageLines in
 * render.ts, but keeping geometry + font info, and splitting same-baseline
 * columns). Coordinates are PDF points with a TOP-LEFT origin — the same
 * convention as OverlayItem.
 */
import type { PdfjsDocument } from "./render";

export interface DetectedLine {
  page: number;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Baseline in points from the page TOP. */
  baseline: number;
  fontSize: number;
  fontFamily: "sans" | "serif";
  bold: boolean;
  italic: boolean;
  /** CSS family for the inline input — the pdfjs-loaded face + fallback. */
  cssFontFamily: string;
}

interface Run {
  /** Displayed-space (top-left origin) run box left edge and width. */
  x: number;
  width: number;
  /** Displayed baseline measured from the page top. */
  baseline: number;
  fontSize: number;
  ascent: number;
  descent: number;
  text: string;
  pdfjsFontName: string;
}

const SERIF_RE = /times|georgia|garamond|serif|book|caslon|minion|roman|palatino|cambria/i;
const BOLD_RE = /bold|black|heavy|semibold|demi/i;
const ITALIC_RE = /italic|oblique/i;

function styleFromFontNames(names: string[]): {
  fontFamily: "sans" | "serif";
  bold: boolean;
  italic: boolean;
} {
  const joined = names.join(" ");
  return {
    fontFamily: SERIF_RE.test(joined) ? "serif" : "sans",
    bold: BOLD_RE.test(joined),
    italic: ITALIC_RE.test(joined),
  };
}

export async function detectTextLines(
  doc: PdfjsDocument,
  pageIndex: number,
): Promise<DetectedLine[]> {
  const page = await doc.getPage(pageIndex + 1);
  // Work in DISPLAYED (rotation-aware) space via the viewport: readable text is
  // horizontal there at any /Rotate, so line grouping, column splitting and box
  // geometry are identical to the un-rotated case. At rotation 0 this reduces to
  // (pageH - y), so output is unchanged for the common case.
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();

  // Collect runs grouped by (rounded) displayed baseline.
  const byBaseline = new Map<number, Run[]>();
  for (const item of content.items) {
    if (!("str" in item) || !item.str.trim()) continue;
    const t = item.transform;
    const fontSize = Math.hypot(t[2], t[3]) || Math.hypot(t[0], t[1]);
    if (fontSize <= 0) continue;
    // Baseline origin and run end in displayed space (advance runs along the
    // text x-axis, mapped through the rotation-aware viewport).
    const [vx0, vy0] = viewport.convertToViewportPoint(t[4], t[5]);
    const axisLen = Math.hypot(t[0], t[1]) || 1;
    const [vx1] = viewport.convertToViewportPoint(
      t[4] + (t[0] / axisLen) * item.width,
      t[5] + (t[1] / axisLen) * item.width,
    );
    const style = content.styles[item.fontName];
    const run: Run = {
      x: Math.min(vx0, vx1),
      width: Math.abs(vx1 - vx0),
      baseline: vy0,
      fontSize,
      ascent: style?.ascent || 0.8,
      descent: style?.descent ?? -0.2, // pdfjs descent is negative
      text: item.str,
      pdfjsFontName: item.fontName,
    };
    const key = Math.round(run.baseline * 2) / 2;
    const group = byBaseline.get(key);
    if (group) group.push(run);
    else byBaseline.set(key, [run]);
  }

  const lines: DetectedLine[] = [];
  // Top of page first (smaller displayed y = higher on the page).
  const baselines = [...byBaseline.keys()].sort((a, b) => a - b);
  for (const key of baselines) {
    const runs = byBaseline.get(key)!.sort((a, b) => a.x - b.x);
    // Split same-baseline columns where the x-gap is too wide to be one line.
    const segments: Run[][] = [];
    let current: Run[] = [];
    for (const run of runs) {
      const prev = current[current.length - 1];
      if (
        prev &&
        run.x - (prev.x + prev.width) >
          Math.max(2.5 * Math.max(prev.fontSize, run.fontSize), 14)
      ) {
        segments.push(current);
        current = [];
      }
      current.push(run);
    }
    if (current.length) segments.push(current);

    for (const segment of segments) {
      const fontSize = Math.max(...segment.map((r) => r.fontSize));
      const ascent = Math.max(...segment.map((r) => r.ascent));
      const descent = Math.min(...segment.map((r) => r.descent));
      const x0 = segment[0].x;
      const x1 = Math.max(...segment.map((r) => r.x + r.width));
      const baseline = segment[0].baseline;
      const text = segment
        .map((r) => r.text)
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) continue;

      // Resolve style info from the loaded font's real PostScript name when
      // available (only after the page has rendered); fall back to the style
      // dict's CSS family string.
      const names: string[] = [];
      let loadedName = "";
      for (const run of segment) {
        try {
          const font = page.commonObjs.get(run.pdfjsFontName) as {
            name?: string;
            loadedName?: string;
          } | null;
          if (font?.name) names.push(font.name);
          if (font?.loadedName && !loadedName) loadedName = font.loadedName;
        } catch {
          // font not resolved yet — fall through to style dict
        }
        const css = content.styles[run.pdfjsFontName]?.fontFamily;
        if (css) names.push(css);
      }
      const style = styleFromFontNames(names);

      lines.push({
        page: pageIndex,
        text,
        x: x0,
        y: baseline - ascent * fontSize,
        w: x1 - x0,
        h: (ascent - descent) * fontSize,
        baseline,
        fontSize,
        ...style,
        cssFontFamily: loadedName
          ? `"${loadedName}", ${style.fontFamily === "serif" ? "serif" : "sans-serif"}`
          : style.fontFamily === "serif"
            ? "serif"
            : "sans-serif",
      });
    }
  }
  return lines;
}

/**
 * Post-export verification: confirm each edited line's original text no
 * longer appears on its page. Returns the ids of items whose text survived
 * (e.g. invisible-Tr neutralizations or partial XObject splits) so the caller
 * can re-export with forceCover on those lines.
 */
export async function verifyTextRemoval(
  data: Uint8Array,
  edits: { id: string; page: number; originalText: string }[],
): Promise<Set<string>> {
  const failed = new Set<string>();
  if (edits.length === 0) return failed;
  const { loadPdfjsDoc } = await import("./render");
  const doc = await loadPdfjsDoc(data);
  const pageText = new Map<number, string>();
  try {
    for (const edit of edits) {
      let text = pageText.get(edit.page);
      if (text === undefined) {
        const page = await doc.getPage(edit.page + 1);
        const content = await page.getTextContent();
        text = content.items
          .map((i) => ("str" in i ? i.str : ""))
          .join(" ")
          .replace(/\s+/g, " ");
        pageText.set(edit.page, text);
      }
      const needle = edit.originalText.replace(/\s+/g, " ").trim();
      if (needle && text.includes(needle)) failed.add(edit.id);
    }
  } finally {
    await doc.loadingTask.destroy().catch(() => {});
  }
  return failed;
}

/**
 * Sample the text and background colors of a line from rendered page pixels.
 * Pure function over ImageData (Node-testable). bbox is in canvas pixels.
 */
export function sampleLineColors(
  img: ImageData,
  bbox: { x: number; y: number; w: number; h: number },
): { textColor: string; bgColor: string } {
  const x0 = Math.max(0, Math.floor(bbox.x));
  const y0 = Math.max(0, Math.floor(bbox.y));
  const x1 = Math.min(img.width - 1, Math.ceil(bbox.x + bbox.w));
  const y1 = Math.min(img.height - 1, Math.ceil(bbox.y + bbox.h));
  if (x1 <= x0 || y1 <= y0) return { textColor: "#000000", bgColor: "#ffffff" };

  const px = (x: number, y: number): [number, number, number] => {
    const i = (y * img.width + x) * 4;
    return [img.data[i], img.data[i + 1], img.data[i + 2]];
  };
  // Quantize to 4 bits/channel so antialiased pixels cluster.
  const quant = (c: [number, number, number]) =>
    ((c[0] >> 4) << 8) | ((c[1] >> 4) << 4) | (c[2] >> 4);

  // Background = modal quantized color of the bbox border ring.
  const counts = new Map<number, { n: number; c: [number, number, number] }>();
  const addBorder = (x: number, y: number) => {
    const c = px(x, y);
    const q = quant(c);
    const entry = counts.get(q);
    if (entry) entry.n++;
    else counts.set(q, { n: 1, c });
  };
  for (let x = x0; x <= x1; x++) {
    addBorder(x, y0);
    addBorder(x, y1);
  }
  for (let y = y0; y <= y1; y++) {
    addBorder(x0, y);
    addBorder(x1, y);
  }
  let bg: [number, number, number] = [255, 255, 255];
  let bestN = 0;
  for (const { n, c } of counts.values()) {
    if (n > bestN) {
      bestN = n;
      bg = c;
    }
  }

  // Text = interior pixel farthest from the background color.
  let text: [number, number, number] = [0, 0, 0];
  let bestDist = 0;
  for (let y = y0 + 1; y < y1; y++) {
    for (let x = x0 + 1; x < x1; x++) {
      const c = px(x, y);
      const d =
        (c[0] - bg[0]) ** 2 + (c[1] - bg[1]) ** 2 + (c[2] - bg[2]) ** 2;
      if (d > bestDist) {
        bestDist = d;
        text = c;
      }
    }
  }
  // No sufficiently contrasting pixel → default to black on the sampled bg.
  if (bestDist < 48 * 48) text = [0, 0, 0];

  const hex = (c: [number, number, number]) =>
    "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
  return { textColor: hex(text), bgColor: hex(bg) };
}
