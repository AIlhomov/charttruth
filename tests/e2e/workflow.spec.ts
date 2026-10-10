import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function selectSample(page: Page, name: string) {
  await page
    .getByRole("button", { name: `Analyze ${name}`, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirm values", exact: true }),
  ).toBeVisible();
}
async function saveSample(page: Page, index: number, filename: string) {
  // Rasterize only the gallery image; no application analysis state is accessed or mocked.
  return await page
    .locator(".sample-thumbnail img")
    .nth(index)
    .evaluate(async (element, name) => {
      const image = element as HTMLImageElement;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 1000;
      canvas.height = 630;
      canvas.getContext("2d")!.drawImage(image, 0, 0);
      return {
        name,
        type: "image/png",
        base64: canvas.toDataURL("image/png").split(",")[1],
      };
    }, filename);
}
test("real OCR: truncated sample → evidence → edit → confirm → SVG, PNG and JSON", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const remote: string[] = [];
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !r
        .url()
        .startsWith(process.env.CHARTTRUTH_TEST_URL || "http://127.0.0.1:5191")
    )
      remote.push(r.url());
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("./");
  await selectSample(page, "The growth illusion");
  await expect(
    page.getByRole("heading", { name: "The vertical axis starts above zero" }),
  ).toBeVisible();
  for (const [i, value] of [96, 100, 104, 108].entries())
    expect(
      Math.abs(
        Number(
          await page
            .getByRole("spinbutton", { name: `Value ${i + 1}`, exact: true })
            .inputValue(),
        ) - value,
      ),
    ).toBeLessThan(0.1);
  await expect(
    page.getByRole("button", { name: "Export chart" }),
  ).toBeDisabled();
  await page
    .getByRole("spinbutton", { name: "Value 1", exact: true })
    .fill("97.5");
  await expect(page.getByTestId("corrected-chart")).toContainText("97.5");
  await page
    .getByRole("textbox", { name: "Category 1", exact: true })
    .fill("Edited year");
  await page
    .getByRole("button", { name: "Confirm values", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Export chart" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  await expect(page.locator(".annotations")).toHaveCount(0);
  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  for (const [name, format] of [
    ["SVG vector", "svg"],
    ["PNG image", "png"],
    ["Evidence report", "json"],
  ] as const) {
    await page.getByRole("button", { name: "Export chart" }).click();
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: new RegExp(name) }).click();
    const result = await pending;
    const path = resolve("output/playwright", result.suggestedFilename());
    await mkdir(resolve("output/playwright"), { recursive: true });
    await result.saveAs(path);
    const bytes = await readFile(path);
    if (format === "svg") {
      expect(bytes.toString()).toContain("97.5");
      expect(bytes.toString()).toContain("Edited year");
      expect(bytes.toString()).toContain("not independently verified");
    }
    if (format === "png") {
      expect(bytes.subarray(1, 4).toString()).toBe("PNG");
      expect(bytes.readUInt32BE(16)).toBe(2000);
      expect(bytes.readUInt32BE(20)).toBe(1260);
    }
    if (format === "json") {
      const report = JSON.parse(bytes.toString());
      expect(report.data[0].value).toBe(97.5);
      expect(report.data[0].source).toBe("manual");
      expect(report.evidence.ticks.length).toBeGreaterThanOrEqual(3);
      expect(report.independentlyVerified).toBe(false);
    }
  }
  await page.screenshot({
    path: "output/playwright/desktop-reviewed.png",
    fullPage: true,
  });
  await page
    .getByRole("spinbutton", { name: "Value 1", exact: true })
    .fill("98");
  await expect(
    page.getByRole("button", { name: "Export chart" }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
  expect(remote).toEqual([]);
});

test("real OCR: honest and inconsistent proportion samples produce different supported findings", async ({
  page,
}) => {
  await page.goto("./");
  await selectSample(page, "A fair comparison");
  await expect(
    page.getByRole("heading", { name: "A zero baseline is supported" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Bar heights agree with printed values",
    }),
  ).toBeVisible();
  await expect(page.locator(".finding.caution")).toHaveCount(0);
  for (const [i, v] of [24, 36, 31, 48].entries())
    await expect(
      page.getByRole("spinbutton", { name: `Value ${i + 1}`, exact: true }),
    ).toHaveValue(String(v));
  await selectSample(page, "When heights disagree");
  await expect(
    page.getByRole("heading", {
      name: "Printed values and bar heights disagree",
    }),
  ).toBeVisible();
  await expect(page.locator(".finding.caution")).toContainText("East");
  await expect(
    page.getByRole("spinbutton", { name: "Value 3", exact: true }),
  ).toHaveValue("58");
  await page.screenshot({
    path: "output/playwright/desktop-proportions.png",
    fullPage: true,
  });
});

test("upload a differently named PNG with no sample ID, then confirm and export", async ({
  page,
}) => {
  await page.goto("./");
  const file = await saveSample(page, 0, "unrecognized-upload.png");
  await page.getByLabel("Upload chart image").setInputFiles({
    name: file.name,
    mimeType: file.type,
    buffer: Buffer.from(file.base64, "base64"),
  });
  await expect(
    page.getByRole("button", { name: "Confirm values", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "The vertical axis starts above zero" }),
  ).toBeVisible();
  await expect(page.locator(".file-meta")).toContainText(
    "unrecognized-upload.png",
  );
  await expect(page.locator(".file-meta")).not.toContainText(
    "Synthetic example",
  );
  await expect(
    page.getByRole("spinbutton", { name: "Value 4", exact: true }),
  ).toHaveValue("108");
});

test("unsupported geometry and invalid uploads have an honest manual fallback", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByLabel("Upload chart image").setInputFiles({
    name: "document.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("not a chart"),
  });
  await expect(page.getByRole("alert")).toContainText(
    "Choose a PNG, JPEG or WebP",
  );
  const unsupported = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 700;
    c.height = 400;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 700, 400);
    ctx.fillStyle = "#7866cc";
    ctx.beginPath();
    ctx.arc(350, 200, 130, 0, 2 * Math.PI);
    ctx.fill();
    return c.toDataURL("image/png").split(",")[1];
  });
  await page.getByLabel("Upload chart image").setInputFiles({
    name: "pie.png",
    mimeType: "image/png",
    buffer: Buffer.from(unsupported, "base64"),
  });
  await expect(page.getByRole("alert")).toContainText("solid vertical bars");
  await expect(page.locator(".finding")).toHaveCount(0);
  await page.getByRole("button", { name: "Enter values manually" }).click();
  await page
    .getByRole("spinbutton", { name: "Value 1", exact: true })
    .fill("12.5");
  await page
    .getByRole("spinbutton", { name: "Value 2", exact: true })
    .fill("20");
  await page
    .getByRole("button", { name: "Confirm values", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Export chart" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "Reconstruction from your values" }),
  ).toBeVisible();
  await page
    .getByRole("spinbutton", { name: "Value 1", exact: true })
    .fill("-2");
  await expect(
    page.getByRole("button", { name: "Export chart" }),
  ).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("finite numbers");
});

test("mobile workflow, keyboard modal, responsive widths and full source image", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await page.getByRole("button", { name: "How it works", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({
    path: "output/playwright/mobile-empty.png",
    fullPage: true,
  });
  await selectSample(page, "The growth illusion");
  await page
    .getByRole("spinbutton", { name: "Value 2", exact: true })
    .fill("101");
  await page
    .getByRole("button", { name: "Confirm values", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Export chart" }),
  ).toBeEnabled();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `no horizontal overflow at ${width}px`,
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "output/playwright/mobile-reviewed.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Enlarge original chart" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
