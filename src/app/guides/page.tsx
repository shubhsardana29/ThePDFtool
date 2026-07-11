import type { Metadata } from "next";
import Link from "next/link";
import { GUIDES } from "@/lib/guides/content";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "PDF Guides — How to Merge, Compress, Edit & Convert PDFs",
  description:
    "Step-by-step guides for common PDF tasks — reduce file size, remove passwords, merge, convert to Word, edit text and fill forms. Free tools, most run in your browser.",
  alternates: { canonical: "/guides" },
  openGraph: {
    title: "PDF Guides",
    description: "Step-by-step guides for common PDF tasks — free, private tools.",
  },
};

const JSONLD = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "PDF Guides",
  itemListElement: GUIDES.map((g, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: g.heading,
    url: `${SITE_URL}/guides/${g.slug}`,
  })),
};

export default function GuidesIndex() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }}
      />
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-zinc-400">
        <Link href="/" className="hover:text-zinc-600 dark:hover:text-zinc-200">
          PDF Tools
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-600 dark:text-zinc-300">Guides</span>
      </nav>
      <h1 className="text-3xl font-bold tracking-tight">PDF Guides</h1>
      <p className="mt-2 mb-8 max-w-2xl text-zinc-500">
        Plain-English walkthroughs for the PDF tasks people actually get stuck
        on. Every guide links to a free tool — and most of them run entirely in
        your browser, so your files never leave your device.
      </p>
      <div className="grid gap-3">
        {GUIDES.map((g) => (
          <Link
            key={g.slug}
            href={`/guides/${g.slug}`}
            className="group rounded-lg border border-zinc-200 bg-white p-4 transition-all duration-150 hover:border-zinc-300 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700"
          >
            <h2 className="font-semibold tracking-tight group-hover:text-red-600 dark:group-hover:text-red-400">
              {g.heading}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
              {g.description}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
