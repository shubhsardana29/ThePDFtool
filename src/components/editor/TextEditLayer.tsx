"use client";

import { useEffect, useRef, useState } from "react";
import type { DetectedLine } from "@/lib/engine-client/text-detect";
import { sampleLineColors } from "@/lib/engine-client/text-detect";
import type { OverlayItem, TextEditItem } from "@/lib/editor/types";

interface Props {
  /** CSS px per PDF point. */
  scale: number;
  lines: DetectedLine[];
  /** Existing items — lines already edited get no hover target. */
  items: OverlayItem[];
  /** The rendered page canvas, for color sampling. */
  getCanvas: () => HTMLCanvasElement | null;
  onCommit: (
    line: DetectedLine,
    newText: string,
    colors: { textColor: string; bgColor: string },
  ) => void;
}

interface Editing {
  line: DetectedLine;
  value: string;
  textColor: string;
  bgColor: string;
}

/**
 * Codepoints the bundled Liberation fonts cover: Latin, Latin Extended,
 * Greek, Cyrillic, punctuation, and currency. CJK/Arabic are v1-unsupported.
 */
function isRenderable(text: string): boolean {
  return !/[^\u0020-\u024F\u0370-\u03FF\u0400-\u04FF\u1E00-\u1EFF\u2000-\u206F\u20A0-\u20BF\u2100-\u214F]/u.test(text);
}

function lineIsEdited(line: DetectedLine, items: OverlayItem[]): boolean {
  return items.some(
    (i) =>
      i.kind === "text-edit" &&
      i.page === line.page &&
      Math.abs(i.x - line.x) < 2 &&
      Math.abs((i as TextEditItem).baseline - line.baseline) < 2,
  );
}

function sampleFromCanvas(
  canvas: HTMLCanvasElement | null,
  line: DetectedLine,
  scale: number,
): { textColor: string; bgColor: string } {
  if (!canvas) return { textColor: "#000000", bgColor: "#ffffff" };
  try {
    // The canvas backing store may be at devicePixelRatio × the CSS size.
    const pxPerPt = canvas.width / (canvas.clientWidth / scale || canvas.width / scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { textColor: "#000000", bgColor: "#ffffff" };
    const bbox = {
      x: line.x * pxPerPt,
      y: line.y * pxPerPt,
      w: line.w * pxPerPt,
      h: line.h * pxPerPt,
    };
    const img = ctx.getImageData(
      Math.max(0, Math.floor(bbox.x) - 2),
      Math.max(0, Math.floor(bbox.y) - 2),
      Math.ceil(bbox.w) + 4,
      Math.ceil(bbox.h) + 4,
    );
    return sampleLineColors(img, { x: 2, y: 2, w: bbox.w, h: bbox.h });
  } catch {
    return { textColor: "#000000", bgColor: "#ffffff" };
  }
}

export function TextEditLayer({ scale, lines, items, getCanvas, onCommit }: Props) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [blocked, setBlocked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function open(line: DetectedLine) {
    const colors = sampleFromCanvas(getCanvas(), line, scale);
    setBlocked(false);
    setEditing({ line, value: line.text, ...colors });
  }

  function commit() {
    if (!editing) return;
    const value = editing.value.trim();
    if (value && value !== editing.line.text) {
      if (!isRenderable(value)) {
        setBlocked(true);
        return;
      }
      onCommit(editing.line, value, {
        textColor: editing.textColor,
        bgColor: editing.bgColor,
      });
    }
    setEditing(null);
  }

  return (
    <div className="pointer-events-none absolute inset-0">
      {lines.map((line, idx) => {
        const isOpen = editing?.line === line;
        if (lineIsEdited(line, items)) return null;
        const style: React.CSSProperties = {
          left: line.x * scale - 2,
          top: line.y * scale - 2,
          width: line.w * scale + 4,
          height: line.h * scale + 4,
        };
        if (isOpen) {
          return (
            <div key={idx} style={style} className="pointer-events-auto absolute">
              <input
                ref={inputRef}
                type="text"
                value={editing.value}
                onChange={(e) => {
                  setBlocked(false);
                  setEditing({ ...editing, value: e.target.value });
                }}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") setEditing(null);
                }}
                spellCheck={false}
                className={`h-full w-full rounded-sm px-0 outline-none ring-2 ${
                  blocked ? "ring-red-500" : "ring-blue-500"
                }`}
                style={{
                  fontSize: line.fontSize * scale,
                  fontFamily: line.cssFontFamily,
                  fontWeight: line.bold ? 700 : 400,
                  fontStyle: line.italic ? "italic" : "normal",
                  color: editing.textColor,
                  backgroundColor: editing.bgColor,
                  lineHeight: 1,
                }}
                aria-label="Edit text line"
              />
              {blocked && (
                <p className="absolute top-full left-0 z-10 mt-1 rounded bg-red-600 px-2 py-1 text-xs whitespace-nowrap text-white shadow">
                  Unsupported characters — Latin, Greek &amp; Cyrillic only for now
                </p>
              )}
            </div>
          );
        }
        return (
          <button
            key={idx}
            type="button"
            style={style}
            onClick={() => open(line)}
            aria-label={`Edit: ${line.text.slice(0, 40)}`}
            className="pointer-events-auto absolute cursor-text rounded-sm hover:bg-blue-400/10 hover:ring-1 hover:ring-blue-400"
          />
        );
      })}
    </div>
  );
}
