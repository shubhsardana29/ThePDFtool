"use client";

import { useState } from "react";

interface Props {
  pageIndex: number;
  /** CSS px per PDF point. */
  scale: number;
  color: string;
  strokeWidth: number;
  onCommit: (
    pageIndex: number,
    points: { x: number; y: number }[],
  ) => void;
}

/** Freehand drawing surface — active only while the pen tool is selected. */
export function PenLayer({ pageIndex, scale, color, strokeWidth, onCommit }: Props) {
  const [stroke, setStroke] = useState<{ x: number; y: number }[] | null>(null);

  function pos(e: React.PointerEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  }

  return (
    <div
      className="absolute inset-0 cursor-crosshair touch-none"
      onPointerDown={(e) => {
        setStroke([pos(e)]);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // synthetic events (tests) have no active pointer to capture
        }
      }}
      onPointerMove={(e) => {
        if (!stroke) return;
        const p = pos(e);
        const last = stroke[stroke.length - 1];
        // Thin out points: skip moves under ~0.7pt to keep paths light.
        if (Math.hypot(p.x - last.x, p.y - last.y) < 0.7) return;
        setStroke([...stroke, p]);
      }}
      onPointerUp={() => {
        if (stroke && stroke.length > 1) onCommit(pageIndex, stroke);
        setStroke(null);
      }}
      onPointerCancel={() => setStroke(null)}
    >
      {stroke && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <polyline
            points={stroke.map((p) => `${p.x * scale},${p.y * scale}`).join(" ")}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth * scale}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}
