# BioMar Product Information (PIM) – prototype

A simple, central place to find, maintain, review and approve BioMar product information:
global master data, marketing copy, digital assets and market/language versions.

This is a **functional prototype** focused on user experience and information structure.
It runs entirely in the browser – no backend needed – and is seeded with 65 real products
imported from the BioMar website content export, shown with their own product logos.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

```bash
npm run build        # static site in dist/
npm run build:single # one self-contained HTML file in dist-single/ (easy to share as a demo)
```

## What's in it

Built for product managers, heads of product marketing and local marketing managers.

| Area | What it does |
|---|---|
| **Home** | Your personal to-do list (things to approve, content sent back to you, translations to update, drafts not yet sent), four key numbers and the latest changes. |
| **Products** | Search and filter by range, species, market, status and missing information, with more filters on demand. Cards or a list. Filters are kept in the link, so a filtered view can be shared. |
| **Product page** | Overview with the marketing copy (copy any text with one click) and product details, a plain "To do" list of what is missing, the packshot and the markets. Tabs for Translations, Files and History. Export the text or a one-page product sheet (PDF). |
| **Translation page** | One page per market: the English text and the local text side by side, its own approval, a warning when the English text has changed, and a "live on the website" flag. |
| **Approval** | One status for the global content and one per market: Draft, Waiting for approval, Approved. Approvers approve or send back with a note. Editing approved content creates a new draft. |
| **Files** | Logo (from the brand logo packs), packshot (from biomar.com) and technical datasheet are expected for every product; photos, brochures and other files are optional. Upload, preview and download. |
| **Markets** | How far each market is with its translations, and who the local editors are. |
| **Administration** | People, roles and what each role can do. The user menu switches between people to try each role. |

Empty fields show "Not added yet". The prototype contains no invented product data: product codes,
feed type, pellet sizes, packaging and datasheets are empty until someone adds them.

## Structure

```
src/
  types.ts              data model (Product, Variant, Asset, HistoryEntry, User…)
  data/
    seed.json           sample data (generated, see below)
    reference.ts        markets/languages, ranges, categories, stages, labels
    rules.ts            permissions, completeness checks, variant state
    insights.ts         derived views: work queues, market coverage
    store.ts            state + all write actions (edit, workflow, assets, history)
  lib/                  IndexedDB wrapper, sample artwork, PDF/download helpers
  components/           layout, shared UI, charts, asset components
  pages/                Dashboard, Library, ProductPage (+ product/* tabs), AssetLibrary, Approvals, Markets, Admin
scripts/build_seed.py   builds seed.json from the Umbraco website export
scripts/import_logos.py imports product logos from the brand logo packs into src/assets/logos
scripts/fetch_bags.py   downloads product bag packshots from biomar.com into src/assets/bags
scripts/fetch_website_content.py  collects taglines, range benefits, categories and stages from biomar.com
```

### Data model in short

- **Product** = one global master record (one product per range + species, as on the website).
  It holds classification, pellet sizes, packaging, owner, lifecycle, global marketing content and assets.
- **Variant** = market + language version keyed by locale (`nn-NO`, `es-CL`…). It holds local copy,
  notes, workflow status, website status and the global version it was based on.
- **markets** on a product = the markets where it is sold. A market without a variant counts as *missing*.

### Extending it

- **Backend:** every write goes through `src/data/store.ts`. To move to a server, swap the
  IndexedDB persistence there for API calls and keep the same action functions. The UI does not change.
- **New markets, ranges or required fields:** edit `src/data/reference.ts` and the checks in `src/data/rules.ts`.
- **Real assets:** replace the generated sample artwork (`src/lib/artwork.ts`) with file storage
  (for example blob storage or a DAM), and keep the `Asset` record as metadata.

## Sample data

`scripts/build_seed.py` reads the website export (one `.uda` JSON file per product page) and
builds `src/data/seed.json`:

```bash
python3 -I scripts/build_seed.py path/to/unzipped-export src/data/seed.json
```

Product names, ranges, species, production stages, descriptions, key benefits and the local
translations come from the CMS export. Taglines and selling points (including their translations),
categories and production stages come from biomar.com via `scripts/fetch_website_content.py`.
The website does not hold product codes, feed type, pellet sizes, packaging or datasheets, so these
are left empty. In production they would be maintained in the PIM by the global product team or
imported from the ERP item master. Workflow states, people and dates are sample data. Edits are saved in the browser. *Administration → Reset demo data*
restores the seed.

## Product logos

Product images use each product's own logo from the brand logo packs:

```bash
python3 -I scripts/import_logos.py path/to/POWER.zip path/to/LARVIVA.zip ...
```

The script takes the coloured "Digital versions" PNGs, keeps one per sub-brand, compresses them and
writes `src/assets/logos/`. The app finds the most specific match for each product: name + species
(*INICIO Plus* + *Shrimp*, *Symbio Lumpfish*), then name (*LARVIVA Multigain*), then range (*LARVIVA*).
Products with no logo yet (EFICO, CPK, Ecolife, EGGSTRA, FINESTA, SmartCare Endurance) show the BioMar logo with the
product name. Running the script with more packs adds to the existing set.

## Product bag designs

Each product's **Product bag design** asset is the real packshot from biomar.com:

```bash
python3 -I scripts/fetch_bags.py                                  # download packshots
python3 -I scripts/build_seed.py path/to/unzipped-export src/data/seed.json   # attach them as assets
```

`fetch_bags.py` opens each product page (`/feed-services/all-feed/<website slug>`), takes the page's
product image (`og:image`), saves a 600 px WebP copy to `src/assets/bags/` and records the source URL.
The asset card shows "Imported from biomar.com" and links back to the original.
