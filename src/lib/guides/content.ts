/**
 * Long-form how-to guides — the informational, top-of-funnel content layer.
 * Each guide targets a real search query, teaches the task genuinely, and
 * points to the tool that does it. Kept as data (like seo-content.ts) so the
 * routes, sitemap, and structured data are all generated from one source.
 *
 * `updated` dates are static (edit when you revise a guide) so the build stays
 * deterministic.
 */

export interface GuideStep {
  title: string;
  body: string;
}

export interface GuideSection {
  heading: string;
  body: string[];
}

export interface Guide {
  slug: string;
  /** <title> — keyword-first, ~60 chars. */
  title: string;
  /** Meta description, ~150 chars. */
  description: string;
  /** On-page H1. */
  heading: string;
  /** ISO date, shown and used for Article schema. */
  updated: string;
  intro: string[];
  steps: GuideStep[];
  sections?: GuideSection[];
  faqs: { q: string; a: string }[];
  /** Primary tool this guide sends readers to. */
  toolId: string;
  /** Related tool ids for the footer grid. */
  related: string[];
}

export const GUIDES: Guide[] = [
  {
    slug: "reduce-pdf-file-size",
    title: "How to Reduce PDF File Size (Free, Without Losing Quality)",
    description:
      "Shrink a large PDF so it's small enough to email or upload — free, and without wrecking the quality. A step-by-step guide plus what actually makes PDFs big.",
    heading: "How to reduce PDF file size",
    updated: "2026-07-11",
    intro: [
      "A PDF that won't attach to an email or squeak under an upload limit is almost always bloated by images — high-resolution scans and photos that are stored at far more detail than the document needs. Compressing the PDF re-encodes those images at a sensible resolution and quality, which typically cuts the file to a fraction of its size while leaving the text perfectly sharp.",
      "Below is the quickest way to do it, plus a short explanation of what's taking up the space so you can decide how hard to compress.",
    ],
    steps: [
      { title: "Open the Compress PDF tool", body: "Head to the Compress PDF tool and drop your file in, or click to browse for it." },
      { title: "Pick a compression level", body: "Choose a balance between size and quality. A medium setting is usually indistinguishable from the original on screen; a stronger setting is best when you only need the file to be readable." },
      { title: "Compress and download", body: "Run it and download the smaller PDF. Compare the new size against the original — if it's still too big, try a stronger level or remove pages you don't need first." },
    ],
    sections: [
      {
        heading: "What makes a PDF large?",
        body: [
          "Text is tiny — a hundred pages of text is often under a megabyte. The weight comes from images: a single full-page scan at 300 DPI can be several megabytes on its own. Fonts embedded in full (rather than subset) and duplicated images add to it.",
          "That's why compression focuses on images: it downsamples them to a resolution appropriate for the page and re-encodes them efficiently. If your PDF is mostly text and still large, the Sanitize and Optimize-for-Web tools can also trim metadata and restructure the file.",
        ],
      },
    ],
    faqs: [
      { q: "Will compressing blur my text?", a: "No. Text stays vector-sharp — compression only re-encodes images. Heavy settings can soften photos, so pick the lightest level that hits your target size." },
      { q: "What's the smallest I can make it?", a: "It depends on the images. Try a stronger level, drop unneeded pages, or convert image-only scans to grayscale first if color isn't needed." },
      { q: "Is my file uploaded?", a: "Compression runs on the server (it uses Ghostscript), over an encrypted connection, and the file is deleted within an hour. Most other tools here run fully in your browser." },
    ],
    toolId: "compress",
    related: ["compress", "grayscale", "linearize"],
  },
  {
    slug: "remove-password-from-pdf",
    title: "How to Remove a Password from a PDF (Free)",
    description:
      "Unlock a password-protected PDF you have the password for, so it opens without prompting every time. Free, step by step.",
    heading: "How to remove a password from a PDF",
    updated: "2026-07-11",
    intro: [
      "If you have a PDF that asks for a password every time you open it — and you know that password — you can strip the protection so it opens freely. This is useful for documents you own and re-read often, like statements or reports, where re-typing a password each time is just friction.",
      "One important note up front: this removes protection from a PDF you can already open. It is not a way to break into a document you don't have the password for.",
    ],
    steps: [
      { title: "Open the Unlock PDF tool", body: "Go to the Unlock PDF tool and add your protected file." },
      { title: "Enter the password", body: "Type the password you normally use to open the document. This is required — the tool decrypts with it, it does not guess it." },
      { title: "Download the unlocked copy", body: "Run it and download a copy that opens without a prompt. Keep the original if you still want a protected version." },
    ],
    sections: [
      {
        heading: "Removing vs. adding protection",
        body: [
          "There are two kinds of PDF passwords: a user password (required to open the file) and an owner password (restricts printing or editing). Unlocking removes the encryption so neither prompts you.",
          "If you instead want to add a password before sharing a sensitive document, use the Protect PDF tool, which encrypts with AES-256.",
        ],
      },
    ],
    faqs: [
      { q: "Can this open a PDF if I don't know the password?", a: "No. You must provide the correct password — the tool decrypts the file, it does not crack it. That's by design." },
      { q: "Is the password sent anywhere?", a: "Unlocking runs on the server (qpdf) over an encrypted connection; the file and password aren't retained and the output is deleted within an hour." },
      { q: "How do I re-protect it later?", a: "Use Protect PDF to set a new password with AES-256 encryption." },
    ],
    toolId: "unlock",
    related: ["unlock", "protect", "sanitize"],
  },
  {
    slug: "merge-pdf-without-uploading",
    title: "How to Merge PDF Files Without Uploading Them",
    description:
      "Combine several PDFs into one — in the order you choose — entirely in your browser, so the files never leave your computer.",
    heading: "How to merge PDF files without uploading them",
    updated: "2026-07-11",
    intro: [
      "Combining PDFs is one of the most common document chores: stapling a cover letter to a résumé, joining scanned pages, assembling a report from separate exports. The catch with most online mergers is that they upload your files to a server — not ideal for contracts, IDs, or anything confidential.",
      "You don't have to. Merging is simple enough to run entirely in your browser, so the documents stay on your machine the whole time.",
    ],
    steps: [
      { title: "Open the Merge PDF tool", body: "Go to the Merge PDF tool and add the files you want to combine — you can drop several at once." },
      { title: "Put them in order", body: "Drag the files (or use the up/down controls) so they're in the exact order you want them stitched together." },
      { title: "Merge and download", body: "Click merge and download the single combined PDF. Page sizes and orientations are preserved from each source file." },
    ],
    sections: [
      {
        heading: "Why in-browser merging is safe for sensitive files",
        body: [
          "This tool uses your browser's own JavaScript to read the files and write the merged PDF — nothing is transmitted to a server. You can confirm it by turning off your network after the page loads: the merge still works.",
          "If you need to reorder or delete individual pages rather than whole files, the Organize tool gives you a visual thumbnail grid.",
        ],
      },
    ],
    faqs: [
      { q: "How many PDFs can I merge?", a: "Up to 20 at once. For more, merge in batches — the output of one merge can feed the next." },
      { q: "Does merging reduce quality?", a: "No. Pages are copied without re-compression, so text and images keep their original resolution." },
      { q: "Are the files really not uploaded?", a: "Correct — merging happens entirely in your browser, so the documents never leave your device." },
    ],
    toolId: "merge",
    related: ["merge", "organize", "extract"],
  },
  {
    slug: "convert-pdf-to-word",
    title: "How to Convert a PDF to Word (Editable .docx)",
    description:
      "Turn a PDF into an editable Word document you can revise. A step-by-step guide, plus when conversion works well and when it won't.",
    heading: "How to convert a PDF to Word",
    updated: "2026-07-11",
    intro: [
      "PDFs are built for presentation, not editing — which is exactly why you sometimes need the content back in Word. Converting a PDF to a .docx recovers the text into an editable document so you can revise a contract, update a résumé, or reuse a report you no longer have the source for.",
      "How clean the result is depends on the PDF. Documents that were exported from a word processor convert best; heavily designed layouts and scans are harder. Here's how to do it and what to expect.",
    ],
    steps: [
      { title: "Open the PDF to Word tool", body: "Go to the PDF to Word tool and add your PDF." },
      { title: "Convert", body: "Run the conversion. The tool extracts the text and layout into a .docx document." },
      { title: "Download and tidy up", body: "Open the result in Word (or Google Docs / LibreOffice) and fix any spacing or formatting the conversion couldn't reproduce exactly." },
    ],
    sections: [
      {
        heading: "When conversion works — and when it doesn't",
        body: [
          "Text-based PDFs (ones where you can select the text) convert well: the words come across editable, with a reasonable approximation of the layout. Expect to nudge some spacing.",
          "Scanned PDFs are images of text, so there's nothing to extract until they're run through OCR first. And if you only need the raw words rather than a formatted document, the PDF to Text tool is faster and runs entirely in your browser.",
        ],
      },
    ],
    faqs: [
      { q: "Will the formatting be perfect?", a: "Rarely 100%. Conversion produces positioned text that's close to the original; complex layouts usually need light cleanup in Word." },
      { q: "It converted a scan and got nothing — why?", a: "A scan is an image with no text layer. Run it through the OCR tool first to make it searchable, then convert." },
      { q: "I just want the text, not a Word file", a: "Use PDF to Text (or PDF to Markdown) — it extracts the words in your browser, no upload." },
    ],
    toolId: "pdf-to-word",
    related: ["pdf-to-word", "pdf-to-text", "ocr"],
  },
  {
    slug: "edit-text-in-pdf",
    title: "How to Edit Text in a PDF (For Free, In Your Browser)",
    description:
      "Fix a typo, change a date, or update an amount directly in a PDF — the original text is genuinely replaced, not covered with a white box.",
    heading: "How to edit text in a PDF",
    updated: "2026-07-11",
    intro: [
      "Needing to change a single wrong word in a finished PDF is maddening when you don't have the source file. Most \"editors\" solve it by slapping a white rectangle over the old text and typing on top — which looks obvious and falls apart the moment someone copies the text.",
      "There's a better way. The Edit PDF tool removes the original text from the page's content and redraws your replacement in the document's own font, so the change is seamless. It all happens in your browser.",
    ],
    steps: [
      { title: "Open the Edit PDF tool", body: "Go to the Edit PDF tool and drop in your file." },
      { title: "Click the text you want to change", body: "Switch on \"Edit text\", then click any line in the document. The original text is detected and made editable in place." },
      { title: "Type your replacement", body: "Edit the line — fix the typo, change the date, update the number — and it's redrawn in the matching font at the same spot." },
      { title: "Apply and download", body: "Download the edited PDF. The old text is genuinely gone from the file, not hidden under a patch." },
    ],
    sections: [
      {
        heading: "Editing scanned documents",
        body: [
          "If your PDF is a scan (an image of text), there's no text layer to click. The editor can run OCR on the page right in your browser to recognize the words and make them editable — then edits are applied by covering the original area and drawing the new text.",
          "You can also add new text, shapes, highlights, images, and signatures from the same editor.",
        ],
      },
    ],
    faqs: [
      { q: "Does it really remove the old text?", a: "Yes — for text in the page's content stream, the original show-operators are spliced out and your replacement is drawn in the document's own font. A cover fallback is used only when removal can't be verified." },
      { q: "Can I edit a scanned PDF?", a: "Yes, via in-browser OCR: the editor recognizes the scanned text so you can edit it. Latin script is supported today." },
      { q: "Is my PDF uploaded?", a: "No. The editor runs entirely in your browser — nothing is uploaded." },
    ],
    toolId: "edit",
    related: ["edit", "sign", "fill-form"],
  },
  {
    slug: "fill-out-pdf-form",
    title: "How to Fill Out a PDF Form Online (Free)",
    description:
      "Complete an interactive PDF form — text fields, checkboxes, dropdowns — and download it filled, without printing. Free and private.",
    heading: "How to fill out a PDF form online",
    updated: "2026-07-11",
    intro: [
      "Getting a PDF form — an application, a tax document, an intake sheet — and having no idea how to complete it without printing, hand-writing, and re-scanning is a rite of passage. If the form has interactive fields, you can fill it on screen and download a clean, typed copy in a minute.",
      "Here's how, plus what to do when a \"form\" turns out to be a flat scan with no fields.",
    ],
    steps: [
      { title: "Open the Fill PDF Form tool", body: "Go to the Fill PDF Form tool and add your form." },
      { title: "Fill in the fields", body: "Every interactive field — text boxes, checkboxes, radio buttons, dropdowns — becomes editable right on the page. Type your answers and tick the boxes." },
      { title: "Choose interactive or flattened", body: "Decide whether to keep the fields editable (so you or someone else can change them later) or flatten the form so the answers are baked in and final." },
      { title: "Download", body: "Download the completed form. Everything happened in your browser — the form was never uploaded." },
    ],
    sections: [
      {
        heading: "What if the form has no fillable fields?",
        body: [
          "Some \"forms\" are just flat pages or scans with lines to write on — there are no interactive fields to fill. In that case, use the Edit PDF tool to type text anywhere on the page and add checkmarks, then flatten it.",
          "To sign the form, the Sign PDF tool lets you draw, type, or upload a signature and place it where it belongs.",
        ],
      },
    ],
    faqs: [
      { q: "What field types are supported?", a: "Text fields (including multi-line), checkboxes, radio-button groups, and dropdowns. Multi-select list boxes and signature fields aren't supported yet." },
      { q: "What does flattening do?", a: "It converts your answers into permanent page content and removes the interactive fields, so the values can't be changed. Leave it off to keep the form editable." },
      { q: "Is my form uploaded?", a: "No — filling runs entirely in your browser, so the document stays on your device." },
    ],
    toolId: "fill-form",
    related: ["fill-form", "sign", "edit"],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
