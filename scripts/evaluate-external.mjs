import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  await readFile(resolve(root, "docs/evaluation/manifest.json"), "utf8"),
);
const origin = process.env.CHARTTRUTH_TEST_URL || "http://127.0.0.1:4173";
const directory = resolve(root, "output/evaluation");
await mkdir(resolve(directory, "results"), { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const results = [];
try {
  for (const chart of manifest.selected) {
    if (
      process.env.CHARTTRUTH_CASE &&
      chart.number !== Number(process.env.CHARTTRUTH_CASE)
    )
      continue;
    const started = Date.now();
    await page.goto(origin);
    const entry = {
      number: chart.number,
      file: chart.file,
      url: chart.url,
      dataset_id: chart.dataset_id,
    };
    try {
      await page
        .getByLabel("Upload chart image")
        .setInputFiles(resolve(directory, "images", chart.file));
      const confirmation = page.getByRole("button", {
        name: "Confirm values",
        exact: true,
      });
      await confirmation
        .or(page.getByRole("alert"))
        .first()
        .waitFor({ state: "visible", timeout: 75_000 });
      if (await confirmation.isVisible()) {
        entry.status = "completed";
        entry.findings = await page.locator(".finding").allTextContents();
        // Confirmation here records automated evaluation review, not verification of chart truth.
        await confirmation.click();
        await page.getByRole("button", { name: "Export chart" }).click();
        const download = page.waitForEvent("download");
        await page.getByRole("button", { name: /Evidence report/ }).click();
        const reportPath = resolve(
          directory,
          "results",
          `${String(chart.number).padStart(2, "0")}.json`,
        );
        await (await download).saveAs(reportPath);
        entry.report = JSON.parse(await readFile(reportPath, "utf8"));
      } else {
        entry.status = "rejected";
        entry.reason = await page.getByRole("alert").innerText();
        entry.findings = await page.locator(".finding").allTextContents();
      }
      await page.screenshot({
        path: resolve(
          directory,
          "results",
          `${String(chart.number).padStart(2, "0")}.png`,
        ),
        fullPage: true,
      });
    } catch (error) {
      entry.status = "error";
      entry.reason = String(error);
    }
    entry.elapsedMs = Date.now() - started;
    results.push(entry);
    await writeFile(
      resolve(
        directory,
        process.env.CHARTTRUTH_CASE
          ? `case-${process.env.CHARTTRUTH_CASE}-result.json`
          : "raw-results.json",
      ),
      JSON.stringify(results, null, 2) + "\n",
    );
    console.log(
      `${String(chart.number).padStart(2, "0")} ${entry.status}: ${entry.reason || entry.report.data.map((d) => `${d.label}=${d.value}`).join(", ")}`,
    );
  }
} finally {
  await context.close();
  await browser.close();
}
console.log(
  `Completed ${results.filter((r) => r.status === "completed").length}; rejected ${results.filter((r) => r.status === "rejected").length}; errors ${results.filter((r) => r.status === "error").length}.`,
);
