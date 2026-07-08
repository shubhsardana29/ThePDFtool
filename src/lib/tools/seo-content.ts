/**
 * Per-tool SEO content: keyword-targeted titles, unique intro copy, FAQs
 * (rendered as FAQPage structured data), and related-tool links.
 *
 * IMPORTANT: imported ONLY by server components (the tool page). Keeping it
 * out of the registry keeps this text out of the client JS bundle.
 */

export interface ToolSeo {
  /** Page <title> — keyword-first, ~60 chars. */
  title: string;
  /** Meta description, ~150 chars, includes the privacy angle. */
  description: string;
  intro: string[];
  faqs: { q: string; a: string }[];
  related: string[];
}

const PRIVATE_NOTE =
  "Your file is processed entirely in your browser using JavaScript — it is never uploaded to a server, so nothing can be stored, leaked, or read by anyone else.";

export const TOOL_SEO: Record<string, ToolSeo> = {
  merge: {
    title: "Merge PDF Files Online Free — Combine PDFs Without Uploading",
    description:
      "Combine multiple PDF files into one document, free and in any order. Runs entirely in your browser — your PDFs are never uploaded to a server.",
    intro: [
      "Combine up to 20 PDF files into a single document in seconds. Drag your files in, arrange them in exactly the order you want with the up/down controls, and download one merged PDF. Page sizes, orientations, and formatting are preserved exactly as they were in the source files.",
      "Unlike most online PDF mergers, this tool never uploads your documents. The merging happens on your own computer, inside your browser — which makes it safe for contracts, medical records, financial statements, and anything else you wouldn't email to a stranger.",
    ],
    faqs: [
      {
        q: "Is it safe to merge confidential PDFs here?",
        a: "Yes. " + PRIVATE_NOTE,
      },
      {
        q: "Can I change the order of the files before merging?",
        a: "Yes. After adding files, use the arrow buttons next to each file to reorder them. The merged PDF follows the exact order shown in the list.",
      },
      {
        q: "How many PDFs can I combine at once?",
        a: "Up to 20 files per merge. If you need more, merge in batches — the output of one merge can be used as an input for the next.",
      },
      {
        q: "Does merging reduce the quality of my PDFs?",
        a: "No. Pages are copied into the new document without re-compression, so text stays sharp and images keep their original resolution.",
      },
    ],
    related: ["split", "organize", "compress"],
  },

  split: {
    title: "Split PDF Online Free — Extract Page Ranges Without Uploading",
    description:
      "Split a PDF into separate files by page range, or into single pages. Free, no signup, and your document never leaves your browser.",
    intro: [
      "Break one PDF into several smaller documents. Enter page ranges like “1-3, 4-6, 7” to get one file per range, or leave the field empty to split every page into its own PDF. Multiple outputs download together as a zip.",
      "Splitting happens locally in your browser, so it works even on sensitive documents — nothing is uploaded, and there are no watermarks or page limits hidden behind a paywall.",
    ],
    faqs: [
      {
        q: "How do I split specific pages into their own file?",
        a: "Type comma-separated ranges such as “1-3, 5, 8-10”. Each range becomes a separate PDF, so that example produces three files.",
      },
      {
        q: "Can I split every page into a separate PDF?",
        a: "Yes — leave the ranges field empty and every page becomes its own file, delivered as a single zip download.",
      },
      { q: "Is my PDF uploaded when I split it?", a: "No. " + PRIVATE_NOTE },
      {
        q: "Will the split files keep the original quality?",
        a: "Yes. Pages are copied as-is with no re-compression, so the output is identical in quality to the source document.",
      },
    ],
    related: ["extract", "merge", "organize"],
  },

  extract: {
    title: "Extract Pages from PDF Online Free — No Upload Needed",
    description:
      "Pull specific pages out of a PDF into a new document. Free and private — the extraction runs in your browser, nothing is uploaded.",
    intro: [
      "Need pages 2, 7, and 12 from a 50-page report? Enter the page numbers or ranges you want and get a new PDF containing just those pages, in the order you listed them.",
      "Because extraction runs entirely on your device, it's a safe way to share part of a document without exposing the rest of it to a third-party server.",
    ],
    faqs: [
      {
        q: "How do I pick which pages to extract?",
        a: "Enter page numbers and ranges like “1, 3-5, 8”. The new PDF contains exactly those pages in that order.",
      },
      {
        q: "Does the original PDF get modified?",
        a: "No. Your original file is untouched — the tool creates a brand-new PDF containing only the selected pages.",
      },
      { q: "Are my files uploaded anywhere?", a: "No. " + PRIVATE_NOTE },
      {
        q: "Can I extract pages from a scanned PDF?",
        a: "Yes. Extraction works on any PDF, scanned or digital, because it copies whole pages rather than interpreting their content.",
      },
    ],
    related: ["split", "organize", "merge"],
  },

  rotate: {
    title: "Rotate PDF Pages Online Free — Fix Sideways Pages Privately",
    description:
      "Rotate all pages or selected pages by 90°, 180°, or 270°. Free, instant, and your PDF never leaves your device.",
    intro: [
      "Fix scanned documents that came out sideways or upside down. Rotate every page at once, or target specific pages with ranges like “2, 4-6” while leaving the rest untouched. The rotation is saved into the file itself, so pages stay upright in every PDF viewer.",
      "Like all of our editing tools, rotation runs in your browser — your document is never uploaded, and the fixed file downloads instantly.",
    ],
    faqs: [
      {
        q: "Can I rotate just one page instead of the whole document?",
        a: "Yes. Enter the page numbers to rotate (e.g. “3” or “2, 5-7”) and only those pages are turned; everything else keeps its orientation.",
      },
      {
        q: "Will the rotation stick when I open the PDF elsewhere?",
        a: "Yes. The page rotation is written into the PDF itself, so Adobe Reader, Preview, browsers, and printers all show it upright.",
      },
      { q: "Is my document uploaded to rotate it?", a: "No. " + PRIVATE_NOTE },
      {
        q: "Can I rotate several PDFs in one go?",
        a: "Yes — add up to 10 files and the same rotation is applied to each, downloaded together as a zip.",
      },
    ],
    related: ["organize", "merge", "split"],
  },

  organize: {
    title: "Organize PDF Pages Online — Reorder & Delete Pages Visually",
    description:
      "Drag pages into a new order or delete them, with live thumbnails of every page. Free and private — runs fully in your browser.",
    intro: [
      "See every page of your PDF as a thumbnail, then rearrange or remove pages visually. Move pages earlier or later, delete the ones you don't need, and download the reorganized document when it looks right.",
      "The thumbnails are rendered on your own machine — the document is never uploaded, so even confidential files can be reorganized safely.",
    ],
    faqs: [
      {
        q: "Can I preview pages before reordering them?",
        a: "Yes. Every page is shown as a rendered thumbnail, so you can see exactly what you're moving or deleting — no guessing by page number.",
      },
      {
        q: "Can I delete multiple pages at once?",
        a: "Yes. Click the ✕ on each page you want removed before applying — nothing is final until you download.",
      },
      { q: "Is the PDF uploaded to generate thumbnails?", a: "No. " + PRIVATE_NOTE },
      {
        q: "What if I make a mistake while organizing?",
        a: "Your original file is never modified. Click “Start over” to reload it and begin again at any point.",
      },
    ],
    related: ["extract", "rotate", "merge"],
  },

  watermark: {
    title: "Add Watermark to PDF Online Free — Text Stamp, No Upload",
    description:
      "Stamp CONFIDENTIAL, DRAFT, or any text across every PDF page. Adjustable size, opacity, and angle. Runs in your browser — files stay private.",
    intro: [
      "Stamp a text watermark — “CONFIDENTIAL”, “DRAFT”, your company name — across every page of a PDF. Control the font size, transparency, and whether it runs diagonally or horizontally, then download the watermarked copy.",
      "Because watermarking is usually applied to documents that are sensitive by definition, this tool runs entirely client-side: the file you're marking never touches a server.",
    ],
    faqs: [
      {
        q: "Can I control how visible the watermark is?",
        a: "Yes. The opacity setting runs from barely-there 5% to fully opaque, and you can choose the font size and a diagonal or horizontal angle.",
      },
      {
        q: "Does the watermark go on every page?",
        a: "Yes, it's stamped identically across all pages, centered, so the document reads as uniformly marked.",
      },
      { q: "Is my PDF uploaded to add the watermark?", a: "No. " + PRIVATE_NOTE },
      {
        q: "Can the watermark be removed later?",
        a: "The watermark is drawn into the page content, not added as a removable annotation — so casual removal isn't possible, though no watermark is cryptographically permanent.",
      },
      ],
    related: ["page-numbers", "protect", "edit"],
  },

  "page-numbers": {
    title: "Add Page Numbers to PDF Online Free — No Upload",
    description:
      "Insert page numbers into a PDF — choose position, starting number, and “1 of N” format. Free and private, processed in your browser.",
    intro: [
      "Add clean page numbers to any PDF. Pick the corner or center of the bottom edge, start counting from any number (useful when the cover page shouldn't be “1”), and choose plain numbers or a “3 of 12” style.",
      "Numbering runs locally in your browser with no upload, and the output downloads immediately — no accounts, no watermarks in exchange.",
    ],
    faqs: [
      {
        q: "Can I start numbering from a number other than 1?",
        a: "Yes. Set “Start at” to any value — handy when your document continues from another file or the title page shouldn't count.",
      },
      {
        q: "Can the numbers show the total page count?",
        a: "Yes. Choose the “1 of N” format to render numbers like “4 of 20” on every page.",
      },
      { q: "Where can the numbers be placed?", a: "Bottom-left, bottom-center, or bottom-right of every page — pick whichever matches your document's layout." },
      { q: "Is my document uploaded?", a: "No. " + PRIVATE_NOTE },
    ],
    related: ["watermark", "merge", "edit"],
  },

  "images-to-pdf": {
    title: "JPG to PDF Converter Online Free — Combine Images, No Upload",
    description:
      "Turn JPG and PNG images into a single PDF. Fit pages to each image or use A4/Letter. Free, private, and processed in your browser.",
    intro: [
      "Convert photos, scans, and screenshots into one tidy PDF. Add up to 50 JPG or PNG files, choose whether each page hugs the image exactly or sits on a standard A4 or Letter page, and set an optional margin.",
      "Photos often contain more personal information than documents. This converter never uploads them — images are embedded into the PDF on your own machine.",
    ],
    faqs: [
      {
        q: "Which image formats are supported?",
        a: "JPG/JPEG and PNG. PNG transparency is preserved against the page background.",
      },
      {
        q: "Will my photos be compressed?",
        a: "No. Images are embedded at their original resolution and quality — the PDF is essentially a container around your original files.",
      },
      {
        q: "Can I put multiple images into one PDF?",
        a: "Yes — up to 50 images become one PDF with one image per page, in the order you added them.",
      },
      { q: "Are my images uploaded?", a: "No. " + PRIVATE_NOTE },
    ],
    related: ["pdf-to-jpg", "merge", "compress"],
  },

  "pdf-to-jpg": {
    title: "PDF to JPG Converter Online Free — Every Page as an Image",
    description:
      "Convert each PDF page into a high-quality JPG at 72–300 dpi. Free and private — rendering happens in your browser, nothing is uploaded.",
    intro: [
      "Turn PDF pages into JPG images you can drop into slides, documents, or social posts. Choose 72 dpi for screens, 150 dpi for general use, or 300 dpi for print, and set the JPEG quality to balance sharpness against file size.",
      "Each page is rendered by a real PDF engine (the same one Firefox uses) running inside your browser — pages never leave your device, and multiple images download together as a zip.",
    ],
    faqs: [
      {
        q: "What resolution should I choose?",
        a: "72 dpi is fine for on-screen viewing, 150 dpi suits most documents, and 300 dpi is print quality. Higher dpi means larger image files.",
      },
      {
        q: "Does it convert every page?",
        a: "Yes — each page becomes its own numbered JPG, and multi-page documents arrive as a single zip download.",
      },
      { q: "Is my PDF uploaded for conversion?", a: "No. " + PRIVATE_NOTE },
      {
        q: "Why JPG and not PNG?",
        a: "JPG keeps document pages small while looking sharp at normal viewing sizes. If you need lossless output for a page, convert at 300 dpi and quality 1.0 — visually indistinguishable from PNG for typical documents.",
      },
    ],
    related: ["images-to-pdf", "compress", "split"],
  },

  edit: {
    title: "Edit PDF Text Online Free — Change Existing Text, No Upload",
    description:
      "Click any text in your PDF and edit it in place — the original text is truly removed, not covered. Plus shapes, highlights, images and freehand drawing. All in your browser.",
    intro: [
      "Click “Edit text”, then click any line in your document to rewrite it in place — fix a typo, change a date, update an amount. The original text is genuinely removed from the file (not hidden under a white box), and your replacement is set in a matching font at the exact same position. You can also add new text, boxes, highlights, arrows, ellipses, freehand pen strokes, and images anywhere on the page, with full undo/redo.",
      "Everything happens in your browser: the page previews are rendered locally and your edits are written into the file on your own machine. No upload, no account, no watermark.",
    ],
    faqs: [
      {
        q: "Can I edit the existing text in my PDF?",
        a: "Yes. Use the “Edit text” mode, click any line, and type your replacement. The original text is removed from the document's content — it can't be selected, searched, or extracted afterwards — and the new text is drawn at the same position in a matching font.",
      },
      {
        q: "Will the replacement text match my document's font?",
        a: "The editor detects the original size, weight, and style, and sets your replacement in a metrically compatible font (the same families used by Word and Google Docs for Arial and Times). For most documents the change is indistinguishable; unusual decorative fonts are approximated.",
      },
      {
        q: "Can I move and resize things after placing them?",
        a: "Yes. Click any added item to select it, drag to move, use the corner handle to resize, nudge with arrow keys, and undo/redo with Ctrl+Z / Ctrl+Shift+Z.",
      },
      { q: "Is my PDF uploaded while I edit?", a: "No. " + PRIVATE_NOTE },
      {
        q: "Will my edits be visible in every PDF reader?",
        a: "Yes. Edits are written into the page content itself, not stored as annotations, so they appear identically in Adobe Reader, Preview, browsers, and print.",
      },
    ],
    related: ["sign", "watermark", "redact"],
  },

  sign: {
    title: "Sign PDF Online Free — Draw or Type Your Signature, No Upload",
    description:
      "Draw, type, or upload a signature and place it anywhere on a PDF. Free and private — your document and signature never leave your browser.",
    intro: [
      "Sign documents in under a minute: draw your signature with a mouse or finger, type it in a script font, or upload an image of your real signature. Click where it belongs, resize it to fit the line, place it on as many pages as you need, and download the signed PDF.",
      "Your signature is uniquely sensitive — it's literally the thing forgers want. Here, both the document and the signature are processed entirely in your browser and are never transmitted anywhere.",
    ],
    faqs: [
      {
        q: "How do I create my signature?",
        a: "Three ways: draw it on the signature pad, type your name in a handwriting-style font, or upload a photo/scan of your signature (PNG with transparency works best).",
      },
      {
        q: "Can I sign in more than one place?",
        a: "Yes. After creating a signature once, click anywhere on any page to place it again — each placement can be moved and resized independently.",
      },
      { q: "Is this a legally binding signature?", a: "This tool applies a visual signature, which is widely accepted for everyday documents. It is not a cryptographic digital signature — for regulated use cases (e.g. eIDAS qualified signatures), use a certified signing service." },
      { q: "Is my signature uploaded or stored?", a: "No. " + PRIVATE_NOTE },
    ],
    related: ["edit", "protect", "watermark"],
  },

  compare: {
    title: "Compare Two PDFs Online Free — Find Text Differences Privately",
    description:
      "See exactly which lines changed between two versions of a PDF, page by page. Free and private — comparison runs in your browser.",
    intro: [
      "Drop in two versions of a document and get a page-by-page diff of the text: removed lines in red, added lines in green, unchanged text dimmed. Perfect for checking what actually changed between contract revisions before you sign.",
      "Both documents are read and compared locally in your browser. For legal and business documents where the changes themselves are confidential, that matters.",
    ],
    faqs: [
      {
        q: "What kind of differences does it find?",
        a: "Text differences, line by line, on each page — added lines, removed lines, and changed lines (shown as a removal plus an addition).",
      },
      {
        q: "Does it work on scanned PDFs?",
        a: "Only if the scan has a text layer. Run a scanned document through the OCR tool first, then compare the OCR'd versions.",
      },
      { q: "Are my documents uploaded to compare them?", a: "No. " + PRIVATE_NOTE },
      {
        q: "Does it detect layout or image changes?",
        a: "No — the comparison is text-based. A moved paragraph shows as removed from one place and added in another; image swaps aren't detected.",
      },
    ],
    related: ["ocr", "edit", "merge"],
  },

  redact: {
    title: "Redact PDF Online Free — Permanently Black Out Text, No Upload",
    description:
      "Black out sensitive content so it's truly unrecoverable — pages are rebuilt as images, not just covered. Free and processed in your browser.",
    intro: [
      "Drag boxes over anything that must not be seen — names, account numbers, addresses — and download a copy where that content is permanently gone. Unlike tools that just draw a black rectangle over live text (which anyone can copy-paste underneath), this tool rebuilds each page as an image, so the text underneath the box no longer exists in the file.",
      "Redaction is the one PDF operation where a mistake becomes a headline. That's why it runs entirely in your browser — the unredacted original is never uploaded anywhere.",
    ],
    faqs: [
      {
        q: "Is the redacted text really unrecoverable?",
        a: "Yes. Pages are re-rendered as images with the black boxes baked into the pixels, and the original text layer is discarded entirely. There is nothing under the box to recover.",
      },
      {
        q: "Why does my redacted PDF have no selectable text?",
        a: "That's the trade-off that makes redaction safe: pages become images. If you need the rest of the document searchable, run the redacted file through the OCR tool afterwards.",
      },
      { q: "Is my unredacted document uploaded?", a: "No. " + PRIVATE_NOTE },
      {
        q: "How is this different from drawing a black box in an editor?",
        a: "A drawn box just sits on top — the text underneath can still be selected, copied, or extracted. True redaction removes the content itself, which is what this tool does.",
      },
    ],
    related: ["protect", "edit", "ocr"],
  },

  compress: {
    title: "Compress PDF Online Free — Reduce File Size up to 90%",
    description:
      "Shrink PDFs to email-friendly sizes with three quality presets. Files are processed securely and auto-deleted from our server within 1 hour.",
    intro: [
      "Get a PDF under that 10 MB email limit. Three presets trade size against quality: Extreme squeezes hardest (best for on-screen reading), Recommended balances both for everyday sharing, and Light barely touches quality for print-bound files. Image-heavy documents often shrink by 70–90%.",
      "Compression uses Ghostscript on our server — the same engine the publishing industry relies on. Files transfer over an encrypted connection, live in an unguessable location, and are automatically deleted within an hour.",
    ],
    faqs: [
      {
        q: "How much smaller will my PDF get?",
        a: "It depends on what's inside. Scanned and image-heavy PDFs often shrink 70–90%; text-only PDFs are already efficient and may only drop 10–30%.",
      },
      {
        q: "Which compression level should I pick?",
        a: "Recommended is right for most uses. Choose Extreme when size matters more than image sharpness, and Light when the file is headed to print.",
      },
      {
        q: "What happens to my file after compression?",
        a: "It's stored under a random unguessable ID, transferred encrypted, and automatically deleted from the server within 1 hour — usually much sooner.",
      },
      {
        q: "Will compression affect my text quality?",
        a: "No — text is re-encoded losslessly and stays razor sharp at any zoom. Only images inside the PDF are downsampled, according to the preset you choose.",
      },
    ],
    related: ["merge", "pdf-to-jpg", "repair"],
  },

  "office-to-pdf": {
    title: "Word, Excel & PowerPoint to PDF Converter Online Free",
    description:
      "Convert DOCX, XLSX, PPTX and legacy Office files to PDF with LibreOffice rendering. Files encrypted in transit and deleted within 1 hour.",
    intro: [
      "Turn Word documents, Excel spreadsheets, and PowerPoint decks into PDFs that look the same on every screen. Both modern formats (docx, xlsx, pptx) and legacy ones (doc, xls, ppt), plus OpenDocument files, are supported — up to 10 files per batch.",
      "Conversion runs through LibreOffice on our server for faithful layout rendering. Your files travel encrypted, are stored under unguessable IDs, and are deleted automatically within an hour.",
    ],
    faqs: [
      {
        q: "Which file formats can I convert?",
        a: "Word (doc, docx), Excel (xls, xlsx), PowerPoint (ppt, pptx), and OpenDocument (odt, ods, odp) — up to 10 files at once.",
      },
      {
        q: "Will my document's formatting be preserved?",
        a: "Very close to perfectly for typical documents. Extremely complex layouts or fonts not embedded in the file can shift slightly, since rendering uses LibreOffice rather than Microsoft Office itself.",
      },
      {
        q: "How long are my files kept?",
        a: "Uploaded and converted files are automatically deleted within 1 hour, and download links use random unguessable IDs.",
      },
      {
        q: "Is there a file size limit?",
        a: "50 MB per file for anonymous use, 100 MB with a free account.",
      },
    ],
    related: ["pdf-to-word", "html-to-pdf", "compress"],
  },

  "pdf-to-word": {
    title: "PDF to Word Converter Online Free — Editable DOCX Output",
    description:
      "Convert PDFs into editable Word documents. Honest best-effort conversion, encrypted transfer, files auto-deleted within 1 hour.",
    intro: [
      "Get an editable .docx out of a PDF so you can revise a document you only have in final form. Text, basic layout, and images are carried across into a Word file you can open in Microsoft Word, Google Docs, or LibreOffice.",
      "Honest caveat most converters won't tell you: PDF is a print format, not an editing format, so complex layouts arrive as positioned text frames rather than free-flowing paragraphs. Simple documents convert cleanly; heavily designed ones need some tidying.",
    ],
    faqs: [
      {
        q: "Will the Word file look exactly like my PDF?",
        a: "Close, but not always identical. Simple text documents convert very well; multi-column or design-heavy layouts arrive as positioned text boxes that may need rearranging.",
      },
      {
        q: "Can I convert a scanned PDF to Word?",
        a: "Not directly — a scan has no text to extract. Run it through the OCR tool first to add a text layer, then convert the result.",
      },
      {
        q: "What happens to my files?",
        a: "They're transferred encrypted, stored under random IDs, and deleted automatically within 1 hour of upload.",
      },
      {
        q: "Why does my converted file open in 'layout' boxes?",
        a: "PDFs store text by position, not by paragraph flow. The converter preserves those positions so nothing is lost — Word's “select all → cut → paste as text” is a quick way to reflow everything if you prefer.",
      },
    ],
    related: ["office-to-pdf", "ocr", "pdf-to-powerpoint"],
  },

  "pdf-to-powerpoint": {
    title: "PDF to PowerPoint Converter Online Free — PPTX Slides",
    description:
      "Turn PDF pages into editable PowerPoint slides. Best-effort conversion via LibreOffice; files encrypted and deleted within 1 hour.",
    intro: [
      "Convert a PDF deck back into editable PowerPoint slides. Each page becomes a slide with its text and images placed to match the original, ready to open in PowerPoint, Keynote, or Google Slides.",
      "As with any PDF-to-Office conversion, elements arrive positioned rather than in native PowerPoint layouts — fine for edits and reuse, though intricate designs may need adjustment.",
    ],
    faqs: [
      {
        q: "Does each PDF page become one slide?",
        a: "Yes — a 12-page PDF produces a 12-slide PPTX with content positioned to match each page.",
      },
      {
        q: "Can I edit the text on the converted slides?",
        a: "Yes, text arrives as editable text boxes. Fonts fall back to close equivalents if the original fonts aren't installed on your machine.",
      },
      {
        q: "How private is the conversion?",
        a: "Files are encrypted in transit, stored under unguessable IDs, and automatically deleted from the server within 1 hour.",
      },
      {
        q: "My slides look slightly different — why?",
        a: "PDFs record final print output, not PowerPoint's internal structures, so the converter rebuilds slides by position. Complex effects like gradients or animations don't survive the round trip.",
      },
    ],
    related: ["office-to-pdf", "pdf-to-word", "pdf-to-jpg"],
  },

  "html-to-pdf": {
    title: "HTML to PDF Converter Online Free — Real Browser Rendering",
    description:
      "Convert an HTML file to a pixel-accurate PDF rendered by a real Chromium browser. Encrypted transfer, files deleted within 1 hour.",
    intro: [
      "Render an HTML file into a PDF exactly as a browser would display it — because the conversion actually runs a real headless Chromium. CSS layouts, web fonts declared in the file, and print stylesheets all behave the way they do in Chrome.",
      "Upload a single .html file and download the rendered PDF moments later. Files are encrypted in transit and wiped from the server within an hour.",
    ],
    faqs: [
      {
        q: "Why is browser-based rendering better?",
        a: "Because HTML is defined by how browsers draw it. Simple converters approximate CSS; this tool runs Chromium, so your PDF matches what you'd see (and print) in Chrome.",
      },
      {
        q: "Can I convert a live website URL?",
        a: "Not currently — for privacy and security reasons the tool takes an uploaded .html file rather than fetching URLs. Save the page from your browser first (Ctrl/Cmd+S).",
      },
      {
        q: "Do CSS print styles apply?",
        a: "Yes. @media print rules and page-break properties are honored, the same as printing to PDF from Chrome.",
      },
      {
        q: "What happens to my uploaded file?",
        a: "Encrypted in transit, stored under a random ID, deleted automatically within 1 hour.",
      },
    ],
    related: ["office-to-pdf", "compress", "merge"],
  },

  protect: {
    title: "Password Protect PDF Online Free — AES-256 Encryption",
    description:
      "Encrypt a PDF with a password using AES-256, the standard trusted for classified data. Files encrypted in transit, deleted within 1 hour.",
    intro: [
      "Lock a PDF with a password so only people you trust can open it. Protection uses AES-256 encryption — the same standard governments use for classified information — applied by qpdf, an industry-standard open-source engine.",
      "The file transfers over an encrypted connection, is processed, and is deleted from the server within an hour. Choose a strong password and share it through a different channel than the file itself.",
    ],
    faqs: [
      {
        q: "How strong is the encryption?",
        a: "AES-256 — the current industry standard. With a strong password, brute-forcing it is computationally infeasible. The password itself is the weakest link, so make it long.",
      },
      {
        q: "What happens if I forget the password?",
        a: "There is no back door — that's the point of real encryption. Keep the password in a password manager; without it the file cannot be opened.",
      },
      {
        q: "Is my password stored anywhere?",
        a: "No. It's used once to encrypt the file during processing and is never written to disk or logged; the file itself is deleted within 1 hour.",
      },
      {
        q: "Can I remove the password later?",
        a: "Yes — use the Unlock tool with the current password to produce an unprotected copy.",
      },
    ],
    related: ["unlock", "redact", "watermark"],
  },

  unlock: {
    title: "Unlock PDF Online Free — Remove Password from Your PDF",
    description:
      "Remove a password from a PDF you own the password for. Decrypted securely on our server, encrypted in transit, deleted within 1 hour.",
    intro: [
      "Stop typing the same password every time you open your own document. Provide the current password once, and download an unlocked copy that opens freely — useful before merging, compressing, or archiving protected files.",
      "You must know the password: this tool removes protection you can already get past, it doesn't crack encryption. Files are encrypted in transit and deleted from the server within an hour.",
    ],
    faqs: [
      {
        q: "Can this crack a PDF I don't have the password for?",
        a: "No. The tool decrypts using the password you provide — it removes friction from files you legitimately own, it doesn't break encryption.",
      },
      {
        q: "Why unlock a PDF at all?",
        a: "Password-protected files can't be merged, compressed, or processed by most tools. Unlocking your own file lets you work with it normally, and you can re-protect it afterwards.",
      },
      {
        q: "Is the password I enter kept anywhere?",
        a: "No — it's used once for decryption and never stored or logged. The file itself is deleted within 1 hour.",
      },
      {
        q: "The tool says my password is wrong but it works in my reader — why?",
        a: "PDFs can carry two passwords: one to open, one for permissions. Enter the open (user) password; if the file only has a permissions password, try leaving it blank.",
      },
    ],
    related: ["protect", "compress", "merge"],
  },

  ocr: {
    title: "OCR PDF Online Free — Make Scanned PDFs Searchable",
    description:
      "Add a searchable, selectable text layer to scanned PDFs in 5 languages. Powered by Tesseract OCR; files deleted within 1 hour.",
    intro: [
      "Scanned PDFs are just photographs of paper — you can't search them, select text, or copy a paragraph. OCR fixes that by recognizing the characters in each scan and adding an invisible text layer underneath, so the document looks identical but behaves like a real PDF.",
      "Recognition supports English, German, French, Spanish, and Hindi, and pages that already contain text pass through untouched. Files are encrypted in transit and deleted within an hour.",
    ],
    faqs: [
      {
        q: "Will OCR change how my document looks?",
        a: "No. The scanned image stays exactly as it is — OCR adds an invisible text layer underneath it, which is what makes search and text selection work.",
      },
      {
        q: "Which languages are supported?",
        a: "English, German, French, Spanish, and Hindi. Pick the document's main language for best accuracy.",
      },
      {
        q: "How accurate is the recognition?",
        a: "On clean 300-dpi scans, typically 95%+ for printed text. Accuracy drops with blurry scans, handwriting, or heavy background noise.",
      },
      {
        q: "What if my PDF already has some real text?",
        a: "Pages that already contain a text layer are passed through unmodified — only image-only pages get OCR'd, so running the tool is always safe.",
      },
    ],
    related: ["pdf-to-word", "compare", "compress"],
  },

  repair: {
    title: "Repair Corrupt PDF Online Free — Fix Damaged Files",
    description:
      "Recover PDFs that won't open by rebuilding their internal structure with Ghostscript. Encrypted transfer, files deleted within 1 hour.",
    intro: [
      "When a PDF refuses to open — “file is damaged”, endless loading, blank pages — the content is usually intact and only the file's internal index is broken. This tool rebuilds the document structure from whatever can be read, producing a clean file that opens normally.",
      "Repair can't resurrect data that was truly destroyed (a half-downloaded file is half a file), but for the common cases — interrupted saves, email mangling, buggy generators — recovery rates are high.",
    ],
    faqs: [
      {
        q: "What kinds of damage can be fixed?",
        a: "Broken cross-reference tables, malformed objects, and structural errors from interrupted saves or buggy PDF generators — the most common reasons a PDF won't open.",
      },
      {
        q: "Can it recover a partially downloaded PDF?",
        a: "Sometimes partially — pages contained in the portion you have can often be recovered, but data that never arrived can't be reconstructed.",
      },
      {
        q: "Will the repaired PDF look the same?",
        a: "Yes, for all recoverable pages. The rebuild preserves page content; it repairs the file's skeleton rather than redrawing pages.",
      },
      {
        q: "How long does my broken file stay on the server?",
        a: "It's encrypted in transit, stored under a random ID, and deleted automatically within 1 hour.",
      },
    ],
    related: ["compress", "pdfa", "merge"],
  },

  pdfa: {
    title: "Convert PDF to PDF/A Online Free — Archive-Ready Files",
    description:
      "Convert PDFs to PDF/A-2 for long-term archiving and compliance. Ghostscript conversion, encrypted transfer, deleted within 1 hour.",
    intro: [
      "PDF/A is the ISO-standardized flavor of PDF built to remain readable decades from now: fonts embedded, colors device-independent, no external dependencies. Archives, courts, and government agencies commonly require it for submissions.",
      "This tool converts standard PDFs to PDF/A-2b via Ghostscript. Your file is encrypted in transit and removed from the server within an hour.",
    ],
    faqs: [
      {
        q: "What's the difference between PDF and PDF/A?",
        a: "PDF/A is a stricter subset: every font must be embedded, colors must be self-described, and features that break long-term reproduction (JavaScript, external links, encryption) are forbidden.",
      },
      {
        q: "Who requires PDF/A?",
        a: "Courts (including US federal courts), national archives, patent offices, and many government and compliance workflows require PDF/A for submitted documents.",
      },
      {
        q: "Will my document look different as PDF/A?",
        a: "It should look identical — the conversion embeds fonts and normalizes colors rather than changing content or layout.",
      },
      {
        q: "Which PDF/A version does this produce?",
        a: "PDF/A-2, the most broadly accepted modern profile. For strict submission portals, validate the output with the checker your recipient specifies — full compliance can depend on the source file's fonts.",
      },
    ],
    related: ["repair", "compress", "protect"],
  },
};
