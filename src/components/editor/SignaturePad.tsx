"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onCreate: (dataUrl: string, w: number, h: number) => void;
}

type Mode = "draw" | "type" | "upload";

const PAD_W = 400;
const PAD_H = 150;

/** Trim transparent margins off a canvas; returns null if it's empty. */
function trimCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = canvas.getContext("2d")!;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = 4;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d")!.drawImage(canvas, -minX, -minY);
  return out;
}

export function SignaturePad({ onCreate }: Props) {
  const [mode, setMode] = useState<Mode>("draw");
  const [typed, setTyped] = useState("");
  const [empty, setEmpty] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (mode !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1a2b6d"; // signature-ink blue
  }, [mode]);

  function pos(e: React.PointerEvent): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * PAD_W,
      y: ((e.clientY - rect.top) / rect.height) * PAD_H,
    };
  }

  function down(e: React.PointerEvent) {
    drawing.current = true;
    last.current = pos(e);
    canvasRef.current!.setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent) {
    if (!drawing.current || !last.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setEmpty(false);
  }

  function up() {
    drawing.current = false;
    last.current = null;
  }

  function clear() {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d")!.clearRect(0, 0, PAD_W, PAD_H);
    setEmpty(true);
  }

  function applyDrawn() {
    const trimmed = canvasRef.current && trimCanvas(canvasRef.current);
    if (!trimmed) return;
    onCreate(trimmed.toDataURL("image/png"), trimmed.width, trimmed.height);
  }

  function applyTyped() {
    if (!typed.trim()) return;
    const canvas = document.createElement("canvas");
    const font = '64px "Segoe Script", "Brush Script MT", "Comic Sans MS", cursive';
    const measure = canvas.getContext("2d")!;
    measure.font = font;
    canvas.width = Math.ceil(measure.measureText(typed).width) + 40;
    canvas.height = 110;
    const ctx = canvas.getContext("2d")!;
    ctx.font = font;
    ctx.fillStyle = "#1a2b6d";
    ctx.textBaseline = "middle";
    ctx.fillText(typed, 20, 55);
    const trimmed = trimCanvas(canvas) ?? canvas;
    onCreate(trimmed.toDataURL("image/png"), trimmed.width, trimmed.height);
  }

  function applyUploaded(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new Image();
      img.onload = () => onCreate(dataUrl, img.naturalWidth, img.naturalHeight);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        mode === m
          ? "bg-blue-600 text-white"
          : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-3 flex gap-2">
        {tab("draw", "Draw")}
        {tab("type", "Type")}
        {tab("upload", "Upload")}
      </div>

      {mode === "draw" && (
        <div className="flex flex-col gap-3">
          <canvas
            ref={canvasRef}
            width={PAD_W}
            height={PAD_H}
            className="w-full max-w-md cursor-crosshair touch-none rounded-lg border border-dashed border-zinc-300 bg-white dark:border-zinc-600"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={applyDrawn}
              disabled={empty}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40"
            >
              Use signature
            </button>
            <button
              type="button"
              onClick={clear}
              className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {mode === "type" && (
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Your name"
            className="w-full max-w-md rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            style={{ fontFamily: '"Segoe Script", "Brush Script MT", cursive', fontSize: 24 }}
          />
          <button
            type="button"
            onClick={applyTyped}
            disabled={!typed.trim()}
            className="w-fit rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40"
          >
            Use signature
          </button>
        </div>
      )}

      {mode === "upload" && (
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => e.target.files?.[0] && applyUploaded(e.target.files[0])}
          className="text-sm"
        />
      )}
    </div>
  );
}
