# Road to 1000 Goals

A website tracking Cristiano Ronaldo's journey to 1000 career goals. Live at [roadto1000goals.com](https://roadto1000goals.com/).

## Tech Stack

- [Astro](https://astro.build/) - Static site generator
- [TailwindCSS](https://tailwindcss.com/) - Styling
- [Playwright](https://playwright.dev/) - Goal scraper

## Development

```bash
npm install
npm run dev
```

## Goal Scraper

Automated scraper fetches goals from Web Source and updates the site data.

```bash
npm run scrape           # Update goals
npm run scrape:dry-run   # Test without changes
```

### GitHub Actions

The scraper runs automatically every 10 minutes during match windows. Manual triggers always run via `workflow_dispatch`.

**Setup:**
1. Go to repo → Settings → Actions → General
2. Enable "Allow all actions"
3. Set "Workflow permissions" to **Read and write permissions**
4. Test via Actions tab → "Scrape Goals" → "Run workflow"

## Code Quality

```bash
npm run typecheck   # TypeScript type checking
npm run lint        # ESLint
npm run lint:fix    # ESLint with auto-fix
npm run check       # Run both typecheck and lint
```

## Build

```bash
npm run build
npm run preview
```
