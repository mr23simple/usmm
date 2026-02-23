import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import type { FISResponse, MediaAsset } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class FacebookClient {
  private api: AxiosInstance;
  private pageId: string;

  constructor(pageId: string, accessToken: string) {
    this.pageId = pageId;
    this.api = axios.create({
      baseURL: `https://graph.facebook.com/v24.0`,
      params: { access_token: accessToken },
      proxy: false, // Force bypass any system/environment proxy
    });
  }

  async uploadMedia(asset: MediaAsset): Promise<string> {
    const isVideo = asset.type === 'video';
    let buffer: Buffer;

    if (asset.source instanceof Buffer) {
      buffer = asset.source;
    } else {
      const response = await axios.get(asset.source as string, { responseType: 'arraybuffer', proxy: false });
      buffer = Buffer.from(response.data);
    }

    if (isVideo) {
      return this.uploadVideoChunked(buffer, asset.mimeType);
    }

    // Standard Photo Upload (Single POST)
    const baseUrl = 'https://graph.facebook.com/v24.0';
    const endpoint = `${baseUrl}/${this.pageId}/photos`;
    const accessToken = (this.api.defaults.params as any)?.access_token;
    
    const form = new FormData();
    if (accessToken) form.append('access_token', accessToken);
    form.append('source', buffer, { filename: 'upload.png' });
    form.append('published', 'false');
    if (asset.altText) form.append('caption', asset.altText);

    const response = await this.requestWithRetry(() => axios.post(endpoint, form, {
      headers: form.getHeaders(),
      proxy: false
    }));

    return response.data.id;
  }

  /**
   * Performs a resumable (chunked) upload for large videos to Facebook.
   * Recommended for files > 25MB or high-reliability requirements.
   */
  private async uploadVideoChunked(buffer: Buffer, mimeType: string = 'video/mp4'): Promise<string> {
    const accessToken = (this.api.defaults.params as any)?.access_token;
    const baseUrl = 'https://graph-video.facebook.com/v24.0';
    const endpoint = `${baseUrl}/${this.pageId}/videos`;
    const fileSize = buffer.length;
    const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks

    logger.debug('Starting chunked video upload to FB', { fileSize, chunks: Math.ceil(fileSize / CHUNK_SIZE) });

    // Phase 1: START
    const startRes = await this.requestWithRetry(() => axios.post(endpoint, null, {
      params: {
        access_token: accessToken,
        upload_phase: 'start',
        file_size: fileSize
      },
      proxy: false
    }));

    const uploadSessionId = startRes.data.upload_session_id;
    let startOffset = 0;

    // Phase 2: APPEND
    while (startOffset < fileSize) {
      const endOffset = Math.min(startOffset + CHUNK_SIZE, fileSize);
      const chunk = buffer.slice(startOffset, endOffset);

      const form = new FormData();
      form.append('access_token', accessToken);
      form.append('upload_phase', 'transfer');
      form.append('upload_session_id', uploadSessionId);
      form.append('start_offset', startOffset.toString());
      form.append('video_file_chunk', chunk, { filename: 'chunk.mp4', contentType: mimeType });

      await this.requestWithRetry(() => axios.post(endpoint, form, {
        headers: form.getHeaders(),
        proxy: false
      }));

      startOffset = endOffset;
      logger.debug('Uploaded FB video chunk', { startOffset, total: fileSize });
    }

    // Phase 3: FINISH
    const finishRes = await this.requestWithRetry(() => axios.post(endpoint, null, {
      params: {
        access_token: accessToken,
        upload_phase: 'finish',
        upload_session_id: uploadSessionId
      },
      proxy: false
    }));

    const videoId = finishRes.data.id || finishRes.data.video_id;

    // Wait for processing to begin and poll for readiness
    logger.debug('FB video upload finished, polling for readiness...', { videoId });
    const isReady = await this.pollVideoStatus(videoId);
    
    if (!isReady) {
      logger.warn('FB video status polling timed out or failed, proceeding anyway...', { videoId });
    }

    return videoId;
  }

  private async pollVideoStatus(videoId: string, maxAttempts = 6): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await this.api.get(`/${videoId}`, { params: { fields: 'status' } });
        const status = res.data.status?.video_status;
        logger.debug(`Checking FB video status`, { videoId, status, attempt: i + 1 });
        
        if (status === 'ready') return true;
        if (status === 'deleted' || status === 'error') {
          logger.error('FB video processing failed', { videoId, status });
          return false;
        }
        
        // Wait longer between polls (starting at 5s, then 10s, 15s...)
        await new Promise(resolve => setTimeout(resolve, 5000 * (i + 1)));
      } catch (e: any) {
        logger.warn(`Error polling video status`, { videoId, error: e.message });
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    return false;
  }

  private async requestWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 3000): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      const statusCode = error.response?.status;
      const errorCode = error.response?.data?.error?.code;
      
      // Handle rate limiting (429)
      if (statusCode === 429) {
        const retryAfter = error.response?.headers?.['retry-after'] || 60;
        logger.warn(`Facebook API rate limited. Waiting ${retryAfter}s before retry...`, { 
          retryAfter 
        });
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        if (retries > 0) {
          return this.requestWithRetry(fn, retries - 1, delay);
        }
      }
      
      // Retry on 500 (Internal Server Error) or code 1 (Unknown error)
      if (retries > 0 && (statusCode === 500 || errorCode === 1 || statusCode === 503)) {
        logger.warn(`Facebook API transient error (Status: ${statusCode}, Code: ${errorCode}). Retrying...`, { 
          retriesLeft: retries 
        });
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.requestWithRetry(fn, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  async createFeedPost(caption: string, media?: { id: string, type: 'image' | 'video' }[], options?: any): Promise<FISResponse> {
    try {
      const hasVideo = media?.some(m => m.type === 'video');
      const videoId = media?.find(m => m.type === 'video')?.id;

      if (hasVideo && videoId) {
        // Videos MUST be published via the video node or /videos endpoint
        const response = await this.requestWithRetry(() => this.api.post(`/${videoId}`, null, {
          params: { 
            description: caption,
            published: true 
          }
        }));
        return {
          success: true,
          postId: response.data.id || videoId,
          timestamp: new Date().toISOString(),
        };
      }

      // Standard Photo/Text Feed Post
      const params: any = { message: caption };
      if (media && media.length > 0) {
        params.attached_media = JSON.stringify(
          media.map(m => ({ media_fbid: m.id }))
        );
      }

      const response = await this.requestWithRetry(() => this.api.post(`/${this.pageId}/feed`, null, { params }));

      return {
        success: true,
        postId: response.data.id,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  async createStory(mediaId: string, type: 'image' | 'video' = 'image'): Promise<FISResponse> {
    try {
      const endpoint = type === 'video' ? `/${this.pageId}/video_stories` : `/${this.pageId}/photo_stories`;
      const paramName = type === 'video' ? 'video_id' : 'photo_id';
      
      const response = await this.requestWithRetry(() => this.api.post(endpoint, null, {
        params: { [paramName]: mediaId }
      }));

      return {
        success: true,
        postId: response.data.id,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  async updatePost(postId: string, newCaption: string): Promise<FISResponse> {
    try {
      const response = await this.requestWithRetry(() => this.api.post(`/${postId}`, null, {
        params: { message: newCaption }
      }));

      return {
        success: response.data.success,
        postId: postId,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  async getProfilePicUrl(): Promise<string> {
    return `https://graph.facebook.com/${this.pageId}/picture?type=large`;
  }

  async validateToken(forceRealCheck: boolean = false): Promise<{ valid: boolean; name?: string; error?: string }> {
    try {
      // Allow 'mock' token to bypass real check for testing/dryRun
      const token = (this.api.defaults.params as any)?.access_token;
      if (token === 'mock') {
        return { valid: true, name: 'Mock FB User' };
      }

      const response = await this.api.get('/me', { params: { fields: 'name' } });
      return { valid: true, name: response.data.name };
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || error.message;
      return { valid: false, error: msg };
    }
  }

  private handleError(error: any): FISResponse {
    const errorData = error.response?.data;
    const statusCode = error.response?.status;
    const requestInfo = {
      method: error.config?.method,
      url: error.config?.url,
      params: error.config?.params,
      hasData: !!error.config?.data
    };

    logger.error('Facebook API Error', { 
      status: statusCode, 
      data: errorData,
      message: error.message,
      request: requestInfo
    });

    return {
      success: false,
      error: {
        code: errorData?.error?.code || 'UNKNOWN',
        message: errorData?.error?.message || error.message,
        raw: errorData || error,
      },
      timestamp: new Date().toISOString(),
    };
  }
}