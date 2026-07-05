export function PrivacyBadge({ server = false }: { server?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/15 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-400/20">
      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
        <rect
          x="5"
          y="10.5"
          width="14"
          height="9.5"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M8 10V7.5a4 4 0 1 1 8 0V10"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
      {server
        ? "Processed securely — auto-deleted within 1 hour"
        : "Files never leave your device"}
    </span>
  );
}

export function DropzoneArt() {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className="mx-auto mb-3 h-11 w-11 text-zinc-300 transition-colors group-hover:text-red-300 dark:text-zinc-600"
      aria-hidden
    >
      <path
        d="M12 6h16l8 8v28H12V6Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M28 6v8h8" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path
        d="M24 33V21m0 0-5 5m5-5 5 5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
