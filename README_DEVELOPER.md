# Facebook Integration Service (FIS) - Developer Guide

FIS is a high-reliability Facebook Graph API wrapper designed for performance, uniform parameter handling, and priority-based queueing.

## 🛠 Features
- **Priority Queueing**: High-priority tasks move to the front of the execution queue.
- **Bundling Prevention**: Integrated delays between consecutive posts to ensure they appear as separate items in the Facebook UI.
- **Uniform API**: Strict validation for all inputs and standardized response objects.
- **Dual-Path Independence**: Failures in Story publishing do not block Feed posts.
- **Media Optimization**: Automatic stripping of metadata and high-quality compression for uploaded assets.

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

// Post a high-priority update
await fis.post({
  caption: 'Breaking News: Significant update regarding the upcoming event...',
  priority: WorkloadPriority.HIGH,
  media: [{ source: './image.png', type: 'image' }],
  options: { publishToStory: true }
});

// Update an existing post
await fis.updatePost('POST_ID', 'Updated: The event schedule has changed.');
```

## 📊 Priority Levels
- `CRITICAL (10)`: Immediate priority for urgent announcements.
- `HIGH (5)`: Elevated priority for important updates.
- `NORMAL (0)`: Standard priority for routine or scheduled content.

## 🛡️ Fail-safe Mechanisms
- **Text-Only Fallback**: If media upload fails, FIS automatically attempts to publish the caption alone.
- **Queue Persistence**: The `QueueManager` ensures that even if many tasks are triggered at once, they are spaced correctly to avoid Facebook's "bundling" behavior.
- **Validation**: Integrated Zod schemas ensure that all requests meet the required format before hitting the Facebook API.

## 🏗 Architecture
- `/core`: Main logic for the client, queue, and service orchestrator.
- `/validation`: Zod schemas ensuring parameter uniformity.
- `/types`: Shared TypeScript interfaces and enums.