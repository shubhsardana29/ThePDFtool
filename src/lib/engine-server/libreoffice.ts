import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { run } from "./exec";
import { UserFacingError, outBase, type ServerOp } from "./types";

/**
 * PDF → Office via headless LibreOffice. Best-effort: LibreOffice imports the
 * PDF through its pdfimport filter, so complex layouts lose fidelity — the
 * tool descriptions say as much in the UI.
 */
async function pdfTo(
  target: "docx" | "pptx",
  infilter: string,
  inPath: string,
  original: string,
  outDir: string,
): Promise<string> {
  // Each invocation gets its own profile dir — concurrent soffice processes
  // sharing a profile deadlock on the profile lock.
  const work = path.join(tmpdir(), `soffice-${randomUUID()}`);
  await mkdir(work, { recursive: true });
  try {
    // soffice names its output after the input file; copy in under the
    // desired base name so the output name is predictable and safe.
    const base = outBase(original);
    const staged = path.join(work, `${base}.pdf`);
    await copyFile(inPath, staged);
    await run(
      "soffice",
      [
        "--headless",
        `-env:UserInstallation=file://${work}/profile`,
        `--infilter=${infilter}`,
        "--convert-to",
        target,
        "--outdir",
        work,
        staged,
      ],
      {
        friendly:
          "Conversion failed — this PDF could not be imported (scanned PDFs need OCR first)",
      },
    );
    const produced = (await readdir(work)).find((f) => f.endsWith(`.${target}`));
    if (!produced) {
      throw new UserFacingError(
        "Conversion produced no output — the PDF may be empty or unsupported",
      );
    }
    const name = `${base}.${target}`;
    // copy, not rename — /tmp and the storage mount are different filesystems
    await copyFile(path.join(work, produced), path.join(outDir, name));
    return name;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

export const pdfToWord: ServerOp = async ({ files, outDir }) => {
  const outputs: string[] = [];
  for (const file of files) {
    outputs.push(await pdfTo("docx", "writer_pdf_import", file.path, file.original, outDir));
  }
  return outputs;
};

export const pdfToPowerpoint: ServerOp = async ({ files, outDir }) => {
  const outputs: string[] = [];
  for (const file of files) {
    outputs.push(await pdfTo("pptx", "impress_pdf_import", file.path, file.original, outDir));
  }
  return outputs;
};
