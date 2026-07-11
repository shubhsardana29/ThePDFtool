# System Design — PDF Tools

A self-hostable iLovePDF-style web application: 43 PDF tools behind one
generic UI, with a hybrid processing model that keeps most files on the
user's device and runs the rest through a queued, containerized pipeline.

This document explains how the system works and why it's built this way.
For run instructions see `README.md`.

---

## 1. Design goals

| Goal | Consequence in the design |
|---|---|
| Privacy first | Everything that *can* run in the browser does. 32 of 43 tools never upload anything. |
| One person can operate it | Single-host Docker Compose deploy; no managed services required beyond a VPS. |
| Adding a tool must be cheap | Tool = registry entry + one processor function. UI, validation, and transport are generic. |
| Untrusted input everywhere | Uploads are validated by magic bytes, filenames are never trusted, engines are shelled with argument arrays only. |
| Fail loudly, leak nothing | Internal errors (paths, stderr) stay in worker logs; users see curated messages. |

## 2. High-level architecture

```
                       ┌──────────────────────── Browser ────────────────────────┐
                       │  Next.js UI (static tool pages, generic ToolRunner)     │
                       │                                                         │
                       │  Client engine:                                         │
                       │   • pdf.worker.ts (Web Worker) — pdf-lib ops:           │
                       │     merge/split/extract/rotate/organize/watermark/      │
                       │     page-numbers/images→PDF/edit/sign (flatten)         │
                       │   • main thread — pdfjs rendering:                      │
                       │     PDF→JPG, thumbnails, text extract (compare), redact │
                       └───────────────┬─────────────────────────────────────────┘
                                       │ HTTPS (only for the 11 server tools)
                    ┌──────────────────▼──────────────────────────────────────────┐
                    │ Caddy  :80/:443  (TLS, security headers, 210MB body cap)    │
                    └──────────────────┬──────────────────────────────────────────┘
                    ┌──────────────────▼──────────────────────────────────────────┐
                    │ web (Next.js standalone)                                    │
                    │  /api/jobs        validate → store → enqueue                │
                    │  /api/jobs/:id    status from BullMQ                        │
                    │  /api/jobs/:id/download                                     │
                    │  /api/health      redis + storage probes                    │
                    │  /api/auth/*      Auth.js (JWT sessions)                    │
                    └───────┬──────────────────┬──────────────────────────────────┘
                            │                  │
                     ┌──────▼──────┐    ┌──────▼──────────────────────────────────┐
                     │ Redis       │    │ storage volume                          │
                     │  BullMQ     │    │  jobs/<uuid>/in/f0.pdf                  │
                     │  quotas     │    │  jobs/<uuid>/out/<name>.pdf             │
                     └──────┬──────┘    └──────▲──────────────────────────────────┘
                            │ consume          │ read/write
                    ┌───────▼──────────────────┴──────────────────────────────────┐
                    │ worker (BullMQ consumer, concurrency 2)                     │
                    │  ghostscript → compress / repair / PDF-A                    │
                    │  qpdf        → protect / unlock / linearize                 │
                    │  ocrmypdf    → OCR (5 languages)                            │
                    │  soffice     → PDF→Word / PDF→PowerPoint                    │
                    │  Gotenberg ──HTTP──► office→PDF, HTML→PDF (own container)   │
                    │  TTL cleanup: delete job dirs older than 1h, every 10 min   │
                    └─────────────────────────────────────────────────────────────┘
```

Five containers in production: `caddy`, `web`, `worker`, `redis`, `gotenberg`.
Only Caddy is exposed to the internet.

## 3. The tool registry — the load-bearing abstraction

`src/lib/tools/registry.ts` defines every tool as a `ToolDefinition`:

```ts
{
  id, name, description, category,
  accept,                  // dropzone MIME map
  minFiles, maxFiles,
  runtime: "client" | "server",
  optionsSchema,           // zod — validated in the UI AND re-validated server-side
  defaultOptions, optionFields,   // declarative options → generic form renderer
  customUI?,               // editor-class tools with bespoke UIs
}
```

