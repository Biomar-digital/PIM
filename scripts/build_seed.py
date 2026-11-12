"""Build the PIM sample dataset from a BioMar website (Umbraco) content export.

Usage:
    python3 -I scripts/build_seed.py <path-to-unzipped-export> [src/data/seed.json]

The export holds one .uda (JSON) file per product page. We read the product
name, feed solution (range), production stages, the published cultures and
the rich-text "productFeatures" field per culture, then turn that into the PIM
data model (one global master record + market/language variants).

Website copy is real. Workflow status, people, dates, pellet sizes, product
codes and assets are illustrative sample values so the prototype can show the
full workflow. Everything is deterministic (fixed random seed).
"""

import glob
import html
import json
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

# The products used in the prototype (website name -> overrides)
SELECTION = [
    "POWER - Atlantic Salmon", "POWER Extreme - Atlantic Salmon", "POWER Rainbow - Trout",
    "Blue Impact - Atlantic Salmon", "Blue Impact - Sturgeon",
    "SmartCare Resist Lice - Atlantic Salmon", "SmartCare Intro Q+ - Atlantic Salmon",
    "SmartCare Assist Skin - Atlantic Salmon", "SmartCare Focus - Trout", "SmartCare BeneFIT - Trout",
    "SmartCare Robust - Sea Bass", "SmartCare Forte - Sea Bream", "SmartCare Endurance - Atlantic Salmon",
    "ORBIT - Atlantic Salmon", "ORBIT - Trout", "ORBIT Intro - Atlantic Salmon",
    "EFICO Enviro - Trout", "EFICO Alpha - Trout", "EFICO Genio - Trout", "EFICO Sigma - Sturgeon",
    "EFICO - Sea Bream", "EFICO - Sea Bass", "EFICO Cromis - Tilapia",
    "INICIO Plus - Trout", "INICIO Plus S - Atlantic Salmon", "INICIO Plus M - Sea Bream",
    "INTRO Plus MT - Sea Bass", "INTRO - Atlantic Salmon", "CPK - Atlantic Salmon",
    "LARVIVA Prostart - Trout", "LARVIVA Prostart - Sea Bream", "LARVIVA Multigain - Sea Bass",
    "LARVIVA Prowean - Sturgeon", "LARVIVA PL - Shrimp", "LARVIVA Zoea - Shrimp",
    "LARVIVA Broodstock - Sea Bass",
    "MAXIO - Sea Bream", "MAXIO - Meagre",
    "EXIA Prime - Shrimp", "EXIA MAXIO - Shrimp",
    "Ecolife Pearl - Atlantic Salmon - Grower", "EGGSTRA - Trout",
    "DAN-EX - Eel - Grower", "FINESTA - Sea Bream",
    "Symbio Lumpfish",
]

RANGE_FROM_NAME = {
    "INICIO": "INICIO", "INTRO": "INTRO", "CPK": "CPK", "DAN-EX": "DAN-EX", "Ecolife": "Ecolife",
    "EGGSTRA": "EGGSTRA", "FINESTA": "FINESTA", "EFICO": "EFICO", "Symbio": "Symbio",
}

CATEGORY = {
    "LARVIVA": "Hatchery feed", "INICIO": "Starter feed", "INTRO": "Starter feed", "CPK": "Starter feed",
    "SmartCare": "Functional health feed", "Blue Impact": "Low-impact feed", "Ecolife": "Low-impact feed",
    "ORBIT": "RAS feed", "Symbio": "Cleaner fish feed", "EGGSTRA": "Broodstock feed",
}

TAGLINES = {
    "POWER": "Maximum growth. Shorter time at sea.",
    "Blue Impact": "Same performance, lower footprint.",
    "SmartCare": "Nutrition that supports fish health when it matters most.",
    "ORBIT": "High performance for fish and biofilter.",
    "EFICO": "Proven performance, every day.",
    "INICIO": "A strong start from the very first feeding.",
    "INTRO": "Built for a robust transition.",
    "LARVIVA": "Hatchery nutrition for strong, uniform juveniles.",
    "MAXIO": "Growth and feed efficiency in balance.",
    "EXIA": "Consistent results in intensive shrimp farming.",
    "Ecolife": "Responsible feed with a documented lower impact.",
    "Symbio": "Tailored nutrition for effective cleaner fish.",
}

SELLING_POINTS = {
    "POWER": ["BioMar's best-selling salmon feed", "Shorter production cycle frees up licence capacity"],
    "Blue Impact": ["Lower carbon footprint per kg of fish produced", "Supports customers' ASC and retailer sustainability targets"],
    "SmartCare": ["Developed and documented at BioMar's Aquaculture Technology Centres", "Can be used strategically in high-risk periods"],
    "ORBIT": ["Reduces biofilter load in RAS", "Also suitable for flow-through systems"],
    "EFICO": ["Broad, well-known range with consistent physical quality"],
    "LARVIVA": ["Complete hatchery programme from first feeding to weaning"],
    "EXIA": ["Formulated for high-density (200+ shrimp/m²) systems"],
}

