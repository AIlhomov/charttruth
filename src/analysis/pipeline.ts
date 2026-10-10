import { createWorker, PSM } from "tesseract.js";
import type { Analysis, GeometryResult, Progress, Word } from "./types";
import {
  axisTicks,
  calibrate,
  extractData,
  makeFindings,
  parseNumeric,
} from "./calibration";

function guarded<T>(
  job: Promise<T>,
  signal: AbortSignal,
  expire: () => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = () => {
      expire();
      cleanup();
      reject(new DOMException("Analysis cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      expire();
      cleanup();
      reject(
        new Error(
          "Local OCR took longer than 60 seconds. Try a smaller, sharper crop or enter values manually.",
        ),
      );
    }, 60_000);
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", stop);
    };
    signal.addEventListener("abort", stop, { once: true });
    if (signal.aborted) {
      stop();
      return;
    }
    job.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
}

type OcrPage = Awaited<
  ReturnType<Awaited<ReturnType<typeof createWorker>>["recognize"]>
>["data"];
function readWords(data: OcrPage, offsetX = 0, offsetY = 0): Word[] {
  return (data.blocks || []).flatMap((block) =>
    block.paragraphs.flatMap((p) =>
      p.lines.flatMap((l) =>
        l.words.map((w) => ({
          text: w.text,
          confidence: w.confidence,
          box: {
            x: w.bbox.x0 + offsetX,
            y: w.bbox.y0 + offsetY,
            width: w.bbox.x1 - w.bbox.x0,
            height: w.bbox.y1 - w.bbox.y0,
          },
        })),
      ),
    ),
  );
}

export async function loadImage(
  file: File,
): Promise<{ canvas: HTMLCanvasElement; url: string }> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error(
      "Choose a PNG, JPEG or WebP image. PDFs and SVG uploads are not supported.",
    );
  if (file.size > 10 * 1024 * 1024)
    throw new Error(
      "This image is larger than 10 MB. Use a smaller screenshot or crop.",
    );
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (
      image.naturalWidth * image.naturalHeight > 20_000_000 ||
      image.naturalWidth < 100 ||
      image.naturalHeight < 100
    )
      throw new Error(
        "Use an image at least 100 × 100 pixels and below 20 megapixels.",
      );
    const scale = Math.min(
      1.5,
      1500 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { canvas, url };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error instanceof Error
      ? error
      : new Error(
          "The image could not be decoded. Try a different PNG or JPEG.",
        );
  }
}

function geometry(
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
): Promise<GeometryResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./geometry.worker.ts", import.meta.url),
      { type: "module" },
    );
    const abort = () => {
      worker.terminate();
      reject(new DOMException("Analysis cancelled", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    const finish = () => {
      worker.terminate();
      signal.removeEventListener("abort", abort);
    };
    worker.onmessage = ({ data }) => {
      finish();
      data.error ? reject(new Error(data.error)) : resolve(data.result);
    };
    worker.onerror = () => {
      finish();
      reject(
        new Error(
          "Image processing could not start. Please retry in a current browser.",
        ),
      );
    };
    const image = canvas
      .getContext("2d")!
      .getImageData(0, 0, canvas.width, canvas.height);
    worker.postMessage(
      { pixels: image.data.buffer, width: canvas.width, height: canvas.height },
      [image.data.buffer],
    );
  });
}

