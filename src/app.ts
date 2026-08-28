import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { sanitizeInputMiddleware } from './middleware/sanitizeInput.js';

import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import userRoutes from './routes/user.routes.js';
import projectRoutes from './routes/project.routes.js';
import deliverableRoutes from './routes/deliverable.routes.js';
import guideRoutes from './routes/guide.routes.js';
import inviteRoutes from './routes/invite.routes.js';

const app = express();

// Security Headers & Cookies
app.use(helmet());
app.use(cookieParser());

// Rate Limiting (Disabled during test environment for automated test runs)
const isTestEnv = process.env.NODE_ENV === 'test';

const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnv ? 10000 : 300,
  message: { error: 'Too many requests from this IP address, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnv ? 10000 : 15,
  message: { error: 'Too many failed authentication attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? true : [env.CORS_ORIGIN, 'http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(sanitizeInputMiddleware);

// Apply Rate Limiters
app.use('/api/', generalApiLimiter);
app.use('/api/auth/login', authRateLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'Xion Backend Engine (Secured)',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/deliverables', deliverableRoutes);
app.use('/api/guide', guideRoutes);
app.use('/api', inviteRoutes);

// Catch-all 404 handler for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `API route ${req.originalUrl} not found.` });
});

// Error handling
app.use(errorHandler);

export default app;
