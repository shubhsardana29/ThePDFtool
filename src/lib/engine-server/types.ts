/** An error whose message is safe to show to the end user verbatim. */
export class UserFacingError extends Error {}

export interface ServerOpInput {
  /** Absolute path on disk. */
  path: string;
  /** Sanitized original upload name (for deriving output names). */
  original: string;
}

export interface ServerOpContext {
  files: ServerOpInput[];
  outDir: string;
  options: Record<string, unknown>;
}

/** Writes outputs into ctx.outDir and returns their filenames. */
export type ServerOp = (ctx: ServerOpContext) => Promise<string[]>;

export function outBase(original: string): string {
  return original.replace(/\.[^.]+$/, "") || "document";
}
