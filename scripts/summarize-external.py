"""Publish reproducible observations, including low coverage and initial failures."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
manifest_path = root / "docs/evaluation/manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["metadata_url"] = "https://raw.githubusercontent.com/UKPLab/acl2026-misviz/6a6612b4a3216ea4eaef157043347c0405d70f0a/data/misviz/misviz.json"
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
initial_path = root / "output/evaluation/initial-results.json"
if not initial_path.exists():
    initial_path = root / "docs/evaluation/initial-results.json"
initial = json.loads(initial_path.read_text(encoding="utf-8"))
final = json.loads((root / "output/evaluation/raw-results.json").read_text(encoding="utf-8"))
scope = [
    "Dark/patterned background and non-flat fills", "Horizontal photo infographic",
    "Zero-height categories and axis-connected shapes; incomplete bar set", "Legend-series roles cannot be resolved; no individual category labels",
    "Horizontal bars", "Horizontal stacked bars", "Horizontal decorative bars",
    "3D cylinders, gradient background, no numeric axis", "Horizontal bars",
    "Many bars, two series and dual axes", "Grouped series and non-English/rotated labels",
    "Horizontal 3D bars; 67.1 megapixels exceeds input limit",
    "Single vertical series, small text and rotated category labels; numerical recovery with manual label review",
    "Stacked multi-series chart with embedded table", "Decorative horizontal bars",
    "Gradient TV infographic without numeric y-axis", "Two chart panels in a single image",
    "Horizontal stacked bars", "3D perspective bars", "Horizontal infographic",
]
reference_values = [2, 5, 14, 18, 4, 8, 7, 10]
reference_labels = ["May", "March", "June", "July", "January", "February", "August", "April"]
rows = []
for before, result, observation in zip(initial, final, scope):
    row = {"number": result["number"], "initial_status": before["status"], "final_status": result["status"], "visual_scope_review": observation}
    if result["status"] == "completed":
        data = result["report"]["data"]
        row.update({
            "extracted": [{key: d.get(key) for key in ("label", "value", "source", "uncertainty", "valueConfidence", "labelConfidence")} for d in data],
            "reference_values": reference_values, "reference_labels": reference_labels,
            "reference_method": "Manually transcribed from the published chart, not inferred from the app output.",
            "values_within_0_5_units": sum(abs(d["value"]-v)<=0.5 for d,v in zip(data,reference_values)) if len(data)==8 else 0,
            "exact_category_labels": sum(d["label"]==v for d,v in zip(data,reference_labels)),
            "review_required": True,
        })
    else:
        row["reason"] = result["reason"].split("\n\n")[1]
        row["automatic_findings"] = result.get("findings", [])
    rows.append(row)
summary = {
    "date": "2026-10-10", "sample_size": 20, "initial_completed": 0,
    "final_completed": sum(r["final_status"]=="completed" for r in rows),
    "final_rejected": sum(r["final_status"]=="rejected" for r in rows),
    "limitation": "Exploratory stress test, not representative accuracy or a held-out benchmark. The broad collection mostly lies outside the declared automatic scope. Case 13 informed fixes and is no longer held out. OCR category labels remain poor in that case.",
    "cases": rows,
}
(root / "docs/evaluation/results.json").write_text(json.dumps(summary,indent=2)+"\n",encoding="utf-8")
lines=["# External chart evaluation", "", "**20 real external charts; 1 numerical reconstruction, 19 rejections.** The reconstructed chart needs manual label correction. This is limited coverage, not a 100% accuracy result.", "", "Selected before analysis from [Misviz](https://github.com/UKPLab/acl2026-misviz) by the deterministic protocol in [manifest.json](manifest.json). Original source URLs, byte hashes, dimensions and dataset annotations are retained. No external images are committed or added to the sample gallery.", "", "The first run rejected all 20. Investigation of case 13 exposed a lost short bar, missing dense-axis baseline text, and small-text OCR errors. The follow-up adds shorter-component detection, spatial category-coverage checks, adaptive tick crops and confidence-based OCR retry merging. The same case was used during those fixes, so these are **exploratory post-fix results**, not held-out performance.", "", "Case 13 recovers all eight numerical values within 0.5 source units of manual transcription. Three are explicitly height estimates; the largest numerical difference is about 0.18 units. **0/8 category labels match exactly** before manual correction. No automatic ordering analysis is claimed; Misviz annotates this chart for inappropriate item order, which ChartTruth does not detect.", "", "Most other cases are horizontal, stacked, grouped, 3D, multi-panel or lack a usable axis. Each rejection displayed an explanation and issued no automatic finding. This does not prove safe handling of every unsupported chart. Manual reconstruction remains available.", "", "| Case | Final outcome | Visual scope review |", "| --- | --- | --- |"]
for r in rows:
    lines.append(f"| {r['number']:02d} | {r['final_status']} | {r['visual_scope_review']} |")
lines += ["", "## Reproduce", "", "Requires Python with Pillow and the normal Node development dependencies. Download URLs may change; validate the recorded SHA-256 hashes before comparing results.", "", "```sh", "python scripts/fetch-external.py", "# Start npm run dev or npm run preview in another terminal.", "node scripts/evaluate-external.mjs", "python scripts/summarize-external.py", "```", "", "The evaluator defaults to http://127.0.0.1:4173; CHARTTRUTH_TEST_URL selects another served build. It uploads actual image files through the UI and exports actual JSON reports. Its automated confirm click enables report download; it does not constitute human verification. Raw screenshots/reports and the frozen initial run remain locally under output/evaluation/.", "", "## Attribution and rights", "", "Misviz: Jonathan Tonglet, Jan Zimny, Tinne Tuytelaars and Iryna Gurevych, *Is this chart lying to me? Automating the detection of misleading visualizations*, ACL 2026. [Paper](https://arxiv.org/abs/2508.21675). Dataset metadata and derived evaluation files in this directory use **CC-BY-SA 4.0**; see [LICENSE.txt](LICENSE.txt). Source images retain their respective owners' rights. Original ChartTruth application/evaluation script code remains MIT.", ""]
(root / "docs/evaluation/README.md").write_text("\n".join(lines),encoding="utf-8")
print(f"Published evaluation summary for {len(rows)} charts.")
