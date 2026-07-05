/**
 * Hero illustration: a fanned stack of PDF pages, each showing a real tool's
 * effect (watermark, redaction, signature) plus floating proof chips. Pure
 * CSS/SVG — no image assets, theme-aware, transform/opacity animation only.
 */

function TextLine({ w, dark = false }: { w: string; dark?: boolean }) {
  return (
    <div
      className={`h-1.5 rounded-full ${dark ? "bg-zinc-900 dark:bg-zinc-200" : "bg-zinc-200 dark:bg-zinc-700"}`}
      style={{ width: w }}
    />
  );
}

function Page({
  pos,
  tilt,
  delay,
  children,
}: {
  /** Position utilities for the absolute wrapper (left-* / top-*). */
  pos: string;
  /** Rotation + hover-spread utilities for the card itself. */
  tilt: string;
  delay: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`absolute ${pos} motion-safe:animate-[hero-rise_0.7s_ease-out_both]`}
      style={{ animationDelay: delay }}
    >
      <div
        className={`h-52 w-40 rounded-lg border border-zinc-200 bg-white p-4 shadow-[0_12px_32px_rgba(0,0,0,0.10)] transition-transform duration-300 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_12px_32px_rgba(0,0,0,0.5)] ${tilt}`}
      >
        {children}
      </div>
    </div>
  );
}

export function HeroArt() {
  return (
    <div
      aria-hidden
      className="group relative hidden h-80 w-[22rem] select-none lg:block"
    >
      {/* soft brand glow behind the stack */}
      <div className="absolute inset-4 rounded-full bg-[radial-gradient(closest-side,rgba(239,68,68,0.10),transparent)] dark:bg-[radial-gradient(closest-side,rgba(239,68,68,0.15),transparent)]" />

      {/* back page — watermark */}
      <Page
        pos="left-2 top-0"
        delay="0.05s"
        tilt="-rotate-10 group-hover:-translate-x-2 group-hover:-rotate-14"
      >
        <div className="relative flex h-full flex-col gap-2.5 overflow-hidden">
          <TextLine w="70%" dark />
          <TextLine w="100%" />
          <TextLine w="90%" />
          <TextLine w="96%" />
          <TextLine w="60%" />
          <TextLine w="88%" />
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-30 text-[13px] font-extrabold tracking-[0.18em] whitespace-nowrap text-red-400/50">
            CONFIDENTIAL
          </span>
        </div>
      </Page>

      {/* middle page — redaction */}
      <Page
        pos="left-40 top-5"
        delay="0.2s"
        tilt="rotate-5 group-hover:translate-x-2 group-hover:rotate-9"
      >
        <div className="flex h-full flex-col gap-2.5">
          <TextLine w="60%" dark />
          <TextLine w="100%" />
          <div className="h-2 w-[85%] rounded-sm bg-zinc-900 dark:bg-zinc-100" />
          <TextLine w="92%" />
          <TextLine w="97%" />
          <div className="h-2 w-[55%] rounded-sm bg-zinc-900 dark:bg-zinc-100" />
          <TextLine w="78%" />
        </div>
      </Page>

      {/* front page — signature */}
      <Page
        pos="left-[5.5rem] top-16"
        delay="0.35s"
        tilt="-rotate-2 group-hover:translate-y-1 group-hover:rotate-1"
      >
        <div className="flex h-full flex-col gap-2.5">
          <TextLine w="80%" dark />
          <TextLine w="100%" />
          <TextLine w="94%" />
          <TextLine w="66%" />
          <div className="mt-auto">
            {/* hand-drawn signature squiggle */}
            <svg viewBox="0 0 120 34" fill="none" className="h-9 w-28 text-[#2743a6] dark:text-[#7d95e8]">
              <path
                d="M6 24c8-14 14-18 16-13s-7 15-3 16 10-13 14-12-2 11 2 11 9-14 13-13-1 12 3 12 8-10 12-10c5 0 2 8 6 8 5 0 12-9 25-9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="motion-safe:animate-[hero-sign_1.4s_ease-out_0.7s_both]"
                pathLength={1}
              />
            </svg>
            <div className="mt-1 h-px w-full bg-zinc-300 dark:bg-zinc-600" />
            <p className="mt-1 text-[9px] font-medium tracking-wide text-zinc-400">
              SIGNED
            </p>
          </div>
        </div>
      </Page>

      {/* floating proof chips */}
      <div
        className="absolute -right-2 top-4 motion-safe:animate-[hero-rise_0.7s_ease-out_0.55s_both]"
      >
        <span className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 font-mono text-[11px] font-medium text-zinc-600 shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          2.4 MB → 0.6 MB
        </span>
      </div>
      <div
        className="absolute bottom-2 -left-3 motion-safe:animate-[hero-rise_0.7s_ease-out_0.7s_both]"
      >
        <span className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-600 shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 text-emerald-600 dark:text-emerald-400">
            <rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke="currentColor" strokeWidth="2.2" />
            <path d="M8 10V7.5a4 4 0 1 1 8 0V10" stroke="currentColor" strokeWidth="2.2" />
          </svg>
          0 uploads
        </span>
      </div>
    </div>
  );
}
