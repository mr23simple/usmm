# Facebook Integration Service (FIS) | Architecture Plan

This document outlines the requirements and features for a high-concurrency Facebook backend service designed to handle diverse workloads with reliability and precision.

## 🚀 Core Features

### 1. Concurrency & Queue Management
*   **Prioritized Task Queue**: Urgent updates take precedence over routine scheduled tasks.
*   **Concurrency Limiter**: Restricts the number of simultaneous Graph API calls to prevent throttling.
*   **Non-Blocking Media Uploads**: Media is processed and uploaded in the background to maximize throughput.

### 2. High-Reliability Pipeline
*   **Dual-Path Independence**: Separation of Feed and Story execution paths. A failure in one path does not affect the other.
*   **Media ID Reuse**: Upload an asset once and reuse its ID for multiple posts to save bandwidth and quota.
*   **Smart Backoff & Retries**: Automated retry logic for rate limits and internal API errors with exponential backoff.

### 3. Rate Limit & Safety
*   **Bundling Prevention**: Integrated delays between consecutive posts to prevent Facebook from grouping multiple updates into a single UI element.
*   **Fail-safe Fallback**: Automatic transition to text-only posting if media processing or upload fails.

---

## 🌏 Workload Integration Examples

The service is designed to handle various types of content and integration patterns.

*   **Real-time Alerts**: High-priority updates that require immediate broadcast to the Feed and Story.
*   **Authoritative Updates**: Ability to edit existing posts to reflect revised or corrected information.
*   **Batch Processing**: Support for consolidating multiple data points into a single, cohesive announcement.
*   **Automated Summaries**: Scheduled tasks that generate periodic reports or daily highlights.

---

## 🛠 Service Configuration

### Environment Requirements
```env
# Graph API Credentials
FB_PAGE_ID=
FB_PAGE_ACCESS_TOKEN=

# Service Settings
PORT=3005
MAX_CONCURRENT_UPLOADS=3
POST_SPACING_DELAY_MS=45000
```

### Core Interface
*   **post(payload)**: Publish content to Feed/Story with priority handling.
*   **updatePost(id, caption)**: Edit existing content on the Page.
*   **uploadMedia(source)**: Optimize and upload assets to retrieve persistent IDs.
*   **getStats()**: Monitor queue health and success metrics.

### Priority Definitions
- **CRITICAL (10)**: Urgent announcements requiring immediate visibility.
- **HIGH (5)**: Important updates or news.
- **NORMAL (0)**: Routine content, scheduled posts, and summaries.