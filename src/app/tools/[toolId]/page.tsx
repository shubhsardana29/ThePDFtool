import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompareTool } from "@/components/editor/CompareTool";
import { CropTool } from "@/components/editor/CropTool";
import { EditTool } from "@/components/editor/EditTool";
import { FillFormTool } from "@/components/editor/FillFormTool";
import { MetadataTool } from "@/components/editor/MetadataTool";
import { RedactTool } from "@/components/editor/RedactTool";
import { ReplaceImageTool } from "@/components/editor/ReplaceImageTool";
import { SignTool } from "@/components/editor/SignTool";
import { VisualCompareTool } from "@/components/editor/VisualCompareTool";
import { OrganizeTool } from "@/components/OrganizeTool";
import { ToolRunner } from "@/components/ToolRunner";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { TOOLS, getTool } from "@/lib/tools/registry";
import { TOOL_SEO } from "@/lib/tools/seo-content";

interface Props {
  params: Promise<{ toolId: string }>;
}

const CUSTOM_UIS = {
  organize: OrganizeTool,
  edit: EditTool,
  sign: SignTool,
  compare: CompareTool,
  redact: RedactTool,
  fillform: FillFormTool,
  crop: CropTool,
  metadata: MetadataTool,
  replaceimage: ReplaceImageTool,
  visualcompare: VisualCompareTool,
} as const;

export function generateStaticParams() {
  return TOOLS.map((tool) => ({ toolId: tool.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { toolId } = await params;
  const tool = getTool(toolId);
  if (!tool) return {};
  const seo = TOOL_SEO[tool.id];
  return {
    title: seo?.title ?? `${tool.name} — free online`,
    description: seo?.description ?? tool.description,
    alternates: { canonical: `/tools/${tool.id}` },
    openGraph: {
      title: seo?.title ?? tool.name,
      description: seo?.description ?? tool.description,
    },
  };
}

function howItWorks(tool: NonNullable<ReturnType<typeof getTool>>): string[] {
  const upload =
    tool.maxFiles > 1 ? "Select or drag in your files" : "Select or drag in your file";
  const run = `Choose your options and click “${tool.name}”`;
  const download =
    tool.runtime === "client"
      ? "Download the result — everything ran in your browser"
      : "Download the result — server files are deleted within an hour";
  return [upload, run, download];
}

export default async function ToolPage({ params }: Props) {
  const { toolId } = await params;
  const tool = getTool(toolId);
  if (!tool) notFound();

  const seo = TOOL_SEO[tool.id];
  const CustomUI = tool.customUI ? CUSTOM_UIS[tool.customUI] : null;
  // The editor tools need more horizontal room than the simple ones.
  const wide = tool.customUI && tool.customUI !== "organize";
  const steps = howItWorks(tool);
  const url = `${SITE_URL}/tools/${tool.id}`;
  const related = (seo?.related ?? [])
    .map((id) => getTool(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: `${tool.name} — ${SITE_NAME}`,
      description: seo?.description ?? tool.description,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Web",
      url,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "PDF Tools", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: tool.name, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: `How to use ${tool.name}`,
      step: steps.map((text, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        text,
      })),
    },
    ...(seo
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: seo.faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
        ]
      : []),
  ];

  return (
    <main className={`mx-auto w-full px-6 py-10 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-zinc-400">
        <Link href="/" className="hover:text-zinc-600 dark:hover:text-zinc-200">
          PDF Tools
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-600 dark:text-zinc-300">{tool.name}</span>
      </nav>
      <h1 className="text-3xl font-bold tracking-tight">{tool.name}</h1>
      <p className="mt-2 mb-8 text-zinc-500">{tool.description}</p>
      {CustomUI ? <CustomUI /> : <ToolRunner toolId={tool.id} />}

      {seo && (
        <section className="mt-16 max-w-2xl space-y-4 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          {seo.intro.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </section>
      )}

      <section className="mt-14 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="mb-5 text-lg font-semibold tracking-tight">How it works</h2>
        <ol className="grid gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-red-50 text-sm font-bold text-red-600 ring-1 ring-red-600/15 dark:bg-red-950/50 dark:text-red-400 dark:ring-red-400/20">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {seo && seo.faqs.length > 0 && (
        <section className="mt-14 border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <h2 className="mb-5 text-lg font-semibold tracking-tight">
            Frequently asked questions
          </h2>
          <div className="max-w-2xl divide-y divide-zinc-200 dark:divide-zinc-800">
            {seo.faqs.map((faq) => (
              <details key={faq.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {faq.q}
                  <span
                    aria-hidden
                    className="text-zinc-400 transition-transform duration-200 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-14 border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <h2 className="mb-5 text-lg font-semibold tracking-tight">Related tools</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/tools/${r.id}`}
                className="group rounded-lg border border-zinc-200 p-4 transition-all duration-150 hover:border-zinc-300 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:border-zinc-800 dark:hover:border-zinc-700"
              >
                <h3 className="font-semibold tracking-tight group-hover:text-red-600 dark:group-hover:text-red-400">
                  {r.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{r.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
