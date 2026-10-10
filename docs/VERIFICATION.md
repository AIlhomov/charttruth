# Verification record

Verified on **10 October 2026** with Node.js **24.14.1**, npm **11.11.0** and Google Chrome **155.0.8059.39**, controlled by Playwright. CI uses Linux and bundled Chromium. These are implementation and workflow checks, not a broad chart-recognition accuracy benchmark.

| Check                                           | Result                                                                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Unit suite                                      | **41/41 passed**                                                                                                            |
| TypeScript and Vite production build            | Passed                                                                                                                      |
| Local browser suite                             | **15/15 passed**                                                                                                            |
| GitHub Actions gauntlet and Pages deployment    | [Passed](https://github.com/AIlhomov/charttruth/actions/runs/38070967906); reruns on every push                             |
| Complete browser suite against public HTTPS app | **15/15 passed**, no failures, flaky cases or skips; approximately 74.7 seconds. [Report summary](hosted-test-summary.json) |

Public application: https://ailhomov.github.io/charttruth/.

## What the checks establish

The unit suite exercises numeric parsing, connected-component geometry, baseline alignment, short-bar retention and category-coverage checks, OCR retry merging, linear calibration, insufficient or inconsistent ticks, printed-number versus height evidence, uncertain estimates, manual validation, small-value chart domains, SVG escaping and review provenance.

The browser suite runs actual Tesseract OCR and geometry without mocking extracted values. It covers:

- All three original synthetic samples, including the independent discrepancy between East's printed value **58** and measured height of approximately **90**.
- PNG uploads, independent JPEG and percentage charts, drop/paste events, cancellation and restart. OS-level clipboard permissions were not separately tested.
- Unsupported or ambiguous chart fixtures, invalid-file errors and explicitly manual reconstruction with validation.
- Label/value corrections, immediate chart updates, review confirmation, export gating and review invalidation after a subsequent edit.
- Actual SVG, PNG and JSON downloads. Assertions inspect edited values and provenance, PNG signatures and **2000 × 1260** dimensions, and original evidence versus manual edits.
- No page errors or cross-origin requests in the complete sample/edit/export workflow. OCR assets, model and fonts are served with the app.
- No horizontal overflow at **320, 390, 768, 1024 and 1440 CSS pixels**, plus a mobile-sized analysis/edit/review workflow. This is viewport emulation, not a physical-phone test.
- Automated axe checks against WCAG 2 A/AA and 2.1 AA, and Escape-key dismissal of dialogs. These are automated checks, not full accessibility certification.

Actual production-browser captures show the [desktop comparison](screenshots/comparison.png), [empty workspace](screenshots/workspace.png) and [mobile reviewed workflow](screenshots/mobile.png). All use clearly labeled synthetic examples.

## Reproduce and interpret

Run `npm ci` and `npm run gauntlet`. Tests start an isolated strict-port server on 5191. For the hosted application in PowerShell, set `$env:CHARTTRUTH_TEST_URL = 'https://ailhomov.github.io/charttruth/'`, run `npm run test:e2e`, then `Remove-Item Env:CHARTTRUTH_TEST_URL`. Relative navigation preserves the Pages subdirectory. Browser artifacts and reports are local and excluded from Git; CI retains browser evidence as a workflow artifact.

The implement → test → inspect → fix loop exposed sparse OCR, missing short bars, incomplete category coverage, baseline-calibration failures and low-contrast text. Focused OCR crops, stricter validation and layout fixes addressed the tested cases.

The [twenty-chart exploratory external test](evaluation/README.md) reports **one numerical reconstruction and nineteen rejections**. The reconstructed chart's category labels required manual correction. That case informed fixes and is not held out. This does not establish general accuracy or safe handling of every unsupported chart. OCR diagnostics and geometric uncertainty do not certify source data; review against the original remains necessary.
