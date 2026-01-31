# Nano Banana

Internal ChromaPages tool to upgrade QSR/restaurant photos into high-performing marketing images using **Gemini**.

## Setup

1) Install

```bash
npm install
```

2) Configure env

Create `.env.local`:

```bash
GEMINI_API_KEY=...
# Optional (defaults to gemini-3-pro)
GEMINI_MODEL=gemini-3-pro
```

3) Run

```bash
npm run dev
```

Open <http://localhost:3000>.

## Features (MVP+)

- **Brand kits + shot recipes**
  - Defaults stored in repo JSON: `src/data/brand-kits.json`, `src/data/shot-recipes.json`
  - Admin editor at **/admin/brand-kits** (stored in `localStorage` per-browser)
  - Import/export JSON + reset to repo defaults

- **Auto-clean (safe, deterministic)** (default: ON)
  - Server-side `sharp` preprocessing: auto-rotate, normalize, gentle denoise + sharpen, resize down to a sane max

- **Multi-variant generation**
  - Generate N variants (1–4 in UI) with slight daypart/crowd prompt deltas
  - Selectable variant thumbnails

- **Compliance guardrails**
  - Prompt construction enforces:
    - **No identifiable faces** (silhouettes/blur only)
    - **No text/signage changes** (no add/remove/modify readable text)
  - Crowd/people recipes require an acknowledgement checkbox before generation

- **Provenance / audit trail**
  - Captures hashes (original + processed), prompts, parameters, model, timestamp
  - Displayed on result panel and exportable as JSON

- **Auto-crop pack (.zip)**
  - "Download Pack (.zip)" generates channel-specific crops server-side via `sharp` and streams a zip:
    - Google Business Profile: 4:3 + 1:1
    - Instagram: 1:1 + 4:5
    - Stories/Reels: 9:16
    - Meta ads: 1:1 + 4:5
    - Delivery apps: 1:1

## Notes / Constraints

- This app does **not** persist server-side edits yet (no DB). Admin edits are stored in browser `localStorage`.
- Model selection is controlled via `GEMINI_MODEL` (default is **gemini-3-pro**).
