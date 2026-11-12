"""Build the PIM sample dataset from a BioMar website (Umbraco) content export.

Usage:
    python3 -I scripts/build_seed.py <path-to-unzipped-export> [src/data/seed.json]

The export holds one .uda (JSON) file per product page. We read the product
name, feed solution (range), production stages, the published cultures and
the rich-text "productFeatures" field per culture, then turn that into the PIM
data model (one global master record + market/language variants).

Product copy comes from the export and biomar.com; logos and packshots are real
files. Workflow status, people and dates are sample values so the prototype can
show the full workflow. Everything is deterministic (fixed random seed).
Fields that are not on the website (product code, pellet sizes, packaging, feed
type) are left empty.
"""

import glob
import html
import json
import os
import random
import re
import sys

EXPORT_DIR = sys.argv[1] if len(sys.argv) > 1 else "export"
OUT = sys.argv[2] if len(sys.argv) > 2 else "src/data/seed.json"

# Umbraco node ids (last 6 chars of the udi) -> labels, identified from product names.
FEED_SOLUTIONS = {
    "177f4d": "LARVIVA", "821d6e": "EFICO", "c3dc72": "SmartCare", "35c9c6": "POWER",
    "da552a": "EXIA", "311a00": "ORBIT", "deabb7": "Blue Impact", "292a61": "MAXIO",
    "5b65d3": "Symbio",
}
STAGES = {
    "bf5dd5": "Grower", "85bc5c": "Hatchery", "1ccfa4": "Fry & fingerling", "215c58": "Smolt transfer",
}

# Spelling and naming differences between website pages -> one species name
SPECIES_FIX = {
    "trout": "Trout", "largemouth bass": "Largemouth Bass", "stripped bass": "Striped Bass", "stribed bass": "Striped Bass",
    "berggylt": "Ballan Wrasse", "barra": "Barramundi", "salmon": "Atlantic Salmon", "kingfish": "Yellowtail Kingfish",
    "seriola": "Yellowtail Kingfish", "yellowtail": "Longfin Yellowtail",
}

# Product pages that are not real products (archived, duplicates, test pages)
SKIP = re.compile(r"ARCHIVED|DUPLICATE|TEST|EXISTS|\(1\)")
PRODUCT_TYPE = "d835ea"  # Umbraco document type of product pages

# Species written in Chinese on China-market pages
CN_SPECIES = {
    "鲟鱼": "Sturgeon", "大菱鲆": "Turbot", "大黄鱼": "Large Yellow Croaker", "石斑鱼": "Grouper", "金鲳鱼": "Golden Pompano",
    "鳟鱼": "Trout", "加州鲈": "Largemouth Bass", "鳗鱼": "Eel", "对虾": "Shrimp",
}


# Range for products without a feed solution in the export, by the start of the name (case-insensitive)
RANGE_FROM_NAME = {
    "INICIO": "INICIO", "INTRO": "INTRO", "CPK": "CPK", "DAN-EX": "DAN-EX", "Ecolife": "Ecolife",
    "EGGSTRA": "EGGSTRA", "FINESTA": "FINESTA", "EFICO": "EFICO", "Symbio": "Symbio", "Tri": "TRI-X",
    "New Power": "POWER", "Power": "POWER", "Golden": "Golden", "Rainbow": "Rainbow", "Classic": "Classic",
    "Label Rouge": "Label Rouge", "Ocean King": "Ocean King", "King": "Ocean King", "ENERGY": "ENERGY", "Quinnat": "Quinnat", "SIRCLE": "SIRCLE",
    "Maxio": "MAXIO", "LARVIVA": "LARVIVA", "SmartCare": "SmartCare", "ORBIT": "ORBIT", "EXIA": "EXIA",
    "Blue Impact": "Blue Impact",
}

# Website content (taglines, range benefits, categories, stages) collected by
# scripts/fetch_website_content.py. Without it the fields stay empty.
WEBSITE_PATH = "src/data/website.json"
WEBSITE = json.load(open(WEBSITE_PATH, encoding="utf-8")) if os.path.exists(WEBSITE_PATH) else {"ranges": {}, "products": {}}

STAGE_ORDER = ["Hatchery", "Starter", "Transfer", "Grower"]

