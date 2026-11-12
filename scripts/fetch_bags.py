"""Download the product bag packshots from biomar.com and attach them to the products.

Usage:
    python3 -I scripts/fetch_bags.py            # uses src/data/seed.json for the product list
    python3 -I scripts/build_seed.py <export>   # then rebuild the seed so the bags become assets

For each product we open https://www.biomar.com/feed-services/all-feed/<websiteSlug>,
read the page's og:image (the product packshot) and save a 600 px WebP copy to
src/assets/bags/<product-id>.webp. src/assets/bags/index.json records the source URL.
"""

import json
import os
import re
import subprocess
import sys

SITE = "https://www.biomar.com"
OUT = "src/assets/bags"


def curl(url, out=None):
    args = ["curl", "-sS", "-L", "--max-time", "30", "-A", "Mozilla/5.0 (PIM asset import)"]
    if out:
        args += ["-o", out, "-w", "%{http_code}"]
    r = subprocess.run(args + [url], capture_output=True, text=not out)
    return r.stdout if not out else r.stdout.decode()


def main():
    seed = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "src/data/seed.json", encoding="utf-8"))
    os.makedirs(OUT, exist_ok=True)
    index = {}
    missing = []
    for p in seed["products"]:
        page = curl(f"{SITE}/feed-services/all-feed/{p['websiteSlug']}")
        m = re.search(r'property="og:image"\s+content="([^"]+)"', page) or re.search(r'og:image" content="([^"]+)"', page)
        if not m or "/media/" not in m.group(1) or "logo" in m.group(1).lower():
            missing.append(p["id"])
            print(f"--  {p['id']}: no product image on the website")
            continue
        src = m.group(1).split("?")[0]
        fname = f"{p['id']}.webp"
        code = curl(f"{src}?width=600&format=webp&quality=82", os.path.join(OUT, fname))
        if code != "200":
            missing.append(p["id"])
            print(f"!!  {p['id']}: HTTP {code} for {src}")
            continue
        size = os.path.getsize(os.path.join(OUT, fname))
        original = src.rsplit("/", 1)[-1]
        index[p["id"]] = {"file": fname, "url": src, "fileName": re.sub(r"\.\w+$", "", original) + ".webp", "sizeKb": max(1, size // 1024)}
        print(f"ok  {p['id']}: {original} ({size // 1024} KB)")
    json.dump(index, open(os.path.join(OUT, "index.json"), "w"), indent=1)
    print(f"\n{len(index)} bags downloaded, {len(missing)} products without a website image")


if __name__ == "__main__":
    main()
