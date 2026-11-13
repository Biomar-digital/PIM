# BioMar Product Information (PIM) – prototype

A simple, central place to find, maintain, review and approve BioMar product information:
global master data, marketing copy, digital assets and market/language versions.

This is a **functional prototype** focused on user experience and information structure.
It is seeded with all 360 products imported from the BioMar website content export, shown with
their own product logos, and organised around the website's locales.

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
Everything follows the **selected market or region**: the website's own locales (Global English plus the
19 market cultures of biomar.com, such as `da-DK` and `es-ES`), organised by division:

| Division | Regions and markets |
|---|---|
| Salmon Division | Norway, Chile, United Kingdom, Australia |
| LATAM, Shrimp and Hatchery Division | Ecuador, Philippines, Costa Rica |
| Asia Division | Vietnam, China |
| EMEA Division | **West Med** (France, Spain), **Greece**, **Türkiye**, **Baltics** (Denmark, Sweden, Finland, Germany, Poland, Italy) |

A regional marketing manager opens the PIM in their region (Cathrine Jensen: Baltics, Iris Moreau: West Med)
and sees the dashboard, tasks and products of every market in it; on a product page they switch between the
region's markets with one click. Divisions are selectable too.

| Area | What it does |
|---|---|
| **Market picker** | In the top bar, like the customer portal's selector: Global, then each division with its regions and markets. Each person opens the PIM in their default (a market, region or division) and can switch to what they have access to (global roles see everything). *Open the PIM in … by default* changes the default. |
| **Dashboard** | What needs attention in the selected locale: products available there, products missing local copy, local copy to review because the global content changed, content awaiting approval, and products missing information or assets. Every number opens exactly that list in Products. Below: your next steps (grouped), the content status of the locale and the latest changes. In Global: the same across every locale, plus a table of all locales. |
| **Products** | Only the products available in the selected locale. Grouped by range, then product, then species. Search by name, filter by range, species, production stage, status in the locale, and *Available in* (Global). List or cards. Global editors also get a **Spreadsheet** to edit the global record of many products at once, and **Excel** export and import. |
| **Product page** | One master record per product. *Product identity* (name, range, species, stages, category, tagline) and *Technical information* are global: marked *Same in every locale* with a lock, editable by the global team only. *Marketing copy* (short description, description, key benefits, selling points) is the local version of the selected locale. The header shows the status and version in that locale, who changed it last, and the approval buttons. |
| **Side by side** | On a product in a locale, switch from *Normal view* to *Side by side*: the approved global English on the left (read only), the local copy on the right (editable), field by field. Copy buttons on every field, *Use in Denmark* to start from the English text, and the words that changed in English since the local copy was written are highlighted. |
| **Status and updates** | Per locale: Missing, Draft, In approval, Approved, and *Needs review* when the global content was approved again after the local copy was written. Local copy is never overwritten: the local team reviews it, edits it or marks *No change needed*. |
| **Approval** | Saving approved content offers a **small update** (typo or wording: stays approved, no approval, no review for other locales) or a change that **needs approval** (draft, then *Send for approval*). Approvers see exactly what changed (added text in green, removed text struck through) and approve or send back with a note. |
| **Assets** | Hero image, high-resolution product images, bag designs, logos, technical datasheets, brochures and other documents. The files stay in **The Pond**: the PIM stores a link to each one. Hero image, product images, bag designs and logos are global and managed by the global team. Local teams add brochures, datasheets and documents for their own locales. |
| **Use the content** | Copy any field, copy all approved text for the locale, or download a one-page product sheet (PDF) with the latest approved content of the locale. |
| **Locales tab** | Where the product is available, the status and version of every local version, and the "live on the website" flag. Global editors add or remove locales. |
| **People and access** | People, their locales and default locale, and what each role can do. The user menu switches person to try each role (for example Cathrine Jensen, Marketing Manager Denmark). |

Empty fields show "Not added yet". The prototype contains no invented product data: product codes,
feed type, pellet sizes, packaging, hero images and datasheets are empty until someone adds them.

## Shared data

