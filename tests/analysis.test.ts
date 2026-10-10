import { describe, expect, it } from "vitest";
import { detectGeometry } from "../src/analysis/geometry";
import {
  axisTicks,
  calibrate,
  extractData,
  makeFindings,
  parseNumeric,
  validateData,
} from "../src/analysis/calibration";
import { chartDomain, chartSvg } from "../src/charts/render";
import type { Bar, Datum, Tick, Word } from "../src/analysis/types";
import { formatValue } from "../src/analysis/types";

const tick = (value: number, y: number): Tick => ({
  value,
  y,
  text: String(value),
  confidence: 93,
  box: { x: 25, y: y - 5, width: 20, height: 10 },
});
const bars: Bar[] = [
  { x: 100, y: 180, width: 40, height: 120, fill: 1, color: "violet" },
  { x: 200, y: 100, width: 40, height: 200, fill: 1, color: "violet" },
];
const word = (
  text: string,
  x: number,
  y: number,
  width = 20,
  confidence = 94,
): Word => ({ text, confidence, box: { x, y, width, height: 12 } });
function image(
  rectangles: {
    x: number;
    y: number;
    w: number;
    h: number;
    color?: number[];
  }[],
  width = 400,
  height = 300,
) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  pixels.fill(255);
  for (const rect of rectangles)
    for (let y = rect.y; y < rect.y + rect.h; y++)
      for (let x = rect.x; x < rect.x + rect.w; x++)
        pixels.set(
          [...(rect.color ?? [135, 100, 210]), 255],
          (y * width + x) * 4,
        );
  return { pixels, width, height };
}
describe("strict numeric OCR parsing", () => {
  it.each([
    ["1,250", 1250],
    ["14,5%", 14.5],
    ["$1.2k", 1200],
    ["−10", -10],
    ["2M", 2e6],
    ["0", 0],
  ])("parses %s", (input, expected) =>
    expect(parseNumeric(input)).toBe(expected),
  );
  it.each(["1O0", "Chapter 4", "Q1", "1,2,3", "NaN", "Infinity", "10%20"])(
    "rejects %s without guessing",
    (input) => expect(parseNumeric(input)).toBeNull(),
  );
});
describe("geometry from pixels", () => {
  it("measures rectangles while discarding text-sized components", () => {
    const { pixels, width, height } = image([
      { x: 80, y: 100, w: 30, h: 140 },
      { x: 160, y: 60, w: 30, h: 180 },
      { x: 250, y: 75, w: 30, h: 165 },
      { x: 20, y: 30, w: 5, h: 8 },
    ]);
    const result = detectGeometry(pixels, width, height);
    expect(result.bars.map((b) => [b.x, b.y, b.width, b.height])).toEqual([
      [80, 100, 30, 140],
      [160, 60, 30, 180],
      [250, 75, 30, 165],
    ]);
  });
  it("finds independent grayscale bars too", () => {
    const { pixels, width, height } = image([
      { x: 80, y: 100, w: 30, h: 140, color: [80, 80, 80] },
      { x: 160, y: 60, w: 30, h: 180, color: [80, 80, 80] },
    ]);
    expect(detectGeometry(pixels, width, height).bars).toHaveLength(2);
  });
  it("rejects blank or nonrectangular images", () => {
    const { pixels, width, height } = image([]);
    expect(() => detectGeometry(pixels, width, height)).toThrow(
      "solid vertical bars",
    );
  });
  it("rejects unequal bar widths", () => {
    const { pixels, width, height } = image([
      { x: 70, y: 100, w: 20, h: 140 },
      { x: 160, y: 60, w: 60, h: 180 },
    ]);
    expect(() => detectGeometry(pixels, width, height)).toThrow(
      "widths or overlaps",
    );
  });
  it("rejects separated stacked segments", () => {
    const { pixels, width, height } = image([
      { x: 70, y: 160, w: 30, h: 80 },
      { x: 160, y: 140, w: 30, h: 100 },
      { x: 70, y: 70, w: 30, h: 88 },
    ]);
    expect(() => detectGeometry(pixels, width, height)).toThrow("Stacked bars");
  });
  it("rejects touching stacks that otherwise form solid rectangles", () => {
    const { pixels, width, height } = image([
      { x: 70, y: 80, w: 30, h: 160 },
      { x: 160, y: 60, w: 30, h: 180 },
      { x: 70, y: 80, w: 30, h: 70, color: [210, 110, 60] },
    ]);
    expect(() => detectGeometry(pixels, width, height)).toThrow(
      "Multiple fills",
    );
  });
});
describe("calibration and evidence", () => {
  it("maps pixel positions using all ticks and detects a truncated baseline", () => {
    const c = calibrate([tick(90, 300), tick(100, 200), tick(110, 100)], 300);
    expect(c.baseline).toBe(90);
    expect(c.slope).toBe(-0.1);
    expect(c.r2).toBe(1);
    expect(makeFindings([], c)[0].level).toBe("caution");
  });
  it("snaps a baseline to zero only within the measured uncertainty", () => {
    const c = calibrate([tick(0, 301), tick(10, 200), tick(20, 100)], 300);
    expect(c.baseline).toBe(0);
    expect(c.uncertainty).toBeGreaterThan(0);
    expect(makeFindings([], c)[0].level).toBe("good");
  });
  it("does not fabricate a scale from two labels", () =>
    expect(() => calibrate([tick(0, 300), tick(100, 100)], 300)).toThrow(
      "three",
    ));
  it("rejects log and reversed axes", () => {
    expect(() =>
      calibrate([tick(1, 300), tick(10, 200), tick(100, 100)], 300),
    ).toThrow("consistent linear");
    expect(() =>
      calibrate([tick(100, 300), tick(50, 200), tick(0, 100)], 300),
    ).toThrow("consistent linear");
  });
  it("rejects a single inconsistent tick rather than dropping it", () =>
    expect(() =>
      calibrate(
        [
          tick(0, 300),
          tick(25, 250),
          tick(90, 200),
          tick(75, 150),
          tick(100, 100),
        ],
        300,
      ),
    ).toThrow("consistent linear"));
  it("refuses extensive extrapolation to an unseen baseline", () =>
    expect(() =>
      calibrate([tick(50, 200), tick(75, 150), tick(100, 100)], 300),
    ).toThrow("extrapolation"));
  it("anchors OCR tick centers to nearby grid lines", () => {
    const result = axisTicks(
      [
        word("0", 25, 294),
        word("10", 15, 193),
        word("20", 15, 93),
        word("2026", 200, 340),
      ],
      bars,
      [100, 200, 300],
    );
    expect(result.map((t) => t.y)).toEqual([300, 200, 100]);
  });
  it("uses independent printed labels and flags disagreement with geometry", () => {
    const c = calibrate([tick(0, 300), tick(50, 200), tick(100, 100)], 300);
    const data = extractData(
      [
        word("Alpha", 100, 320, 40),
        word("Beta", 200, 320, 40),
        word("60", 110, 157),
        word("75", 210, 77),
      ],
      bars,
      c,
    );
    expect(data[1].value).toBe(75);
    expect(data[1].geometryValue).toBe(100);
    expect(
      makeFindings(data, c).find((f) => f.id === "proportions")?.level,
    ).toBe("caution");
  });
  it("keeps missing printed values as estimates with no false consistency claim", () => {
    const c = calibrate([tick(0, 300), tick(50, 200), tick(100, 100)], 300);
    const data = extractData([], bars, c);
    expect(data[0].source).toBe("geometry");
    expect(data[0].value).toBe(60);
    expect(
      makeFindings(data, c).find((f) => f.id === "proportions")?.level,
    ).toBe("info");
  });
});
describe("editing and zero-baseline reconstruction", () => {
  it.each(["", "-1", "Infinity", "NaN", "1e15"])(
    "rejects invalid edited value %s",
    (value) =>
      expect(
        validateData([
          { label: "A", value },
          { label: "B", value: "12" },
        ]),
      ).not.toBeNull(),
  );
  it("accepts explicit zero and decimal values", () =>
    expect(
      validateData([
        { label: "A", value: "0" },
        { label: "B", value: "12.5" },
      ]),
    ).toBeNull());
  it("rejects invalid labels and all-zero values", () => {
    expect(
      validateData([
        { label: "", value: "3" },
        { label: "B", value: "12" },
      ]),
    ).toContain("label");
    expect(
      validateData([
        { label: "A", value: "0" },
        { label: "B", value: "0" },
      ]),
    ).toContain("greater than zero");
  });
  it("keeps all values inside a zero-based domain including a degenerate input", () => {
    expect(chartDomain([{ value: 108 }]).max).toBeGreaterThanOrEqual(108);
    expect(chartDomain([{ value: 0 }]).max).toBeGreaterThan(0);
    expect(chartDomain([{ value: 0.005 }]).max).toBeLessThan(0.01);
    expect(formatValue(0.005)).toBe("0.005");
    expect(formatValue(1e-10)).not.toBe("0");
  });
  it("escapes SVG text and includes provenance plus an accessible description", () => {
    const rows: Datum[] = [
      {
        id: "1",
        label: "<script>alert(1)</script>",
        value: 2,
        geometryValue: 2,
        uncertainty: 0,
        source: "manual",
      },
    ];
    const svg = chartSvg(rows, "A & B", "", false);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("A &amp; B");
    expect(svg).toContain("<desc");
    expect(svg).toContain("DRAFT");
    expect(chartSvg(rows, "Title", "", true)).toContain(
      "not independently verified",
    );
  });
});
