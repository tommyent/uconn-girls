# UConn Women's Basketball Tracker

A Progressive Web App (PWA) for tracking UConn Women's Basketball team scores, stats, roster, and game history. Optimized for elderly users with accessibility features.

## Features

### Core Functionality
- **Live Scores**: Real-time game scores with auto-refresh (every 30 seconds)
- **Team Roster**: View current season player information and stats
- **Game History**: Browse past games from the last 5 years
- **Team Info**: Current record, rankings, and next game

### PWA Features
- ✅ Installable on mobile and desktop devices
- ✅ Offline support with service worker
- ✅ Responsive mobile-first design
- ✅ App-like experience with bottom navigation

### Accessibility Features for Elderly Users
- 📱 **Large Text**: Base font size of 18px for better readability
- 🎨 **High Contrast**: Violet theme with excellent contrast ratios
- 👆 **Large Touch Targets**: Minimum 48px buttons for easy tapping
- 🧭 **Simple Navigation**: Bottom tab bar with icons + labels
- ⌨️ **Keyboard Navigation**: Full keyboard support with visible focus indicators
- 📊 **Clear Visual Hierarchy**: Easy-to-scan layouts with proper spacing

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Data Source**: ESPN Hidden API
- **Icons**: Lucide React
- **PWA**: Custom service worker implementation

## Data Sources

### ESPN Hidden API Endpoints

The app uses the following ESPN API endpoints:

1. **Team Info**: `http://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/teams/41`
2. **Live Scoreboard**: `http://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/scoreboard`
3. **Team Schedule**: `http://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/teams/41/schedule`
4. **Team Roster**: `http://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/teams/41/roster`

Note: These are unofficial ESPN endpoints and are subject to change. The app uses caching with appropriate revalidation intervals.

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
uconngtp/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Home page
│   ├── live/              # Live scores page
│   ├── players/           # Team roster page
│   ├── history/           # Game history page
│   ├── layout.tsx         # Root layout with navigation
│   └── globals.css        # Global styles with violet theme
├── components/
│   ├── ui/                # shadcn/ui components
│   │   ├── card.tsx
│   │   ├── button.tsx
│   │   └── badge.tsx
│   └── bottom-nav.tsx     # Bottom navigation component
├── lib/
│   ├── espn-api.ts        # ESPN API client
│   ├── types.ts           # TypeScript types
│   └── utils.ts           # Utility functions
└── public/
    ├── manifest.json      # PWA manifest
    └── sw.js             # Service worker
```

## Pages

### Home (`/`)
- Current team record and ranking
- Next upcoming game
- Quick access cards to other sections

### Live Scores (`/live`)
- Auto-refreshing live scores (30 second interval)
- UConn game prominently displayed
- Other women's college basketball games
- Manual refresh button

### Players (`/players`)
- Current roster grouped by position
- Player photos, jersey numbers, and stats
- Height, weight, year information

### History (`/history`)
- Season selector (last 5 years)
- Win/loss record summary
- Completed games with scores
- Upcoming scheduled games

## Customization

### Changing Theme Colors
Edit the CSS variables in `app/globals.css`:
```css
:root {
  --primary: 262.1 83.3% 57.8%;  /* Violet color */
  /* ... other colors */
}
```

### Adding Push Notifications
To implement push notifications:
1. Set up a push notification service (e.g., Firebase Cloud Messaging)
2. Update the service worker to handle push events
3. Add notification permission requests in the app

### Modifying Auto-refresh Intervals
Edit the revalidation values in:
- API functions in `lib/espn-api.ts`
- Client-side intervals in pages

## Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Other Platforms
The app can be deployed to any platform supporting Next.js:
- Netlify
- AWS Amplify
- Digital Ocean
- Self-hosted with Node.js

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers (iOS Safari, Chrome Mobile)

## Known Limitations

1. **ESPN API**: Uses unofficial ESPN endpoints that may change without notice
2. **Historical Data**: Limited to what ESPN API provides (typically 5-10 years)
3. **Live Updates**: 30-second refresh interval (not true real-time WebSocket)
4. **Icons**: Placeholder icons need to be replaced with actual team logo

## Future Enhancements

- [ ] Push notifications for game start times
- [ ] Player comparison feature
- [ ] Season highlights and milestones
- [ ] Dark mode toggle
- [ ] Voice announcements for score updates
- [ ] Calendar integration for game reminders
- [ ] Share scores via text/email

## License

MIT

## Acknowledgments

- Data provided by ESPN
- Icons by Lucide
- UI components by shadcn/ui
