import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config.js';
import { FISController } from './api/controller.js';
import { logger } from './utils/logger.js';
import { StreamManager } from './core/StreamManager.js';
import path from 'path';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer);
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024, // 1MB limit
  }
});

StreamManager.init(io);

// Global Error Handlers to prevent EPIPE/Broken Pipe crashes
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  if ((err as any).code === 'EPIPE') {
    logger.warn('EPIPE (Broken Pipe) detected. Ignoring to keep server alive.');
    return;
  }
  // For other errors, we might want to exit gracefully depending on severity
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason });
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false })); // Disable CSP for simple demo to allow inline scripts/styles if needed
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(process.cwd(), 'public')));

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.post('/v1/post', upload.array('media'), FISController.createPost);
app.post('/v1/post/:id/update', FISController.updatePost);
app.get('/v1/stats', FISController.getStats);

// Error Handler for Multer
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'File too large. Maximum size is 1MB per image.' });
    }
  }
  next(err);
});

// Start Server
httpServer.listen(config.PORT, () => {
  logger.info(`🚀 UFBM Server running on port ${config.PORT}`, {
    pageId: config.FB_PAGE_ID,
    concurrency: config.CONCURRENCY,
    nodeEnv: process.env.NODE_ENV
  });
});
