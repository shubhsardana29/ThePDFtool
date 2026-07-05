import { execFile } from "node:child_process";
import { EXEC_TIMEOUT_MS } from "@/lib/server/config";
import { UserFacingError } from "./types";

/**
 * Run an external engine binary. Always argument arrays via execFile — never
 * a shell string — because filenames and options are attacker-controlled.
 */
export function run(
  bin: string,
  args: string[],
  opts: { env?: NodeJS.ProcessEnv; friendly: string },
): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      args,
      {
        timeout: EXEC_TIMEOUT_MS,
        maxBuffer: 16 * 1024 * 1024,
        env: opts.env ?? process.env,
      },
      (err, _stdout, stderr) => {
        if (!err) return resolve();
        console.error(`[engine] ${bin} failed:`, stderr.slice(-2000) || err.message);
        // Surface a user-safe message; details stay in the worker log.
        reject(new UserFacingError(opts.friendly));
      },
    );
  });
}
