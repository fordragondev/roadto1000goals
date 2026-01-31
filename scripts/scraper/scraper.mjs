// Playwright scraper for goal data
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { CONFIG } from './config.mjs';

// Enable stealth mode to avoid detection
chromium.use(StealthPlugin());

/**
 * Scrape goals from source (first page only)
 * @returns {Promise<Array>} Array of raw goal data objects
 */
export async function scrapeGoals() {
  console.log('Launching browser...');

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
  });

  const page = await context.newPage();

  try {
    console.log('Navigating to web source...');
    await page.goto(CONFIG.GOALS_URL, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.TIMEOUT,
    });

    // Wait for page to stabilize
    await page.waitForTimeout(3000);

    // Handle cookie consent popup if it appears
    try {
      // Try different cookie button selectors
      const cookieSelectors = [
        'button[title="Accept All"]',
        '#onetrust-accept-btn-handler',
        '.onetrust-close-btn-handler',
        'button:has-text("Accept")',
        'button:has-text("Akzeptieren")',
      ];

      for (const selector of cookieSelectors) {
        const btn = page.locator(selector).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click();
          console.log('Accepted cookies');
          await page.waitForTimeout(2000);
          break;
        }
      }
    } catch {
      // Cookie popup may not appear
    }

    // Debug: Save screenshot
    const debugMode = process.argv.includes('--debug');
    if (debugMode) {
      await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
      console.log('Saved debug screenshot');
    }

    // Wait for the goals table to load - try multiple selectors
    console.log('Waiting for goals table...');
    const tableSelectors = [
      'table.items',
      'table.inline-table',
      '#yw1',
      '.responsive-table table',
      'table',
    ];

    let tableFound = false;
    for (const selector of tableSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 });
        console.log(`Found table with selector: ${selector}`);
        tableFound = true;
        break;
      } catch {
        // Try next selector
      }
    }

    if (!tableFound) {
      // Save page content for debugging
      const html = await page.content();
      console.log('Page title:', await page.title());
      console.log('First 2000 chars of HTML:', html.substring(0, 2000));
      throw new Error('Could not find goals table');
    }

    // Extract goals from the first page only
    console.log('Extracting goal data...');

    // Debug: Check table structure
    const debugInfo = await page.evaluate(() => {
      const tables = document.querySelectorAll('table');
      const info = {
        tableCount: tables.length,
        tables: [],
      };

      tables.forEach((table, i) => {
        const rows = table.querySelectorAll('tbody tr');
        const rowsData = [];

        // Get first 5 data rows
        rows.forEach((row, ri) => {
          if (ri < 5) {
            const cells = row.querySelectorAll('td');
            const cellTexts = Array.from(cells).map(c => c.textContent?.trim().substring(0, 50) || '');
            rowsData.push({
              rowIndex: ri,
              cellCount: cells.length,
              cells: cellTexts,
            });
          }
        });

        info.tables.push({
          index: i,
          className: table.className,
          rowCount: rows.length,
          sampleRows: rowsData,
        });
      });

      return info;
    });

    if (process.argv.includes('--debug')) {
      console.log('Table debug info:', JSON.stringify(debugInfo, null, 2));
    }

    const goals = await page.evaluate(() => {
      // Find the goals table (the one with tbody containing goal data)
      const tables = document.querySelectorAll('table');
      const extractedGoals = [];
      let goalsTable = null;
      let maxRows = 0;

      for (const table of tables) {
        const rowCount = table.querySelectorAll('tbody tr').length;
        if (rowCount > maxRows) {
          maxRows = rowCount;
          goalsTable = table;
        }
      }

      if (!goalsTable) return extractedGoals;

      const rows = goalsTable.querySelectorAll('tbody tr');

      // Track current match context for continuation rows
      let currentMatch = null;

      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 4) continue;

        // Check if this is a continuation row (has colspan for empty cells)
        const hasColspan = row.querySelector('td[colspan]');

        if (hasColspan) {
          // Continuation row - additional goal in same match
          // Structure: [colspan=11 empty], Minute, At score, Type, Assist
          if (currentMatch) {
            const cellTexts = Array.from(cells).map(c => c.textContent?.trim() || '');
            // Find the minute and goal type in the remaining cells
            let minute = '';
            let goalType = '';

            for (let i = 0; i < cellTexts.length; i++) {
              const text = cellTexts[i];
              if (text.includes("'") && !minute) {
                minute = text;
              } else if (text && !text.includes(':') && !minute && i > 0) {
                // Skip "At score" column (contains ":")
              }
            }

            // Find goal type - usually after minute
            for (let i = cellTexts.length - 1; i >= 0; i--) {
              const text = cellTexts[i];
              if (text && !text.includes("'") && !text.includes(':') && text.length > 2) {
                goalType = text;
                break;
              }
            }

            if (minute) {
              extractedGoals.push({
                ...currentMatch,
                minute: minute,
                goalType: goalType || 'Right-footed shot',
              });
            }
          }
          continue;
        }

        // Full row with all match data
        // Structure: Competition(2), Matchday, Date, Venue, For(2), Opponent(2), Result, Pos, Minute, AtScore, Type, Assist
        const cellTexts = Array.from(cells).map(c => c.textContent?.trim() || '');

        // Find key data by position and content
        let competition = '';
        let date = '';
        let venue = '';
        let forTeam = '';
        let opponent = '';
        let minute = '';
        let goalType = '';

        // Competition is in first cells
        const compCell = cells[1];
        if (compCell) {
          const compLink = compCell.querySelector('a');
          competition = compLink ? compLink.textContent.trim() : cellTexts[1];
        }

        // Find date (format: DD/MM/YY)
        for (const text of cellTexts) {
          if (/^\d{2}\/\d{2}\/\d{2}$/.test(text)) {
            date = text;
            break;
          }
        }

        // Find venue (H or A in a cell with class hauptlink)
        const venueCell = row.querySelector('td.hauptlink');
        if (venueCell) {
          const venueText = venueCell.textContent.trim();
          if (venueText === 'H' || venueText === 'A' || venueText === 'N') {
            venue = venueText;
          }
        }

        // Find team names from links with title attributes
        const teamLinks = row.querySelectorAll('a[title]');
        for (const link of teamLinks) {
          const title = link.getAttribute('title');
          const parent = link.closest('td');
          if (!parent) continue;

          // Skip competition links
          if (parent.classList.contains('no-border-links') && parent.classList.contains('links')) {
            continue;
          }

          // For team is before opponent in the structure
          if (!forTeam && title && !title.includes('Match')) {
            forTeam = title;
          } else if (forTeam && !opponent && title && !title.includes('Match')) {
            opponent = title;
          }
        }

        // Find minute (contains apostrophe)
        for (const text of cellTexts) {
          if (text.includes("'") && /\d/.test(text)) {
            minute = text;
            break;
          }
        }

        // Find goal type - look for known types
        const goalTypes = ['Penalty', 'Header', 'Right-footed shot', 'Left-footed shot',
                          'Counter attack goal', 'Direct free kick', 'Not reported'];
        for (const text of cellTexts) {
          for (const type of goalTypes) {
            if (text.toLowerCase().includes(type.toLowerCase())) {
              goalType = text;
              break;
            }
          }
          if (goalType) break;
        }

        if (date && minute) {
          const goal = {
            competition,
            date,
            venue: venue || 'N',
            forTeam: forTeam || 'Al-Nassr',
            opponent: opponent || '',
            minute,
            goalType: goalType || 'Right-footed shot',
          };

          extractedGoals.push(goal);
          currentMatch = goal; // Save for continuation rows
        }
      }

      return extractedGoals;
    });

    console.log(`Scraped ${goals.length} goals from first page`);
    return goals;

  } catch (error) {
    console.error('Scraping error:', error instanceof Error ? error.message : error);
    throw error;
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
}
