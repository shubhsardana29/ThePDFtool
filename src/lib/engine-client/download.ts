import { zipSync } from "fflate";
import type { EngineFile } from "./types";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadFile(file: EngineFile) {
  triggerDownload(
    new Blob([file.data.slice() as Uint8Array<ArrayBuffer>], {
      type: file.mime,
    }),
    file.name,
  );
}

/** One file downloads directly; several download as a single zip. */
export function downloadAll(files: EngineFile[], zipName: string) {
  if (files.length === 1) {
    downloadFile(files[0]);
    return;
  }
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) entries[file.name] = file.data;
  const zipped = zipSync(entries, { level: 6 });
  triggerDownload(
    new Blob([zipped as Uint8Array<ArrayBuffer>], { type: "application/zip" }),
    zipName,
  );
}
