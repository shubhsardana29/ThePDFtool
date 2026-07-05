export interface EngineFile {
  name: string;
  /** Raw file bytes. Transferred (not copied) to and from the worker. */
  data: Uint8Array;
  mime: string;
}

export type EngineOptions = Record<string, unknown>;

export type EngineOp = (
  files: EngineFile[],
  options: EngineOptions,
) => Promise<EngineFile[]>;