# People in the sample organisation
USERS = [
    {"id": "u-ingrid", "name": "Ingrid Solberg", "title": "Global Product Manager", "role": "global_editor", "markets": []},
    {"id": "u-marco", "name": "Marco Bianchi", "title": "Global Marketing Lead", "role": "approver", "markets": []},
    {"id": "u-thomas", "name": "Thomas Haugen", "title": "Marketing Coordinator, Norway", "role": "local_editor", "markets": ["nn-NO", "en-GB"]},
    {"id": "u-lars", "name": "Lars Nielsen", "title": "Marketing Coordinator, Nordics", "role": "local_editor", "markets": ["da-DK", "sv-SE", "fi-FI"]},
    {"id": "u-elena", "name": "Elena Papadopoulou", "title": "Marketing Manager, Mediterranean", "role": "local_editor", "markets": ["el-GR", "tr-TR", "it-IT", "es-ES", "fr-FR"]},
    {"id": "u-camila", "name": "Camila Rojas", "title": "Marketing Coordinator, Latin America", "role": "local_editor", "markets": ["es-CL", "es-EC", "es-CR"]},
    {"id": "u-minh", "name": "Nguyen Minh Anh", "title": "Marketing Coordinator, Asia-Pacific", "role": "local_editor", "markets": ["vi-VN", "en-AU", "zh"]},
    {"id": "u-sofie", "name": "Sofie Andersen", "title": "Digital Platforms", "role": "admin", "markets": []},
    {"id": "u-paul", "name": "Paul Becker", "title": "Sales Manager, Central Europe", "role": "viewer", "markets": ["de-DE", "pl-PL"]},
]
REVIEW_NOTES = [
    "Please align the key benefits with the latest global version.",
    "Short description is too long for the website product card – max 160 characters.",
    "Check the product name: we use the global name in this market.",
    "Remove the claim about reduced time at sea – not approved locally.",
]
_note_i = [0]


def next_note():
    _note_i[0] += 1
    return REVIEW_NOTES[_note_i[0] % len(REVIEW_NOTES)]


LOCAL_EDITOR_FOR = {m: u["id"] for u in USERS if u["role"] == "local_editor" for m in u["markets"]}

DISCLAIMER = re.compile(
    r"illustrat|ilustra|Produktbildene|assortment displayed|contact form|kontaktskjema|Bitte beachten|"
    r"Huomaa|Bemærk|observera|Obs!|Lütfen|Si prega|Veuillez|Tenga en|Prosimy|Λάβετε|请注意|Xin lưu|"
    r"Klik|Click|Kliknij|Klicka|Klicken|password|lösenord|adgangskode|fare click|Se avete|Napsauta|"
    r"poglądowy|^-$|Haga clic|Cliquez|Tıklay|κάντε κλικ|Πατήστε|Pinche",
    re.I,
)


def clean(markup):
    paras, items = [], []
    for m in re.finditer(r"<(p|li)>(.*?)</\1>", markup, re.S):
        tag, txt = m.group(1), m.group(2)
        txt = html.unescape(re.sub(r"<[^>]+>", "", txt)).replace("­", "").strip()
        if not txt:
            continue
        (items if tag == "li" else paras).append(txt)
    paras = [p for p in paras if p not in items and not DISCLAIMER.search(p)]
    return paras, items


def first_sentence(text, limit=240):
    """First full sentence of a text, or "" when it is too long to work as a short description."""
    m = re.match(r"(.+?[.!?。])(\s|$)", text)
    s = m.group(1) if m else text
    return s if len(s) <= limit else ""


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def iso(day_offset, hour=9):
    # Day 0 = 2026-11-12. Offsets are negative (in the past).
    import datetime as dt
    d = dt.datetime(2026, 11, 12, hour, 0) + dt.timedelta(days=day_offset, minutes=random.randint(0, 59))
    return d.strftime("%Y-%m-%dT%H:%M:00Z")


LOGOS = json.load(open("src/assets/logos/index.json", encoding="utf-8")) if os.path.exists("src/assets/logos/index.json") else {}


def norm(s):
    """Same matching key as scripts/import_logos.py and src/lib/logos.ts."""
    return re.sub(r"[^A-Z0-9]", "", s.upper().replace("+", "PLUS"))


BAGS_INDEX = "src/assets/bags/index.json"
BAGS = json.load(open(BAGS_INDEX, encoding="utf-8")) if os.path.exists(BAGS_INDEX) else {}


