"use client";

import type { FormFieldItem } from "@/lib/editor/types";

interface Props {
  /** CSS px per PDF point. */
  scale: number;
  /** Fields on this page only. */
  fields: FormFieldItem[];
  /** Set the value of a single (text/checkbox/dropdown) field. */
  onChange: (id: string, value: string | boolean) => void;
  /** Select a radio widget — applies its export value across the group. */
  onSelectRadio: (fieldName: string, exportValue: string) => void;
}

/**
 * Renders a real HTML control over each detected form field's rect, positioned
 * exactly like OverlayEditor items. Editing a control updates the backing
 * FormFieldItem; the flatten op writes the values into the AcroForm on export.
 */
export function FormLayer({ scale, fields, onChange, onSelectRadio }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {fields.map((f) => {
        const style: React.CSSProperties = {
          left: f.x * scale,
          top: f.y * scale,
          width: f.w * scale,
          height: f.h * scale,
        };
        const common =
          "pointer-events-auto absolute rounded-sm ring-1 ring-blue-400/70 " +
          "focus:ring-2 focus:ring-blue-500 focus:outline-none";
        // Font size scaled to the field height, clamped to something readable.
        const fontPx = Math.max(8, Math.min(f.h * scale * 0.6, 16));

        if (f.fieldType === "text") {
          const shared = {
            value: String(f.value ?? ""),
            disabled: f.readOnly,
            "aria-label": f.fieldName,
            onChange: (
              e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
            ) => onChange(f.id, e.target.value),
            style: { ...style, fontSize: fontPx },
            className: `${common} bg-white/70 px-1 text-zinc-900 disabled:bg-zinc-200/60`,
          };
          return f.multiline ? (
            <textarea key={f.id} {...shared} className={`${shared.className} resize-none py-0.5 leading-tight`} />
          ) : (
            <input key={f.id} type="text" {...shared} />
          );
        }

        if (f.fieldType === "checkbox") {
          return (
            <div key={f.id} style={style} className="pointer-events-none absolute flex items-center justify-center">
              <input
                type="checkbox"
                checked={!!f.value}
                disabled={f.readOnly}
                aria-label={f.fieldName}
                onChange={(e) => onChange(f.id, e.target.checked)}
                className="pointer-events-auto h-4 w-4 cursor-pointer accent-blue-600"
              />
            </div>
          );
        }

        if (f.fieldType === "radio") {
          return (
            <div key={f.id} style={style} className="pointer-events-none absolute flex items-center justify-center">
              <input
                type="radio"
                name={f.fieldName}
                checked={f.value === f.exportValue}
                disabled={f.readOnly}
                aria-label={`${f.fieldName}: ${f.exportValue}`}
                onChange={() => onSelectRadio(f.fieldName, f.exportValue ?? "")}
                className="pointer-events-auto h-4 w-4 cursor-pointer accent-blue-600"
              />
            </div>
          );
        }

        // dropdown
        return (
          <select
            key={f.id}
            value={String(f.value ?? "")}
            disabled={f.readOnly}
            aria-label={f.fieldName}
            onChange={(e) => onChange(f.id, e.target.value)}
            style={{ ...style, fontSize: fontPx }}
            className={`${common} bg-white/70 px-1 text-zinc-900 disabled:bg-zinc-200/60`}
          >
            <option value="">—</option>
            {(f.options ?? []).map((opt, i) => (
              <option key={opt} value={opt}>
                {f.displayOptions?.[i] ?? opt}
              </option>
            ))}
          </select>
        );
      })}
    </div>
  );
}
