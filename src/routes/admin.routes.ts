import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { Role } from '../types/enums.js';

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/stats — System overview metrics for Admin Dashboard
router.get('/stats', authenticate, requireRole(Role.ADMIN), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({ where: { isActive: true } });
    const totalProjects = await prisma.project.count();
    const totalDeliverables = await prisma.projectDeliverable.count();
    const completedDeliverables = await prisma.projectDeliverable.count({ where: { status: 'COMPLETED' } });
    const totalPhases = await prisma.projectPhase.count();

    const recentProjects = await prisma.project.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { members: true, phases: true } },
      },
    });

    const recentUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, createdAt: true, isActive: true },
    });

    res.json({
      stats: {
        totalUsers,
        activeUsers,
        totalProjects,
        totalDeliverables,
        completedDeliverables,
        totalPhases,
        completionRate: totalDeliverables > 0 ? Math.round((completedDeliverables / totalDeliverables) * 100) : 0,
      },
      recentProjects,
      recentUsers,
    });
  } catch (error) {
    next(error);
  }
});

const resetPasswordSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

// POST /api/admin/reset-password — Reset user password
router.post('/reset-password', authenticate, requireRole(Role.ADMIN), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { userId, newPassword } = resetPasswordSchema.parse(req.body);

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    res.json({ message: 'User password reset successfully.' });
  } catch (error) {
    next(error);
  }
});

export default router;
