"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { PDFDocument } from "pdf-lib";
import { downloadFile } from "@/lib/engine-client/download";
import { runClientTool } from "@/lib/engine-client/run";
import { getTool } from "@/lib/tools/registry";
import { PDF_ACCEPT } from "@/lib/tools/types";
import { PrivacyBadge } from "@/components/PrivacyBadge";

interface Loaded {
  name: string;
  data: Uint8Array;
}

interface Fields {
  title: string;
  author: string;
  subject: string;
  keywords: string;
}

const FIELD_LABELS: { key: keyof Fields; label: string; placeholder: string }[] = [
  { key: "title", label: "Title", placeholder: "Document title" },
  { key: "author", label: "Author", placeholder: "Author name" },
  { key: "subject", label: "Subject", placeholder: "What the document is about" },
  { key: "keywords", label: "Keywords", placeholder: "comma, separated, keywords" },
];

export function MetadataTool() {
  const [pdf, setPdf] = useState<Loaded | null>(null);
  const [fields, setFields] = useState<Fields>({ title: "", author: "", subject: "", keywords: "" });
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const doc = await PDFDocument.load(data, { updateMetadata: false });
      setFields({
        title: doc.getTitle() ?? "",
        author: doc.getAuthor() ?? "",
        subject: doc.getSubject() ?? "",
        keywords: doc.getKeywords() ?? "",
      });
      setPdf({ name: file.name, data });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const onDrop = useCallback((accepted: File[]) => accepted[0] && load(accepted[0]), [load]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: PDF_ACCEPT,
    maxFiles: 1,
  });

  async function apply() {
    if (!pdf) return;
    setApplying(true);
    setError(null);
    try {
      const [out] = await runClientTool(
        getTool("edit-metadata")!,
        [{ name: pdf.name, data: pdf.data.slice(), mime: "application/pdf" }],
        { ...fields },
      );
      downloadFile(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(false);
    }
  }

  if (!pdf) {
    return (
      <div className="flex flex-col gap-4">
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
            isDragActive
              ? "border-red-400 bg-red-50 dark:bg-red-950/30"
              : "border-zinc-300 hover:border-red-300 dark:border-zinc-700"
          }`}
        >
          <input {...getInputProps({ style: { display: "none" } })} />
          <p className="text-lg font-medium">
            {loading ? "Loading PDF…" : "Drop a PDF here, or click to select"}
          </p>
          <p className="mt-4">
            <PrivacyBadge />
          </p>
        </div>
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <p className="text-sm text-zinc-500">
        Editing metadata for <span className="font-medium text-zinc-700 dark:text-zinc-300">{pdf.name}</span>.
        Current values are pre-filled — change any of them and download.
      </p>
      <div className="flex flex-col gap-3">
        {FIELD_LABELS.map(({ key, label, placeholder }) => (
          <label key={key} className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{label}</span>
            <input
              type="text"
              value={fields[key]}
              placeholder={placeholder}
              onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
              className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={apply}
          disabled={applying}
          className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40"
        >
          {applying ? "Applying…" : "Apply & download"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPdf(null);
            setError(null);
          }}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Start over
        </button>
      </div>
    </div>
  );
}
