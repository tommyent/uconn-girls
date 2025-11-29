# UConn Women's Basketball Tracker

A Progressive Web App (PWA) for tracking UConn Women's Basketball live scores, stats, roster, and game history. Optimized for elderly users with accessibility features.

## Features
- Live scores with auto-refresh (30s) and team stats per game.
- Team roster with season averages (aggregated from completed games) and injuries.
- Game history with per-team box stats and per-player lines.
- Offline-capable PWA with installable icons (UConn logo bundled locally).
- High-contrast, large text, responsive layout.

## Tech Stack
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Data**: ESPN (unofficial) endpoints
- **Icons**: Local UConn logo for PWA; Lucide for UI icons

## Getting Started
### Prerequisites
- Node.js 18+
- npm

### Install
```bash
npm install
```

### Run Dev Server
```bash
npm run dev
```
- Dev server runs on http://127.0.0.1:3000 by default (we used 4000 behind ngrok).

### Build
```bash
npm run build
```

### Start (production)
```bash
npm start
```

## Environment/Endpoints
- Scoreboard, schedule, summaries are fetched from ESPN over HTTPS.
- Player season averages are aggregated from completed game summaries (boxscores).
- If live stats are unavailable, UI shows placeholders.

## PWA
- Manifest: `public/manifest.json`
- Icons: `public/icon-192x192.png`, `public/icon-512x512.png` (UConn logo).

## Known Limitations
- Uses unofficial ESPN endpoints; structure/rate limits may change.
- Player season stats aggregation depends on available boxscore data.
- Some ESPN endpoints may block/403 in certain environments.

## Development Notes
- Tailwind utilities via PostCSS.
- Turbopack with Next.js app router.
- Mixed content avoided by using HTTPS ESPN URLs.

