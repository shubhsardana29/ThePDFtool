import { describe, expect, it } from "vitest";
import { changedPercent, diffPixels } from "./pixel-diff";

function solid(w: number, h: number, rgb: [number, number, number]): Uint8ClampedArray {
  const a = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    a[i * 4] = rgb[0];
    a[i * 4 + 1] = rgb[1];
    a[i * 4 + 2] = rgb[2];
    a[i * 4 + 3] = 255;
  }
  return a;
}

describe("diffPixels", () => {
  it("reports zero changes for identical images", () => {
    const a = solid(4, 4, [10, 20, 30]);
    const b = solid(4, 4, [10, 20, 30]);
    const r = diffPixels(a, b, 4, 4);
    expect(r.changed).toBe(0);
    expect(r.total).toBe(16);
    expect(changedPercent(r)).toBe(0);
  });

  it("flags every pixel when images differ beyond threshold", () => {
    const a = solid(4, 4, [0, 0, 0]);
    const b = solid(4, 4, [255, 255, 255]);
    const r = diffPixels(a, b, 4, 4);
    expect(r.changed).toBe(16);
    expect(changedPercent(r)).toBe(100);
    // Changed pixels are painted red.
    expect([r.out[0], r.out[1], r.out[2]]).toEqual([220, 30, 30]);
  });

  it("ignores tiny differences below the threshold", () => {
    const a = solid(2, 2, [100, 100, 100]);
    const b = solid(2, 2, [105, 100, 100]); // delta 5 < 24
    expect(diffPixels(a, b, 2, 2).changed).toBe(0);
  });

  it("counts a partial change and computes percent", () => {
    const a = solid(2, 2, [0, 0, 0]);
    const b = solid(2, 2, [0, 0, 0]);
    // Flip one of the four pixels to white.
    b[0] = 255;
    b[1] = 255;
    b[2] = 255;
    const r = diffPixels(a, b, 2, 2);
    expect(r.changed).toBe(1);
    expect(changedPercent(r)).toBe(25);
  });
});
