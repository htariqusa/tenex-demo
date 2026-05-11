// Load .env FIRST before any other imports
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../.env') });

// Now import everything else
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.js';
import { calendarRouter } from './routes/calendar.js';
import { chatRouter } from './routes/chat.js';
import { aiRouter } from './routes/ai.js';
import { errorHandler } from './middleware/error.js';
import { initDb } from './db/index.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
initDb();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/chat', chatRouter);
app.use('/api/ai', aiRouter);

// Error handling
app.use(errorHandler);

// Export for Vercel serverless
export default app;

// Only start the server when running directly (not imported by Vercel)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
  });
}
