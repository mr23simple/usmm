# Facebook Integration Service (FIS) - Developer Guide

FIS is a standalone, high-reliability Facebook Graph API wrapper designed for performance, uniform parameter handling, and priority-based queueing.

## 🛠 Features
- **Priority Queueing**: Critical alerts jump to the front of the queue.
- **Bundling Prevention**: Automatic 45s delay between consecutive posts to ensure they appear as separate items in the Facebook UI.
- **Uniform API**: Strict Zod validation for all inputs and standardized response objects.
- **Dual-Path Independence**: Failures in Story publishing do not block Feed posts.
- **Media Reuse**: Upload assets once and reuse their IDs for multiple posts.
- **AI Fallback**: Detects short/failed AI-generated content and applies robust templates.

## 🚀 Quick Start

### 1. Installation
```bash
pnpm install
```

### 2. Basic Usage
```typescript
import { FIS, WorkloadPriority } from './src/index.js';

const fis = new FIS({
  pageId: 'YOUR_PAGE_ID',
  accessToken: 'YOUR_PAGE_TOKEN',
  concurrency: 3,
  minPostSpacingMs: 45000
});

// Post a high-priority alert
await fis.post({
  caption: '🚨 CRITICAL: Tsunami Warning Issued for Region X...',
  priority: WorkloadPriority.CRITICAL,
  media: [{ source: './infographic.png', type: 'image' }],
  options: { publishToStory: true }
});

// Update an existing post (Authoritative Update)
await fis.updatePost('POST_ID', '🔔 REVISED: Mag 5.2 Earthquake...');
```

## 📊 Priority Levels
- `CRITICAL (10)`: Tsunami, Mag 5.0+ alerts.
- `HIGH (5)`: General weather alerts, Mag 2.0+.
- `NORMAL (0)`: Daily summaries, scheduled content.

## 🛡️ Fail-safe Mechanisms
- **Text-Only Fallback**: If media upload fails, FIS automatically attempts to publish the caption alone.
- **Robust Captions**: If a caption is <50 characters (likely an AI failure), FIS adds a standard emergency footer to ensure the post remains professional and informative.
- **Queue Persistence**: The `QueueManager` ensures that even if many alerts are triggered at once, they are spaced correctly to avoid Facebook's "bundling" behavior.

## 🏗 Architecture
- `/core`: Main logic for the client, queue, and service orchestrator.
- `/validation`: Zod schemas ensuring parameter uniformity.
- `/types`: Shared TypeScript interfaces and enums.
