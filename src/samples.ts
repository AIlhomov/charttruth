export const samples = [
  {
    id: "truncated",
    name: "The growth illusion",
    subtitle: "A small change. A big impression.",
    scenario: "Truncated axis",
    title: "Customer satisfaction",
    description: "Survey index · synthetic example",
    min: 90,
    max: 110,
    ticks: [90, 95, 100, 105, 110],
    labels: ["2022", "2023", "2024", "2025"],
    values: [96, 100, 104, 108],
    drawn: [96, 100, 104, 108],
    color: "#8875db",
    tint: "#efecfc",
  },
  {
    id: "honest",
    name: "A fair comparison",
    subtitle: "A chart with nothing to hide.",
    scenario: "Zero baseline",
    title: "Library visits by quarter",
    description: "Visits, thousands · synthetic example",
    min: 0,
    max: 60,
    ticks: [0, 15, 30, 45, 60],
    labels: ["Q1", "Q2", "Q3", "Q4"],
    values: [24, 36, 31, 48],
    drawn: [24, 36, 31, 48],
    color: "#59a38c",
    tint: "#e8f3ee",
  },
  {
    id: "proportions",
    name: "When heights disagree",
    subtitle: "The label tells a different story.",
    scenario: "Inconsistent proportions",
    title: "Renewable energy share",
    description: "Share of generation · synthetic example",
    min: 0,
    max: 100,
    ticks: [0, 25, 50, 75, 100],
    labels: ["North", "South", "East", "West"],
    values: [42, 65, 58, 82],
    drawn: [42, 65, 90, 82],
    color: "#c6925e",
    tint: "#fbf0e4",
  },
] as const;
export type Sample = (typeof samples)[number];
// Only the image generator receives these specifications. Analysis receives pixels, never sample IDs or values.
export function sampleSvg(sample: Sample): string {
  const y = (v: number) =>
    500 - ((v - sample.min) / (sample.max - sample.min)) * 350;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="630" viewBox="0 0 1000 630"><rect width="1000" height="630" fill="#ffffff"/>
    <g font-family="Arial, sans-serif"><text x="55" y="58" fill="#292d3f" font-size="30" font-weight="600">${sample.title}</text><text x="55" y="95" fill="#727987" font-size="19">${sample.description}</text>
    ${sample.ticks.map((v) => `<line x1="115" x2="925" y1="${y(v)}" y2="${y(v)}" stroke="#d9dde5" stroke-width="1"/><text x="95" y="${y(v) + 8}" text-anchor="end" fill="#586070" font-size="23">${v}</text>`).join("")}
    ${sample.values
      .map((v, i) => {
        const x = 175 + i * 195;
        return `<rect x="${x}" y="${y(sample.drawn[i])}" width="90" height="${500 - y(sample.drawn[i])}" fill="${sample.color}"/><text x="${x + 45}" y="${y(sample.drawn[i]) - 16}" text-anchor="middle" fill="#35394d" font-size="24" font-weight="500">${v}</text><text x="${x + 45}" y="539" text-anchor="middle" fill="#586070" font-size="22">${sample.labels[i]}</text>`;
      })
      .join("")}
    <text x="55" y="594" font-size="17" fill="#9095a2">SYNTHETIC EXAMPLE · Created for ChartTruth · Not real-world data</text></g></svg>`;
}
export const sampleImage = (sample: Sample) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sampleSvg(sample))}`;
export async function sampleFile(sample: Sample): Promise<File> {
  const image = new Image();
  image.src = sampleImage(sample);
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 630;
  canvas.getContext("2d")!.drawImage(image, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error("Sample could not be rendered.")),
      "image/png",
    ),
  );
  return new File([blob], `${sample.id}-synthetic.png`, { type: "image/png" });
}
