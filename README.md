# PDF Tools

A self-hostable iLovePDF-style web app: 42 PDF tools with a hybrid processing
model — simple operations run entirely in the browser (files never leave the
device), heavy operations run through a job queue on the server and are
auto-deleted within an hour.

## Tools

**Client-side** (private by design — 31 tools):

- Organize: merge, split, extract pages, delete pages, rotate, organize
  (visual reorder), crop, N-up (pages per sheet), resize (A4/Letter)
- Convert: JPG→PDF, PDF→JPG, PDF→PNG, PDF→Text/Markdown, PDF→Excel/CSV,
  extract images
- Edit: edit (inline text / boxes / highlights / images), replace image, sign,
  fill forms, flatten, redact, watermark, page numbers, header/footer, Bates
  numbering, edit metadata, annotate (comments + highlights), compare (text),
  visual compare (pixel)
- Optimize: grayscale
- Security: sanitize (strip metadata)

The editor (edit / sign / redact / fill forms) works on rotated (`/Rotate`)
pages: detection, overlays, and exports are all rotation-aware.

**Server-side** (Docker engines — 11 tools): compress, Office→PDF, PDF→Word,
PDF→PowerPoint, HTML→PDF, protect, unlock, OCR, repair, PDF/A, optimize-for-web
(linearize).

## Development

```bash
cp .env.example .env.local   # then set AUTH_SECRET (openssl rand -base64 32)
docker compose up -d         # redis + gotenberg + job worker
npm install
npm run dev                  # app on http://localhost:3000
```

In development a fake "Dev login" provider is available to test the
signed-in tier. Real OAuth (Google/GitHub) activates when the AUTH_* env
vars are set — see `.env.example`.

```bash
npm test        # unit tests (engine ops, validation, diff)
npm run lint
npm run build
```

## Production

On the VPS (needs Docker + ports 80/443 open):

```bash
git clone <this repo> && cd pdf
echo "AUTH_SECRET=$(openssl rand -base64 32)" > .env
./deploy.sh
```

That's the whole deploy — Caddy fronts everything and the stack serves on
`http://<vps-ip>`. When you buy a domain:

```bash
# 1. point the domain's A record at the VPS IP, then:
echo "SITE_DOMAIN=your-domain.com" >> .env
echo "NEXT_PUBLIC_SITE_URL=https://your-domain.com" >> .env
./deploy.sh   # Caddy provisions Let's Encrypt TLS automatically
```

Re-run `./deploy.sh` after any code update. Monitor `GET /api/health`;
sitemap at `/sitemap.xml`.

## Architecture

- `src/lib/tools/registry.ts` — every tool is a `ToolDefinition`; the generic
  UI (upload → options → run → download) is driven entirely by these entries.
  Adding a tool = one definition + one processor function.
- `src/lib/engine-client/` — pdf-lib/pdfjs implementations; pdf-lib ops run in
  a Web Worker (`src/workers/pdf.worker.ts`), rendering runs on the main thread.
- `src/lib/engine-server/` — `execFile` wrappers for Ghostscript, qpdf,
  ocrmypdf, LibreOffice, plus the Gotenberg HTTP client.
- `src/app/api/jobs/` — upload (validated by magic bytes, rate-limited,
  tier-quota'd) → BullMQ → `src/worker/index.ts` → poll → download.
- Quotas: anonymous 10 jobs/day (50 MB/file), signed-in 50/day (100 MB/file),
  enforced in Redis. Client-side tools are unlimited.

## Security properties

- Server files stored under synthetic UUID paths, deleted after 1 hour.
- Uploads validated by magic bytes, never by extension alone.
- All engine shell-outs use argument arrays (`execFile`) — no shell strings.
- Internal error details stay in worker logs; users see friendly messages.
- No secrets in the repo — runtime config only via env.

## Not yet built

Stripe/premium billing, i18n, S3/R2 storage backend (single-host disk storage
today), cryptographic signatures (signing is visual), OCR-in-editor (editing
scanned/image-only PDFs inline). PDF→Excel is heuristic (text-layer table
detection), so complex layouts may need cleanup.
