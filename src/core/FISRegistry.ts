import { FIS } from './FIS.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export class FISRegistry {
  private static instances: Map<string, FIS> = new Map();

  /**
   * Retrieves or creates an FIS instance for a specific Page ID.
   * This ensures that each Page has its own independent queue and rate limits.
   */
  static getInstance(pageId: string, accessToken: string): FIS {
    if (!this.instances.has(pageId)) {
      logger.info('Creating new FIS instance for Page', { pageId });
      
      const instance = new FIS({
        pageId,
        accessToken,
        concurrency: config.CONCURRENCY,
        minPostSpacingMs: config.POST_SPACING_DELAY_MS
      });

      this.instances.set(pageId, instance);
    }
    
    return this.instances.get(pageId)!;
  }

  /**
   * Returns stats for all active instances.
   */
  static getGlobalStats() {
    const stats: Record<string, any> = {};
    for (const [pageId, fis] of this.instances.entries()) {
      stats[pageId] = fis.stats;
    }
    return stats;
  }
}
