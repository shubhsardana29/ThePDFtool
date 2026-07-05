"use client";

import type { OptionField } from "@/lib/tools/types";

interface Props {
  fields: OptionField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
}

export function OptionsForm({ fields, values, onChange, disabled }: Props) {
  if (fields.length === 0) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => {
        const id = `opt-${field.key}`;
        if (field.kind === "checkbox") {
          return (
            <label
              key={field.key}
              htmlFor={id}
              className="flex items-center gap-2 text-sm"
            >
              <input
                id={id}
                type="checkbox"
                disabled={disabled}
                checked={Boolean(values[field.key])}
                onChange={(e) => onChange(field.key, e.target.checked)}
                className="h-4 w-4 accent-red-500"
              />
              {field.label}
            </label>
          );
        }
        return (
          <div key={field.key} className="flex flex-col gap-1">
            <label htmlFor={id} className="text-sm font-medium">
              {field.label}
            </label>
            {field.kind === "select" ? (
              <select
                id={id}
                disabled={disabled}
                value={String(values[field.key] ?? "")}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {field.choices.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                type={
                  field.kind === "number"
                    ? "number"
                    : field.kind === "password"
                      ? "password"
                      : "text"
                }
                disabled={disabled}
                value={String(values[field.key] ?? "")}
                placeholder={field.kind === "text" ? field.placeholder : undefined}
                min={field.kind === "number" ? field.min : undefined}
                max={field.kind === "number" ? field.max : undefined}
                step={field.kind === "number" ? field.step : undefined}
                onChange={(e) =>
                  onChange(
                    field.key,
                    field.kind === "number"
                      ? e.target.valueAsNumber
                      : e.target.value,
                  )
                }
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
