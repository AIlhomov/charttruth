# Third-party resources and attributions

Exact installed versions are recorded in `package-lock.json`. `scripts/prepare-notices.mjs` assembles the distributed runtime notices at `public/licenses.txt` (copied into `dist/licenses.txt`). Dependency files and the OCR model are unmodified; their original terms remain in force.

## Runtime

| Resource                                     | Purpose                                                     | License / source                                                                                                                                                                                                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React and React DOM                          | Interface and rendering                                     | MIT — [React](https://github.com/facebook/react)                                                                                                                                                                                                                                        |
| Tesseract.js 7                               | Local OCR worker and word boxes                             | Apache-2.0 — [naptha/tesseract.js](https://github.com/naptha/tesseract.js)                                                                                                                                                                                                              |
| Tesseract.js-core 7 / Tesseract              | WebAssembly OCR engine, existing upstream engine and ports  | Apache-2.0 — [naptha/tesseract.js-core](https://github.com/naptha/tesseract.js-core); incorporates upstream image-processing dependencies under their respective terms                                                                                                                  |
| English OCR model                            | Existing LSTM English text recognition, no project training | `@tesseract.js-data/eng` 1.0.0 package declares MIT for packaging; `4.0.0_best_int` trained data are integerized Tessdata Best, upstream Apache-2.0. [Model distribution](https://github.com/naptha/tessdata), [upstream model/license](https://github.com/tesseract-ocr/tessdata_best) |
| Lucide React                                 | Interface icons                                             | ISC, with Feather MIT portions retained in supplied license — [Lucide](https://github.com/lucide-icons/lucide)                                                                                                                                                                          |
| Inter by Rasmus Andersson                    | Body typography, self-hosted via Fontsource                 | SIL Open Font License 1.1 — [Inter](https://github.com/rsms/inter)                                                                                                                                                                                                                      |
| Manrope by Mikhail Sharanda and contributors | Heading typography, self-hosted via Fontsource              | SIL Open Font License 1.1 — [Manrope](https://github.com/sharanda/manrope)                                                                                                                                                                                                              |

Tesseract's transitive runtime packages (including compression, image decoding, worker and compatibility helpers) are identified with their installed licenses in the generated notice bundle. The upstream engine's own dependencies retain their notices; see the additional engine license sources in `third_party/`.

No OpenCV distribution, YOLO/Paddle/LayoutLM model, DePlot checkpoint, vision LLM or external chart API is included. The connected-component geometry implementation and calibration/validation code were written for ChartTruth.

## Development and verification

TypeScript (Apache-2.0), Vite and its React plugin (MIT), Vitest (MIT), Playwright (Apache-2.0), axe-core / its Playwright integration (MPL-2.0) and Prettier (MIT) are used for development, testing and formatting. They are not runtime chart-inference services. Refer to each installed package for exact notices and transitive dependencies.

## Research and visual inspiration

Technical references: [DataDetective](https://github.com/kumarsparkz/datadetective), [WebPlotDigitizer](https://github.com/automeris-io/WebPlotDigitizer), [Chart-InforX](https://github.com/Cocobaut/Chart-InforX), [Misviz](https://github.com/UKPLab/acl2026-misviz), [PlotDigitizer](https://github.com/yuchung-chuang/PlotDigitizer), [Image Comparison Slider](https://github.com/sneas/img-comparison-slider), [Google DePlot](https://github.com/google-research/google-research/tree/master/deplot) and [Observable Framework examples](https://github.com/observablehq/framework/tree/main/examples).

Visual and interaction references: [FastToChart](https://fasttochart.click/chart-image-to-excel), [Vladislav's dashboard case study](https://dribbble.com/shots/27336953-Data-Dashboard-UX-Redesign-Improving-Insights-Engagement), [Powerdrill](https://powerdrill.ai/features/line-graph-creator), [InsightX by Kamrul Hasan Rifat](https://me.muz.li/kamrulhasanrifat/insightx-analytics-dashboard-ui-design-2), [Datawrapper](https://www.datawrapper.de/academy/how-to-create-your-first-datawrapper-chart), [Observable Framework](https://observablehq.github.io/framework/) and [Crystal by Alisha Aggarwal](https://dribbble.com/shots/26924073-Crystal-SaaS-Analytics-Dashboard-UI-UX-Light-Dark-Mode).

These informed concepts, limitations and general interaction patterns. Their application code, reference artwork and sample charts are not included in ChartTruth. The separately attributed external evaluation metadata is described below.

The ChartTruth wordmark, CSS interface and all three synthetic samples are original project work created during Banana Hacks 2026. Synthetic values are illustrative and are never presented as real-world data.

## External evaluation additions

A validation pass uses twenty published Misviz chart images locally. The images are excluded from Git and runtime samples. The attributed metadata subset and derived observations under `docs/evaluation/` use CC-BY-SA 4.0, with their license retained there. Original chart-source URLs and byte hashes are recorded. No Misviz application code, model or full dataset is bundled.