COPY_KEYS = ("tagline", "shortDescription", "description", "keyBenefits", "sellingPoints")


def earlier_version(copy):
    """A believable earlier version of a text: before the tagline and selling points were added
    (they came later from the range pages), or with one key benefit fewer."""
    prev = dict(copy)
    if copy.get("tagline") or copy.get("sellingPoints"):
        prev["tagline"] = ""
        prev["sellingPoints"] = []
        if len(copy.get("keyBenefits", [])) >= 3:
            prev["keyBenefits"] = copy["keyBenefits"][:-1]
        return prev
    if len(copy.get("keyBenefits", [])) >= 2:
        prev["keyBenefits"] = copy["keyBenefits"][:-1]
        return prev
    return None


def english_versions(status, version, copy):
    """English text of each approved version, keyed by version number.
    Approved product: the current text is the latest version. Draft or in approval:
    the current text is a proposed change on top of the last approved version."""
    prev = earlier_version(copy) or copy
    if status == "approved":
        return {str(version - 1): prev, str(version): copy}
    # The last approved version is `prev`; the one before it had one key benefit fewer
    before = dict(prev, keyBenefits=prev["keyBenefits"][:-1]) if len(prev.get("keyBenefits", [])) >= 2 else prev
    return {str(version - 1): before, str(version): prev}


