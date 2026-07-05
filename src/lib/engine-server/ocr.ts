import path from "node:path";
import { run } from "./exec";
import { outBase, type ServerOp } from "./types";

// Must match the tesseract language packs installed in docker/worker/Dockerfile.
const LANGS = new Set(["eng", "deu", "fra", "spa", "hin"]);

export const ocr: ServerOp = async ({ files, outDir, options }) => {
  const lang = LANGS.has(String(options.language)) ? String(options.language) : "eng";
  const outputs: string[] = [];
  for (const file of files) {
    const name = `${outBase(file.original)}-ocr.pdf`;
    await run(
      "ocrmypdf",
      [
        "--skip-text", // pages that already have text pass through untouched
        "--language",
        lang,
        "--output-type",
        "pdf",
        file.path,
        path.join(outDir, name),
      ],
      { friendly: "OCR failed — the PDF may be corrupt or password-protected" },
    );
    outputs.push(name);
  }
  return outputs;
};
