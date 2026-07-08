"use client";

import { useRef } from "react";
import type { OverlayItem } from "@/lib/editor/types";

interface Props {
  pageIndex: number;
  /** CSS px per PDF point. */
  scale: number;
  items: OverlayItem[];
  selectedId: string | null;
  /** When true, clicking empty space places a new item there. */
  placing: boolean;
  onSelect: (id: string | null) => void;
  onPlace: (pageIndex: number, x: number, y: number) => void;
  onChange: (item: OverlayItem) => void;
  /** Called once before a drag/resize mutates items (undo snapshot hook). */
  onBeforeChange?: () => void;
  onDelete: (id: string) => void;
}

interface DragState {
  id: string;
  mode: "move" | "resize";
  startClientX: number;
  startClientY: number;
  orig: OverlayItem;
}

export function OverlayEditor({
  pageIndex,
  scale,
  items,
  selectedId,
  placing,
  onSelect,
  onPlace,
  onChange,
  onBeforeChange,
  onDelete,
}: Props) {
  const drag = useRef<DragState | null>(null);

  function beginDrag(
    e: React.PointerEvent,
    item: OverlayItem,
    mode: DragState["mode"],
  ) {
    e.stopPropagation();
    onSelect(item.id);
    // Text edits are anchored to the original line — select but never drag.
    if (item.kind === "text-edit") return;
    onBeforeChange?.();
    drag.current = {
      id: item.id,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      orig: item,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startClientX) / scale;
    const dy = (e.clientY - d.startClientY) / scale;
    if (d.mode === "move") {
      if (d.orig.kind === "line") {
        onChange({
          ...d.orig,
          x: d.orig.x + dx,
          y: d.orig.y + dy,
          x2: d.orig.x2 + dx,
          y2: d.orig.y2 + dy,
        });
      } else {
        onChange({ ...d.orig, x: d.orig.x + dx, y: d.orig.y + dy });
      }
    } else if (d.orig.kind === "line") {
      // Resizing a line moves its end point (the arrow tip).
      onChange({ ...d.orig, x2: d.orig.x2 + dx, y2: d.orig.y2 + dy });
    } else if (d.orig.kind !== "path" && "w" in d.orig) {
      onChange({
        ...d.orig,
        w: Math.max(8, d.orig.w + dx),
        h: Math.max(8, d.orig.h + dy),
      });
    }
  }

  function endDrag() {
    drag.current = null;
  }

  function onBackgroundClick(e: React.MouseEvent) {
    if (e.target !== e.currentTarget) return;
    if (placing) {
      const rect = e.currentTarget.getBoundingClientRect();
      onPlace(pageIndex, (e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale);
    } else {
      onSelect(null);
    }
  }

  return (
    <div
      className={`absolute inset-0 ${placing ? "cursor-crosshair" : ""}`}
      onClick={onBackgroundClick}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {items.map((item) => {
        const selected = item.id === selectedId;
        const sized = "w" in item || item.kind === "line";
        // Lines are positioned by the bounding box of their two endpoints.
        const box =
          item.kind === "line"
            ? {
                left: Math.min(item.x, item.x2),
                top: Math.min(item.y, item.y2),
                width: Math.max(Math.abs(item.x2 - item.x), 4),
                height: Math.max(Math.abs(item.y2 - item.y), 4),
              }
            : {
                left: item.x,
                top: item.y,
                width: "w" in item ? item.w : 0,
                height: "w" in item ? item.h : 0,
              };
        const style: React.CSSProperties = {
          left: box.left * scale,
          top: box.top * scale,
          ...("w" in item || item.kind === "line"
            ? { width: box.width * scale, height: box.height * scale }
            : {}),
        };
        return (
          <div
            key={item.id}
            style={style}
            className={`absolute cursor-move touch-none select-none ${
              selected ? "ring-2 ring-blue-500" : "hover:ring-1 hover:ring-blue-300"
            }`}
            onPointerDown={(e) => beginDrag(e, item, "move")}
          >
            {item.kind === "text" && (
              <div
                className="whitespace-pre leading-[1.25]"
                style={{
                  fontSize: item.fontSize * scale,
                  color: item.color,
                  fontFamily: "Helvetica, Arial, sans-serif",
                }}
              >
                {item.text || " "}
              </div>
            )}
            {item.kind === "rect" && (
              <div
                className="h-full w-full"
                style={
                  item.fill
                    ? { backgroundColor: item.color, opacity: item.opacity }
                    : { border: `${2 * scale}px solid ${item.color}`, opacity: item.opacity }
                }
              />
            )}
            {item.kind === "highlight" && (
              <div className="h-full w-full" style={{ backgroundColor: "#ffe533", opacity: 0.4 }} />
            )}
            {item.kind === "line" && (
              <svg
                className="h-full w-full overflow-visible"
                viewBox={`0 0 ${box.width} ${box.height}`}
                preserveAspectRatio="none"
                aria-hidden
              >
                <line
                  x1={item.x - box.left}
                  y1={item.y - box.top}
                  x2={item.x2 - box.left}
                  y2={item.y2 - box.top}
                  stroke={item.color}
                  strokeWidth={item.strokeWidth}
                  strokeLinecap="round"
                  markerEnd={item.arrow ? `url(#arrow-${item.id})` : undefined}
                />
                {item.arrow && (
                  <defs>
                    <marker
                      id={`arrow-${item.id}`}
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="5"
                      markerHeight="5"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10" fill="none" stroke={item.color} strokeWidth="2" />
                    </marker>
                  </defs>
                )}
              </svg>
            )}
            {item.kind === "ellipse" && (
              <div
                className="h-full w-full rounded-full"
                style={
                  item.fill
                    ? { backgroundColor: item.color, opacity: item.opacity }
                    : {
                        border: `${2 * scale}px solid ${item.color}`,
                        opacity: item.opacity,
                      }
                }
              />
            )}
            {item.kind === "path" && (
              <svg
                className="h-full w-full overflow-visible"
                viewBox={`0 0 ${Math.max(item.w, 1)} ${Math.max(item.h, 1)}`}
                preserveAspectRatio="none"
                aria-hidden
              >
                <polyline
                  points={item.points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={item.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            {item.kind === "text-edit" && (
              <div
                className="flex h-full w-full items-center rounded-sm ring-1 ring-amber-400 ring-dashed"
                style={{ backgroundColor: item.bgColor }}
              >
                <span
                  className="whitespace-pre"
                  style={{
                    fontSize: item.fontSize * scale,
                    fontFamily: item.cssFontFamily,
                    fontWeight: item.bold ? 700 : 400,
                    fontStyle: item.italic ? "italic" : "normal",
                    color: item.color,
                    lineHeight: 1,
                  }}
                >
                  {item.newText}
                </span>
              </div>
            )}
            {item.kind === "image" && (
              // eslint-disable-next-line @next/next/no-img-element -- data URL stamp
              <img
                src={item.dataUrl}
                alt="stamp"
                draggable={false}
                className="h-full w-full object-fill"
              />
            )}
            {selected && (
              <>
                <button
                  type="button"
                  aria-label="Delete item"
                  className="absolute -top-3 -right-3 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white shadow hover:bg-red-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item.id);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  ✕
                </button>
                {sized && item.kind !== "text-edit" && item.kind !== "path" && (
                  <div
                    aria-label="Resize"
                    className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-sm border border-white bg-blue-500 shadow"
                    onPointerDown={(e) => beginDrag(e, item, "resize")}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
