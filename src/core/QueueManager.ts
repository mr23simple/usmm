import PQueue from 'p-queue';
import { WorkloadPriority } from '../types/index.js';

export class QueueManager {
  private queue: PQueue;
  private lastPostTime: number = 0;
  private readonly minPostSpacing: number;

  constructor(concurrency: number = 3, minPostSpacingMs: number = 45000) {
    this.queue = new PQueue({ concurrency });
    this.minPostSpacing = minPostSpacingMs;
  }

  async add<T>(
    task: () => Promise<T>,
    priority: WorkloadPriority = WorkloadPriority.NORMAL,
    isPublishingTask: boolean = false
  ): Promise<T> {
    return this.queue.add(async () => {
      if (isPublishingTask) {
        await this.waitForSpacing();
      }
      
      const result = await task();

      if (isPublishingTask) {
        this.lastPostTime = Date.now();
      }

      return result;
    }, { priority });
  }

  private async waitForSpacing(): Promise<void> {
    const now = Date.now();
    const timeSinceLastPost = now - this.lastPostTime;
    
    if (timeSinceLastPost < this.minPostSpacing) {
      const waitTime = this.minPostSpacing - timeSinceLastPost;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  get stats() {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
      isPaused: this.queue.isPaused,
    };
  }
}