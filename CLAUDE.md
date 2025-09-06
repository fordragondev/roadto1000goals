# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Astro-based website tracking Cristiano Ronaldo's goals toward 1000 career goals. The site is deployed at https://roadto1000goals.com/.

## Implementation Guidedance

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

## Architecture and Structure

### Framework Stack
- **Astro 5.2.3**: Static site generator with component-based architecture
- **TailwindCSS 4.0.2**: Styling framework with custom configuration
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
The main goal data is stored as a hardcoded array in `RoadSection.astro` (line 2-51). This includes:
- Goal number, date, match details, and goal type
- Both official ("941", "940") and non-official ("N.O") goals
- Data is manually updated with each new goal

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
`"[Goal Number] [Date] [H/A/N] [Team] vs. [Opponent] [Time]' [Goal Type]"`

### Component Structure
- All components use Astro's component syntax with frontmatter
- Layouts provide consistent structure across pages
- Components are self-contained with embedded styling

### SEO Considerations
The site includes SEO-focused elements like long-tail keywords for Cristiano Ronaldo goal tracking queries embedded in components.