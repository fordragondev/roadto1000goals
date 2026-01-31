// Update RoadSection.astro with new goal data
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '../..');

/**
 * Read existing goals from RoadSection.astro
 * @returns {string[]} Array of raw goal strings
 */
export function readExistingGoals() {
  const componentPath = join(ROOT_DIR, CONFIG.COMPONENT_FILE);
  const content = readFileSync(componentPath, 'utf-8');

  // Match the rawData array
  const rawDataPattern = /const rawData = \[([\s\S]*?)\];/;
  const match = content.match(rawDataPattern);

  if (!match) {
    console.warn('Could not find rawData array in component');
    return [];
  }

  // Extract individual goal strings
  const arrayContent = match[1];
  const goalStrings = arrayContent.match(/"[^"]+"/g);

  return goalStrings ? goalStrings.map((s) => s.slice(1, -1)) : [];
}

/**
 * Get the highest official goal number from existing data
 */
export function getHighestGoalNumber(existingRaw) {
  let highest = 0;
  for (const raw of existingRaw) {
    const parts = raw.split(' ');
    const num = parseInt(parts[0]);
    if (!isNaN(num) && num > highest) {
      highest = num;
    }
  }
  return highest;
}

/**
 * Assign goal numbers to new goals
 * @param {Array} newGoals - New goals without numbers (sorted by date, newest first)
 * @param {number} highestExisting - Highest existing goal number
 * @returns {Array} Goals with numbers assigned
 */
export function assignGoalNumbers(newGoals, highestExisting) {
  // Sort by date ascending (oldest first) to assign numbers in chronological order
  const sortedByDateAsc = [...newGoals].sort((a, b) => {
    const dateA = parseGoalDate(a.parsed.date);
    const dateB = parseGoalDate(b.parsed.date);
    if (dateA.getTime() === dateB.getTime()) {
      // Same date - sort by minute
      const minA = parseInt(a.parsed.minute) || 0;
      const minB = parseInt(b.parsed.minute) || 0;
      return minA - minB;
    }
    return dateA.getTime() - dateB.getTime();
  });

  let nextNumber = highestExisting + 1;

  for (const goal of sortedByDateAsc) {
    if (goal.parsed.isOfficial) {
      goal.parsed.number = String(nextNumber);
      nextNumber++;
    } else {
      goal.parsed.number = 'N.O';
    }
    // Rebuild raw string with new number
    goal.raw = `${goal.parsed.number} ${goal.parsed.date} ${goal.parsed.venue} ${goal.parsed.team} vs. ${goal.parsed.opponent} ${goal.parsed.minute} ${goal.parsed.goalType}`;
  }

  // Return sorted newest first for display
  return sortedByDateAsc.reverse();
}

function parseGoalDate(dateStr) {
  const [month, day, year] = dateStr.split('/');
  const fullYear = parseInt(year) > 50 ? 1900 + parseInt(year) : 2000 + parseInt(year);
  return new Date(fullYear, parseInt(month) - 1, parseInt(day));
}

/**
 * Normalize string for comparison (remove special chars, lowercase, etc.)
 */
function normalizeForComparison(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')  // Remove special chars
    .trim();
}

/**
 * Parse a raw goal string to extract more details for comparison
 */
function parseRawGoalDetailed(rawString) {
  const parts = rawString.split(' ');
  const number = parts[0];
  const date = parts[1];
  const venue = parts[2];

  // Find minute (contains apostrophe)
  let minute = '';
  for (const part of parts) {
    if (part.includes("'")) {
      minute = part;
      break;
    }
  }

  return {
    number,
    date,
    venue,
    minute: normalizeForComparison(minute),
    raw: rawString,
  };
}

/**
 * Find new goals that don't exist in current data
 * @param {Array} transformedGoals - Newly scraped and transformed goals
 * @param {string[]} existingRaw - Existing raw goal strings
 * @returns {Array} New goals to add
 */
export function findNewGoals(transformedGoals, existingRaw) {
  const existingParsed = existingRaw.map(parseRawGoalDetailed);

  // Create a set of existing goal identifiers (date + venue + minute)
  // This is more reliable than using goal numbers since Original source doesn't provide them
  const existingIds = new Set(
    existingParsed.map((g) => `${g.date}_${g.venue}_${g.minute}`)
  );

  // Find goals that don't exist yet
  const newGoals = transformedGoals.filter((goal) => {
    const minute = normalizeForComparison(goal.parsed.minute);
    const id = `${goal.parsed.date}_${goal.parsed.venue}_${minute}`;
    return !existingIds.has(id);
  });

  return newGoals;
}

/**
 * Merge new goals with existing goals (new goals at top)
 * @param {Array} newGoals - New transformed goals
 * @param {string[]} existingRaw - Existing raw goal strings
 * @returns {string[]} Merged array of raw goal strings
 */
export function mergeGoals(newGoals, existingRaw) {
  const newRawStrings = newGoals.map((g) => g.raw);
  return [...newRawStrings, ...existingRaw];
}

/**
 * Update RoadSection.astro with new goals
 * @param {string[]} allGoals - Complete array of raw goal strings
 * @returns {boolean} Whether file was updated
 */
export function updateAstroComponent(allGoals) {
  const componentPath = join(ROOT_DIR, CONFIG.COMPONENT_FILE);
  const content = readFileSync(componentPath, 'utf-8');

  // Match the rawData array
  const rawDataPattern = /const rawData = \[([\s\S]*?)\];/;
  const match = content.match(rawDataPattern);

  if (!match) {
    throw new Error('Could not find rawData array in component');
  }

  // Build new rawData array with proper formatting
  const formattedGoals = allGoals.map((g) => `  "${g}"`).join(',\n');
  const newRawData = `const rawData = [\n${formattedGoals},\n]`;

  // Replace in content
  const newContent = content.replace(rawDataPattern, newRawData);

  // Check if content actually changed
  if (newContent === content) {
    return false;
  }

  writeFileSync(componentPath, newContent, 'utf-8');
  console.log(`Updated ${componentPath}`);
  return true;
}

/**
 * Compare and report differences
 */
export function compareGoals(newGoals, existingRaw) {
  return {
    existing: existingRaw.length,
    new: newGoals.length,
    total: existingRaw.length + newGoals.length,
    newGoalsList: newGoals.map((g) => g.raw),
  };
}
