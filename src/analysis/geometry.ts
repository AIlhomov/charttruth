import type { Bar, GeometryResult } from "./types";

/** Original connected-component rectangle detector. No model or sample metadata. */
export function detectGeometry(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): GeometryResult {
  if (pixels.length !== width * height * 4)
    throw new Error("Invalid image pixels.");
  const count = width * height;
  const mask = new Uint8Array(count);
  const rowLines = new Uint32Array(height);
  for (let i = 0; i < count; i++) {
    const p = i * 4;
    const r = pixels[p],
      g = pixels[p + 1],
      b = pixels[p + 2];
    const maximum = Math.max(r, g, b),
      minimum = Math.min(r, g, b);
    // Keep solid coloured and dark neutral fills. Pale gridlines and white paper stay out.
    if (
      pixels[p + 3] > 160 &&
      ((maximum - minimum > 28 && minimum < 225) || maximum < 155)
    )
      mask[i] = 1;
    if (maximum - minimum < 24 && maximum < 245 && minimum > 145)
      rowLines[Math.floor(i / width)]++;
  }
  const stack = new Int32Array(count);
  const candidates: Bar[] = [];
  for (let seed = 0; seed < count; seed++) {
    if (mask[seed] !== 1) continue;
    let length = 0,
      area = 0;
    stack[length++] = seed;
    mask[seed] = 2;
    let x0 = width,
      y0 = height,
      x1 = 0,
      y1 = 0,
      sumR = 0,
      sumG = 0,
      sumB = 0;
    while (length > 0) {
      const i = stack[--length],
        x = i % width,
        y = Math.floor(i / width);
      area++;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      sumR += pixels[i * 4];
      sumG += pixels[i * 4 + 1];
      sumB += pixels[i * 4 + 2];
      const visit = (next: number) => {
        if (mask[next] === 1) {
          mask[next] = 2;
          stack[length++] = next;
        }
      };
      if (x > 0) visit(i - 1);
      if (x < width - 1) visit(i + 1);
      if (y > 0) visit(i - width);
      if (y < height - 1) visit(i + width);
    }
    const w = x1 - x0 + 1,
      h = y1 - y0 + 1,
      fill = area / (w * h);
    if (
      w >= Math.max(9, width * 0.012) &&
      w < width * 0.23 &&
      h >= Math.max(5, height * 0.018) &&
      fill > 0.87 &&
      y0 > height * 0.08 &&
      y1 < height * 0.93
    ) {
      candidates.push({
        x: x0,
        y: y0,
        width: w,
        height: h,
        fill,
        color: `rgb(${Math.round(sumR / area)},${Math.round(sumG / area)},${Math.round(sumB / area)})`,
      });
    }
  }
  if (candidates.length < 2)
    throw new Error(
      "We could not find a set of solid vertical bars. Try a flat, single-series bar chart on a light background. Line, pie, stacked and 3D charts need manual entry.",
    );
  // A shared lower edge is necessary for a quantitative vertical bar series.
  const tolerance = Math.max(3, height * 0.009);
  const groups = candidates.map((anchor) =>
    candidates.filter(
      (b) => Math.abs(b.y + b.height - anchor.y - anchor.height) <= tolerance,
    ),
  );
  groups.sort(
    (a, b) =>
      b.length - a.length ||
      b.reduce((s, v) => s + v.width * v.height, 0) -
        a.reduce((s, v) => s + v.width * v.height, 0),
  );
  const bars = groups[0].sort((a, b) => a.x - b.x);
  if (bars.length < 2 || bars.length > 16)
    throw new Error(
      "A shared baseline for 2–16 bars could not be established. Crop to one single-series vertical bar chart, or enter values manually.",
    );
  const widths = bars.map((b) => b.width).sort((a, b) => a - b);
  const medianWidth = widths[Math.floor(widths.length / 2)];
  if (
    bars.some((b) => Math.abs(b.width / medianWidth - 1) > 0.3) ||
    bars.some((b, i) => i > 0 && b.x < bars[i - 1].x + bars[i - 1].width)
  ) {
    throw new Error(
      "Bar geometry is ambiguous: widths or overlaps do not match a standard single-series chart. Enter values manually instead.",
    );
  }
  // Components aligned above a detected bar suggest stacks, which must not be flattened.
  if (
    candidates.some(
      (c) =>
        !bars.includes(c) &&
        bars.some(
          (b) =>
            Math.abs(c.x - b.x) < 4 &&
            Math.abs(c.width - b.width) < 4 &&
            c.y + c.height <= b.y + 4,
        ),
    )
  ) {
    throw new Error(
      "Stacked bars may be present. Automatic extraction is limited to single-series vertical bars. Use manual entry for this chart.",
    );
  }
  // Touching coloured stacks can form one rectangular component. Their interior colours reveal the ambiguity.
  for (const bar of bars) {
    const centerX = Math.floor(bar.x + bar.width / 2);
    const samples: number[][] = [];
    for (let fraction = 0.15; fraction < 0.95; fraction += 0.15) {
      const p =
        (Math.floor(bar.y + bar.height * fraction) * width + centerX) * 4;
      samples.push([pixels[p], pixels[p + 1], pixels[p + 2]]);
    }
    if (
      samples.some((a) =>
        samples.some(
          (b) =>
            Math.abs(a[0] - b[0]) +
              Math.abs(a[1] - b[1]) +
              Math.abs(a[2] - b[2]) >
            100,
        ),
      )
    ) {
      throw new Error(
        "Multiple fills or gradients were found inside the bars. Stacked, patterned and gradient bars are outside automatic scope; use manual entry.",
      );
    }
  }
  const horizontalLines: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    if (
      rowLines[y] > width * 0.4 &&
      (horizontalLines.length === 0 ||
        y - horizontalLines[horizontalLines.length - 1] > 3)
    )
      horizontalLines.push(y);
  }
  return { bars, horizontalLines };
}
