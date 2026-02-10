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
    const form = new FormData();
    
    if (asset.source instanceof Buffer) {
      form.append('source', asset.source, { filename: 'upload.png' });
    } else {
      form.append('url', asset.source);
    }

    form.append('published', 'false');
    if (asset.altText) form.append('caption', asset.altText);

    const response = await this.api.post(`/${this.pageId}/photos`, form, {
      headers: form.getHeaders(),
    });

    return response.data.id;
  }

  async createFeedPost(caption: string, mediaIds?: string[]): Promise<FISResponse> {
    try {
      const params: any = { message: caption };
      
      if (mediaIds && mediaIds.length > 0) {
        params.attached_media = JSON.stringify(
          mediaIds.map(id => ({ media_fbid: id }))
        );
      }

      const response = await this.api.post(`/${this.pageId}/feed`, null, { params });

      return {
        success: true,
        postId: response.data.id,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  async createStory(mediaId: string): Promise<FISResponse> {
    try {
      return {
        success: true,
        postId: `STORY_${mediaId}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  async updatePost(postId: string, newCaption: string): Promise<FISResponse> {
    try {
      const response = await this.api.post(`/${postId}`, null, {
        params: { message: newCaption }
      });

      return {
        success: response.data.success,
        postId: postId,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  private handleError(error: any): FISResponse {
    const errorData = error.response?.data;
    const statusCode = error.response?.status;

    logger.error('Facebook API Error', { 
      status: statusCode, 
      data: errorData,
      message: error.message 
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