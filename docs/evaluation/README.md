# External chart evaluation

**20 real external charts; 1 numerical reconstruction, 19 rejections.** The reconstructed chart needs manual label correction. This is limited coverage, not a 100% accuracy result.

The [11 October reliability recheck](recheck-2026-10-11.json), after shaded-bar and tick-OCR changes, retained one numerical reconstruction and nineteen rejections with no runtime errors. Case 13 still needs manual category correction; all eight numerical values remain within 0.5 source units of the recorded manual reference.

Selected before analysis from [Misviz](https://github.com/UKPLab/acl2026-misviz) by the deterministic protocol in [manifest.json](manifest.json). Original source URLs, byte hashes, dimensions and dataset annotations are retained. No external images are committed or added to the sample gallery.

The first run rejected all 20. Investigation of case 13 exposed a lost short bar, missing dense-axis baseline text, and small-text OCR errors. The follow-up adds shorter-component detection, spatial category-coverage checks, adaptive tick crops and confidence-based OCR retry merging. The same case was used during those fixes, so these are **exploratory post-fix results**, not held-out performance.

Case 13 recovers all eight numerical values within 0.5 source units of manual transcription. Three are explicitly height estimates; the largest numerical difference is about 0.18 units. **0/8 category labels match exactly** before manual correction. No automatic ordering analysis is claimed; Misviz annotates this chart for inappropriate item order, which ChartTruth does not detect.

Most other cases are horizontal, stacked, grouped, 3D, multi-panel or lack a usable axis. Each rejection displayed an explanation and issued no automatic finding. This does not prove safe handling of every unsupported chart. Manual reconstruction remains available.

| Case | Final outcome | Visual scope review                                                                                         |
| ---- | ------------- | ----------------------------------------------------------------------------------------------------------- |
| 01   | rejected      | Dark/patterned background and non-flat fills                                                                |
| 02   | rejected      | Horizontal photo infographic                                                                                |
| 03   | rejected      | Zero-height categories and axis-connected shapes; incomplete bar set                                        |
| 04   | rejected      | Legend-series roles cannot be resolved; no individual category labels                                       |
| 05   | rejected      | Horizontal bars                                                                                             |
| 06   | rejected      | Horizontal stacked bars                                                                                     |
| 07   | rejected      | Horizontal decorative bars                                                                                  |
| 08   | rejected      | 3D cylinders, gradient background, no numeric axis                                                          |
| 09   | rejected      | Horizontal bars                                                                                             |
| 10   | rejected      | Many bars, two series and dual axes                                                                         |
| 11   | rejected      | Grouped series and non-English/rotated labels                                                               |
| 12   | rejected      | Horizontal 3D bars; 67.1 megapixels exceeds input limit                                                     |
| 13   | completed     | Single vertical series, small text and rotated category labels; numerical recovery with manual label review |
| 14   | rejected      | Stacked multi-series chart with embedded table                                                              |
| 15   | rejected      | Decorative horizontal bars                                                                                  |
| 16   | rejected      | Gradient TV infographic without numeric y-axis                                                              |
| 17   | rejected      | Two chart panels in a single image                                                                          |
| 18   | rejected      | Horizontal stacked bars                                                                                     |
| 19   | rejected      | 3D perspective bars                                                                                         |
| 20   | rejected      | Horizontal infographic                                                                                      |

## Reproduce

Requires Python with Pillow and the normal Node development dependencies. Download URLs may change; validate the recorded SHA-256 hashes before comparing results.

```sh
python scripts/fetch-external.py
# Start npm run dev or npm run preview in another terminal.
node scripts/evaluate-external.mjs
python scripts/summarize-external.py
```

The evaluator defaults to http://127.0.0.1:4173; CHARTTRUTH_TEST_URL selects another served build. It uploads actual image files through the UI and exports actual JSON reports. Its automated confirm click enables report download; it does not constitute human verification. Raw screenshots/reports and the frozen initial run remain locally under output/evaluation/.

## Attribution and rights

Misviz: Jonathan Tonglet, Jan Zimny, Tinne Tuytelaars and Iryna Gurevych, _Is this chart lying to me? Automating the detection of misleading visualizations_, ACL 2026. [Paper](https://arxiv.org/abs/2508.21675). Dataset metadata and derived evaluation files in this directory use **CC-BY-SA 4.0**; see [LICENSE.txt](LICENSE.txt). Source images retain their respective owners' rights. Original ChartTruth application/evaluation script code remains MIT.