export async function analyze(
  canvas: HTMLCanvasElement,
  onProgress: (p: Progress) => void,
  signal: AbortSignal,
): Promise<Analysis> {
  const start = performance.now();
  onProgress({
    stage: "geometry",
    detail: "Finding solid bars and a shared baseline…",
  });
  const { bars, horizontalLines } = await geometry(canvas, signal);
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  onProgress({ stage: "ocr", detail: "Loading the local English OCR model…" });
  const base = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href)
    .href;
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  let expired = false;
  const cancel = () => {
    expired = true;
    void worker?.terminate();
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    const creation = createWorker("eng", 1, {
      workerPath: `${base}worker.min.js`,
      corePath: base,
      langPath: base.replace(/\/$/, ""),
      errorHandler: () => undefined,
      logger: (m) => {
        if (!signal.aborted)
          onProgress({
            stage: "ocr",
            detail:
              m.status === "recognizing text"
                ? "Reading axis ticks, labels and printed values…"
                : "Preparing the local OCR engine…",
            fraction: m.status === "recognizing text" ? m.progress : undefined,
          });
      },
    }).then((candidate) => {
      if (expired || signal.aborted) {
        void candidate.terminate();
        throw new DOMException("Cancelled", "AbortError");
      }
      return candidate;
    });
    worker = await guarded(creation, signal, cancel);
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      user_defined_dpi: "150",
    });
    const { data } = await guarded(
      worker.recognize(canvas, {}, { blocks: true, text: true }),
      signal,
      cancel,
    );
    const words = readWords(data);
    const initialTicks = axisTicks(words, bars, horizontalLines);
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
    const cropWords = async (
      x: number,
      y: number,
      width: number,
      height: number,
      numericOnly = true,
    ) => {
      const left = Math.max(0, Math.floor(x)),
        top = Math.max(0, Math.floor(y));
      const w = Math.min(Math.ceil(width), canvas.width - left),
        h = Math.min(Math.ceil(height), canvas.height - top);
      const crop = document.createElement("canvas");
      crop.width = w + 24;
      crop.height = h + 24;
      const ctx = crop.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, crop.width, crop.height);
      ctx.drawImage(canvas, left, top, w, h, 12, 12, w, h);
      const result = await guarded(
        worker!.recognize(crop, {}, { blocks: true, text: true }),
        signal,
        cancel,
      );
      return readWords(result.data, left - 12, top - 12).filter(
        (w) =>
          w.confidence >= (numericOnly ? 70 : 35) &&
          (!numericOnly || parseNumeric(w.text) !== null),
      );
    };
    // Gridlines locate missing tick crops, but never supply a value. Only OCR supplies numbers.
    if (initialTicks.length >= 2) {
      const edges = initialTicks
        .map((t) => t.box.x + t.box.width)
        .sort((a, b) => a - b);
      const right = edges[Math.floor(edges.length / 2)];
      const halfHeight = Math.max(18, canvas.height * 0.028);
      const bottom = Math.max(...bars.map((b) => b.y + b.height));
      for (const y of horizontalLines.filter((y) => y <= bottom + 5)) {
        if (initialTicks.some((t) => Math.abs(t.y - y) < 10)) continue;
        words.push(
          ...(await cropWords(
            right - 130,
            y - halfHeight,
            150,
            halfHeight * 2,
          )),
        );
      }
    }
    for (const bar of bars) {
      const center = bar.x + bar.width / 2;
      const alreadyRead = words.some(
        (w) =>
          parseNumeric(w.text) !== null &&
          w.confidence >= 70 &&
          Math.abs(w.box.x + w.box.width / 2 - center) < bar.width * 0.65 &&
          w.box.y + w.box.height <= bar.y + 4 &&
          bar.y - w.box.y - w.box.height < 45,
      );
      if (!alreadyRead)
        words.push(
          ...(await cropWords(
            center - bar.width * 0.8,
            bar.y - canvas.height * 0.085,
            bar.width * 1.6,
            canvas.height * 0.08,
          )),
        );
    }
    const baselineY = Math.max(...bars.map((b) => b.y + b.height));
    for (const bar of bars) {
      const center = bar.x + bar.width / 2;
      const hasLabel = words.some(
        (w) =>
          w.box.y > baselineY + 4 &&
          w.box.y < baselineY + 65 &&
          Math.abs(w.box.x + w.box.width / 2 - center) < bar.width * 0.9,
      );
      if (!hasLabel)
        words.push(
          ...(await cropWords(
            center - bar.width,
            baselineY + 5,
            bar.width * 2,
            canvas.height * 0.09,
            false,
          )),
        );
    }
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    onProgress({
      stage: "validation",
      detail: "Checking axis consistency and label-to-height agreement…",
    });
    const ticks = axisTicks(words, bars, horizontalLines);
    const calibration = calibrate(
      ticks,
      Math.max(...bars.map((b) => b.y + b.height)),
    );
    if (
      calibration.baseline < -calibration.uncertainty ||
      ticks.some((t) => t.value < 0)
    )
      throw new Error(
        "Negative values or a negative baseline were found. Automatic reconstruction currently supports nonnegative bars only. Use manual entry.",
      );
    const rows = extractData(words, bars, calibration);
    // A grouped chart may look geometrically regular. Require one category per detected bar.
    if (
      rows.filter((d) => d.labelConfidence === undefined).length >
        Math.floor(rows.length / 3) ||
      new Set(
        rows.filter((d) => d.labelConfidence !== undefined).map((d) => d.label),
      ).size !== rows.filter((d) => d.labelConfidence !== undefined).length
    )
      throw new Error(
        "Category labels could not be matched to individual bars. This may be a grouped chart or an unreadable crop. Use manual entry rather than an uncertain reconstruction.",
      );
    const title =
      words
        .filter((w) => w.box.y < canvas.height * 0.115 && w.confidence > 60)
        .map((w) => w.text)
        .join(" ") || "Reconstructed chart";
    const unit = ticks.some((t) => t.text.includes("%"))
      ? "%"
      : ticks.some((t) => t.text.includes("$"))
        ? "$"
        : ticks.some((t) => t.text.includes("€"))
          ? "€"
          : ticks.some((t) => t.text.includes("£"))
            ? "£"
            : "";
    return {
      width: canvas.width,
      height: canvas.height,
      bars,
      words,
      calibration,
      data: rows,
      findings: makeFindings(rows, calibration),
      title,
      unit,
      elapsed: performance.now() - start,
    };
  } catch (error) {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    throw error;
  } finally {
    signal.removeEventListener("abort", cancel);
    await worker?.terminate().catch(() => undefined);
  }
}
