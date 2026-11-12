# BioMar Product Information (PIM) – prototype

A simple, central place to find, maintain, review and approve BioMar product information:
global master data, marketing copy, digital assets and market/language versions.

This is a **functional prototype** focused on user experience and information structure.
It runs entirely in the browser – no backend needed – and is seeded with all 360 products
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
| **Home** | Your personal to-do list (things to approve, content sent back to you, translations to update, drafts not yet sent), with similar items grouped. Four key numbers and the latest changes. |
| **Spreadsheet** | In Products, switch to *Spreadsheet*: one row per product, one column per field, grouped as Classification, Specification, Marketing copy and Ownership. Click a cell to edit it, or tick several rows and set a field for all of them at once (replace or add to a list). |
| **Excel** | *Export to Excel* downloads the products currently shown (Products, Translations and a How to use sheet with the allowed values). Edit it and use *Import from Excel*: every change is listed before anything is saved, rows with unknown products or values are skipped with a reason, and imported changes become drafts that need approval. |
| **Products** | Grouped by range. Local editors see the products sold in their own markets first, with *All products* one click away. Search and filter by range, species, market, status and translation status, with more filters on demand. Cards or a list. Filters are kept in the link, so a filtered view can be shared. |
| **Product page** | Overview with the fields in four groups (Marketing copy, Classification, Specification, Ownership), each in a label and value layout with its own Edit button and copy buttons for text, a plain "To do" list of what is missing, the packshot and the markets. Tabs for Translations, Files and History. Export the text or a one-page product sheet (PDF). |
| **Translation page** | One page per market: the English text and the local text side by side, its own approval and a "live on the website" flag. When the English text changes, the changed words are highlighted so the translator only has to look at what is new. A *Next* button goes to the next translation on your list. |
| **Approval** | One status for the global content and one per market: Draft, In approval, Approved. Approvers see exactly what changed since the last approved version (added text in green, removed text struck through), then approve or send back with a note. Editing approved content creates a new draft. |
| **Ready to use** | A product is *Ready to use* when it is approved and has its marketing copy, packshot and datasheet. Sending a product for approval with any of these missing asks for confirmation first. |
| **To do** | Split into *Needed before approval* (tagline, short description, description, key benefits, packshot, datasheet) and *Nice to have* (selling points, product code, feed type, pellet sizes, packaging, logo). Lists only count the essentials. |
| **Files** | Logo (from the brand logo packs), packshot (from biomar.com) and technical datasheet are expected for every product; photos, brochures and other files are optional. Upload, preview and download. |
| **Markets** | How far each market is with its translations, and who the local editors are. |
| **Administration** | People, roles and what each role can do. The user menu switches between people to try each role. |

Empty fields show "Not added yet". The prototype contains no invented product data: product codes,
feed type, pellet sizes, packaging and datasheets are empty until someone adds them.

## Structure

```
src/
  types.ts              data model (Product, Variant, Asset, HistoryEntry, User)
  data/
    seed.json           product data (generated, see below)
    website.json        content collected from biomar.com
    reference.ts        markets and languages, ranges, categories, stages, labels
    rules.ts            permissions, market version state, the "To do" list
    insights.ts         to-do lists, approval queue, home numbers, market coverage
    store.ts            state and every write action (edit, approval, files, history)
  assets/               product logos and packshots
  lib/                  browser storage, files, downloads, product sheet PDF, logo matching,
                        fields.ts (one definition of every field), excel.ts (export and import)
  components/           layout, shared UI, approval buttons, file cards
  pages/                Home, Products, ProductPage (+ product/* tabs), TranslationPage, Files, Approvals, Markets, Admin
scripts/build_seed.py   builds seed.json from the website export
scripts/import_logos.py imports product logos from the brand logo packs
scripts/fetch_bags.py   downloads product packshots from biomar.com
scripts/fetch_website_content.py  collects taglines, range benefits, categories and stages from biomar.com
```

### Data model in short

- **Product** = one global record (one product per range and species, as on the website).
  It holds the product details, the English marketing copy, files and one approval status.
- **Variant** = the version for one market and language, keyed by locale (`nn-NO`, `es-CL`). It holds
  the translated copy, its own approval status, the website flag and the English version it follows.
- **markets** on a product = where it is sold. A market without a variant shows as *Not started*.

### Extending it

- **Backend:** every write goes through `src/data/store.ts`. To move to a server, swap the
  IndexedDB persistence there for API calls and keep the same action functions. The UI does not change.
- **New markets, ranges or required fields:** edit `src/data/reference.ts` and the checks in `src/data/rules.ts`.
- **File storage:** uploads are kept in the browser. In production, store files in blob storage or a
  DAM and keep the `Asset` record as metadata.

## Sample data

`scripts/build_seed.py` reads the website export (one `.uda` JSON file per product page) and
builds `src/data/seed.json` with every published product page (360), leaving out archived,
duplicate and test pages. Chinese species names on China-market pages are translated, and spelling
differences between pages are merged into one species name:

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
product image (`og:image`) and saves a small WebP copy to `src/assets/bags/`. Products that share a
packshot share one file (334 products, 151 images). 26 products have no page on biomar.com (mostly
China-market EFICO pages) and show the packshot as missing.