The published prototype uses the artifact's shared database: everyone who opens the link sees the
same products, edits, approvals and asset links, live. Each changed product is stored as one document
(the full record with its local versions, approved versions and history); products nobody has changed
come from `seed.json`. The sidebar shows *Shared data, saved*. Run locally (`npm run dev`), it falls back
to this browser's storage and says *Saved in this browser only*. *People and access → Reset sample data*
removes all changes for everyone.

## Structure

```
src/
  types.ts              data model (Product, Variant, AssetRef, HistoryEntry, User)
  data/
    seed.json           product data (generated, see below)
    website.json        content collected from biomar.com
    reference.ts        markets, divisions and regions, ranges, categories, stages, asset types, labels
    rules.ts            permissions, locale state, approved content, what is missing
    insights.ts         dashboard numbers, attention filters, next steps, locale overview
    store.ts            state and every write action (edit, small update, approval, assets, history)
  assets/               product logos and bag designs (previews until The Pond is connected)
  lib/                  shared.ts (shared database), files (previews, copy, product sheet PDF),
                        fields.ts (one definition of every field), excel.ts (export and import)
  components/           layout with the locale picker, shared UI, approval and save buttons, spreadsheet
  pages/                Dashboard, Products, ProductPage (+ product/* tabs: Content, Assets, Locales, History), People
scripts/build_seed.py   builds seed.json from the website export
scripts/import_logos.py imports product logos from the brand logo packs
scripts/fetch_bags.py   downloads product bag images from biomar.com
scripts/fetch_website_content.py  collects taglines, range benefits, categories and stages from biomar.com
```

### Data model in short

- **Product** = the one master record (one per product and species, as on the website). It holds the
  global fields (identity, classification, technical details, tagline), the global English copy with its
  approval status and version number, approved versions, asset references and history.
- **Variant** = the local version for one locale (`da-DK`, `es-CL`): short description, description,
  key benefits, selling points, its own status and version, the last approved text, the global version it
  was written against (`sourceVersion`, which drives *Needs review*) and the website flag. No tagline: the
  tagline is global and never translated.
- **markets** on a product = the locales where it is available. Available without a variant = *Missing*.
- **AssetRef** = a link to an asset in The Pond, with its type and scope (`global` or a locale).
- **User** = role, the locales the person works in and their default locale.

### Extending it

- **Backend:** every write goes through `src/data/store.ts`, and storage is isolated in
  `src/lib/shared.ts`. To move to the PIM's own API and database, replace that file; the UI does not change.
- **The Pond:** assets are references already. Connecting The Pond means filling `pondUrl` and previews
  from its API instead of by hand.
- **New locales, ranges or required fields:** edit `src/data/reference.ts` and the checks in `src/data/rules.ts`.

## Sample data

`scripts/build_seed.py` reads the website export (one `.uda` JSON file per product page) and
builds `src/data/seed.json` with every published product page (360), leaving out archived,
duplicate and test pages. Chinese species names on China-market pages are translated, and spelling
differences between pages are merged into one species name:

```bash
python3 -I scripts/build_seed.py path/to/unzipped-export src/data/seed.json
```

Product names, ranges, species, production stages, descriptions, key benefits and the local
local versions come from the CMS export. Taglines (global only) and selling points,
categories and production stages come from biomar.com via `scripts/fetch_website_content.py`.
The website does not hold product codes, feed type, pellet sizes, packaging or datasheets, so these
are left empty. In production they would be maintained in the PIM by the global product team or
imported from the ERP item master. Workflow states, people and dates are sample data.
*People and access → Reset sample data* restores the seed.

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

Each product's **Bag design** asset uses the real packshot from biomar.com as its preview:

```bash
python3 -I scripts/fetch_bags.py                                  # download packshots
python3 -I scripts/build_seed.py path/to/unzipped-export src/data/seed.json   # attach them as assets
```

`fetch_bags.py` opens each product page (`/feed-services/all-feed/<website slug>`), takes the page's
product image (`og:image`) and saves a small WebP copy to `src/assets/bags/`. Products that share a
packshot share one file (334 products, 151 images). 26 products have no page on biomar.com (mostly
China-market EFICO pages) and show the packshot as missing.
