# Unified Facebook Manager (UFBM)

UFBM is a high-performance, multi-tenant Facebook gateway designed to centralize and optimize Page interactions. It provides a standardized interface for posting content, managing media, and monitoring activity across multiple Facebook Pages.

**Production Endpoint:** `https://ufbm.global-desk.top`
**Live Monitor:** `https://ufbm.global-desk.top`

---

## 📖 How to Use UFBM

UFBM operates as a secure proxy. You can target specific Facebook Pages by providing their credentials in the request headers.

### 1. Request Headers
To target a specific Facebook Page, include these headers in your request. If omitted, the service may use configured defaults.

| Header | Description |
| :--- | :--- |
| `x-fb-page-id` | The numeric ID of the target Facebook Page. |
| `x-fb-token` | A valid Page Access Token with `pages_manage_posts` permissions. |

---

### 2. API Endpoints

#### `POST /v1/post`
Create a new post on the Page Feed and/or Story. Supports JSON or `multipart/form-data`.

**JSON Parameters:**
*   `caption` (string, required): The text content of the post.
*   `media` (array, optional): List of media objects.
    *   `source` (string/buffer): URL or binary data of the image/video.
    *   `type` (string): Either `image` or `video`.
*   `priority` (number, optional): `10` (Critical), `5` (High), `0` (Normal). Defaults to `0`.
*   `options` (object, optional):
    *   `publishToFeed` (boolean): Default `true`.
    *   `publishToStory` (boolean): Default `false`.
    *   `dryRun` (boolean): Default `false`.
    *   `retryConfig` (object): (Optional) `{ maxRetries: number, backoffMs: number }`.

**Example Request:**
```json
{
  "caption": "Check out our latest announcement!",
  "priority": 5,
  "options": {
    "publishToFeed": true,
    "publishToStory": true
  }
}
```

#### `POST /v1/post/:id/update`
Edit an existing post's caption.

**Parameters:**
*   `id` (path): The Facebook Post ID.
*   `caption` (string, required): The new text content.
*   `priority` (number, optional): Processing priority.
*   `dryRun` (boolean, optional): If true, simulates the update.

**Example Request:**
```json
{
  "caption": "Update: The event has been rescheduled to 6 PM.",
  "priority": 10
}
```

#### `GET /v1/stats`
Retrieve global processing statistics, including queue lengths and success rates.

#### `GET /health`
Basic service health check and uptime information.

---

### 3. Media Processing
When using `multipart/form-data`, attach your image/video files to the `media` field.
*   **File Limit**: 1MB per file.
*   **Max Resolution**: 3000x3000px.
*   **Auto-Optimization**: UFBM automatically strips metadata and applies high-quality compression to ensure optimal delivery and privacy.

---

## 🏗 Data Processing Flow

```mermaid
graph TD
    subgraph Input_Stage [1. Input Stage]
        A[Client Request] -->|JSON / Multipart| B[Express Server]
        B -->|Dry Run Check| C{isDryRun?}
    end

    subgraph Process_Stage [2. Processing Stage]
        C -->|No| D[FIS Page Instance]
        D -->|Validation| E[Size/Resolution Check]
        E -->|Optimization| F[Sharp: Compress/Strip]
        F --> G[Priority Queue Manager]
        C -->|Yes| G
        G -->|Event| H[Socket.IO: QUEUED]
    end

    subgraph Execution_Stage [3. Execution Stage]
        G -->|Priority Pick| I[Task Execution]
        I -->|Event| J[Socket.IO: PROCESSING]
        I -->|If Real| K[FB Graph API v24.0]
        I -->|If Dry| L[Mock Response Delay]
    end

    subgraph Output_Stage [4. Output Stage]
        K & L --> M[Standardized Response]
        M -->|Real-Time| N[Socket.IO: COMPLETED/FAILED]
        M -->|Audit| O[Winston Logs]
    end
```

---

## 🧪 Testing with Dry Run
You can simulate any request without hitting the Facebook API by adding `"dryRun": true` to your payload. 
*   The API returns a mock `postId` (e.g., `DRY_RUN_abc123`).
*   The **Live Monitor** will label the data packet as **"DRY"** for visual verification.

---

## ⚡ Technical Specs
*   **Priority System**: 
    *   `10` (Critical): Immediate processing.
    *   `5` (High): Elevated queue position.
    *   `0` (Normal): Standard background processing.
*   **API Version**: Facebook Graph API v24.0.
*   **Fail-Safe**: Automatic transition to text-only if media upload fails or is rejected.

---

## 🛠 Quick Setup (Self-Hosting)
1. `pnpm install`
2. `pnpm dev` (Port 3005)
3. `pnpm build`
