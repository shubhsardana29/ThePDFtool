import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { AuthNav } from "@/components/AuthNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { hasSignIn } from "@/lib/auth";
import { SITE_URL } from "@/lib/site";
import { TOOLS } from "@/lib/tools/registry";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "PDF Tools — merge, split, convert & edit PDFs",
    template: "%s · PDF Tools",
  },
  description:
    "Free online PDF tools. Merge, split, compress, convert, sign and edit PDFs — simple tools run in your browser and files never leave your device.",
  alternates: { canonical: "/" },
  openGraph: {
    siteName: "PDF Tools",
    type: "website",
  },
};

function LogoMark() {
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-red-500 text-white shadow-sm">
      {/* page with folded corner */}
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
        <path
          d="M6 3.5h7.5L18 8v12.5H6V3.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M13.5 3.5V8H18"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        {/* Applies the saved theme before first paint — no flash of the wrong mode. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`,
          }}
        />
        <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/85 backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/85">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-[17px] font-bold tracking-tight"
            >
              <LogoMark />
              PDF Tools
            </Link>
            <nav className="flex items-center gap-3 text-sm text-zinc-500">
              <Link
                href="/"
                className="hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                All tools
              </Link>
              <Link
                href="/guides"
                className="hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Guides
              </Link>
              <ThemeToggle />
              <AuthNav hasProviders={hasSignIn()} />
            </nav>
          </div>
        </header>
        {children}
        <footer className="mt-auto border-t border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto max-w-5xl px-6 py-10">
            <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
              <div className="max-w-xs">
                <div className="flex items-center gap-2.5">
                  <LogoMark />
                  <p className="text-sm font-semibold">PDF Tools</p>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-zinc-500">
                  Private by design — most tools run entirely in your browser
                  and never upload your files. Server-processed files are
                  encrypted in transit and deleted within 1 hour.
                </p>
              </div>
              <nav
                aria-label="All PDF tools"
                className="grid grid-cols-2 gap-x-10 gap-y-1.5 text-xs sm:grid-cols-3"
              >
                {TOOLS.map((tool) => (
                  <Link
                    key={tool.id}
                    href={`/tools/${tool.id}`}
                    className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    {tool.name}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