Everything else is generated from this:

- the homepage grid and the `/tools/[toolId]` pages (all statically generated),
- the upload → options → run → download flow (`src/components/ToolRunner.tsx`),
- SEO: sitemap entries, canonical URLs, JSON-LD, "how it works" steps,
- server-side re-validation of options on job submission.

Adding a tool means one registry entry plus one processor function (client:
add to `PDFLIB_OPS`; server: add to `SERVER_OPS` + an entry in
`TOOL_INPUT_EXTS`). Nothing else changes.

Twelve tools (edit, sign, organize, compare, visual compare, annotate, pipeline, redact, fill forms, crop, edit
metadata, replace image) opt out of the generic runner via `customUI` — they
share the same engine layer but bring their own interaction model (page
canvases + overlay editing, gallery pickers, prefilled forms).

## 4. Client-side processing path

Two execution contexts, chosen by what the operation needs:

1. **Web Worker** (`src/workers/pdf.worker.ts`) — all pdf-lib document
   surgery. Files are transferred (not copied) via `postMessage` transferables,
   so a 100 MB PDF doesn't freeze the UI or double in memory. The worker
   dispatches on tool id through `PDFLIB_OPS`.

2. **Main thread** (`src/lib/engine-client/render.ts`) — anything that needs
   pdfjs rendering or the text layer: PDF→JPG, page thumbnails, grayscale and
   redaction rasterization, and text-layer extraction (compare, PDF→Text,
   PDF→Excel table detection). pdfjs already runs its own internal worker for
   parsing; only canvas paint / text reads happen on the main thread.

The **edit/sign/fill-form flatten** pipeline is the interesting composite: the
UI keeps overlay items (text/box/highlight/image/form-field) as plain data in
*displayed PDF points with a top-left origin*, the natural CSS coordinate space.
The `flatten` op in the worker maps to PDF's bottom-left, unrotated space via
`page-rotate.ts` (so overlays, form fields, and inline text edits land correctly
on `/Rotate` pages) and stamps items with pdf-lib. Because items are
serializable data, one op serves every editor tool and is unit-testable in Node.

**Redaction** is deliberately destructive: pages are re-rendered to bitmaps,
boxes are painted onto the pixels, and the PDF is rebuilt from images. The
text layer is discarded wholesale — redacted content is unrecoverable, at the
cost of selectable text. (Drawing black rectangles over live text, which some
tools do, is not redaction.)

## 5. Server-side job pipeline

### Lifecycle

```
POST /api/jobs (multipart)
  │ per-IP burst limit (in-memory sliding window)
  │ tier quota (Redis INCR on quota:<day>:<subject>, TTL 25h)
  │ tool exists && runtime === "server"
  │ options re-validated against the tool's zod schema
  │ file count / per-file size / 200MB total caps
  │ extension allowed for this tool && magic bytes match the extension
  │ write to storage/jobs/<uuid>/in/f<N>.<ext>   ← synthetic names only
  ▼
BullMQ queue (job id = uuid, removeOnComplete/Fail age = 1h)
  ▼
worker: SERVER_OPS[toolId]({files, outDir, options}) → output names
  │ outputs written to storage/jobs/<uuid>/out/
  ▼
GET /api/jobs/:id           → processing | done{files} | error{message}
GET /api/jobs/:id/download  → single file, or zip (fflate) for multi-output
```

### Design decisions

- **BullMQ is the only job store.** Job state, payload metadata, and the
  result manifest live in the BullMQ job record; there is no database. This
  is right for ephemeral 1-hour jobs — introducing Postgres here would add an
  operational dependency to store data we intentionally delete.
- **The web tier never touches engines.** It validates, stores, and enqueues.
  All binary-wrangling risk (Ghostscript et al. parsing hostile files) is
  isolated in the worker container, which has no exposed ports.
