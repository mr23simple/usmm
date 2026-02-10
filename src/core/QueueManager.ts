import PQueue from 'p-queue';
import { WorkloadPriority } from '../types/index.js';

export class QueueManager {
  private queue: PQueue;
  private publishQueue: PQueue;

  constructor(concurrency: number = 3, publishRateLimit: number = 10) {
    // General queue for non-publishing tasks (uploads, stats, etc)
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
    const targetQueue = isPublishingTask ? this.publishQueue : this.queue;
    
    return targetQueue.add(task, { priority });
  }

  get stats() {
    return {
      general: {
        size: this.queue.size,
        pending: this.queue.pending,
      },
      publish: {
        size: this.publishQueue.size,
        pending: this.publishQueue.pending,
      }
    };
  }
}
