import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

const loginSchema = z.object({
  email: z.string().email('Valid email address is required'),
  password: z.string().min(1, 'Password is required'),
});

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

import { AuditLogger } from '../services/auditLogger.js';

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const ip = req.ip || req.socket.remoteAddress;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || !user.isActive) {
      await AuditLogger.log({ action: 'AUTH_LOGIN_FAIL', details: { email }, ipAddress: ip });
      return res.status(401).json({ error: 'Invalid credentials or inactive account.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      await AuditLogger.log({ action: 'AUTH_LOGIN_FAIL', details: { email }, userId: user.id, ipAddress: ip });
      return res.status(401).json({ error: 'Invalid credentials or inactive account.' });
    }

    const token = jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });

    // Set HttpOnly cookie for enhanced security
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600 * 1000,
    });

    await AuditLogger.log({ action: 'AUTH_LOGIN', details: { email: user.email }, userId: user.id, ipAddress: ip });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

// PUT /api/auth/profile (Update self profile)
router.put('/profile', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { name, username, avatarUrl } = updateProfileSchema.parse(req.body);

    // If username is provided and changed, check uniqueness
    if (username && username.toLowerCase() !== req.user!.username.toLowerCase()) {
      const existing = await prisma.user.findUnique({
        where: { username: username.toLowerCase().trim() },
      });
      if (existing && existing.id !== req.user!.id) {
        return res.status(400).json({ error: 'Username is already taken by another user.' });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        name,
        ...(username ? { username: username.toLowerCase().trim() } : {}),
        avatarUrl: avatarUrl || null,
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        avatarUrl: true,
        updatedAt: true,
      },
    });

    res.json({ user: updatedUser, message: 'Profile updated successfully.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { passwordHash: newPasswordHash },
    });

    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, (req: AuthenticatedRequest, res: Response) => {
  res.json({ message: 'Logged out successfully.' });
});

export default router;
