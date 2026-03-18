# Whale · الحوت

Trust-first marketplace focused on Palestine and Arab cities.

Core guarantee:

> أموالك محفوظة حتى تؤكد الاستلام  
> Your money is protected until you confirm delivery.

## Quick Start

```bash
npm install
npm run prisma:generate
npm run seed
npm run dev
```

## Main Runtime

- Home: `/` -> redirects to `/whale`
- Marketplace: `/whale`
- Static pages: `/about`, `/contact`, `/safety`, `/pricing`, `/terms`, `/privacy`, `/forum`

## Tests

```bash
npm run test
npm run test:ui
```

Focused Whale UI:

```bash
npx playwright test __uitests__/pages/whale-marketplace.spec.js --project="Desktop Chrome"
```

Whale UI system demo:

- `/WHALE_UI_COMPONENTS.html`
- `/css/WHALE_UI_SYSTEM_V2.css`

The Whale marketplace now uses:

- Responsive `picture`/`srcset` delivery for hero, listing, detail, and checkout media
- A mobile bottom-sheet filter drawer with drag-to-dismiss
- A dual-range price filter with desktop auto-apply behavior
- Premium light/dark theme tokens wired through `html.dark`

## AI Upgrade Handoff

Use this file for AI agents:

- [README_AI_UPGRADE.md](/c:/Users/osama/OneDrive/سطح المكتب/pc-gaming-website/README_AI_UPGRADE.md)

Detailed operational handoff:

- [AI_HANDOFF.md](/c:/Users/osama/OneDrive/سطح المكتب/pc-gaming-website/AI_HANDOFF.md)
