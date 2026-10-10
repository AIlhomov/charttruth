import type { Datum } from "../analysis/types";
import { formatValue } from "../analysis/types";
export function escapeXml(text: string) {
  return text.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
}
export function chartDomain(data: Pick<Datum, "value">[]): {
  max: number;
  step: number;
} {
  const raw = Math.max(0, ...data.map((d) => d.value)) || 1;
  const target = raw / 5 || raw;
  const magnitude = Math.max(
    Number.MIN_VALUE,
    10 ** Math.floor(Math.log10(target)),
  );
  const normalized = target / magnitude;
  const step =
    (normalized <= 1
      ? 1
      : normalized <= 2
        ? 2
        : normalized <= 2.5
          ? 2.5
          : normalized <= 5
            ? 5
            : 10) * magnitude;
  return { max: Math.ceil(raw / step) * step, step };
}
export function chartSvg(
  data: Datum[],
  title: string,
  unit: string,
  reviewed: boolean,
  note = "",
): string {
  const { max, step } = chartDomain(data),
    plot = { x: 90, y: 128, width: 850, height: 338 },
    baseline = plot.y + plot.height;
  const ticks = Array.from(
    { length: Math.round(max / step) + 1 },
    (_, i) => i * step,
  );
  const slot = plot.width / data.length,
    barWidth = Math.min(90, slot * 0.48);
  const fmt = (value: number) =>
    `${unit === "$" || unit === "€" || unit === "£" ? unit : ""}${formatValue(value)}${unit === "%" ? "%" : ""}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 630" width="1000" height="630" role="img" aria-labelledby="chart-title chart-description"><title id="chart-title">${escapeXml(title)}</title><desc id="chart-description">Zero-baseline bar chart. ${escapeXml(data.map((d) => `${d.label}: ${fmt(d.value)}`).join("; "))}. ${reviewed ? "Values reviewed by user." : "Draft: values need review."}</desc><rect width="1000" height="630" fill="#fff"/><g font-family="Arial,sans-serif"><text x="55" y="58" font-size="29" font-weight="600" fill="#292d3f">${escapeXml(title.slice(0, 62))}</text><text x="55" y="93" font-size="18" fill="#777e8b">Zero baseline · ${reviewed ? "User-reviewed values" : "Draft reconstruction — review values"}</text>
    ${ticks
      .map((t) => {
        const y = baseline - (t / max) * plot.height;
        return `<line x1="${plot.x}" x2="940" y1="${y}" y2="${y}" stroke="#e8eaf0"/><text x="72" y="${y + 7}" text-anchor="end" font-size="20" fill="#7a8191">${escapeXml(fmt(t))}</text>`;
      })
      .join("")}
    ${data
      .map((d, i) => {
        const x = plot.x + slot * (i + 0.5) - barWidth / 2,
          h = (d.value / max) * plot.height;
        return `<g><title>${escapeXml(d.label)}: ${escapeXml(fmt(d.value))}</title><rect x="${x}" y="${baseline - h}" width="${barWidth}" height="${h}" rx="3" fill="${i === data.length - 1 ? "#6554d8" : "#b8adee"}"/><text x="${x + barWidth / 2}" y="${baseline - h - 14}" text-anchor="middle" font-size="22" font-weight="600" fill="#49425d">${escapeXml(fmt(d.value))}</text><text x="${x + barWidth / 2}" y="505" text-anchor="middle" font-size="${data.length > 8 ? 13 : 20}" fill="#687080">${escapeXml(d.label.length > 12 ? `${d.label.slice(0, 11)}…` : d.label)}</text></g>`;
      })
      .join("")}
    <text x="55" y="560" font-size="17" fill="#7a8191">${escapeXml(note ? `Context: ${note.slice(0, 95)}` : "Reconstructed from the image. Check against the original source.")}</text><line x1="55" x2="945" y1="584" y2="584" stroke="#ededf2"/><text x="55" y="612" font-size="16" fill="#6554d8" font-weight="600">ChartTruth</text><text x="945" y="612" text-anchor="end" font-size="16" fill="#8a8f9d">${reviewed ? "User reviewed · not independently verified" : "DRAFT · unreviewed"} · Zero-baseline reconstruction</text></g></svg>`;
}
export async function exportChart(
  svg: string,
  format: "svg" | "png",
): Promise<void> {
  let blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  if (format === "png") {
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 2000;
      canvas.height = 1260;
      canvas.getContext("2d")!.drawImage(image, 0, 0, 2000, 1260);
      blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("PNG rendering failed."))),
          "image/png",
        ),
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  download(blob, `charttruth-corrected.${format}`);
}
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
