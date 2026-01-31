// Transform scraped source data to RoadSection.astro format
import { CONFIG } from './config.mjs';

/**
 * Transform a single scraped goal to the required format:
 * "[Goal#] [Date:MM/DD/YY] [H/A/N] [Team] vs. [Opponent] [Time]' [Goal Type]"
 */
export function transformGoal(goal) {
  const isOfficial = determineIfOfficial(goal.competition);
  const goalNumber = isOfficial ? goal.number : 'N.O';
  const formattedDate = transformDate(goal.date);
  const venue = transformVenue(goal.venue);
  const team = normalizeTeamName(goal.forTeam);
  const opponent = normalizeTeamName(goal.opponent);
  const minute = transformMinute(goal.minute);
  const goalType = transformGoalType(goal.goalType);

  const formatted = `${goalNumber} ${formattedDate} ${venue} ${team} vs. ${opponent} ${minute} ${goalType}`;

  return {
    raw: formatted,
    parsed: {
      number: goalNumber,
      date: formattedDate,
      venue,
      team,
      opponent,
      minute,
      goalType,
      isOfficial,
      competition: goal.competition,
    },
  };
}

/**
 * Transform all scraped goals
 */
export function transformGoals(scrapedGoals) {
  return scrapedGoals.map(transformGoal);
}

/**
 * Determine if goal is official based on competition name
 */
function determineIfOfficial(competition) {
  if (!competition) return true;

  const compLower = competition.toLowerCase();
  for (const pattern of CONFIG.NON_OFFICIAL_PATTERNS) {
    if (compLower.includes(pattern.toLowerCase())) {
      return false;
    }
  }
  return true;
}

/**
 * Transform date from web source format (DD/MM/YY) to MM/DD/YY
 */
function transformDate(dateStr) {
  if (!dateStr) return '';

  // Source data uses DD/MM/YY format
  const ddmmyyMatch = dateStr.match(/(\d{2})\/(\d{2})\/(\d{2})/);
  if (ddmmyyMatch) {
    const [, day, month, year] = ddmmyyMatch;
    return `${month}/${day}/${year}`;
  }

  // Try parsing other formats
  let date;

  // Format: "Jan 21, 2026" or similar
  const monthNameMatch = dateStr.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (monthNameMatch) {
    const [, monthName, day, year] = monthNameMatch;
    date = new Date(`${monthName} ${day}, ${year}`);
  }

  // Format: "21/01/2026" or "21.01.2026" (full year)
  if (!date || isNaN(date.getTime())) {
    const euMatch = dateStr.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
    if (euMatch) {
      const [, day, month, year] = euMatch;
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
  }

  if (!date || isNaN(date.getTime())) {
    console.warn(`Could not parse date: ${dateStr}`);
    return dateStr;
  }

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);

  return `${month}/${day}/${year}`;
}

/**
 * Transform venue to H/A/N format
 */
function transformVenue(venue) {
  if (!venue) return 'N';

  const venueLower = venue.toLowerCase().trim();

  if (venueLower === 'h' || venueLower === 'home') return 'H';
  if (venueLower === 'a' || venueLower === 'away') return 'A';
  if (venueLower === 'n' || venueLower === 'neutral') return 'N';

  // Web Source may use different indicators
  if (venueLower.includes('home') || venueLower.includes('(h)')) return 'H';
  if (venueLower.includes('away') || venueLower.includes('(a)')) return 'A';

  return 'N';
}

/**
 * Normalize team names for consistency
 */
function normalizeTeamName(teamName) {
  if (!teamName) return '';

  const trimmed = teamName.trim();
  return CONFIG.TEAM_MAPPINGS[trimmed] || trimmed;
}

/**
 * Transform minute to ensure apostrophe format
 */
function transformMinute(minute) {
  if (!minute) return '';

  // Remove any non-relevant characters but keep digits, +, and '
  let cleaned = minute.replace(/[^\d+']/g, '');

  // Ensure it ends with apostrophe
  if (!cleaned.endsWith("'")) {
    cleaned += "'";
  }

  return cleaned;
}

/**
 * Transform goal type to match existing format
 */
function transformGoalType(goalType) {
  if (!goalType) return 'Right-footed shot';

  const typeLower = goalType.toLowerCase();

  // Check mappings
  for (const [pattern, mapped] of Object.entries(CONFIG.GOAL_TYPE_MAPPINGS)) {
    if (typeLower.includes(pattern)) {
      return mapped;
    }
  }

  // Default based on common patterns
  if (typeLower.includes('left')) return 'Left-footed shot';
  if (typeLower.includes('right')) return 'Right-footed shot';
  if (typeLower.includes('head')) return 'Header';
  if (typeLower.includes('counter')) return 'Counter attack goal';
  if (typeLower.includes('penalty') || typeLower.includes('pen')) return 'Penalty';
  if (typeLower.includes('free kick') || typeLower.includes('freekick')) return 'Direct free kick';

  // If it looks like a player name (contains capital letters mid-word or special chars), default to shot
  if (/[A-Z][a-z]+\s+[A-Z]/.test(goalType) || goalType.includes('í') || goalType.includes('ć')) {
    return 'Right-footed shot';
  }

  // Handle "Not reported"
  if (typeLower.includes('not reported')) {
    return 'Right-footed shot';
  }

  return goalType.trim() || 'Right-footed shot';
}

/**
 * Sort goals by date (newest first)
 */
export function sortGoalsByDate(goals) {
  return goals.sort((a, b) => {
    const dateA = parseDate(a.parsed.date);
    const dateB = parseDate(b.parsed.date);
    return dateB.getTime() - dateA.getTime();
  });
}

/**
 * Parse MM/DD/YY date string to Date object
 */
function parseDate(dateStr) {
  const [month, day, year] = dateStr.split('/');
  const fullYear = parseInt(year) > 50 ? 1900 + parseInt(year) : 2000 + parseInt(year);
  return new Date(fullYear, parseInt(month) - 1, parseInt(day));
}
