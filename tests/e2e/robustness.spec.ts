import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

// Independent test generator: this never imports the application's sample renderer.
async function fixture(
  page: Page,
  mode:
    | "plain"
    | "log"
    | "stacked"
    | "grouped"
    | "two-ticks"
    | "percent"
    | "tick-marks"
    | "decorated"
    | "short" = "plain",
  mime = "image/png",
) {
  return page.evaluate(
    ({ mode, mime }) => {
      const c = document.createElement("canvas");
      c.width = 1100;
      c.height = 700;
      const g = c.getContext("2d")!;
      g.fillStyle = "#fff";
      g.fillRect(0, 0, c.width, c.height);
      if (mode === "decorated") {
        g.fillStyle = "#c1e1f4";
        g.fillRect(0, 0, c.width, c.height);
        g.fillStyle = "#d9effc";
        g.beginPath();
        g.moveTo(0, 130);
        g.bezierCurveTo(350, 460, 500, -80, 1100, 240);
        g.lineTo(1100, 700);
        g.lineTo(0, 700);
        g.fill();
        g.strokeStyle = "#183c4c";
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(140, 130);
        g.lineTo(140, 560);
        g.lineTo(1050, 560);
        g.stroke();
      }
      g.fillStyle = "#272a3c";
      g.font = "bold 32px Arial";
      g.fillText("Independent test chart", 50, 60);
      const ys =
        mode === "decorated"
          ? [180, 256, 332, 408, 484, 560]
          : mode === "two-ticks"
            ? [180, 560]
            : [180, 275, 370, 465, 560];
      const ticks =
        mode === "decorated"
          ? [60, 48, 36, 24, 12, 0]
          : mode === "log"
            ? [10000, 1000, 100, 10, 1]
            : mode === "two-ticks"
              ? [80, 0]
              : [80, 60, 40, 20, 0];
      g.font = "24px Arial";
      g.textAlign = "right";
      ys.forEach((y, i) => {
        g.strokeStyle = mode === "decorated" ? "#183c4c" : "#d6dae2";
        g.lineWidth = mode === "decorated" ? 3 : 1;
        g.beginPath();
        g.moveTo(mode === "decorated" ? 130 : 140, y);
        g.lineTo(mode === "tick-marks" || mode === "decorated" ? 147 : 1030, y);
        g.stroke();
        g.fillStyle = "#485366";
        g.fillText(`${ticks[i]}${mode === "percent" ? "%" : ""}`, 120, y + 8);
      });
      const values =
          mode === "decorated"
            ? [12, 36, 24, 48, 36]
            : mode === "short"
              ? [2, 52, 40]
              : [28, 52, 40],
        labels = ["Cedar", "Birch", "Maple", "Pine", "Willow"];
      values.forEach((v, i) => {
        const x = mode === "decorated" ? 220 + i * 170 : 245 + i * 275,
          h = (v / (mode === "decorated" ? 60 : 80)) * 380;
        g.fillStyle = "#617ca8";
        if (mode === "decorated") {
          const shades = [
            ["#6684e3", "#294293"],
            ["#4e68ca", "#253b83"],
            ["#b2609b", "#753b66"],
            ["#3d9b80", "#235f4f"],
            ["#c77d3e", "#854f26"],
          ];
          const gradient = g.createLinearGradient(x, 560 - h, x, 560);
          gradient.addColorStop(0, shades[i][0]);
          gradient.addColorStop(1, shades[i][1]);
          g.fillStyle = gradient;
        }
        g.fillRect(x, 560 - h, 100, h);
        if (mode === "stacked") {
          g.fillStyle = "#d79a63";
          g.fillRect(x, 560 - h, 100, h * 0.5);
        }
        if (mode === "grouped") {
          g.fillStyle = "#83a48a";
          g.fillRect(x + 115, 560 - h * 0.7, 65, h * 0.7);
        }
        g.fillStyle = "#485366";
        g.textAlign = "center";
        g.fillText(labels[i], x + 50, 603);
        // plain intentionally omits printed values to test genuine interpolation.
        if (mode === "percent") g.fillText(`${v}%`, x + 50, 560 - h - 18);
      });
      return c.toDataURL(mime, 0.93).split(",")[1];
    },
    { mode, mime },
  );
}

