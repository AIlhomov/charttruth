# Verification record

Measured on **10 October 2026** on Windows with Node.js **24.14.1**, npm **11.11.0**, and installed Google Chrome **155.0.8059.39**, controlled by Playwright. These results describe this local build, not a hosted release or broad chart-recognition benchmark.

## Completed gates

| Check                                                                                   | Actual result                                                    |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Clean `npm ci`, including asset and notice preparation                                  | Passed; 110 packages installed, 0 audit vulnerabilities reported |
| `npm test`                                                                              | **37/37 passed**                                                 |
| `npm run build`                                                                         | TypeScript and Vite production build passed                      |
| `npm run test:e2e`, isolated development server                                         | **13/13 passed**, 37.2 seconds                                   |
| `CHARTTRUTH_TEST_URL=http://127.0.0.1:4173 npm run test:e2e`, static production preview | **13/13 passed**, 28.8 seconds                                   |
| Actual desktop and mobile browser inspection                                            | Completed; screenshots below                                     |
| Devpost description word count                                                          | **397 words**, including headings                                |

The final combined `npm run gauntlet` also **passed**: 37 unit tests, production build, and 13 browser tests (28.9 seconds for the browser suite).

The environment variable command above uses POSIX notation. In PowerShell, use `$env:CHARTTRUTH_TEST_URL = 'http://127.0.0.1:4173'`, run `npm run test:e2e`, then `Remove-Item Env:CHARTTRUTH_TEST_URL`.

## What the checks establish

The unit suite exercises numeric parsing, connected-component geometry on generated pixels, baseline alignment, grayscale bars, stacked-bar rejection, linear calibration, insufficient/inconsistent ticks, printed-number versus height evidence, uncertain estimates, manual validation, small-value chart domains, SVG escaping and review provenance.

The browser suite runs actual Tesseract OCR and geometry; it does not mock extracted values. It covers:

- All three original synthetic samples: truncated axis, zero baseline, and inconsistent proportions. The last independently reads East as **58** while its measured height maps to approximately **90**.
- A renamed PNG upload, plus independent canvas-generated JPEG and percentage charts. The independent generator does not import application samples or access analysis state.
- Logarithmic, stacked, grouped, two-tick and pie fixtures, with explanations and no fabricated automatic finding; an invalid PDF and manual reconstruction with invalid-value handling.
- Upload, drag/drop and a dispatched clipboard-paste event; cancellation during asset loading and a successful restart. OS-level clipboard permission/paste UI was not separately tested.
- Editing labels and values, live reconstruction, review confirmation, export gating and invalidation after a subsequent edit.
- Real SVG, PNG and JSON downloads. Assertions inspect SVG edited values and provenance, PNG file signature and **2000 × 1260** dimensions, and JSON original evidence versus manually edited data.
- No page errors or cross-origin HTTP requests during the complete sample/edit/export workflow. OCR/model/fonts are served with the app.
- No horizontal overflow at **320, 390, 768, 1024 and 1440 CSS pixels**. A mobile-sized browser completes analysis, editing, confirmation and source-image enlargement. This is viewport emulation, not a physical-phone test.
- Automated axe checks against WCAG 2 A/AA and 2.1 AA in the empty and analyzed states. These are automated checks, not full accessibility certification. Escape-key dismissal of the methodology and source dialogs is also exercised.

## Inspection and fixes

The implement → test → inspect → fix loop exposed missing sparse-OCR ticks and labels, insufficient baseline calibration, and low-contrast muted text. Focused OCR crops recovered readable text; calibration remained strict; the text palette was darkened. Those cases pass the final suites. A final clean-install run also exposed a local port collision with another project. Tests now launch their own strict-port server and never reuse an unidentified application.

These are real production-browser captures, with original synthetic data:

- [Desktop comparison](screenshots/comparison.png): East's label and height disagree; the reconstructed bar uses the printed value and requests review.
- [Empty workspace](screenshots/workspace.png): upload and three samples.
- [Mobile reviewed workflow](screenshots/mobile.png): a test edit changes the second synthetic value to 101 and marks that value manual. Review means user confirmation, not independent verification.

Additional screenshots, downloaded artifacts and the latest HTML test report are generated locally under `output/playwright/` and `playwright-report/`; those transient directories are excluded from Git. Failed tests retain traces under `test-results/`.

## Exact remaining boundary

No public GitHub remote, hosting deployment, YouTube recording/upload, entrant-eligibility confirmation or Devpost submission was performed. The GitHub Actions workflow is prepared but has not run on GitHub. See the [submission checklist](SUBMISSION_CHECKLIST.md).

There is no held-out real-world accuracy benchmark. The detector supports a deliberately narrow chart family and can reject readable charts or mistake unusual geometry for supported bars. OCR diagnostics and geometric uncertainty do not certify the source data. Review against the original remains necessary.
