# Job worker image: Node + the PDF processing engines.
# The project directory is bind-mounted at /app by docker-compose, so this
# image only provides the runtime — code changes don't require a rebuild.
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript \
    qpdf \
    ocrmypdf \
    tesseract-ocr-eng \
    tesseract-ocr-deu \
    tesseract-ocr-fra \
    tesseract-ocr-spa \
    tesseract-ocr-hin \
    libreoffice-writer \
    libreoffice-impress \
    libreoffice-draw \
    fonts-liberation \
    fonts-dejavu \
  && rm -rf /var/lib/apt/lists/*

# LibreOffice and ocrmypdf need a writable HOME; run as the unprivileged
# node user (uid 1000, matching the host user on the bind mount).
ENV HOME=/tmp
USER node
WORKDIR /app

CMD ["npx", "tsx", "watch", "src/worker/index.ts"]
