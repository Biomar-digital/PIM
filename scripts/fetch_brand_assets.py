"""Download BioMar visual assets from biomar.com for the PIM interface.

- species/<slug>.webp  navy species icons, as used on biomar.com's species tiles
- flags/<code>.svg     country flags, as used in biomar.com's site selector
- photos/<name>.webp   aquaculture photography for page headers

Usage: python3 -I scripts/fetch_brand_assets.py
"""
import json
import os
import re
import subprocess

BASE = "https://www.biomar.com"
OUT = "src/assets/brand"
PAGES = ["/", "/feed-services", "/sustainability", "/about-biomar", "/feed-services/feed-solutions/power"]

# File name on biomar.com -> species name in the PIM
SPECIES_FILES = {
    "arctic-char": "Arctic Char", "atlantic-salmon": "Atlantic Salmon", "ballan-wrasse": "Ballan Wrasse",
    "barramundi": "Barramundi", "cat-fish": "Catfish", "chinook-salmon": "Chinook Salmon", "cobia": "Cobia",
    "atlantic-cod": "Cod", "coho-slamon": "Coho Salmon", "european-eel": "Eel", "golden-pompano": "Golden Pompano",
    "grouper": "Grouper", "large-mouth-bass": "Largemouth Bass", "large-yellow-croaker": "Large Yellow Croaker",
    "longfin-yellowtail": "Longfin Yellowtail", "lumpfish": "Lumpfish", "meagre": "Meagre", "murray-cod": "Murray Cod",
    "pike-perch": "Pike Perch", "red-drum": "Red Drum", "red-sea-bream": "Red Sea Bream", "sea-bass": "Sea Bass",
    "sea-bream": "Sea Bream", "shrimp": "Shrimp", "red-snapper": "Snapper", "sole": "Sole", "striped-catfish": "Striped Catfish",
    "striped-bass": "Striped Bass", "siberian-sturgeon": "Sturgeon", "tilapia": "Tilapia", "totoaba": "Totoaba",
    "final_salmon": "Triploid Salmon", "trout": "Trout", "turbot": "Turbot", "whitefish": "Whitefish",
    "yellowtail-kingfish": "Yellowtail Kingfish",
}
# Flag file -> locale id
FLAGS = {"dk": "da-DK", "au": "en-AU", "gb": "en-GB", "fi": "fi-FI", "fr": "fr-FR", "de": "de-DE", "gr": "el-GR", "it": "it-IT",
         "no-1": "nn-NO", "pl": "pl-PL", "cl": "es-CL", "cr": "es-CR", "ec": "es-EC", "es": "es-ES", "tr": "tr-TR", "vn": "vi-VN",
         "se": "sv-SE", "cn": "zh", "ph": "en-PH"}
PHOTOS = {
    "salmon-feeding-underwater": "salmonid-salmon-atlantic-grower-feed-underwater",
    "salmon-underwater": "salmon-atlantic-grower-norway-underwater-feed-fish",
    "feed-farm": "feed_feeding_farm",
    "pellets-in-hands": "image-feed-pellet-hands-barramundi",
    "salmon-farm": "biomar-akaroa-salmon",
}


def get(url, binary=False):
    r = subprocess.run(["curl", "-sL", "--max-time", "40", url], capture_output=True)
    return r.stdout if binary else r.stdout.decode("utf-8", "replace")


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main():
    html = "".join(get(BASE + p) for p in PAGES)
    urls = set(re.findall(r'(?:data-src|content)="((?:https://www\.biomar\.com)?/media/[^"?]+)', html))
    index = {"species": {}, "flags": {}, "photos": {}}
    for d in ("species", "flags", "photos"):
        os.makedirs(f"{OUT}/{d}", exist_ok=True)
    for u in sorted(urls):
        path = u.replace(BASE, "")
        name = path.rsplit("/", 1)[-1].rsplit(".", 1)[0]
        ext = path.rsplit(".", 1)[-1]
        if "fish" in name and ext in ("png", "svg"):
            key = next((k for k in sorted(SPECIES_FILES, key=len, reverse=True) if k in name), None)
            if key and SPECIES_FILES[key] not in index["species"]:
                q = "" if ext == "svg" else "?width=240&format=webp&quality=85"
                data = get(BASE + path + q, True)
                fn = f"{slug(SPECIES_FILES[key])}.{'svg' if ext == 'svg' else 'webp'}"
                open(f"{OUT}/species/{fn}", "wb").write(data)
                index["species"][SPECIES_FILES[key]] = fn
        elif ext == "svg" and name in FLAGS:
            open(f"{OUT}/flags/{FLAGS[name]}.svg", "wb").write(get(BASE + path, True))
            index["flags"][FLAGS[name]] = f"{FLAGS[name]}.svg"
        elif ext in ("jpg", "jpeg"):
            for key, frag in PHOTOS.items():
                if frag in name and key not in index["photos"]:
                    open(f"{OUT}/photos/{key}.webp", "wb").write(get(BASE + path + "?width=1600&format=webp&quality=72", True))
                    index["photos"][key] = f"{key}.webp"
    json.dump(index, open(f"{OUT}/index.json", "w"), indent=1, sort_keys=True)
    print({k: len(v) for k, v in index.items()}, "missing species:", sorted(set(SPECIES_FILES.values()) - set(index["species"])))


if __name__ == "__main__":
    main()
