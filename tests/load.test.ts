import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';

describe('USMM Load Simulation (Dry Run)', () => {
  
  it('should handle multiple Page IDs with varying request counts concurrently', async () => {
    const scenarios = [
      { id: 'page_alpha', count: 3 },
      { id: 'page_beta', count: 1 },
      { id: 'page_gamma', count: 5 },
      { id: 'page_delta', count: 2 },
      { id: 'page_epsilon', count: 4 }
    ];

    const allRequests = scenarios.flatMap(scenario => {
      return Array.from({ length: scenario.count }).map((_, i) => {
        return request(app)
          .post('/v1/post')
          .set('x-platform-id', scenario.id)
          .set('x-platform-token', `token_${scenario.id}`)
          .send({
            platform: 'fb',
            caption: `Load Test Request ${i+1} for ${scenario.id}`,
            options: { dryRun: true }
          });
      });
    });

    console.log(`🚀 Launching ${allRequests.length} concurrent dry-run requests across ${scenarios.length} platforms...`);

    const results = await Promise.all(allRequests);

    // Verify all responses
    results.forEach((res, index) => {
      if (res.status !== 200) {
        console.error(`Request ${index} failed:`, res.body);
      }
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.postId).toContain('DRY_RUN_');
    });

    console.log('✅ All simulation requests completed successfully.');
  }, 30000); // Higher timeout for load simulation

});
