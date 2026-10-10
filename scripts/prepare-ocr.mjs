import { mkdir, copyFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = resolve(root, "public/ocr");
await mkdir(destination, { recursive: true });
await copyFile(
  resolve(root, "node_modules/tesseract.js/dist/worker.min.js"),
  resolve(destination, "worker.min.js"),
);
const core = resolve(root, "node_modules/tesseract.js-core");
for (const name of await readdir(core)) {
  if (name.endsWith(".wasm") || name.endsWith(".wasm.js"))
    await copyFile(resolve(core, name), resolve(destination, name));
}
await copyFile(
  resolve(
    root,
    "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
  ),
  resolve(destination, "eng.traineddata.gz"),
);
console.log(
  "OCR worker, WebAssembly and English model prepared for same-origin local analysis.",
);