def main():
    random.seed(42)
    docs = {}
    for f in glob.glob(EXPORT_DIR + "/*.uda"):
        j = json.load(open(f, encoding="utf-8"))
        n = j["Name"].strip()
        if j.get("PublishedVersion") and j.get("ContentType", "").endswith(PRODUCT_TYPE) and not SKIP.search(n):
            docs[n] = j

    # Species ids in the export -> English species name, learned from the English page names
    species_votes = {}
    for n, j in docs.items():
        parts = [x.strip() for x in n.split(" - ")]
        sp = j["PublishedVersion"]["Properties"].get("species")
        if len(parts) > 1 and isinstance(sp, str) and sp and re.match(r"^[A-Za-z ]+$", parts[1]):
            species_votes.setdefault(sp[-6:], {}).setdefault(parts[1], 0)
            species_votes[sp[-6:]][parts[1]] += 1
    SPECIES_BY_ID = {k: max(v, key=v.get) for k, v in species_votes.items()}

    products = []
    used_ids = set()
    for full in sorted(docs, key=str.lower):
        j = docs[full]
        props = j["PublishedVersion"]["Properties"]
        parts = [p.strip() for p in re.sub(r"\s*-\s*$", "", full).split(" - ")]
        name = parts[0]
        species = parts[1] if len(parts) > 1 else ""
        if len(parts) > 2:  # e.g. "DAN-EX - Eel - Grower" -> "DAN-EX Grower"
            name = f"{name} {parts[2]}"
        if name == "Symbio Lumpfish":
            name, species = "Symbio", "Lumpfish"
        sp_id = props.get("species") if isinstance(props.get("species"), str) else ""
        if not species or not re.match(r"^[A-Za-z ]+$", species):
            species = CN_SPECIES.get(species) or SPECIES_BY_ID.get(sp_id.split(",")[0][-6:], "") or species or "Various"
        species = SPECIES_FIX.get(species.lower(), species)
        fs = props.get("feedSolution")
        rng = FEED_SOLUTIONS.get(fs[-6:]) if isinstance(fs, str) and fs else None
        if not rng:
            rng = next((v for k, v in RANGE_FROM_NAME.items() if name.lower().startswith(k.lower())), name.split()[0])
        if name.upper().startswith("INICIO") or name.upper().startswith("INTRO"):
            rng = name.split()[0].upper()
        # Unique product id; China-market pages get a "-cn" suffix
        slug = slugify(f"{name}-{species}")
        if re.search(r"[^\x00-\x7f]", full):
            slug += "-cn"
        base, k = slug, 2
        while slug in used_ids:
            slug, k = f"{base}-{k}", k + 1
        used_ids.add(slug)
        stages_raw = props.get("stages") if isinstance(props.get("stages"), str) else ""
        stages = [STAGES[s[-6:]] for s in stages_raw.split(",") if s and s[-6:] in STAGES] or ["Grower"]
        # The export's stage ids are unlabelled; prefer the stages shown on the product page.
        web = WEBSITE["products"].get(slug, {})
        web_stages = [x.replace(" Feed", "") for x in web.get("stages", [])]
        stages = web_stages or [{"Fry & fingerling": "Starter", "Smolt transfer": "Transfer"}.get(x, x) for x in stages]
        stages = sorted(set(stages), key=STAGE_ORDER.index)

        content = {}
        pf = props.get("productFeatures") or {}
        for culture, v in pf.items():
            if not v:
                continue
            try:
                paras, items = clean(json.loads(v)["markup"])
            except Exception:
                continue
            if paras or items:
                content[culture] = {"paras": paras, "benefits": items}
        en = content.get("en", {"paras": [], "benefits": []})
        description = "\n\n".join(en["paras"])

        categories = [c.replace("\u200b", "").strip() for c in web.get("categories", [])]
        web_range = WEBSITE["ranges"].get(rng, {})

        # --- workflow state (illustrative) ---
        r = random.random()
        mk_status = "approved" if r < 0.6 else ("in_review" if r < 0.75 else "draft")
        mk_updated = random.randint(-120, -1) if mk_status == "approved" else random.randint(-21, -1)
        mk_version = random.randint(2, 6)
        random.random(), random.random()  # keep the random sequence stable
        tagline = web_range.get("tagline", "")
        selling = web_range.get("benefits", [])
        sources = {}
        if web.get("url"):
            for f in ("description", "keyBenefits", "categories", "stages"):
                sources[f] = web["url"]
        if web_range.get("url"):
            if tagline:
                sources["tagline"] = web_range["url"]
            if selling:
                sources["sellingPoints"] = web_range["url"]
        short = first_sentence(description) if description and random.random() < 0.85 else ""
        if short and web.get("url"):
            sources["shortDescription"] = web["url"]
        if not description:
            mk_status = "draft"

        # --- markets & variants ---
        cultures = [c for c in (j.get("PublishedCultures") or []) if c != "en"]
        variants = {}
        for c in cultures:
            loc = content.get(c)
            if not loc:
                continue
            same_as_global = c.startswith("en-") and loc["paras"] == en["paras"]
            vr = random.random()
            vstatus = "approved" if vr < 0.74 else ("in_review" if vr < 0.83 else "draft")
            outdated = random.random() < 0.15
            editor = LOCAL_EDITOR_FOR.get(c, "u-ingrid")
            web_loc = web_range.get("locales", {}).get(c, {})
            variants[c] = {
                "localName": "",
                "shortDescription": "" if same_as_global else (first_sentence(loc["paras"][0]) if loc["paras"] and random.random() < 0.88 else ""),
                "tagline": "" if same_as_global or web_loc.get("tagline") == tagline else web_loc.get("tagline", ""),
                "description": "" if same_as_global else "\n\n".join(loc["paras"]),
                "keyBenefits": [] if same_as_global else loc["benefits"],
                "sellingPoints": [] if same_as_global or web_loc.get("benefits") == selling else web_loc.get("benefits", []),
                "notes": "",
                "inheritsGlobal": same_as_global,
                "websiteStatus": "live" if vstatus == "approved" and random.random() < 0.85 else "not_live",
                "sourceVersion": mk_version - 1 if outdated else mk_version,
                "meta": {"status": vstatus, "updatedBy": editor, "updatedAt": iso(random.randint(-200, -2) if vstatus == "approved" else random.randint(-18, -1)),
                         **({"reviewNote": next_note()} if vstatus == "draft" and random.random() < 0.25 else {})},
            }
            # Last approved text of the translation, used to show approvers what changed
            vcopy = {k: variants[c][k] for k in COPY_KEYS}
            if vstatus == "approved":
                variants[c]["approved"] = vcopy
            else:
                prev_v = earlier_version(vcopy)
                if prev_v:
                    variants[c]["approved"] = prev_v
        # target markets: where variants exist + sometimes a market we have no copy for yet
        targets = list(variants.keys())
        extra_pool = {
            "Atlantic Salmon": ["nn-NO", "es-CL", "en-GB", "en-AU"], "Trout": ["fi-FI", "de-DE", "pl-PL", "tr-TR"],
            "Sea Bream": ["el-GR", "tr-TR", "es-ES"], "Sea Bass": ["el-GR", "tr-TR", "it-IT"],
            "Shrimp": ["es-EC", "vi-VN", "es-CR"], "Sturgeon": ["it-IT", "pl-PL"], "Tilapia": ["es-CR"],
        }.get(species, ["en-GB"])
        for m in extra_pool:
            if m not in targets and random.random() < 0.3:
                targets.append(m)

        owner = "u-ingrid" if random.random() < 0.7 else "u-sofie"
        url_names = props.get("umbracoUrlName") or {}
        website_slug = (url_names.get("en") if isinstance(url_names, dict) else None) or slugify(full)

        # --- assets: only real files (product logo from the brand packs, packshot from biomar.com) ---
        assets = []
        logo_key = next((k for k in (norm(name) + norm(species), norm(name), norm(rng)) if k in LOGOS), None)
        if logo_key:
            assets.append({
                "id": f"a-{slug}-logo", "type": "logo", "fileName": f"{LOGOS[logo_key]['label'].replace(' (shrimp)', '')} logo.png",
                "mime": "image/png", "sizeKb": max(1, os.path.getsize(f"src/assets/logos/{LOGOS[logo_key]['file']}") // 1024),
                "scope": "global", "source": "bundled", "file": f"logos/{LOGOS[logo_key]['file']}",
                "uploadedBy": "u-sofie", "uploadedAt": "2026-11-12T11:00:00Z",
            })
        bag = BAGS.get(slug)
        if bag:
            assets.append({
                "id": f"a-{slug}-bag", "type": "bag", "fileName": bag["fileName"], "mime": "image/webp",
                "sizeKb": bag["sizeKb"], "scope": "global", "source": "bundled", "file": f"bags/{bag['file']}",
                "sourceUrl": bag["url"], "uploadedBy": "website", "uploadedAt": "2026-11-12T12:00:00Z",
            })

        # --- history ---
        history = []
        created = iso(random.randint(-700, -400))
        history.append({"id": f"h-{slug}-1", "at": created, "by": owner, "section": "global", "action": "created", "summary": "Product created from the website import"})
        if description:
            history.append({"id": f"h-{slug}-2", "at": iso(mk_updated - random.randint(30, 200)), "by": owner, "section": "global", "action": "approved", "summary": f"Global content approved (version {mk_version - 1})"})
        history.append({"id": f"h-{slug}-3", "at": iso(mk_updated), "by": owner, "section": "global",
                        "action": {"approved": "approved", "in_review": "submitted", "draft": "edited"}[mk_status],
                        "summary": {"approved": f"Global content approved (version {mk_version})", "in_review": "Global content submitted for approval", "draft": "Global content edited"}[mk_status]})
        for c, v in variants.items():
            history.append({"id": f"h-{slug}-{c}", "at": v["meta"]["updatedAt"], "by": v["meta"]["updatedBy"], "section": c,
                            "action": {"approved": "approved", "in_review": "submitted", "draft": "edited"}[v["meta"]["status"]],
                            "summary": {"approved": "Translation approved", "in_review": "Translation submitted for approval", "draft": "Translation edited"}[v["meta"]["status"]]})
        history.sort(key=lambda h: h["at"], reverse=True)

        products.append({
            "id": slug,
            "code": "",
            "websiteSlug": website_slug,
            "name": name,
            "species": species,
            "range": rng,
            "categories": categories,
            "stages": stages,
            "feedType": "",
            "pelletSizes": [],
            "packaging": [],
            "notes": "",
            "sources": sources,
            "owner": owner,
            "lifecycle": "active",
            "status": {"status": mk_status, "updatedBy": owner if mk_status != "approved" else "u-marco", "updatedAt": iso(mk_updated)},
            "content": {
                "shortDescription": short,
                "tagline": tagline,
                "description": description,
                "keyBenefits": en["benefits"],
                "sellingPoints": selling,
                "version": mk_version,
            },
            "versions": english_versions(mk_status, mk_version, {
                "tagline": tagline, "shortDescription": short, "description": description,
                "keyBenefits": en["benefits"], "sellingPoints": selling,
            }),
            "markets": targets,
            "variants": variants,
            "assets": assets,
            "history": history,
            "createdAt": created,
        })

    seed = {"version": 8, "users": USERS, "products": products}
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(seed, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {len(products)} products to {OUT}")


if __name__ == "__main__":
    main()
