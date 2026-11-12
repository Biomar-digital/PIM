"""Import BioMar product logos from the brand logo packs (zip files or folders).

Usage:
    python3 -I scripts/import_logos.py <zip-or-folder> [<zip-or-folder> ...]

Each pack has "Digital versions" PNGs named like
    Logo-<LABEL>-<Colour>.png        e.g. Logo-INICIO PLUS M-Celeste-Blue.png
We pick one colour variant per label (a coloured one, never White), scale it down and
write it to src/assets/logos/<slug>.png. The app matches products to logos by
normalised name (see src/lib/logos.ts), e.g. "INICIO Plus M" -> INICIOPLUSM.

Logos from the INICIO SHRIMP pack get a "SHRIMP" suffix on the key, so shrimp
products use the shrimp variant of INICIO logos.
"""

import io
import json
import os
import re
import sys
import zipfile

from PIL import Image

OUT_DIR = "src/assets/logos"
MAX_W, MAX_H = 480, 180

COLOURS = {
    "blue", "green", "white", "celeste", "skyblue", "grey", "orange", "red", "yellow", "teal",
    "orbitleaf", "orbitleaff", "oceanblue", "focusteal", "bb", "orbit teal", "rgb",
}


# Known typos in the logo packs
LABEL_FIXES = {"ASSEST": "ASSIST"}


def norm(s: str) -> str:
    """Matching key: upper case, '+' read as PLUS, everything else non-alphanumeric dropped.
    Must stay in sync with norm() in src/lib/logos.ts."""
    s = s.upper().replace("+", "PLUS")
    for wrong, right in LABEL_FIXES.items():
        s = s.replace(wrong, right)
    return re.sub(r"[^A-Z0-9]", "", s)


def parse(name: str):
    """'Logo-INICIO PLUS M-Celeste-Blue.png' -> ('INICIO PLUS M', ['Celeste', 'Blue'])"""
    base = os.path.basename(name)
    if not base.lower().endswith(".png") or not base.startswith("Logo-") or " + " in base or "Tagline" in base:
        return None
    parts = base[5:-4].split("-")
    colours = []
    while len(parts) > 1 and parts[-1].strip().lower() in COLOURS:
        colours.insert(0, parts.pop().strip())
    label = "-".join(parts).strip()
    if label.lower().endswith(" logo"):
        label = label[:-5]
    return label, colours


def score(colours):
    c = [x.lower() for x in colours]
    if not c or "white" in c[:1] or c == ["white"]:
        return -10
    if len(c) > 1 or c[0] not in ("blue",):
        return 2  # two-tone / brand-coloured version
    return 1


def entries(src):
    """Yield (path, bytes) for every PNG in a zip or folder."""
    if os.path.isdir(src):
        for root, _, files in os.walk(src):
            for f in files:
                p = os.path.join(root, f)
                with open(p, "rb") as fh:
                    yield p, fh.read()
    else:
        with zipfile.ZipFile(src) as z:
            for n in z.namelist():
                if n.lower().endswith(".png"):
                    yield n, z.read(n)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    index_path = os.path.join(OUT_DIR, "index.json")
    index = json.load(open(index_path)) if os.path.exists(index_path) else {}
    best = {}
    for src in sys.argv[1:]:
        for path, data in entries(src):
            if "__MACOSX" in path or "Print versions" in path:
                continue
            parsed = parse(path)
            if not parsed:
                continue
            label, colours = parsed
            if "white" in label.lower():  # e.g. "QardioWhite-Green" (missing dash) is a white variant
                continue
            shrimp = "INICIO SHRIMP" in path and not norm(label).endswith("SHRIMP")
            key = norm(label) + ("SHRIMP" if shrimp else "")
            if norm(label) == "BIOMAR":
                key = "BIOMAR"
            s = score(colours)
            if s < 0:
                continue
            if key not in best or s > best[key][0]:
                best[key] = (s, label + (" (shrimp)" if shrimp else ""), "-".join(colours), data)

    for key, (_, label, colour, data) in sorted(best.items()):
        img = Image.open(io.BytesIO(data)).convert("RGBA")
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
        img.thumbnail((MAX_W, MAX_H), Image.LANCZOS)
        fname = key.lower() + ".png"
        # palette PNG keeps logos crisp at a fraction of the size
        img.quantize(colors=64, method=Image.Quantize.FASTOCTREE).save(os.path.join(OUT_DIR, fname), optimize=True)
        index[key] = {"label": label, "colour": colour, "file": fname}
        print(f"{key:28} {label} ({colour})")

    json.dump(dict(sorted(index.items())), open(index_path, "w"), indent=1)
    print(f"{len(best)} logos written to {OUT_DIR}")


if __name__ == "__main__":
    main()
