import type { Word } from "./types";

/** Resolve retries by engine certainty and equal-reading box precision. */
export function mergeOcrWords(existing: Word[], incoming: Word[]): Word[] {
  const result = [...existing];
  for (const candidate of incoming) {
    const overlaps = (word: Word) => {
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
    };
    const matching = result.filter(overlaps);
    if (matching.length === 0) result.push(candidate);
    else if (
      matching.every(
        (word) =>
          candidate.confidence > word.confidence ||
          (candidate.confidence === word.confidence &&
            candidate.text === word.text &&
            candidate.box.width * candidate.box.height <
              word.box.width * word.box.height),
      )
    ) {
      // A retry can join two words, or split one. Remove every weaker overlap
      // so a joined category such as "Period4" cannot leave a duplicate "4".
      const first = result.findIndex(overlaps);
      for (let i = result.length - 1; i >= 0; i--)
        if (overlaps(result[i])) result.splice(i, 1);
      result.splice(first, 0, candidate);
    }
  }
  return result;
}
