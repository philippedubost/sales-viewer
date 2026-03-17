# Sales Dashboard

A single-page React app for visualizing sales data from PennyLane CSV exports.

## Getting Started

```bash
git clone <repo-url>
cd sales-viewer
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

## Build for Production

```bash
npm run build
```

## CSV Format

The app accepts PennyLane-compatible CSV files with the following column layout (comma-separated, 28 columns):

| Column | Field |
|--------|-------|
| 0 | ID |
| 1 | Invoice number |
| 2 | Invoice date (DD/MM/YYYY) |
| 3 | Due date (DD/MM/YYYY) |
| 4 | Client name |
| 8 | Total TTC (e.g. `"1 154,40 €"`) |
| 9 | Total TVA |
| 10 | Total HT |
| 16 | Status: `Encaissée` \| `À venir` \| `En retard` \| `Annulée` \| `À traiter` |
| 22 | Invoice title |
| 27 | Payment date (DD/MM/YYYY, empty if unpaid) |

Amount format: French locale with spaces as thousand separators and comma as decimal separator (e.g. `"1 154,40 €"`).

## Features

- **Timeline** — SVG swimlane view with one lane per client, bubbles sized by revenue
- **Camembert** — Donut pie chart showing revenue share per client
- **CA par Année** — Horizontal bar chart grouped by year, expandable per client

## Deployment

Deploy to Vercel with zero configuration — the included `vercel.json` handles SPA routing.
