import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GOTENBERG_URL } from "@/lib/server/config";
import { UserFacingError, outBase, type ServerOp } from "./types";

async function convert(
  route: string,
  fileName: string,
  data: Uint8Array,
  friendly: string,
): Promise<Uint8Array> {
  const form = new FormData();
  form.append("files", new Blob([data as Uint8Array<ArrayBuffer>]), fileName);
  let res: Response;
  try {
    res = await fetch(`${GOTENBERG_URL}${route}`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new UserFacingError("Conversion service is unavailable — try again shortly");
  }
  if (!res.ok) {
    console.error(`[gotenberg] ${route} → ${res.status}:`, await res.text());
    throw new UserFacingError(friendly);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export const officeToPdf: ServerOp = async ({ files, outDir }) => {
  const outputs: string[] = [];
  for (const file of files) {
    const name = `${outBase(file.original)}.pdf`;
    const pdf = await convert(
      "/forms/libreoffice/convert",
      file.original,
      await readFile(file.path),
      "Conversion failed — the document may be corrupt or in an unsupported format",
    );
    await writeFile(path.join(outDir, name), pdf);
    outputs.push(name);
  }
  return outputs;
};

export const htmlToPdf: ServerOp = async ({ files, outDir }) => {
  const [file] = files;
  const name = `${outBase(file.original)}.pdf`;
  // The chromium route requires the entry file to be named index.html.
  const pdf = await convert(
    "/forms/chromium/convert/html",
    "index.html",
    await readFile(file.path),
    "HTML conversion failed — check that the file is valid HTML",
  );
  await writeFile(path.join(outDir, name), pdf);
  return [name];
};
