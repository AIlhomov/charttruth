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
  const hue = new Float32Array(count);
  const chromatic = new Uint8Array(count);
  const rowLines = new Uint32Array(height);
  for (let i = 0; i < count; i++) {
    const p = i * 4;
    const r = pixels[p],
      g = pixels[p + 1],
      b = pixels[p + 2];
    const maximum = Math.max(r, g, b),
      minimum = Math.min(r, g, b);
    const delta = maximum - minimum;
    // Relative saturation excludes pale tinted paper, while retaining shaded
    // coloured bars. Hue-aware components keep bars apart from touching axes.
    const colored =
      delta > 12 &&
      (delta / Math.max(1, maximum) > 0.3 || (maximum < 205 && minimum < 150));
    if (pixels[p + 3] > 160 && ((colored && minimum < 205) || maximum < 155)) {
      mask[i] = 1;
      if (colored) {
        chromatic[i] = 1;
        let angle =
          maximum === r
            ? (g - b) / delta
            : maximum === g
              ? (b - r) / delta + 2
              : (r - g) / delta + 4;
        hue[i] = (angle * 60 + 360) % 360;
      }
    }
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
          if (chromatic[next] !== chromatic[seed]) return;
          if (chromatic[seed]) {
            const difference = Math.abs(hue[next] - hue[seed]);
            if (Math.min(difference, 360 - difference) > 18) return;
          } else {
            // Separate dark ink from lighter gray bars when they touch.
            if (Math.abs(pixels[next * 4] - pixels[seed * 4]) > 50) return;
          }
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
      "We could not reliably isolate solid vertical bars in this image. Low contrast, textured backgrounds or connected shapes can prevent detection. Try a tighter crop of a single-series vertical bar chart, or enter values manually.",
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
  // Abrupt interior colour steps indicate stacks. Smooth shading can change
  // brightness substantially across a bar without introducing a segment break.
  for (const bar of bars) {
    const centerX = Math.floor(bar.x + bar.width / 2);
    const samples: number[][] = [];
    const inset = Math.min(
      Math.max(3, bar.height * 0.02),
      Math.floor((bar.height - 1) / 3),
    );
    for (let fraction = 0.15; fraction < 0.95; fraction += 0.15) {
      const sampleY = Math.floor(
        Math.max(
          bar.y + inset,
          Math.min(
            bar.y + bar.height - 1 - inset,
            bar.y + bar.height * fraction,
          ),
        ),
      );
      const p = (sampleY * width + centerX) * 4;
      samples.push([pixels[p], pixels[p + 1], pixels[p + 2]]);
    }
    if (
      samples.some(
        (a, index) =>
          index > 0 &&
          a.reduce(
            (sum, channel, c) =>
              sum + Math.abs(channel - samples[index - 1][c]),
            0,
          ) > 70,
      )
    ) {
      throw new Error(
        "Multiple fills with abrupt colour changes were found inside the bars. Stacked or strongly patterned bars are outside automatic scope; use manual entry.",
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
  // A long dark vertical spine can locate short tick marks even when there
  // are no full-width gridlines. Their pixels anchor OCR boxes, not values.
  const leftBar = Math.min(...bars.map((b) => b.x));
  const bottom = Math.max(...bars.map((b) => b.y + b.height));
  const top = Math.min(...bars.map((b) => b.y));
  const ink = (x: number, y: number) => {
    const p = (y * width + x) * 4;
    return Math.max(pixels[p], pixels[p + 1], pixels[p + 2]) < 140;
  };
  const spineColumns: number[] = [];
  let axisLabelRight: number | undefined;
  for (
    let x = Math.max(0, Math.floor(leftBar - medianWidth * 4));
    x < leftBar - medianWidth * 0.3;
    x++
  ) {
    let dark = 0;
    for (let y = top; y < bottom; y++) if (ink(x, y)) dark++;
    if (dark >= (bottom - top) * 0.85) spineColumns.push(x);
  }
  if (spineColumns.length) {
    let axisLeft = spineColumns[spineColumns.length - 1];
    for (
      let i = spineColumns.length - 2;
      i >= 0 && axisLeft - spineColumns[i] <= 2;
      i--
    )
      axisLeft = spineColumns[i];
    const reach = Math.max(5, Math.min(30, medianWidth * 0.3));
    const tickLengths: number[] = [];
    const tickRows: {
      first: number;
      last: number;
      sum: number;
      weight: number;
    }[] = [];
    for (
      let y = Math.max(0, Math.floor(top - height * 0.2));
      y < Math.min(height, bottom + 5);
      y++
    ) {
      // Tick ink must connect to the spine. Nearby number glyphs are not ticks.
      let dark = 0;
      for (
        let x = axisLeft - 3;
        x >= Math.max(0, Math.floor(axisLeft - reach));
        x--
      ) {
        if (!ink(x, y)) break;
        dark++;
      }
      if (dark < 4) continue;
      tickLengths.push(dark + 2);
      const previous = tickRows[tickRows.length - 1];
      if (previous && y - previous.last <= 2) {
        previous.last = y;
        previous.sum += y * dark;
        previous.weight += dark;
      } else tickRows.push({ first: y, last: y, sum: y * dark, weight: dark });
    }
    for (const row of tickRows)
      if (row.last - row.first < Math.max(8, height * 0.015))
        horizontalLines.push(Math.round(row.sum / row.weight));
    if (tickLengths.length) {
      tickLengths.sort((a, b) => a - b);
      axisLabelRight =
        axisLeft - tickLengths[Math.floor(tickLengths.length / 2)] - 3;
    }
    // An x-axis need not extend left of the spine like the other tick marks.
    // Anchor a baseline label only if a continuous dark row is actually visible.
    const axisRight = Math.max(...bars.map((b) => b.x + b.width));
    const baselineRows: number[] = [];
    for (
      let y = Math.max(0, bottom - 4);
      y < Math.min(height, bottom + 5);
      y++
    ) {
      let dark = 0;
      for (let x = axisLeft; x < axisRight; x++) if (ink(x, y)) dark++;
      if (dark > (axisRight - axisLeft) * 0.9) baselineRows.push(y);
    }
    if (baselineRows.length) {
      const baseline = Math.round(
        baselineRows.reduce((a, y) => a + y, 0) / baselineRows.length,
      );
      horizontalLines.push(baseline);
      // Thick axis ink can cover the final bar pixels. Use its measured centre
      // as the shared lower edge rather than interpreting the stroke as data.
      for (const bar of bars)
        if (Math.abs(bar.y + bar.height - baseline) <= tolerance)
          bar.height = baseline - bar.y;
    }
  }
  horizontalLines.sort((a, b) => a - b);
  return {
    bars,
    axisLabelRight,
    horizontalLines: horizontalLines.filter(
      (y, i, all) => i === 0 || y - all[i - 1] > 3,
    ),
  };
}
