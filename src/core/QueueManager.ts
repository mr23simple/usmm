import PQueue from 'p-queue';
import { WorkloadPriority } from '../types/index.js';
import { config } from '../config.js';

export class QueueManager {
  // Global shared queue to limit total CPU usage across all instances
  private static globalGeneralQueue = new PQueue({ concurrency: config.GLOBAL_CONCURRENCY || 100 });
  
  private queue: PQueue;
  private publishQueue: PQueue;

  constructor(concurrency: number = 3, publishRateLimit: number = 10) {
    // Instance-specific queue still exists but we'll prefer the global one for heavy lifting
    this.queue = new PQueue({ concurrency });

    // Specialized queue for publishing to ensure rate limits
    this.publishQueue = new PQueue({
      concurrency: 1, // Ensure one post at a time to maintain sequence
      intervalCap: publishRateLimit,
      interval: 60000, // 1 minute
      carryoverConcurrencyCount: true
    });
  }

  /**
   * Adds a task to the queue with a specific priority.
   */
  async add<T>(
    task: () => Promise<T>,
    priority: WorkloadPriority = WorkloadPriority.NORMAL,
    isPublishingTask: boolean = false
  ): Promise<T> {
    // Publishing tasks are instance-specific (rate limits), 
    // but general tasks (uploads, processing) hit the global concurrency limit
    const targetQueue = isPublishingTask ? this.publishQueue : QueueManager.globalGeneralQueue;
    
    return targetQueue.add(task, { priority });
  }

  get stats() {
    return {
      general: {
        size: QueueManager.globalGeneralQueue.size,
        pending: QueueManager.globalGeneralQueue.pending,
      },
      publish: {
        size: this.publishQueue.size,
        pending: this.publishQueue.pending,
      }
    };
  }
}
