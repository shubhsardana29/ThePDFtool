import path from "node:path";
import { run } from "./exec";
import { outBase, type ServerOp } from "./types";

const PRESETS: Record<string, string> = {
  extreme: "/screen",
  recommended: "/ebook",
  light: "/prepress",
};

async function gs(args: string[], outPath: string, inPath: string, friendly: string) {
  await run(
    "gs",
    [
      "-dSAFER",
      "-dNOPAUSE",
      "-dBATCH",
      "-dQUIET",
      "-sDEVICE=pdfwrite",
      ...args,
      "-o",
      outPath,
      inPath,
    ],
    { friendly },
  );
}

export const compress: ServerOp = async ({ files, outDir, options }) => {
  const preset = PRESETS[String(options.level)] ?? PRESETS.recommended;
  const outputs: string[] = [];
  for (const file of files) {
    const name = `${outBase(file.original)}-compressed.pdf`;
    await gs(
      ["-dCompatibilityLevel=1.5", `-dPDFSETTINGS=${preset}`],
      path.join(outDir, name),
      file.path,
      "Compression failed — the PDF may be corrupt or password-protected",
    );
    outputs.push(name);
  }
  return outputs;
};

/** Rewriting through pdfwrite fixes broken xref tables and stream errors. */
export const repair: ServerOp = async ({ files, outDir }) => {
  const outputs: string[] = [];
  for (const file of files) {
    const name = `${outBase(file.original)}-repaired.pdf`;
    await gs(
      [],
      path.join(outDir, name),
      file.path,
      "Repair failed — the file is too damaged to reconstruct",
    );
    outputs.push(name);
  }
  return outputs;
};

export const pdfa: ServerOp = async ({ files, outDir }) => {
  const outputs: string[] = [];
  for (const file of files) {
    const name = `${outBase(file.original)}-pdfa.pdf`;
    await gs(
      [
        "-dPDFA=2",
        "-dPDFACompatibilityPolicy=1",
        "-sColorConversionStrategy=RGB",
      ],
      path.join(outDir, name),
      file.path,
      "PDF/A conversion failed — the PDF may be corrupt or password-protected",
    );
    outputs.push(name);
  }
  return outputs;
};
