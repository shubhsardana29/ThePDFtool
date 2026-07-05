"use client";

interface Props {
  files: File[];
  onRemove: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  /** Show reorder buttons (matters for merge, where order = output order). */
  reorderable: boolean;
  disabled?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileList({ files, onRemove, onMove, reorderable, disabled }: Props) {
  if (files.length === 0) return null;
  return (
    <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {files.map((file, i) => (
        <li
          key={`${file.name}-${i}`}
          className="flex items-center gap-3 px-4 py-2.5 text-sm"
        >
          <span className="min-w-0 flex-1 truncate font-medium">
            {file.name}
          </span>
          <span className="shrink-0 text-xs text-zinc-500">
            {formatSize(file.size)}
          </span>
          {reorderable && (
            <span className="flex shrink-0 gap-1">
              <button
                type="button"
                aria-label="Move up"
                disabled={disabled || i === 0}
                onClick={() => onMove(i, -1)}
                className="rounded px-1.5 py-0.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={disabled || i === files.length - 1}
                onClick={() => onMove(i, 1)}
                className="rounded px-1.5 py-0.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
              >
                ↓
              </button>
            </span>
          )}
          <button
            type="button"
            aria-label={`Remove ${file.name}`}
            disabled={disabled}
            onClick={() => onRemove(i)}
            className="shrink-0 rounded px-1.5 py-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
