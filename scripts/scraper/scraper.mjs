// Playwright scraper for goal data, using Patchright (a Playwright fork
// patched against CDP-level automation leaks) for bot-detection evasion.
import fs from 'node:fs';
import { chromium } from 'patchright';
import { CONFIG } from './config.mjs';

/**
 * Log response status/headers/title/HTML snippet and persist screenshot + HTML
 * to disk so CI can surface them even without --debug (e.g. as workflow artifacts).
 */
async function logDiagnostics(page, response) {
  const httpStatus = response?.status();
  const headers = response?.headers() ?? {};
  const title = await page.title();
  const html = await page.content();

  // Headers that hint at WAF/bot-detection vendors (Cloudflare, DataDome, etc.)
  const interestingHeaders = ['server', 'cf-ray', 'cf-mitigated', 'x-datadome', 'retry-after', 'content-type'];
  const headerSummary = interestingHeaders
    .filter((h) => headers[h])
    .map((h) => `${h}: ${headers[h]}`)
    .join(', ');

  console.log(`HTTP status: ${httpStatus ?? 'unknown'}`);
  console.log(`Response headers: ${headerSummary || '(none of interest present)'}`);
  console.log(`Page title: "${title}"`);
  console.log(`HTML snippet (first 1000 chars): ${html.substring(0, 1000)}`);

  try {
    await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
    fs.writeFileSync('debug-page.html', html);
    console.log('Saved debug-screenshot.png and debug-page.html');
  } catch (err) {
    console.log('Failed to save debug artifacts:', err instanceof Error ? err.message : err);
  }
}

/**
 * Scrape goals from source (first page only)
 * @returns {Promise<Array>} Array of raw goal data objects
 */
export async function scrapeGoals() {
  console.log('Launching browser...');

  // Patchright's evasions assume the patched browser's real fingerprint and
  // headers are used unmodified — hand-rolled UA/client-hint overrides are a
  // known giveaway when they drift from what the actual binary reports, so
  // none are set here (unlike the previous playwright-extra setup).
  const context = await chromium.launchPersistentContext('', {
    headless: true,
    locale: 'en-US',
  });

  const page = await context.newPage();

  const debugMode = process.argv.includes('--debug');

  try {
    // Random delay to avoid instant-connection fingerprint
    const preDelay = 1500 + Math.floor(Math.random() * 2000);
    await page.waitForTimeout(preDelay);

    console.log('Navigating to web source...');
    let response = await page.goto(CONFIG.GOALS_URL, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.TIMEOUT,
    });

    // Check for block via HTTP status or known block page titles
    let httpStatus = response?.status();
    let title = await page.title();
    const BLOCK_TITLES = ['ERROR', '403', 'Forbidden', 'Access Denied', 'Request blocked'];
    const isBlocked = httpStatus === 403 || BLOCK_TITLES.some(s => title.includes(s));
    if (isBlocked) {
      console.log(`Page blocked (HTTP ${httpStatus ?? 'unknown'}, title: "${title}")`);
      await logDiagnostics(page, response);
      throw new Error('CloudFront 403 block — will retry');
    }

    // AWS WAF (fronted by CloudFront) serves a 202 JS challenge instead of the
    // real page. The challenge script needs time to run and set an
    // aws-waf-token cookie, then the page must be re-fetched to get real content.
    if (httpStatus === 202) {
      const challengeHtml = await page.content();
      const isWafChallenge = challengeHtml.includes('gokuProps') || challengeHtml.includes('awsWafCookieDomainList');
      if (isWafChallenge) {
        console.log('AWS WAF JS challenge detected (HTTP 202) — waiting for it to resolve...');
        await page.waitForTimeout(10000);
        response = await page.goto(CONFIG.GOALS_URL, {
          waitUntil: 'domcontentloaded',
          timeout: CONFIG.TIMEOUT,
        });
        httpStatus = response?.status();
        title = await page.title();
        if (httpStatus === 202) {
          console.log(`Still blocked after challenge wait (HTTP ${httpStatus})`);
          await logDiagnostics(page, response);
          throw new Error('AWS WAF challenge unresolved — will retry');
        }
        console.log(`Challenge resolved (HTTP ${httpStatus})`);
      }
    }

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
      await logDiagnostics(page, response);
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

    // Prefer the known selectors (same ones used to detect the table above)
    // over a row-count heuristic — early in a season the real goals table can
    // have very few rows, letting an unrelated sidebar/widget table with more
    // rows win a "most rows" comparison and silently produce zero goals.
    const extractionSelectors = tableSelectors.filter((s) => s !== 'table');

    const goals = await page.evaluate((prioritySelectors) => {
      const extractedGoals = [];
      let goalsTable = null;

      for (const selector of prioritySelectors) {
        const candidate = document.querySelector(selector);
        if (candidate && candidate.querySelectorAll('tbody tr').length > 0) {
          goalsTable = candidate;
          break;
        }
      }

      // Fallback: table with the most rows, in case none of the known
      // selectors matched anything with actual data rows.
      if (!goalsTable) {
        const tables = document.querySelectorAll('table');
        let maxRows = 0;
        for (const table of tables) {
          const rowCount = table.querySelectorAll('tbody tr').length;
          if (rowCount > maxRows) {
            maxRows = rowCount;
            goalsTable = table;
          }
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
    }, extractionSelectors);

    console.log(`Scraped ${goals.length} goals from first page`);
    return goals;

  } catch (error) {
    console.error('Scraping error:', error instanceof Error ? error.message : error);
    throw error;
  } finally {
    await context.close();
    console.log('Browser closed');
  }
}
