import type { Bar, Calibration, Datum, Finding, Tick, Word } from "./types";
import { formatValue } from "./types";

export function parseNumeric(input: string): number | null {
  const normalized = input.trim().replace(/[−–]/g, "-");
  if (!/^[$€£]?\s*-?[\d.,]+[kKmMbB]?\s*%?$/.test(normalized)) return null;
  const text = normalized.replace(/[\s$€£%]/g, "");
  if (!/^-?(?:\d+(?:[.,]\d+)*|\.\d+)[kKmMbB]?$/.test(text)) return null;
  const suffix = text.slice(-1).toLowerCase();
  const multiplier =
    suffix === "k" ? 1e3 : suffix === "m" ? 1e6 : suffix === "b" ? 1e9 : 1;
  let body = multiplier !== 1 ? text.slice(0, -1) : text;
  if (body.includes(",")) {
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(body))
      body = body.replace(/,/g, "");
    else if (/^-?\d+,\d{1,2}$/.test(body)) body = body.replace(",", ".");
    else return null;
  }
  const value = Number(body) * multiplier;
  return Number.isFinite(value) ? value : null;
}

export function calibrate(ticks: Tick[], baselineY: number): Calibration {
  if (ticks.length < 3)
    throw new Error(
      "Fewer than three readable y-axis ticks were found. A linear scale cannot be verified. Try a sharper crop or enter values manually.",
    );
  const n = ticks.length,
    meanY = ticks.reduce((s, t) => s + t.y, 0) / n,
    meanV = ticks.reduce((s, t) => s + t.value, 0) / n;
  const covariance = ticks.reduce(
    (s, t) => s + (t.y - meanY) * (t.value - meanV),
    0,
  );
  const variance = ticks.reduce((s, t) => s + (t.y - meanY) ** 2, 0);
  const slope = covariance / variance,
    intercept = meanV - slope * meanY;
  const errors = ticks.map((t) => t.value - (slope * t.y + intercept));
  const sse = errors.reduce((s, v) => s + v * v, 0),
    sst = ticks.reduce((s, t) => s + (t.value - meanV) ** 2, 0);
  const r2 = 1 - sse / sst,
    residual = Math.sqrt(sse / n);
  const range =
    Math.max(...ticks.map((t) => t.value)) -
    Math.min(...ticks.map((t) => t.value));
  if (
    !Number.isFinite(slope) ||
    slope >= 0 ||
    r2 < 0.995 ||
    Math.max(...errors.map(Math.abs)) > range * 0.025
  ) {
    throw new Error(
      "The axis ticks do not support a consistent linear scale. Logarithmic, inverted or irregular axes are unsupported; OCR errors can also cause this. No scale finding has been issued.",
    );
  }
  const yRange =
    Math.max(...ticks.map((t) => t.y)) - Math.min(...ticks.map((t) => t.y));
  if (
    yRange < 40 ||
    baselineY > Math.max(...ticks.map((t) => t.y)) + yRange * 0.15
  )
    throw new Error(
      "Readable ticks do not reach the baseline. A zero-baseline claim would require too much extrapolation. Use manual entry.",
    );
  const uncertainty = Math.max(Math.abs(slope) * 2, residual * 2);
  const rawBaseline = slope * baselineY + intercept;
  const baselineTick = ticks.find(
    (t) =>
      Math.abs(t.y - baselineY) <= 2 &&
      Math.abs(t.value - rawBaseline) <= uncertainty,
  );
  const baseline =
    Math.abs(rawBaseline) <= uncertainty
      ? 0
      : (baselineTick?.value ?? rawBaseline);
  return { slope, intercept, r2, residual, uncertainty, baseline, ticks };
}

export function axisTicks(words: Word[], bars: Bar[], lines: number[]): Tick[] {
  const left = Math.min(...bars.map((b) => b.x)),
    bottom = Math.max(...bars.map((b) => b.y + b.height));
  const candidates = words.filter(
    (w) =>
      w.box.x + w.box.width < left - 3 &&
      w.box.y < bottom + 20 &&
      w.confidence >= 45 &&
      parseNumeric(w.text) !== null,
  );
  // Cluster by the right-aligned tick edge. Avoid numeric notes in the page margin.
  const groups = candidates.map((anchor) =>
    candidates.filter(
      (w) =>
        Math.abs(w.box.x + w.box.width - anchor.box.x - anchor.box.width) < 18,
    ),
  );
  groups.sort(
    (a, b) =>
      b.length - a.length ||
      Math.max(...b.map((w) => w.box.x)) - Math.max(...a.map((w) => w.box.x)),
  );
  return (groups[0] || [])
    .map((w) => {
      const center = w.box.y + w.box.height / 2;
      const nearby = lines.filter(
        (y) => Math.abs(y - center) <= Math.max(6, w.box.height / 2),
      );
      const y = nearby.length
        ? nearby.sort((a, b) => Math.abs(a - center) - Math.abs(b - center))[0]
        : center;
      return {
        value: parseNumeric(w.text)!,
        y,
        text: w.text,
        confidence: w.confidence,
        box: w.box,
      };
    })
    .sort((a, b) => b.y - a.y)
    .filter((t, i, all) => i === 0 || Math.abs(t.y - all[i - 1].y) > 6);
}