PELLETS = {
    "Hatchery": ["0.1–0.2 mm", "0.2–0.3 mm", "0.3–0.5 mm", "0.5–0.8 mm"],
    "Fry & fingerling": ["0.5 mm", "0.8 mm", "1.0 mm", "1.5 mm", "2.0 mm"],
    "Smolt transfer": ["2.0 mm", "3.0 mm", "4.0 mm"],
    "Grower": ["3.0 mm", "4.5 mm", "6.0 mm", "9.0 mm", "12.0 mm"],
}
SHRIMP_PELLETS = ["Crumble 0.4–0.6 mm", "Crumble 0.8–1.2 mm", "1.6 mm", "2.0 mm", "2.4 mm"]

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


def first_sentence(text, limit=150):
    m = re.match(r"(.+?[.!?。])(\s|$)", text)
    s = m.group(1) if m else text
    if len(s) > limit:
        s = s[:limit].rsplit(" ", 1)[0] + "…"
    return s


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def iso(day_offset, hour=9):
    # Day 0 = 2026-11-12. Offsets are negative (in the past).
    import datetime as dt
    d = dt.datetime(2026, 11, 12, hour, 0) + dt.timedelta(days=day_offset, minutes=random.randint(0, 59))
    return d.strftime("%Y-%m-%dT%H:%M:00Z")


