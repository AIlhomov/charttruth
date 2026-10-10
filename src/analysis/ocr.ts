import type { Word } from "./types";

/** Resolve overlapping OCR retries by engine certainty, never by expected data. */
export function mergeOcrWords(existing: Word[], incoming: Word[]): Word[] {
  const result = [...existing];
  for (const candidate of incoming) {
    const matching = result.findIndex((word) => {
      const a = word.box,
        b = candidate.box;
      const width = Math.max(
        0,
        Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
      );
      const height = Math.max(
        0,
        Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
      );
      return (
        width * height > Math.min(a.width * a.height, b.width * b.height) * 0.6
      );
    });
    if (matching < 0) result.push(candidate);
    else if (candidate.confidence > result[matching].confidence)
      result[matching] = candidate;
  }
  return result;
}