export function extractData(
  words: Word[],
  bars: Bar[],
  calibration: Calibration,
): Datum[] {
  const baselineY = Math.max(...bars.map((b) => b.y + b.height));
  return bars.map((bar, i) => {
    const center = bar.x + bar.width / 2;
    const labels = words
      .filter(
        (w) =>
          w.box.y > baselineY + 4 &&
          w.box.y < baselineY + 65 &&
          Math.abs(w.box.x + w.box.width / 2 - center) < bar.width * 0.9,
      )
      .sort((a, b) => a.box.x - b.box.x);
    const printed = words
      .filter(
        (w) =>
          parseNumeric(w.text) !== null &&
          w.confidence >= 70 &&
          Math.abs(w.box.x + w.box.width / 2 - center) < bar.width * 0.65 &&
          w.box.y + w.box.height <= bar.y + 4 &&
          bar.y - w.box.y - w.box.height < 45,
      )
      .sort((a, b) => b.box.y - a.box.y)[0];
    const geometryValue = calibration.slope * bar.y + calibration.intercept;
    const printedValue = printed ? parseNumeric(printed.text)! : undefined;
    return {
      id: `bar-${i}`,
      label: labels.map((w) => w.text).join(" ") || `Bar ${i + 1}`,
      value: printedValue ?? Number(geometryValue.toFixed(2)),
      geometryValue,
      printedValue,
      valueConfidence: printed?.confidence,
      labelConfidence: labels.length
        ? Math.min(...labels.map((w) => w.confidence))
        : undefined,
      uncertainty: calibration.uncertainty,
      source: printed ? "printed" : "geometry",
      bar,
    };
  });
}

export function hasUnmatchedCategories(
  words: Word[],
  bars: Bar[],
  axisRight: number,
): boolean {
  const baseline = Math.max(...bars.map((b) => b.y + b.height));
  return words.some(
    (w) =>
      w.confidence >= 70 &&
      w.box.x > axisRight + 5 &&
      w.box.y > baseline + 4 &&
      w.box.y < baseline + 65 &&
      !bars.some(
        (b) =>
          Math.abs(w.box.x + w.box.width / 2 - b.x - b.width / 2) <
          b.width * 0.9,
      ),
  );
}

export function makeFindings(
  data: Datum[],
  calibration: Calibration,
): Finding[] {
  const baseline = calibration.baseline,
    nonzero = baseline > calibration.uncertainty;
  const findings: Finding[] = [
    {
      id: "baseline",
      level: nonzero ? "caution" : "good",
      title: nonzero
        ? "The vertical axis starts above zero"
        : "A zero baseline is supported",
      detail: nonzero
        ? `The detected bar baseline maps to ${formatValue(baseline)} ± ${formatValue(calibration.uncertainty)} using ${calibration.ticks.length} OCR ticks. Shortened bars can amplify relative differences. The reconstruction starts at zero.`
        : `${calibration.ticks.length} OCR ticks support a baseline within ${formatValue(calibration.uncertainty)} of zero. This check found no evidence of axis truncation.`,
    },
  ];
  const mismatched = data.filter(
    (d) =>
      d.printedValue !== undefined &&
      Math.abs(d.printedValue - d.geometryValue) >
        Math.max(
          d.uncertainty * 2,
          (Math.max(...calibration.ticks.map((t) => t.value)) - baseline) *
            0.03,
        ),
  );
  findings.push(
    mismatched.length
      ? {
          id: "proportions",
          level: "caution",
          title: "Printed values and bar heights disagree",
          detail:
            mismatched
              .map(
                (d) =>
                  `${d.label}: the label reads ${formatValue(d.printedValue!)}; the height maps to ${formatValue(d.geometryValue)} ± ${formatValue(d.uncertainty)}.`,
              )
              .join(" ") +
            " The reconstruction uses printed values; verify them before export.",
        }
      : {
          id: "proportions",
          level: data.some((d) => d.printedValue === undefined)
            ? "info"
            : "good",
          title: data.some((d) => d.printedValue === undefined)
            ? "Values estimated from bar heights"
            : "Bar heights agree with printed values",
          detail: data.some((d) => d.printedValue === undefined)
            ? "Some bars have no readable printed value. Their values are interpolated from the axis; this cannot independently establish proportional accuracy."
            : "Readable labels fall within the geometry tolerance. This checks visible consistency, not the truth of the underlying data.",
        },
  );
  if (
    data.some(
      (d) =>
        d.labelConfidence === undefined ||
        d.labelConfidence < 80 ||
        (d.valueConfidence !== undefined && d.valueConfidence < 80),
    )
  )
    findings.push({
      id: "review",
      level: "info",
      title: "Some text needs a closer look",
      detail:
        "Missing labels are named by bar position. OCR certainty is an engine score, not a probability of correctness. Check the extracted table against the image.",
    });
  return findings;
}

export function validateData(
  rows: { label: string; value: string }[],
): string | null {
  if (rows.length < 2 || rows.length > 16)
    return "Use between 2 and 16 categories.";
  if (rows.some((r) => !r.label.trim() || r.label.trim().length > 48))
    return "Each label needs 1–48 characters.";
  if (
    rows.some(
      (r) =>
        r.value.trim() === "" ||
        !Number.isFinite(Number(r.value)) ||
        Number(r.value) < 0 ||
        Number(r.value) > 1e12,
    )
  )
    return "Values must be finite numbers from 0 to 1,000,000,000,000.";
  if (rows.every((r) => Number(r.value) === 0))
    return "At least one value must be greater than zero.";
  return null;
}
