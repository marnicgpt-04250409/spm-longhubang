"""Extract reviewed figure regions from the retained original MRSM page renders."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / "tmp/trial-source-inventory/images"
output = root / "assets/question-images/biologi-mrsm-2025"
output.mkdir(parents=True, exist_ok=True)
# Bounds are fractions of the reviewed original page, retaining all diagram labels.
regions = {
    "q35-rajah27": (34, (0.135, 0.158, 0.965, 0.345)),
    "q37-jadual1": (35, (0.15, 0.163, 0.82, 0.572)),
    "q38-charts": (36, (0.11, 0.265, 0.94, 0.82)),
    "q40-rajah28": (38, (0.16, 0.165, 0.90, 0.575)),
}
for name, (page, bounds) in regions.items():
    image = Image.open(source / f"2025-biologi-mrsm-page-{page:02}.png")
    w, h = image.size
    box = tuple(round(value * (w if index % 2 == 0 else h)) for index, value in enumerate(bounds))
    figure = image.crop(box)
    destination = output / f"{name}.webp"
    figure.save(destination, "WEBP", lossless=True)
    print(f"{name}: {figure.width}x{figure.height}, {destination.stat().st_size} bytes")
