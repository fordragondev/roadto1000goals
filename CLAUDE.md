# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Astro-based website tracking Cristiano Ronaldo's goals toward 1000 career goals. The site is deployed at https://roadto1000goals.com/.

## Implementation Guidance

- All improvements maintain the clean, minimal design aesthetic
- Mobile-first responsive approach
- Performance-conscious implementations
- Maintains existing SEO optimization
- Backward compatible with current data structure
- Use TailwindCSS over custom css when possible

## Common Commands

Development server:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

Code quality:
```bash
npm run typecheck   # TypeScript type checking
npm run lint        # ESLint
npm run lint:fix    # ESLint with auto-fix
npm run check       # Run both typecheck and lint
```

## Architecture and Structure

### Framework Stack
- **Astro**: Static site generator with component-based architecture
- **TailwindCSS**: Styling framework with custom configuration
- **Partytown**: Third-party script optimization for analytics
- **TypeScript**: Strict type checking enabled

### Key Directories
- `src/components/`: Reusable Astro components (Header, Footer, HeroSection, RoadSection, etc.)
- `src/layouts/`: Base layouts (Layout.astro for main pages, LayoutAds.astro for ad pages)
- `src/pages/`: Route pages (index.astro, ads.astro)
- `src/styles/`: Global CSS with TailwindCSS configuration
- `src/assets/`: Static assets (images, icons)
- `src/scripts/`: Client-side JavaScript (header shrinking functionality)

### Core Data Management
Goal data lives in two components that the scraper updates together:

- **`src/components/RoadSection.astro`** — hardcoded `rawData` array (line ~42) with one string per goal
- **`src/components/HeroSection.astro`** — `title` (current goal count) and `text` (last goal date) variables

The `rawData` array **must keep its trailing-comma format** — the scraper uses a regex (`/const rawData = \[([\s\S]*?)\n\]/`) to find and replace the block, and depends on the closing `\n]` pattern.

### Styling Architecture
- Custom TailwindCSS theme with Gravitas One and Roboto fonts
- Custom color palette with "oldgold" theme color
- Black background with white/gold text scheme
- Custom scrollbar hiding utilities
- Responsive design with mobile-first approach

### Configuration
- Site URL configured for production deployment
- Partytown integration for Google Analytics optimization
- Vite plugin integration for TailwindCSS
- TypeScript strict mode enabled

## Development Notes

### Goal Data Updates
When updating goal data in `RoadSection.astro`, maintain the format:
`"[Goal Number] [Date:MM/DD/YY] [H/A/N] [Team] vs. [Opponent] [Time]' [Goal Type]"`

Both official goals use a number (e.g., `"961"`) and non-official (friendly/pre-season) use `"N.O"`.

### SEO Considerations
The site includes SEO-focused elements like long-tail keywords for Cristiano Ronaldo goal tracking queries embedded in components.

## Goal Scraper

Automated scraper using Playwright to fetch goals and update `RoadSection.astro` and `HeroSection.astro`.

### Scraper Commands
```bash
npm run scrape           # Run scraper and update RoadSection.astro + HeroSection.astro
npm run scrape:dry-run   # Test without writing changes
npm run scrape -- --debug  # Save debug screenshot
```

### Scraper Structure
- `scripts/scraper/index.mjs` - Main entry point
- `scripts/scraper/scraper.mjs` - Playwright scraping logic with stealth plugin
- `scripts/scraper/transformer.mjs` - Data transformation (Web source → rawData format)
- `scripts/scraper/updater.mjs` - File update and goal comparison logic
- `scripts/scraper/config.mjs` - URLs, selectors, team/goal type mappings

### GitHub Actions Automation
`.github/workflows/scrape-goals.yml` uses precise cron schedules for match windows:
- **Monday:** 10:00-11:59 UTC (every 10 min)
- **Friday:** 12:00-13:59 UTC (every 10 min)
- Manual trigger via `workflow_dispatch` always runs

Cron expressions:
```yaml
- cron: '*/10 10-11 * * 1'  # Monday
- cron: '*/10 12-13 * * 5'  # Friday
```

### Technical Notes
- Uses `playwright-extra` with stealth plugin to bypass source's anti-bot protection
- Scrapes only first page (recent goals) - historical data preserved
- Compares goals by date + venue + minute to detect new entries (not by goal number)
- Assigns goal numbers based on highest existing + chronological order
- Only commits `src/components/RoadSection.astro` and `src/components/HeroSection.astro`
