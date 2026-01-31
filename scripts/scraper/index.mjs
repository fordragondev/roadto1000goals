#!/usr/bin/env node
// Main entry point for goal scraper

import { scrapeGoals } from './scraper.mjs';
import { transformGoals, sortGoalsByDate } from './transformer.mjs';
import {
  readExistingGoals,
  findNewGoals,
  mergeGoals,
  updateAstroComponent,
  updateHeroSection,
  compareGoals,
  getHighestGoalNumber,
  assignGoalNumbers,
} from './updater.mjs';

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

async function main() {
  console.log('=== Source Goal Scraper ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  try {
    // Step 1: Read existing goals
    console.log('Step 1: Reading existing goals...');
    const existingGoals = readExistingGoals();
    console.log(`  Found ${existingGoals.length} existing goals`);

    // Step 2: Scrape new goals from web source
    console.log('');
    console.log('Step 2: Scraping goals from web source...');
    const scrapedGoals = await scrapeGoals();
    console.log(`  Scraped ${scrapedGoals.length} goals from first page`);

    // Step 3: Transform data
    console.log('');
    console.log('Step 3: Transforming data...');
    const transformedGoals = transformGoals(scrapedGoals);
    const sortedGoals = sortGoalsByDate(transformedGoals);
    console.log(`  Transformed ${sortedGoals.length} goals`);

    // Step 4: Find new goals
    console.log('');
    console.log('Step 4: Finding new goals...');
    const newGoals = findNewGoals(sortedGoals, existingGoals);

    if (newGoals.length === 0) {
      console.log('  No new goals found.');
      console.log('');
      console.log('=== Scraping Complete ===');
      return;
    }

    // Step 5: Assign goal numbers
    console.log('');
    console.log('Step 5: Assigning goal numbers...');
    const highestNumber = getHighestGoalNumber(existingGoals);
    console.log(`  Highest existing goal number: ${highestNumber}`);
    const numberedGoals = assignGoalNumbers(newGoals, highestNumber);

    const comparison = compareGoals(numberedGoals, existingGoals);
    console.log(`  Existing: ${comparison.existing}`);
    console.log(`  New: ${comparison.new}`);
    console.log(`  Total after merge: ${comparison.total}`);

    if (comparison.new > 0) {
      console.log('');
      console.log('  New goals found:');
      comparison.newGoalsList.forEach((g) => console.log(`    + ${g}`));
    }

    // Step 6: Update file
    console.log('');
    if (DRY_RUN) {
      console.log('Step 6: DRY RUN - Skipping file update.');
      console.log('  Would add the following goals:');
      comparison.newGoalsList.forEach((g) => console.log(`    ${g}`));
    } else {
      console.log('Step 6: Updating components...');
      const mergedGoals = mergeGoals(numberedGoals, existingGoals);
      const roadUpdated = updateAstroComponent(mergedGoals);
      const heroUpdated = updateHeroSection(mergedGoals);

      if (roadUpdated || heroUpdated) {
        console.log(`  Successfully added ${comparison.new} new goal(s)!`);
      } else {
        console.log('  No changes needed.');
      }
    }

    console.log('');
    console.log('=== Scraping Complete ===');

  } catch (error) {
    console.error('');
    console.error('Error:', error instanceof Error ? error.message : error);
    if (VERBOSE && error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
