import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// GET /api/guide — Fetch all 10 lifecycle phase templates with full guidance
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const templates = await prisma.phaseTemplate.findMany({
      orderBy: { order: 'asc' },
      include: {
        deliverables: {
          orderBy: { order: 'asc' },
        },
      },
    });

    const parsedTemplates = templates.map((t) => ({
      ...t,
      activities: JSON.parse(t.activitiesJson || '[]'),
    }));

    res.json({ phases: parsedTemplates });
  } catch (error) {
    next(error);
  }
});

export default router;
