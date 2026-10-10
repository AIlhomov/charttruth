"""Download a deterministic, pre-analysis external chart sample. No app fixtures."""
import concurrent.futures
import hashlib
import io
import json
from pathlib import Path
import urllib.request
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/evaluation"
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "images").mkdir(exist_ok=True)
metadata_url = "https://raw.githubusercontent.com/UKPLab/acl2026-misviz/6a6612b4a3216ea4eaef157043347c0405d70f0a/data/misviz/misviz.json"
with urllib.request.urlopen(metadata_url, timeout=30) as response:
    metadata_bytes = response.read()
records = json.loads(metadata_bytes)
pool = [r for r in records if r["chart_type"] == ["bar chart"]]
pool.sort(key=lambda r: hashlib.sha256(("ChartTruth-2026:" + r["image_path"]).encode()).hexdigest())

def fetch(record):
    try:
        request = urllib.request.Request(record["image_url"], headers={"User-Agent": "ChartTruth-research/1.0"})
        with urllib.request.urlopen(request, timeout=18) as response:
            data = response.read(10_000_001)
        if len(data) > 10_000_000:
            raise ValueError("larger than 10 MB")
        image = Image.open(io.BytesIO(data))
        if image.format not in ("PNG", "JPEG", "WEBP") or min(image.size) < 100:
            raise ValueError("unsupported format or dimensions")
        return {"record": record, "bytes": data, "width": image.width, "height": image.height, "format": image.format}
    except Exception as error:
        return {"record": record, "error": str(error)}

selected, unavailable = [], []
# Results retain deterministic order, independent of network completion and analysis.
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
    for result in executor.map(fetch, pool[:45]):
        if len(selected) == 20:
            break
        record = result["record"]
        if "error" in result:
            unavailable.append({"id": record["image_path"], "url": record["image_url"], "error": result["error"]})
            continue
        number = len(selected) + 1
        extension = {"PNG": "png", "JPEG": "jpg", "WEBP": "webp"}[result["format"]]
        filename = f"{number:02d}.{extension}"
        (OUT / "images" / filename).write_bytes(result["bytes"])
        selected.append({
            "number": number, "file": filename, "dataset_id": record["image_path"],
            "url": record["image_url"], "dataset_labels": record["misleader"],
            "split": record["split"], "sha256": hashlib.sha256(result["bytes"]).hexdigest(),
            "width": result["width"], "height": result["height"],
        })
        print(f"Downloaded {number:02d}: {record['image_path']} ({result['width']} x {result['height']})", flush=True)

manifest = {
    "protocol": "First 20 downloadable PNG/JPEG/WebP single-type bar-chart records ordered by SHA256('ChartTruth-2026:' + image_path), selected before application analysis. Downloads under 10 MB and dimensions >=100px. No selection by extraction success.",
    "metadata_url": metadata_url, "metadata_sha256": hashlib.sha256(metadata_bytes).hexdigest(),
    "dataset": "Misviz (Tonglet, Zimny, Tuytelaars, Gurevych, ACL 2026)",
    "dataset_license": "CC-BY-SA-4.0; individual chart source rights remain with their owners. Image files are not committed to the app repository.",
    "selected": selected, "unavailable_before_selection_completed": unavailable,
}
(ROOT / "docs/evaluation").mkdir(parents=True, exist_ok=True)
(ROOT / "docs/evaluation/manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
sheet = Image.new("RGB", (1800, 5 * 360), "#e7e9ef")
draw = ImageDraw.Draw(sheet)
for index, item in enumerate(selected):
    image = Image.open(OUT / "images" / item["file"]).convert("RGB")
    image.thumbnail((430, 315))
    x, y = (index % 4) * 450, (index // 4) * 360
    sheet.paste(image, (x + (450 - image.width)//2, y + 28))
    draw.text((x+10, y+7), f"{index+1:02d} | {item['width']}x{item['height']} | {', '.join(item['dataset_labels']) or 'no dataset misleader'}", fill="#111111")
sheet.save(OUT / "contact-sheet.jpg")
print(f"Selected {len(selected)} charts; {len(unavailable)} prior network/format exclusions.")
if len(selected) != 20:
    raise SystemExit("Could not obtain 20 external charts.")
