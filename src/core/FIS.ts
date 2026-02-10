import { FacebookClient } from './FacebookClient.js';
import { QueueManager } from './QueueManager.js';
import { PostRequestSchema } from '../validation/schemas.js';
import type { PostRequest } from '../validation/schemas.js';
import { WorkloadPriority } from '../types/index.js';
import type { FISResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { StreamManager } from './StreamManager.js';

export interface FISConfig {
  pageId: string;
  accessToken: string;
  concurrency?: number;
  minPostSpacingMs?: number;
}

export class FIS {
  private client: FacebookClient;
  private queue: QueueManager;
  private pageId: string;

  constructor(config: FISConfig) {
    this.pageId = config.pageId;
    this.client = new FacebookClient(config.pageId, config.accessToken);
    this.queue = new QueueManager(config.concurrency || 3, config.minPostSpacingMs || 45000);
    logger.info('FIS Service Initialized', { 
      pageId: config.pageId, 
      concurrency: config.concurrency,
      spacing: config.minPostSpacingMs 
    });
  }

  async post(request: PostRequest): Promise<FISResponse> {
    const validated = PostRequestSchema.parse(request);
    const processedCaption = this.ensureRobustCaption(validated.caption);

    StreamManager.emitQueueUpdate(this.pageId, 'queued', { priority: validated.priority });

    return this.queue.add(async () => {
      StreamManager.emitQueueUpdate(this.pageId, 'processing', { task: 'Starting Upload' });
      logger.debug('Processing queued post task', { priority: validated.priority });
      try {
        let mediaIds: string[] = [];

        if (validated.media && validated.media.length > 0) {
          try {
            mediaIds = await Promise.all(
              validated.media.map(m => this.client.uploadMedia({
                source: m.source,
                type: m.type,
                altText: m.altText ?? undefined
              }))
            );
            logger.debug('Media uploaded successfully', { count: mediaIds.length });
          } catch (uploadError: any) {
            logger.error('Media upload failed, falling back to text-only', { error: uploadError.message });
          }
        }

        const results: FISResponse[] = [];

        if (validated.options?.publishToFeed !== false) {
          const res = await this.client.createFeedPost(processedCaption, mediaIds);
          results.push(res);
          if (res.success) logger.info('Feed post published', { postId: res.postId });
        }

        if (validated.options?.publishToStory && mediaIds.length > 0) {
          const firstMediaId = mediaIds[0];
          if (firstMediaId) {
            const res = await this.client.createStory(firstMediaId);
            results.push(res);
            if (res.success) logger.info('Story published', { mediaId: firstMediaId });
          }
        }

        const finalResult = results[0] || { 
          success: false, 
          error: { code: 'NO_ACTION', message: 'No publish targets selected' },
          timestamp: new Date().toISOString()
        };

        StreamManager.emitQueueUpdate(this.pageId, finalResult.success ? 'completed' : 'failed', { 
          postId: finalResult.postId,
          error: finalResult.error
        });

        return finalResult;

      } catch (error: any) {
        logger.error('Post execution error', { error: error.message });
        StreamManager.emitQueueUpdate(this.pageId, 'failed', { error: error.message });
        
        return {
          success: false,
          error: { code: 'EXECUTION_ERROR', message: error.message },
          timestamp: new Date().toISOString()
        };
      }
    }, validated.priority, true);
  }

  async updatePost(postId: string, newCaption: string, priority: WorkloadPriority = WorkloadPriority.HIGH): Promise<FISResponse> {
    logger.info('Queuing authoritative update', { postId });
    StreamManager.emitQueueUpdate(this.pageId, 'queued', { type: 'update', postId });
    
    return this.queue.add(async () => {
      StreamManager.emitQueueUpdate(this.pageId, 'processing', { task: 'Updating Post' });
      const result = await this.client.updatePost(postId, newCaption);
      StreamManager.emitQueueUpdate(this.pageId, result.success ? 'completed' : 'failed', { postId });
      return result;
    }, priority, false);
  }

  private ensureRobustCaption(caption: string): string {
    if (!caption || caption.length < 50) {
      return caption || '⚠️ Standard Advisory: Please check the official portal for more details.';
    }
    return caption;
  }

  get stats() {
    return this.queue.stats;
  }
}