def main():
    random.seed(42)
    docs = {}
    for f in glob.glob(EXPORT_DIR + "/*.uda"):
        j = json.load(open(f, encoding="utf-8"))
        if j.get("PublishedVersion"):
            docs[j["Name"].strip()] = j

    products = []
    for idx, full in enumerate(SELECTION):
        j = docs[full]
        props = j["PublishedVersion"]["Properties"]
        parts = [p.strip() for p in full.split(" - ")]
        name = parts[0]
        species = parts[1] if len(parts) > 1 else "Lumpfish"
        if name == "Symbio Lumpfish":
            name, species = "Symbio", "Lumpfish"
        if name == "DAN-EX":
            species = "Eel"
        fs = props.get("feedSolution")
        rng = FEED_SOLUTIONS.get(fs[-6:]) if isinstance(fs, str) and fs else None
        if not rng:
            rng = next((v for k, v in RANGE_FROM_NAME.items() if name.startswith(k)), name.split()[0])
        if name.startswith("INICIO") or name.startswith("INTRO"):
            rng = name.split()[0]
        stages_raw = props.get("stages") if isinstance(props.get("stages"), str) else ""
        stages = [STAGES[s[-6:]] for s in stages_raw.split(",") if s and s[-6:] in STAGES] or ["Grower"]
        order = ["Hatchery", "Fry & fingerling", "Smolt transfer", "Grower"]
        stages = sorted(set(stages), key=order.index)

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

        category = CATEGORY.get(rng, "Performance feed")
        if "Broodstock" in name:
            category = "Broodstock feed"
        is_shrimp = species == "Shrimp"
        pellet_pool = SHRIMP_PELLETS if is_shrimp else PELLETS[stages[-1]]
        pellet_sizes = pellet_pool[: random.randint(3, len(pellet_pool))]

        # --- workflow state (illustrative) ---
        r = random.random()
        info_status = "approved" if r < 0.86 else ("in_review" if r < 0.92 else "draft")
        r = random.random()
        mk_status = "approved" if r < 0.6 else ("in_review" if r < 0.75 else "draft")
        mk_updated = random.randint(-120, -1) if mk_status == "approved" else random.randint(-21, -1)
        mk_version = random.randint(2, 6)
        tagline = TAGLINES.get(rng, "") if random.random() < 0.9 else ""
        selling = SELLING_POINTS.get(rng, []) if random.random() < 0.85 else []
        short = first_sentence(description) if description and random.random() < 0.85 else ""
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
            variants[c] = {
                "localName": "",
                "shortDescription": "" if same_as_global else (first_sentence(loc["paras"][0]) if loc["paras"] and random.random() < 0.88 else ""),
                "tagline": "",
                "description": "" if same_as_global else "\n\n".join(loc["paras"]),
                "keyBenefits": [] if same_as_global else loc["benefits"],
                "sellingPoints": [],
                "notes": "Uses global English copy." if same_as_global else "",
                "inheritsGlobal": same_as_global,
                "websiteStatus": "live" if vstatus == "approved" and random.random() < 0.85 else "not_live",
                "sourceVersion": mk_version - 1 if outdated else mk_version,
                "meta": {"status": vstatus, "updatedBy": editor, "updatedAt": iso(random.randint(-200, -2) if vstatus == "approved" else random.randint(-18, -1)),
                         **({"reviewNote": next_note()} if vstatus == "draft" and random.random() < 0.25 else {})},
            }
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
        code = "BM-" + re.sub(r"[^A-Z0-9]", "", name.upper())[:6] + "-" + re.sub(r"[^A-Z]", "", species.upper())[:3]
        slug = slugify(f"{name}-{species}")

        # --- assets (metadata; preview images are rendered by the app) ---
        assets = []
        def add_asset(kind, fname, size_kb, scope="global", days=None):
            assets.append({
                "id": f"a-{slug}-{len(assets)+1}", "type": kind, "fileName": fname,
                "mime": "application/pdf" if fname.endswith(".pdf") else ("image/png" if fname.endswith(".png") else "image/jpeg"),
                "sizeKb": size_kb, "scope": scope, "source": "generated",
                "uploadedBy": owner, "uploadedAt": iso(days if days is not None else random.randint(-400, -10)),
            })
        base = slugify(full)
        if random.random() < 0.85:
            add_asset("hero", f"{base}-hero.jpg", random.randint(800, 2400))
        if random.random() < 0.6:
            add_asset("highres", f"{base}-pellets-highres.jpg", random.randint(6000, 14000))
        if random.random() < 0.8:
            add_asset("bag", f"{base}-bag-25kg.png", random.randint(400, 1300))
        if random.random() < 0.75:
            add_asset("datasheet", f"{base}-technical-datasheet.pdf", random.randint(180, 600))
        if rng in ("POWER", "SmartCare", "Blue Impact", "LARVIVA", "ORBIT") and random.random() < 0.6:
            add_asset("brochure", f"biomar-{slugify(rng)}-brochure.pdf", random.randint(2000, 8000))
        for c in list(variants)[:2]:
            if random.random() < 0.35:
                add_asset("datasheet", f"{base}-datasheet-{c.lower()}.pdf", random.randint(180, 600), scope=c)

        # --- history ---
        history = []
        created = iso(random.randint(-700, -400))
        history.append({"id": f"h-{slug}-1", "at": created, "by": owner, "section": "info", "action": "created", "summary": "Product record created from website import"})
        if description:
            history.append({"id": f"h-{slug}-2", "at": iso(mk_updated - random.randint(30, 200)), "by": owner, "section": "marketing", "action": "approved", "summary": f"Marketing content approved (v{mk_version - 1})"})
        history.append({"id": f"h-{slug}-3", "at": iso(mk_updated), "by": owner, "section": "marketing",
                        "action": {"approved": "approved", "in_review": "submitted", "draft": "edited"}[mk_status],
                        "summary": {"approved": f"Marketing content approved (v{mk_version})", "in_review": "Marketing content submitted for review", "draft": "Marketing content edited"}[mk_status]})
        for c, v in variants.items():
            history.append({"id": f"h-{slug}-{c}", "at": v["meta"]["updatedAt"], "by": v["meta"]["updatedBy"], "section": c,
                            "action": {"approved": "approved", "in_review": "submitted", "draft": "edited"}[v["meta"]["status"]],
                            "summary": f"{c} variant " + {"approved": "approved", "in_review": "submitted for review", "draft": "edited"}[v["meta"]["status"]]})
        history.sort(key=lambda h: h["at"], reverse=True)

        products.append({
            "id": slug,
            "code": code,
            "name": name,
            "species": species,
            "range": rng,
            "category": category,
            "stages": stages,
            "feedType": "Microdiet" if "Hatchery" in stages and rng == "LARVIVA" else ("Sinking pellet" if is_shrimp or species in ("Sea Bream", "Sea Bass", "Sturgeon", "Eel") else "Extruded pellet"),
            "pelletSizes": pellet_sizes,
            "packaging": ["25 kg bag", "500 kg big bag"] if stages[-1] == "Grower" else ["10 kg bag", "20 kg bag"],
            "regulatoryNotes": "",
            "owner": owner,
            "lifecycle": "active",
            "info": {"status": info_status, "updatedBy": owner, "updatedAt": iso(random.randint(-300, -5) if info_status == "approved" else random.randint(-15, -1))},
            "marketing": {
                "shortDescription": short,
                "tagline": tagline,
                "description": description,
                "keyBenefits": en["benefits"],
                "sellingPoints": selling,
                "version": mk_version,
                "meta": {"status": mk_status, "updatedBy": owner if mk_status != "approved" else "u-marco", "updatedAt": iso(mk_updated)},
            },
            "markets": targets,
            "variants": variants,
            "assets": assets,
            "history": history,
            "comments": [],
            "createdAt": created,
        })

    seed = {"version": 1, "users": USERS, "products": products}
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(seed, fh, ensure_ascii=False, indent=1)
    print(f"Wrote {len(products)} products to {OUT}")


if __name__ == "__main__":
    main()
