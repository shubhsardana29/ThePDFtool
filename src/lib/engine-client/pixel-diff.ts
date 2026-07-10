/**
 * Per-pixel image diff for the visual-compare tool. Pure (operates on raw RGBA
 * arrays, no DOM) so it's unit-testable; the tool wraps canvas ImageData around
 * it. Changed pixels are painted red over a dimmed grayscale of the original,
 * so differences pop against a faded background.
 */
export interface PixelDiffResult {
  /** Number of pixels that differ beyond the threshold. */
  changed: number;
  /** Total pixels compared. */
  total: number;
  /** RGBA output: red where changed, faded gray elsewhere. */
  out: Uint8ClampedArray;
}

export function diffPixels(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 24,
): PixelDiffResult {
  const total = width * height;
  const out = new Uint8ClampedArray(total * 4);
  let changed = 0;
  for (let i = 0; i < total; i++) {
    const o = i * 4;
    const delta =
      Math.abs(a[o] - b[o]) + Math.abs(a[o + 1] - b[o + 1]) + Math.abs(a[o + 2] - b[o + 2]);
    if (delta > threshold) {
      changed++;
      out[o] = 220;
      out[o + 1] = 30;
      out[o + 2] = 30;
      out[o + 3] = 255;
    } else {
      // Faded grayscale of the original so unchanged content is still legible.
      const g = (a[o] + a[o + 1] + a[o + 2]) / 3;
      const v = 170 + g * 0.33;
      out[o] = v;
      out[o + 1] = v;
      out[o + 2] = v;
      out[o + 3] = 255;
    }
  }
  return { changed, total, out };
}

/** Percentage of pixels changed, rounded to two decimals. */
export function changedPercent(r: PixelDiffResult): number {
  return r.total === 0 ? 0 : Math.round((r.changed / r.total) * 10000) / 100;
}
