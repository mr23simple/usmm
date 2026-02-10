# Facebook Integration Service (FIS) | Architecture Plan

This document outlines the requirements and features for a standalone or modular Facebook backend service designed to handle high-concurrency workloads for the PULSE ecosystem and future projects.

## 🚀 Core Features

### 1. Concurrency & Queue Management
*   **Promise-Based Concurrency Limiter**: Implement a semaphore or queue system (e.g., `p-limit`) to restrict the number of simultaneous Graph API calls, preventing IP-based throttling.
*   **Prioritized Task Queue**: Urgent earthquake alerts (Mag 5.0+) take precedence over scheduled tasks like Daily Summaries.
*   **Non-Blocking Media Uploads**: Media is uploaded in the background; the post is only published once the Graph API confirms the asset is ready.

### 2. High-Reliability Pipeline
*   **Dual-Path Independence**: Strict separation of **Feed** and **Story** execution paths. A failure in one (e.g., Story asset rejection) must not prevent the Feed post from going live.
*   **Media ID Reuse**: Upload a single high-resolution asset once and reuse the returned `photo_id` for multiple posts (Feed, Story, and Album) to save bandwidth and quota.
*   **Smart Backoff & Retries**: Automated retry logic for `429 (Rate Limit)` and `5xx (Facebook Internal)` errors with exponential backoff.

### 3. Rate Limit & Safety
*   **Global Quota Monitor**: Track Graph API usage in real-time to prevent "Page restricted" status.
*   **Bundling Prevention**: Integrated delays (e.g., 45s) between consecutive posts to prevent Facebook from "collapsing" or bundling multiple alerts into a single UI element.
*   **Fail-safe Fallback**: Automatic transition to text-only posting if image generation or upload fails.

---

## 🌏 PULSE Section (Workload Integration)

The PULSE monitor will interface with this service to deliver real-time seismic alerts.

*   **Significant Event Flow**: Triggered for Mag 2.0+. Significant quakes (M5.0+) trigger an additional "Snapshot" story path.
*   **Authoritative Updates**: Capability to edit existing `PostIDs` when PHIVOLCS issues revised bulletins, adding the "🔔 AUTHORITATIVE UPDATE" header and revised metrics.
*   **Deep-Scan Data Preservation**: Preserves line breaks and formatting for Reported and Instrumental Intensities extracted from PHIVOLCS.
*   **AI Context Injection**: Seamlessly merges Gemini-generated seismic analysis into the post caption.

---

## 🛠 INIT Section (Service Scaffolding)

*This section provides the requirements for weather alert integration and infographic handling.*

### 📦 Key Features for INIT Workload
*   **Consolidated Group Posting**: Support for a single post/infographic that represents multiple geographical areas (e.g., grouping 15 cities under one "Severe Heat Advisory").
*   **Regional Grouping Logic**: Ability to automatically transition between listing individual provinces and consolidating into higher-level region groups (e.g., "Davao Region") when >60% of a group is affected.
*   **Per-Location Severity Overlays**: Support for mapping specific severity levels (Severe vs Extreme) to individual locations within a single post's metadata.
*   **Scoped Identity Management**: Enforce the use of `/me` scoped endpoints rather than Global IDs to ensure compatibility with Page Access Tokens.
*   **Gemini Failure Fallback**: Integrated logic to detect insufficient AI content (e.g., <50 chars) and automatically fallback to a robust formatted template without interrupting the queue.

### Environment Requirements
```env
# Graph API Credentials
FB_PAGE_ID=
FB_PAGE_ACCESS_TOKEN=
FB_APP_ID=
FB_APP_SECRET=

# Concurrency Settings
MAX_CONCURRENT_UPLOADS=3
POST_SPACING_DELAY_MS=45000
```

### Proposed Interface (Internal API)
```javascript
/**
 * Initializing the service should support:
 * 1. authenticate() - Validate token health and permissions.
 * 2. uploadMedia(buffer|path) - Returns persistent media ID.
 * 3. createPost(mediaID, caption, options) - Publish to Feed/Story.
 * 4. updatePost(postID, newCaption) - Edit existing content.
 * 5. getPostStats(postID) - Retrieve reach and engagement.
 */
```

### Workload Definitions
- **EVENT_ALERT**: Weather warnings (Rainfall, Cyclone). High priority.
- **SYNTHETIC_ADVISORY**: Custom Heat/UV alerts. Periodic, grouped by hazard.
- **DAILY_SUMMARY**: Scheduled (07:00 PHT), requires heatmap landscape & portrait.
- **TSUNAMI_ADVISORY**: Critical priority, text-heavy, immediate broadcast.
