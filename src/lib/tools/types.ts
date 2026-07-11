import { z } from "zod";

export type ToolRuntime = "client" | "server";

export type ToolCategory =
  | "organize"
  | "optimize"
  | "convert"
  | "edit"
  | "security";

/** UI metadata for one option field, rendered by OptionsForm. */
export type OptionField =
  | {
      kind: "select";
      key: string;
      label: string;
      choices: { value: string; label: string }[];
    }
  | { kind: "text"; key: string; label: string; placeholder?: string }
  | { kind: "password"; key: string; label: string }
  | {
      kind: "number";
      key: string;
      label: string;
      min?: number;
      max?: number;
      step?: number;
    }
  | { kind: "checkbox"; key: string; label: string };

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  /** react-dropzone accept map, e.g. { "application/pdf": [".pdf"] } */
  accept: Record<string, string[]>;
  minFiles: number;
  maxFiles: number;
  runtime: ToolRuntime;
  /** Validates the options object before the tool runs. */
  optionsSchema: z.ZodType;
  /** Default option values; also the initial form state. */
  defaultOptions: Record<string, unknown>;
  optionFields: OptionField[];
  /** Tools with bespoke UIs (e.g. page-thumbnail reordering) name them here. */
  customUI?:
    | "organize"
    | "edit"
    | "sign"
    | "compare"
    | "redact"
    | "fillform"
    | "crop"
    | "metadata"
    | "replaceimage"
    | "visualcompare"
    | "annotate"
    | "pipeline";
}

export const PDF_ACCEPT: Record<string, string[]> = {
  "application/pdf": [".pdf"],
};

export const IMAGE_ACCEPT: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};

export const OFFICE_ACCEPT: Record<string, string[]> = {
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-powerpoint": [".ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "application/vnd.oasis.opendocument.text": [".odt"],
  "application/vnd.oasis.opendocument.spreadsheet": [".ods"],
  "application/vnd.oasis.opendocument.presentation": [".odp"],
};

export const HTML_ACCEPT: Record<string, string[]> = {
  "text/html": [".html", ".htm"],
};