test("independent unlabelled JPEG uses geometric estimates, not sample metadata", async ({
  page,
}) => {
  await page.goto("./");
  const pixels = await fixture(page, "plain", "image/jpeg");
  await page.getByLabel("Upload chart image").setInputFiles({
    name: "trees.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(pixels, "base64"),
  });
  await expect(
    page.getByRole("button", { name: "Confirm values", exact: true }),
  ).toBeVisible();
  for (const [i, value] of [28, 52, 40].entries())
    expect(
      Math.abs(
        Number(
          await page
            .getByRole("spinbutton", { name: `Value ${i + 1}`, exact: true })
            .inputValue(),
        ) - value,
      ),
    ).toBeLessThan(0.5);
  await expect(
    page.getByRole("heading", { name: "Values estimated from bar heights" }),
  ).toBeVisible();
  await expect(page.locator(".certainty.estimate")).toHaveCount(3);
  await expect(page.locator(".insight-strip")).toContainText(
    "not been independently checked",
  );
  await expect(
    page.getByRole("heading", { name: "A zero baseline is supported" }),
  ).toBeVisible();
});
test("shaded multicolour bars on a decorated pale background retain a verified zero baseline", async ({
  page,
}) => {
  await page.goto("./");
  const pixels = await fixture(page, "decorated");
  await page.getByLabel("Upload chart image").setInputFiles({
    name: "decorated.png",
    mimeType: "image/png",
    buffer: Buffer.from(pixels, "base64"),
  });
  await expect(
    page.getByRole("button", { name: "Confirm values", exact: true }),
  ).toBeVisible();
  for (const [i, value] of [12, 36, 24, 48, 36].entries())
    expect(
      Math.abs(
        Number(
          await page
            .getByRole("spinbutton", { name: `Value ${i + 1}`, exact: true })
            .inputValue(),
        ) - value,
      ),
    ).toBeLessThan(0.5);
  await expect(page.locator(".certainty.estimate")).toHaveCount(5);
  await expect(
    page.getByRole("heading", { name: "A zero baseline is supported" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "The vertical axis starts above zero" }),
  ).toHaveCount(0);
});
test("percentage labels retain their unit in the reconstructed chart", async ({
  page,
}) => {
  await page.goto("./");
  const pixels = await fixture(page, "percent");
  await page.getByLabel("Upload chart image").setInputFiles({
    name: "percent.png",
    mimeType: "image/png",
    buffer: Buffer.from(pixels, "base64"),
  });
  await expect(
    page.getByRole("button", { name: "Confirm values", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("corrected-chart")).toContainText("28%");
});
test("numeric axes with tick marks and no full-width gridlines are calibrated", async ({
  page,
}) => {
  await page.goto("./");
  const pixels = await fixture(page, "tick-marks");
  await page.getByLabel("Upload chart image").setInputFiles({
    name: "tick-marks.png",
    mimeType: "image/png",
    buffer: Buffer.from(pixels, "base64"),
  });
  await expect(
    page.getByRole("button", { name: "Confirm values", exact: true }),
  ).toBeVisible();
  for (const [i, value] of [28, 52, 40].entries())
    expect(
      Math.abs(
        Number(
          await page
            .getByRole("spinbutton", { name: `Value ${i + 1}`, exact: true })
            .inputValue(),
        ) - value,
      ),
    ).toBeLessThan(0.5);
});
for (const mode of ["log", "stacked", "grouped", "two-ticks", "short"] as const)
  test(`rejects unsupported ${mode} fixture without a finding`, async ({
    page,
  }) => {
    await page.goto("./");
    const pixels = await fixture(page, mode);
    await page.getByLabel("Upload chart image").setInputFiles({
      name: `${mode}.png`,
      mimeType: "image/png",
      buffer: Buffer.from(pixels, "base64"),
    });
    await expect(
      page.getByRole("button", { name: "Enter values manually" }),
    ).toBeVisible();
    await expect(page.locator(".finding")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Confirm values", exact: true }),
    ).toHaveCount(0);
  });
test("drag-drop, clipboard paste, cancellation and restarting are functional", async ({
  page,
}) => {
  await page.goto("./");
  const pixels = await fixture(page);
  await page.locator(".dropzone").evaluate((element, base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], "dragged.png", { type: "image/png" }));
    element.dispatchEvent(
      new DragEvent("drop", { bubbles: true, dataTransfer: transfer }),
    );
  }, pixels);
  await expect(
    page.getByRole("button", { name: "Confirm values", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start over" }).click();
  // Delay OCR assets so cancellation can be exercised deterministically, without mocking analysis output.
  await page.route(
    "**/ocr/**",
    (route) =>
      new Promise<void>((resolve) => {
        setTimeout(() => {
          void route.continue().catch(() => undefined);
          resolve();
        }, 1000);
      }),
  );
  await page.evaluate((base64) => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(
        [Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))],
        "pasted.png",
        { type: "image/png" },
      ),
    );
    document.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, clipboardData: transfer }),
    );
  }, pixels);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("cancelled");
  await page.unroute("**/ocr/**");
  await page.getByRole("button", { name: "ChartTruth home" }).click();
  await page
    .getByRole("button", { name: "Analyze The growth illusion", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirm values", exact: true }),
  ).toBeVisible();
});
test("empty and analyzed states pass automated accessibility checks", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  let results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Analyze The growth illusion", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirm values", exact: true }),
  ).toBeVisible();
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
});
