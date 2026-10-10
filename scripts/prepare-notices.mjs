import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lock = JSON.parse(
  await readFile(resolve(root, "package-lock.json"), "utf8"),
);
const sections = [
  "ChartTruth third-party runtime notices.\nOriginal application: MIT. Dependencies retain their own licenses.\n",
];
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path.startsWith("node_modules/") || entry.dev) continue;
  const directory = resolve(root, path);
  const pkg = JSON.parse(
    await readFile(resolve(directory, "package.json"), "utf8"),
  );
  sections.push(
    `\n${"=".repeat(70)}\n${pkg.name}@${pkg.version}\nDeclared license: ${JSON.stringify(pkg.license)}\n`,
  );
  for (const file of await readdir(directory)) {
    if (/^(license|copying|notice)(\.|$)/i.test(file))
      sections.push(
        `${file}\n${await readFile(resolve(directory, file), "utf8")}\n`,
      );
  }
}
sections.push(
  `\n${"=".repeat(70)}\nEnglish OCR model: integerized Tessdata Best from naptha/tessdata.\n${await readFile(resolve(root, "third_party/tessdata-LICENSE.txt"), "utf8")}`,
);
sections.push(
  `\n${"=".repeat(70)}\nLeptonica, used by the WebAssembly OCR engine.\n${await readFile(resolve(root, "third_party/leptonica-LICENSE.txt"), "utf8")}`,
);
await mkdir(resolve(root, "public"), { recursive: true });
await writeFile(resolve(root, "public/licenses.txt"), sections.join("\n"));
console.log("Bundled runtime dependency and OCR model license notices.");
