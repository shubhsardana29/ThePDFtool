import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDES, getGuide } from "@/lib/guides/content";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { getTool } from "@/lib/tools/registry";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: {
      type: "article",
      title: guide.title,
      description: guide.description,
    },
  };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const url = `${SITE_URL}/guides/${guide.slug}`;
  const primary = getTool(guide.toolId);
  const related = guide.related
    .map((id) => getTool(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.heading,
      description: guide.description,
      image: `${SITE_URL}/opengraph-image`,
      dateModified: guide.updated,
      datePublished: guide.updated,
      author: { "@type": "Organization", name: SITE_NAME },
      publisher: { "@type": "Organization", name: SITE_NAME },
      mainEntityOfPage: url,
      url,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "PDF Tools", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides` },
        { "@type": "ListItem", position: 3, name: guide.heading, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: guide.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-zinc-400">
        <Link href="/" className="hover:text-zinc-600 dark:hover:text-zinc-200">PDF Tools</Link>
        <span className="mx-2">/</span>
        <Link href="/guides" className="hover:text-zinc-600 dark:hover:text-zinc-200">Guides</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-600 dark:text-zinc-300">{guide.heading}</span>
      </nav>

      <article className="text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {guide.heading}
        </h1>

        <div className="mt-6 space-y-4">
          {guide.intro.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        {primary && (
          <div className="mt-6">
            <Link
              href={`/tools/${primary.id}`}
              className="inline-block rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
            >
              Open the {primary.name} tool →
            </Link>
          </div>
        )}

        <h2 className="mt-10 mb-4 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Step by step
        </h2>
        <ol className="space-y-4">
          {guide.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">{step.title}</p>
                <p className="mt-0.5">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        {guide.sections?.map((section) => (
          <section key={section.heading} className="mt-10">
            <h2 className="mb-4 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {section.heading}
            </h2>
            <div className="space-y-4">
              {section.body.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        ))}

        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            FAQ
          </h2>
          <div className="space-y-4">
            {guide.faqs.map((f) => (
              <div key={f.q}>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">{f.q}</p>
                <p className="mt-0.5">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      </article>

      {related.length > 0 && (
        <section className="mt-14 border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Related tools</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {related.map((tool) => (
              <Link
                key={tool.id}
                href={`/tools/${tool.id}`}
                className="group rounded-lg border border-zinc-200 p-3 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
              >
                <span className="font-medium group-hover:text-red-600 dark:group-hover:text-red-400">
                  {tool.name}
                </span>
                <span className="mt-1 block text-xs text-zinc-500">{tool.description}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
