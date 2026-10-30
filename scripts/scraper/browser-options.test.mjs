import assert from 'node:assert/strict';
import test from 'node:test';

import { createBrowserOptions } from './browser-options.mjs';

test('launches real Chrome in headed mode with its native viewport', () => {
  assert.deepEqual(createBrowserOptions(), {
    channel: 'chrome',
    headless: false,
    locale: 'en-US',
    viewport: null,
  });
});
