// Configuration for goal scraper

export const CONFIG = {
  // Source URLs - filtered to 2025 season for recent goals
  GOALS_URL: 'https://www.transfermarkt.com/cristiano-ronaldo/alletore/spieler/8198/saison/2025/verein/0/liga/0/wettbewerb//pos/0/trainer_id/0/minute/0/torart/0/plus/1',

  // Scraping settings
  TIMEOUT: 60000,

  // Output paths (relative to project root)
  COMPONENT_FILE: 'src/components/RoadSection.astro',

  // Table selectors for web scraping
  SELECTORS: {
    goalsTable: 'table.items',
    tableBody: 'table.items tbody',
    tableRows: 'table.items tbody tr',
  },

  // Competition patterns for non-official goals
  NON_OFFICIAL_PATTERNS: [
    'Friendly',
    'Friendlies',
    'Pre-Season',
    'Club Friendly',
    'Testimonial',
    'Amistoso',
  ],

  // Team name mappings for consistency
  TEAM_MAPPINGS: {
    'Al-Nassr FC': 'Al-Nassr',
    'Al Nassr': 'Al-Nassr',
    'Al-Nassr Riad': 'Al-Nassr',
    'Al-Nassr Riyadh': 'Al-Nassr',
    'Manchester United': 'Man United',
    'Manchester Utd': 'Man United',
    'Real Madrid CF': 'Real Madrid',
    'Juventus FC': 'Juventus',
    'Sporting CP': 'Sporting',
  },

  // Goal type mappings
  GOAL_TYPE_MAPPINGS: {
    'penalty': 'Penalty',
    'header': 'Header',
    'free kick': 'Direct free kick',
    'freekick': 'Direct free kick',
    'free-kick': 'Direct free kick',
    'counter': 'Counter attack goal',
    'counter-attack': 'Counter attack goal',
    'left foot': 'Left-footed shot',
    'left-footed': 'Left-footed shot',
    'right foot': 'Right-footed shot',
    'right-footed': 'Right-footed shot',
  },
};
