"""Collect product content from biomar.com that is not in the CMS export.

Usage:
    python3 -I scripts/fetch_website_content.py      # writes src/data/website.json
    python3 -I scripts/build_seed.py <export-dir>     # uses it

Product pages (/feed-services/all-feed/<slug>) give: Brand, Stage, Category.
Range pages (/feed-services/feed-solutions/<range>) give: tagline, sub-headline, intro and
the "Benefits" list, plus translated versions linked with hreflang (e.g. /no-no/..., /es-cl/...).
"""

import html
import json
import re
import subprocess
import sys

SITE = "https://www.biomar.com"
OUT = "src/data/website.json"

# Range pages that exist on biomar.com (from /feed-services/feed-solutions)
RANGE_PAGES = {
    "POWER": "power", "SmartCare": "smartcare", "Blue Impact": "blue-impact", "LARVIVA": "larviva",
    "ORBIT": "orbit", "EXIA": "exia", "EFICO": "efico", "MAXIO": "maxio", "Symbio": "symbio",
}

# URL language prefix -> PIM locale id
PREFIX_LOCALE = {
    "no-no": "nn-NO", "en-au": "en-AU", "es-cl": "es-CL", "en-gb": "en-GB", "da-dk": "da-DK", "sv-se": "sv-SE",
    "fi-fi": "fi-FI", "de-de": "de-DE", "fr-fr": "fr-FR", "es-es": "es-ES", "it-it": "it-IT", "el-gr": "el-GR",
    "tr-tr": "tr-TR", "pl-pl": "pl-PL", "es-ec": "es-EC", "es-cr": "es-CR", "vi-vn": "vi-VN", "en-ph": "en-PH",
    "zh-cn": "zh", "zh": "zh",
}

BENEFIT_HEADINGS = {"benefits", "fordeler", "fordele", "fördelar", "beneficios", "vorteile", "avantages", "vantaggi",
                    "korzyści", "edut", "faydalar", "οφέλη", "lợi ích", "优势"}
STOP = {"please select a species", "stage", "species", "faq"}


def get(url):
    r = subprocess.run(["curl", "-sS", "-L", "--max-time", "30", "-A", "Mozilla/5.0 (PIM content import)", url],
                       capture_output=True)
    return r.stdout.decode("utf-8", "replace")


def text_lines(page, keep_header=False):
    drop = "script|style|svg|noscript|nav|footer|template" + ("" if keep_header else "|header")
    s = re.sub(rf"<({drop})[^>]*>.*?</\1>", "", page, flags=re.S)
    m = re.search(r"<main.*?</main>", s, re.S)
    s = m.group(0) if m else s
    s = re.sub(r"<(br|/p|/li|/h\d|/div)[^>]*>", "\n", s)
    s = re.sub(r"<(strong|b|em|i|span|a)( [^>]*)?>|</(strong|b|em|i|span|a)>", "", s)  # keep inline text together
    t = html.unescape(re.sub(r"<[^>]+>", "\n", s))
    out = []
    for line in t.split("\n"):
        line = re.sub(r"\s+", " ", line).strip()
        if not line or any(c in line for c in "[]{}$") or line == "­":
            continue
        out.append(line)
    return out


def species_names():
    seed = json.load(open("src/data/seed.json", encoding="utf-8"))
    return {p["species"].lower() for p in seed["products"]} | {"arctic char", "chinook salmon", "kingfish", "cod", "catfish"}


def parse_range(page, name, species):
    lines = text_lines(page)
    try:
        i = next(k for k, l in enumerate(lines) if l.lower() == name.lower())
    except StopIteration:
        return None
    tagline = lines[i + 1] if i + 1 < len(lines) else ""
    rest = lines[i + 2:]
    sub = ""
    first = rest[0].lower() if rest else ""
    if rest and first != name.lower() and len(rest[0]) > 15 and not first.startswith("biomar") \
            and not first.startswith(name.lower() + " ") and not first.startswith("our ") and len(rest[0]) < 120:
        sub = rest[0]
        rest = rest[1:]
    intro, benefits, mode = [], [], "intro"
    for l in rest:
        low = l.lower()
        if low in STOP or low in species or low.startswith("please select") or low.startswith("how does"):
            break
        if low in BENEFIT_HEADINGS:
            mode = "benefits"
            continue
        if mode == "intro":
            intro.append(l)
        elif l.endswith("?"):  # "How does your fish benefit from EFICO?" heading ends the list
            break
        elif len(l) > 3:
            benefits.append(l.lstrip("•· ").strip())
        if len(benefits) >= 5:
            break
    intro_text = re.sub(r"\s+([,.;:])", r"\1", " ".join(intro)).strip()
    return {"tagline": tagline, "subheadline": sub, "intro": intro_text, "benefits": benefits}


LABELS = {"Species": "species", "Brand": "brand", "Stage": "stages", "Stages": "stages",
          "Category": "categories", "Categories": "categories"}


def parse_product(page):
    """Header facts on a product page. Values run until the next label or 'Contact Us'."""
    lines = text_lines(page, keep_header=True)
    out, key = {}, None
    for l in lines:
        if l in LABELS:
            key = LABELS[l]
            out.setdefault(key, [])
            continue
        if l == "Contact Us" or l == "Product Features":
            if key:
                key = None
            if "species" in out:
                break
            continue
        if key:
            out[key] += [x.strip() for x in l.split(",") if x.strip()]
    if "brand" in out:
        out["brand"] = out["brand"][0] if out["brand"] else None
    return out


def main():
    seed = json.load(open("src/data/seed.json", encoding="utf-8"))
    species = species_names()
    data = {"ranges": {}, "products": {}}

    for rng, slug in RANGE_PAGES.items():
        url = f"{SITE}/feed-services/feed-solutions/{slug}"
        page = get(url)
        parsed = parse_range(page, rng, species)
        if not parsed:
            print(f"!! could not parse range page {url}")
            continue
        parsed["url"] = url
        parsed["locales"] = {}
        for alt in re.findall(r'<link rel="alternate" href="([^"]+)" hreflang="[^"]+"', page):
            m = re.match(r"https://www\.biomar\.com/([a-z]{2}(?:-[a-z]{2})?)/", alt)
            loc = PREFIX_LOCALE.get(m.group(1)) if m else None
            if not loc:
                continue
            lp = parse_range(get(alt), rng, species)
            if lp and lp["tagline"] and not lp["tagline"].endswith(","):
                lp["benefits"] = lp["benefits"][: max(len(parsed["benefits"]), 0)]
                lp["url"] = alt
                parsed["locales"][loc] = lp
        data["ranges"][rng] = parsed
        print(f"{rng:12} {parsed['tagline']!r} | {len(parsed['benefits'])} benefits | locales: {', '.join(parsed['locales']) or '-'}")

    from concurrent.futures import ThreadPoolExecutor

    def product(p):
        url = f"{SITE}/feed-services/all-feed/{p['websiteSlug']}"
        info = parse_product(get(url))
        info["url"] = url
        return p["id"], info

    with ThreadPoolExecutor(max_workers=8) as pool:
        for pid, info in pool.map(product, seed["products"]):
            data["products"][pid] = info
    cats = sorted({c for v in data["products"].values() for c in v.get("categories", [])})
    print(f"\n{len(data['products'])} product pages. Categories: {cats}")
    json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