- **Paths are process-relative.** Job records store only relative file refs
  (`f0.pdf`); web and worker each resolve against their own `STORAGE_DIR`.
  This is what lets the same code run with a bind mount in dev and a named
  volume in prod.
- **Gotenberg runs as its own container** rather than shelling LibreOffice
  for office→PDF: it supervises its own LibreOffice process, restarts it when
  wedged (`--libreoffice-restart-after=10`), and gives us Chromium for
  HTML→PDF for free. The worker still has its own `soffice` for PDF→Office,
  which Gotenberg doesn't do. Each soffice invocation gets a private
  `UserInstallation` profile dir — concurrent runs sharing a profile deadlock.
- **Two error classes.** Engines throw `UserFacingError` with curated
  messages ("wrong password or the file is corrupt"); anything else is logged
  in full in the worker and surfaces as a generic message. `failedReason`
  crosses a trust boundary — this is what keeps stderr and container paths
  out of API responses.

### File lifetime

Files exist for at most ~1 hour. The worker deletes `jobs/<uuid>` dirs older
than the TTL every 10 minutes; BullMQ job records expire on the same clock.
There are no backups by design — the storage volume is a scratch space, and
the correct disaster recovery for it is deletion.

## 6. Identity, tiers, and abuse control

Three layers, each cheap where the previous is insufficient:

1. **Burst limit** — in-memory sliding window per IP (20 jobs/10 min) in the
   web process. First line against loops and scripts; costs one Map lookup.
2. **Daily quota** — Redis `INCR` with TTL, keyed by user email (signed in)
   or IP (anonymous). Anonymous: 10 jobs/day, 50 MB/file. Free account:
   50/day, 100 MB/file. Premium exists in `TIER_LIMITS` but nothing assigns
   it until billing lands. Over-limit attempts are decremented back so they
   don't burn quota.
3. **Auth.js (JWT sessions, no DB)** — OAuth providers activate only when
   their env credentials exist; with none configured the site is anonymous-
   only and the sign-in button hides itself. A dev-only credentials provider
   (gated on `NODE_ENV === "development"`) lets the signed-in tier be tested
   without OAuth setup.

Client-side tools are deliberately unmetered — they cost us nothing and
metering them would require uploading, defeating their point.

The session UI is a client island (`AuthNav` + `SessionProvider`) rather than
`auth()` in the layout — calling `auth()` in a server layout reads cookies and
would force every page dynamic, destroying the static generation the SEO
strategy depends on.

## 7. Security model

Threat model: hostile files, hostile filenames, hostile request volume, and
the usual web attack surface. Not in scope: a compromised VPS or malicious
admin.

- **Input validation**: extension allow-list per tool, then magic-byte
  sniffing (`%PDF`, `PK..`, OLE2) — a zip renamed `.pdf` is rejected with 415.
  HTML (no magic bytes) is checked for binary content and capped like
  everything else.
- **Filesystem discipline**: stored names are synthetic (`f0.pdf`); the
  original name is sanitized (`[^\w.\- ]` → `_`, length-capped) and used only
  for display and output naming. Job ids must match a UUID regex before any
  path is built; download paths are resolved and checked to stay inside the
  job's out dir.
- **Command execution**: every engine call goes through `execFile` with
  argument arrays (`src/lib/engine-server/exec.ts`) — no shell
  interpretation, ever, because filenames and options are attacker-supplied.
  Timeouts (3 min) and output buffer caps bound runaway engines.
- **Container posture**: all services run as non-root (`node`, uid 1000);
  only Caddy publishes ports; dev Redis binds to loopback; Gotenberg is
  reachable only on the compose network.
