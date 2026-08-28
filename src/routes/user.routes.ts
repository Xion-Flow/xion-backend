import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { Role } from '../types/enums.js';

const router = Router();
const prisma = new PrismaClient();

const createUserSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  password: z.string().min(8, 'Temporary password must be at least 8 characters'),
  role: z.enum([Role.ADMIN, Role.MEMBER]).default(Role.MEMBER),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum([Role.ADMIN, Role.MEMBER]).optional(),
  isActive: z.boolean().optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
});

// GET /api/users/check-username — Check if a username is available
router.get('/check-username', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const rawUsername = (req.query.username as string || '').trim();
    const username = rawUsername.replace(/^@/, '').toLowerCase().trim();
    if (!username || username.length < 3) {
      return res.json({ available: false, reason: 'Username must be at least 3 characters long.' });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.json({ available: false, reason: 'Username can only contain letters, numbers, and underscores.' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    const isCurrent = req.user?.username.toLowerCase() === username;
    const available = !existingUser || isCurrent;

    res.json({ available, isCurrent });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/search — Search users by name or username for invitations
router.get('/search', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const rawQuery = (req.query.query as string || '').trim();
    const cleanQuery = rawQuery.replace(/^@/, '').toLowerCase().trim();

    if (!cleanQuery) {
      return res.json({ users: [] });
    }

    const allActiveUsers = await prisma.user.findMany({
      where: { isActive: true, role: { not: Role.ADMIN } },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        avatarUrl: true,
      },
    });

    const users = allActiveUsers
      .filter((u) => {
        const nameMatch = u.name.toLowerCase().includes(cleanQuery);
        const usernameMatch = u.username.toLowerCase().includes(cleanQuery);
        const emailMatch = u.email.toLowerCase().includes(cleanQuery);
        return nameMatch || usernameMatch || emailMatch;
      })
      .slice(0, 10);

    res.json({ users });
  } catch (error) {
    next(error);
  }
});

// GET /api/users — List all system users
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ users });
  } catch (error) {
    next(error);
  }
});

// POST /api/users — Provision new user account (Admin only; No public signup)
router.post('/', authenticate, requireRole(Role.ADMIN), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { name, email, username: rawUsername, password, role } = createUserSchema.parse(req.body);

    const existingEmail = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingEmail) {
      return res.status(400).json({ error: 'An account with this email address already exists.' });
    }

    // Determine unique username
    let finalUsername = rawUsername ? rawUsername.toLowerCase().trim() : '';
    if (!finalUsername) {
      const prefix = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      finalUsername = `${prefix}_${randomSuffix}`.toLowerCase();
    }

    const existingUsername = await prisma.user.findUnique({
      where: { username: finalUsername },
    });
    if (existingUsername) {
      return res.status(400).json({ error: 'Selected username is already taken.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        username: finalUsername,
        passwordHash,
        role,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json({ user: newUser, message: 'User account created successfully.' });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/:id — Edit user details or toggle active status (Admin only)
router.patch('/:id', authenticate, requireRole(Role.ADMIN), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const data = updateUserSchema.parse(req.body);

    const updatedUser = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        updatedAt: true,
      },
    });

    res.json({ user: updatedUser });
  } catch (error) {
    next(error);
  }
});

export default router;
