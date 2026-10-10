export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Word {
  text: string;
  confidence: number;
  box: Box;
}
export interface Bar extends Box {
  fill: number;
  color: string;
}
export interface Tick {
  value: number;
  y: number;
  text: string;
  confidence: number;
  box: Box;
}
export interface Calibration {
  slope: number;
  intercept: number;
  r2: number;
  residual: number;
  uncertainty: number;
  baseline: number;
  ticks: Tick[];
}
export interface Datum {
  id: string;
  label: string;
  value: number;
  geometryValue: number;
  printedValue?: number;
  labelConfidence?: number;
  valueConfidence?: number;
  uncertainty: number;
  source: "geometry" | "printed" | "manual";
  bar?: Bar;
}
export interface Finding {
  id: "baseline" | "proportions" | "review" | "scope";
  level: "caution" | "good" | "info";
  title: string;
  detail: string;
}
export interface Analysis {
  width: number;
  height: number;
  bars: Bar[];
  words: Word[];
  calibration: Calibration;
  data: Datum[];
  findings: Finding[];
  title: string;
  unit: string;
  elapsed: number;
}
export interface GeometryResult {
  bars: Bar[];
  horizontalLines: number[];
}
export interface Progress {
  stage: "geometry" | "ocr" | "validation";
  detail: string;
  fraction?: number;
}
export const formatValue = (value: number) => {
  const absolute = Math.abs(value);
  if (absolute > 0 && absolute < 0.00001) return value.toExponential(2);
  return new Intl.NumberFormat("en", {
    maximumFractionDigits:
      absolute > 0 && absolute < 1
        ? Math.min(12, -Math.floor(Math.log10(absolute)) + 2)
        : 2,
  }).format(value);
};