- **Transport**: Caddy terminates TLS (auto Let's Encrypt), sets HSTS,
  nosniff, frame-deny, referrer and permissions policies, and enforces the
  210 MB body cap before requests reach Node.
- **Secrets**: none in the repo. `.env.local` / `.env` are gitignored;
  `.env.example` carries placeholders only. `AUTH_SECRET` is generated per
  deployment.

## 8. Deployment & operations

- **Images** (multi-stage `Dockerfile`): `web` is the Next standalone output
  on `node:22-bookworm-slim` (~287 MB, `HOSTNAME=0.0.0.0` because standalone
  binds to `$HOSTNAME`); `worker` adds the engine packages (~1.6 GB — almost
  entirely LibreOffice, the price of PDF→Office).
- **`deploy.sh`** is the whole CD story: build → `up -d` → explicit Caddy
  config reload (bind-mounted Caddyfiles don't trigger container recreation)
  → poll the web container's Docker healthcheck → prune. Re-runnable.
- **Domain cutover** is config-only: `SITE_DOMAIN` defaults to `:80` (serve
  any host, plain HTTP — works via bare VPS IP); setting a real domain makes
  Caddy provision certificates automatically.
- **Health**: `/api/health` probes Redis (`PING`) and storage writability,
  returns 503 on degradation; Docker healthchecks and any external uptime
  monitor consume the same endpoint.
- **Dev/prod parity**: dev runs the same Redis/Gotenberg/worker containers
  with the repo bind-mounted and `tsx watch`; prod bakes the code in. Same
  engine versions, same code paths.

## 9. Scaling path (deliberately not built yet)

Current capacity: one VPS, worker concurrency 2, LibreOffice conversions
~5–60 s, everything else seconds. That serves a lot of traffic given 32 of
43 tools consume zero server resources.

When it outgrows one box, in order:

1. **More workers** — `docker compose up --scale worker=N`. BullMQ already
   distributes; zero code changes. First bottleneck is CPU during
   Ghostscript/LibreOffice runs.
2. **Split web from workers** — needs shared storage: swap the filesystem
   calls in `storage.ts` + upload/download routes for S3/R2 (the swap point
   is documented there). Web tier is stateless (JWT sessions, Redis quotas)
   and scales horizontally behind any LB.
3. **Isolate the queue** — managed Redis when it becomes precious.
4. **CDN on static pages** — they're SSG already; Cloudflare in front is a
   config change.

In-memory burst limiting becomes per-instance at step 2 — acceptable (the
Redis daily quota is the real backstop), or replaced with a Redis token
bucket if not.

## 10. Known limitations

- **Editing scanned PDFs**: inline text editing needs a text layer. Image-only
  scans can now be OCR'd in-browser from the editor (tesseract.js, self-hosted
  under `/public/tesseract`, English only), which populates editable lines;
  edits then apply via the cover-and-redraw path since there's no stream text
  to remove. Non-Latin scripts (CJK/Arabic) aren't renderable for inline edits
  yet, and only the Latin language pack is bundled.
- **PDF→Office / →Excel fidelity**: LibreOffice's pdfimport produces positioned
  text frames, not reflowing paragraphs ("best effort" in the UI). PDF→Excel is
  a client-side heuristic over the text layer (row/column grouping by position),
  so complex or irregular tables may need manual cleanup.
- **Pathological documents** can pin Gotenberg's LibreOffice for up to 2 min;
  jobs fail with a friendly message until its supervisor recycles the process.
- **PDF/A output** is best-effort (no ICC profile embedding / veraPDF
  validation).
- **Signing is visual**, not cryptographic — no digital signature objects.
- **Job status is poll-based** (1.5 s interval). Fine at this scale; SSE/WS
  is the upgrade if job volume makes polling noisy.

## 11. What arrives with billing (deferred by design)

Stripe checkout + webhook → a persistent user store (the first real database
in the system, likely SQLite/Postgres keyed by OAuth identity) → `premium`
tier assignment in the session JWT. The enforcement path (`TIER_LIMITS`,
quota keys, per-tier file caps) is already tier-complete, so billing touches
auth and adds a webhook handler — it does not touch the pipeline.
