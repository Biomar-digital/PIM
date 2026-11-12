"""Download the product bag packshots from biomar.com and attach them to the products.

Usage:
    python3 -I scripts/fetch_bags.py            # uses src/data/seed.json for the product list
    python3 -I scripts/build_seed.py <export>   # then rebuild the seed so the bags become assets

For each product we open https://www.biomar.com/feed-services/all-feed/<websiteSlug>,
read the page's og:image (the product packshot) and save a small WebP copy to
src/assets/bags/<product-id>.webp. src/assets/bags/index.json records the source URL.
"""

import json
import os
import re
import subprocess
import sys

SITE = "https://www.biomar.com"
OUT = "src/assets/bags"
WIDTH = 420  # px; small enough to ship hundreds of packshots inside the app


def curl(url, out=None):
    args = ["curl", "-sS", "-L", "--max-time", "30", "-A", "Mozilla/5.0 (PIM asset import)"]
    if out:
        args += ["-o", out, "-w", "%{http_code}"]
    r = subprocess.run(args + [url], capture_output=True, text=not out)
    return r.stdout if not out else r.stdout.decode()


def find_image(p):
    """(product id, packshot URL or None, note) from the product page's og:image."""
    page = curl(f"{SITE}/feed-services/all-feed/{p['websiteSlug']}")
    m = re.search(r'property="og:image"\s+content="([^"]+)"', page) or re.search(r'og:image" content="([^"]+)"', page)
    if not m or "/media/" not in m.group(1) or "logo" in m.group(1).lower():
        return p["id"], None, "no product image on the website"
    src = m.group(1).split("?")[0]
    if not re.search(r"\.(png|jpe?g|webp)$", src, re.I):  # missing pages fall back to a "not found" video
        return p["id"], None, f"no packshot ({src.rsplit('/', 1)[-1]})"
    return p["id"], src, ""


def file_name(src):
    """One file per image: products that share a packshot share the file."""
    return re.sub(r"[^a-z0-9]+", "-", src.rsplit("/", 1)[-1].rsplit(".", 1)[0].lower()).strip("-") + ".webp"


def download(src):
    out = os.path.join(OUT, file_name(src))
    code = curl(f"{src}?width={WIDTH}&format=webp&quality=80", out)
    return src, code


def main():
    from concurrent.futures import ThreadPoolExecutor
    seed = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "src/data/seed.json", encoding="utf-8"))
    os.makedirs(OUT, exist_ok=True)
    with ThreadPoolExecutor(max_workers=8) as pool:
        found = list(pool.map(find_image, seed["products"]))
        urls = sorted({src for _, src, _ in found if src})
        codes = dict(pool.map(download, urls))
    index, missing = {}, []
    for pid, src, note in found:
        if not src or codes.get(src) != "200":
            missing.append(pid)
            print(f"--  {pid}: {note or 'download failed'}")
            continue
        f = file_name(src)
        index[pid] = {"file": f, "url": src, "fileName": f, "sizeKb": max(1, os.path.getsize(os.path.join(OUT, f)) // 1024)}
    used = {v["file"] for v in index.values()}
    for f in os.listdir(OUT):
        if f.endswith(".webp") and f not in used:
            os.remove(os.path.join(OUT, f))
    json.dump(dict(sorted(index.items())), open(os.path.join(OUT, "index.json"), "w"), indent=1)
    print(f"\n{len(index)} products have a packshot ({len(used)} different images); {len(missing)} have none on the website")


if __name__ == "__main__":
    main()
