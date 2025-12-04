// File: src/scripts/start.ts

import { startBot } from '../index.js';
import logBanner from '../utils/log-banner.js';

(async () => {
  logBanner();
  await startBot();
})();
