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
      onChange({ ...d.orig, x: d.orig.x + dx, y: d.orig.y + dy });
    } else if ("w" in d.orig) {
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
        const sized = "w" in item;
        const style: React.CSSProperties = {
          left: item.x * scale,
          top: item.y * scale,
          ...(sized ? { width: item.w * scale, height: item.h * scale } : {}),
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
                {sized && (
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
