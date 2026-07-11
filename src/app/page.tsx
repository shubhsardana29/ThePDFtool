import Link from "next/link";
import { HeroArt } from "@/components/HeroArt";
import { GUIDES } from "@/lib/guides/content";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { TOOLS } from "@/lib/tools/registry";
import type { ToolCategory } from "@/lib/tools/types";

const CATEGORY_LABELS: Record<ToolCategory, string> = {
  organize: "Organize",
  optimize: "Optimize",
  convert: "Convert",
  edit: "Edit & Sign",
  security: "Security",
};

// One accent per category — used for the card dot and hover ring.
const CATEGORY_DOT: Record<ToolCategory, string> = {
  organize: "bg-sky-500",
  edit: "bg-amber-500",
  convert: "bg-emerald-500",
  optimize: "bg-orange-500",
  security: "bg-slate-500",
};

const CATEGORY_ORDER: ToolCategory[] = [
  "organize",
  "edit",
  "convert",
  "optimize",
  "security",
];

const HOME_FAQ = [
  {
    q: "Are these PDF tools free?",
    a: "Yes — every tool is free with no sign-up, no watermarks, and no page or file-count limits hidden behind a paywall.",
  },
  {
    q: "Do my files get uploaded?",
    a: "Most tools run entirely in your browser, so your files never leave your device. The few that need a server (like Office conversions and OCR) upload over an encrypted connection and delete the file within an hour.",
  },
  {
    q: "Do I need to install anything or create an account?",
    a: "No. Everything runs in the browser — open a tool, drop your file in, and download the result. No app, no account.",
  },
  {
    q: "Which tools work without uploading?",
    a: `${TOOLS.filter((t) => t.runtime === "client").length} of the ${TOOLS.length} tools run fully in-browser, including merge, split, compress-adjacent tasks, edit, sign, fill forms, and convert to images or text.`,
  },
];

const JSONLD = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description:
      "Free online PDF tools that respect your privacy — most run entirely in your browser without uploading files.",
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: HOME_FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }}
      />
      <section className="mb-16 flex items-center justify-between gap-10">
        <div className="max-w-2xl">
          <p className="mb-4 text-sm font-semibold tracking-wide text-red-600 dark:text-red-400">
            Free · Private · No sign-up needed
          </p>
          <h1 className="text-5xl font-bold tracking-tight text-balance sm:text-6xl">
            Every PDF tool.
            <br />
            <span className="text-zinc-400 dark:text-zinc-500">
              Your files stay yours.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-500">
            Merge, split, compress, convert, sign and edit PDFs. Most tools run
            entirely in your browser — nothing is uploaded, ever.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5 text-sm">
            <span className="rounded-full border border-zinc-200 px-3.5 py-1.5 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              {TOOLS.length} tools, all free
            </span>
            <span className="rounded-full border border-zinc-200 px-3.5 py-1.5 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />
              {TOOLS.filter((t) => t.runtime === "client").length} run fully
              in-browser
            </span>
            <span className="rounded-full border border-zinc-200 px-3.5 py-1.5 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              Server files auto-delete in 1 hour
            </span>
          </div>
        </div>
        <HeroArt />
      </section>

      {CATEGORY_ORDER.map((category) => {
        const tools = TOOLS.filter((t) => t.category === category);
        if (tools.length === 0) return null;
        return (
          <section key={category} className="mb-12">
            <div className="mb-4 flex items-baseline gap-3">
              <h2 className="text-lg font-semibold tracking-tight">
                {CATEGORY_LABELS[category]}
              </h2>
              <span className="text-sm text-zinc-400">{tools.length}</span>
              <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <Link
                  key={tool.id}
                  href={`/tools/${tool.id}`}
                  className="group relative rounded-lg border border-zinc-200 bg-white p-4 transition-all duration-150 hover:border-zinc-300 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${CATEGORY_DOT[category]}`}
                    />
                    <h3 className="font-semibold tracking-tight group-hover:text-red-600 dark:group-hover:text-red-400">
                      {tool.name}
                    </h3>
                    <span
                      aria-hidden
                      className="ml-auto -translate-x-1 text-zinc-300 opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 dark:text-zinc-600"
                    >
                      →
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-zinc-500">
                    {tool.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      <section className="mb-12">
        <div className="mb-4 flex items-baseline gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Guides</h2>
          <Link href="/guides" className="text-sm text-red-600 hover:underline dark:text-red-400">
            View all →
          </Link>
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDES.slice(0, 6).map((g) => (
            <Link
              key={g.slug}
              href={`/guides/${g.slug}`}
              className="group rounded-lg border border-zinc-200 bg-white p-4 transition-all duration-150 hover:border-zinc-300 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700"
            >
              <h3 className="text-sm font-semibold tracking-tight group-hover:text-red-600 dark:group-hover:text-red-400">
                {g.heading}
              </h3>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-4">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">
          Frequently asked questions
        </h2>
        <div className="space-y-3">
          {HOME_FAQ.map((f) => (
            <details
              key={f.q}
              className="group rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800"
            >
              <summary className="cursor-pointer list-none font-medium marker:content-none">
                {f.q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
