# BioMar Product Information (PIM) – prototype

A simple, central place to find, maintain, review and approve BioMar product information:
global master data, marketing copy, digital assets and market/language versions.

This is a **functional prototype** focused on user experience and information structure.
It runs entirely in the browser – no backend needed – and is seeded with 45 real products
imported from the BioMar website content export.

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

| Area | What it does |
|---|---|
| **Overview** | Personal "needs your attention" queue (per role), approval count, outdated local versions, missing assets, content status, completeness by range, local coverage by market, recent activity. |
| **Product library** | Search plus filters for range, species, category, production stage, market, language, status and completeness. Table or grid view. Filters live in the URL, so a filtered view can be shared as a link. |
| **Product page** | Tabs for *Product information*, *Marketing content*, *Assets*, *Markets & languages* and *History*, with a workflow panel and a completeness checklist beside them. |
| **Global ↔ market switch** | The selector in the top bar (and on each product page) switches between the **global master** and a **market version** (e.g. Norway – Norwegian). In a market, local copy sits next to the global text, and empty fields fall back to global. |
| **Workflow** | Draft → In review → Approved for each content block: global product information, global marketing content, and each market version. Approvers can approve or send content back with a note. Editing approved content creates a new draft. |
| **Outdated detection** | Approving global marketing content raises its version number. Market versions written against an older version are flagged as *Outdated* until a local editor updates them or confirms that no change is needed. |
| **Assets** | Hero image, bag design and technical datasheet are required; high-res images, brochures and other files are optional. Assets are global or market-specific, with drag-and-drop upload, preview and download. |
| **History** | Every change is logged with who and when. Approved and edited versions keep a snapshot that can be viewed and restored (the restored version comes back as a draft). |
| **Roles** | Viewer, Local editor (assigned markets), Approver, Global editor and Administrator. Use the user menu in the top right to try the tool as different people. |
| **Website status** | Each market version has a manual "Live / Not live" flag. The website keeps its own translations and publishing; the PIM only tracks them. |

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
translations come from the website. Workflow states, people, dates, pellet sizes, product codes,
taglines, selling points and asset files are **illustrative sample values**, so the prototype can
show the full workflow. Edits are saved in the browser. *Administration → Reset demo data*
restores the seed.
