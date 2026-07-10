import path from "node:path";
import { run } from "./exec";
import { outBase, type ServerOp } from "./types";

export const protect: ServerOp = async ({ files, outDir, options }) => {
  const password = String(options.password ?? "");
  const outputs: string[] = [];
  for (const file of files) {
    const name = `${outBase(file.original)}-protected.pdf`;
    await run(
      "qpdf",
      [
        "--encrypt",
        password,
        password, // owner password = user password
        "256",
        "--",
        file.path,
        path.join(outDir, name),
      ],
      { friendly: "Could not encrypt this PDF — it may be corrupt" },
    );
    outputs.push(name);
  }
  return outputs;
};

export const linearize: ServerOp = async ({ files, outDir }) => {
  const outputs: string[] = [];
  for (const file of files) {
    const name = `${outBase(file.original)}-web-optimized.pdf`;
    await run(
      "qpdf",
      [
        "--linearize", // fast web view: reorder for progressive loading
        "--object-streams=generate", // compact the object structure
        file.path,
        path.join(outDir, name),
      ],
      { friendly: "Could not optimize this PDF — it may be corrupt" },
    );
    outputs.push(name);
  }
  return outputs;
};

export const unlock: ServerOp = async ({ files, outDir, options }) => {
  const password = String(options.password ?? "");
  const outputs: string[] = [];
  for (const file of files) {
    const name = `${outBase(file.original)}-unlocked.pdf`;
    await run(
      "qpdf",
      [
        `--password=${password}`,
        "--decrypt",
        file.path,
        path.join(outDir, name),
      ],
      { friendly: "Could not unlock — wrong password or the file is corrupt" },
    );
    outputs.push(name);
  }
  return outputs;
};
