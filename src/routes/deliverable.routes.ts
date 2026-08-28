import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { ProgressCalc } from '../services/progressCalc.js';
import { socketService } from '../services/socketService.js';
import { DeliverableStatus } from '../types/enums.js';

const router = Router();
const prisma = new PrismaClient();

const updateDeliverableSchema = z.object({
  status: z.enum([DeliverableStatus.NOT_STARTED, DeliverableStatus.IN_PROGRESS, DeliverableStatus.COMPLETED, DeliverableStatus.BLOCKED]).optional(),
  assignedToId: z.string().nullable().optional(),
  documentUrl: z.string().url().nullable().optional().or(z.literal('')),
  notes: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

// GET /api/deliverables/my-work — Get deliverables assigned to logged-in user
router.get('/my-work', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const { status, sortBy } = req.query;

    const whereClause: any = {
      assignedToId: userId,
      projectPhase: {
        status: 'IN_PROGRESS',
      },
    };

    if (status && status !== 'ALL') {
      if (status === 'PENDING') {
        whereClause.status = { in: [DeliverableStatus.NOT_STARTED, DeliverableStatus.IN_PROGRESS, DeliverableStatus.BLOCKED] };
      } else {
        whereClause.status = status;
      }
    }

    const deliverables = await prisma.projectDeliverable.findMany({
      where: whereClause,
      include: {
        projectPhase: {
          include: {
            project: { select: { id: true, name: true, techStack: true } },
          },
        },
        assignedTo: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: sortBy === 'dueDate' ? { dueDate: 'asc' } : { createdAt: 'desc' },
    });

    res.json({ deliverables });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/deliverables/:id — Update status, document URL, assignment, notes + Broadcast WebSockets
router.patch('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const data = updateDeliverableSchema.parse(req.body);

    const existing = await prisma.projectDeliverable.findUnique({
      where: { id },
      include: { projectPhase: { select: { id: true, name: true, projectId: true } } },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Deliverable not found.' });
    }

    const updateData: any = { ...data };

    if (data.status === DeliverableStatus.COMPLETED && existing.status !== DeliverableStatus.COMPLETED) {
      updateData.completedAt = new Date();
    } else if (data.status && data.status !== DeliverableStatus.COMPLETED) {
      updateData.completedAt = null;
    }

    if (data.dueDate) {
      updateData.dueDate = new Date(data.dueDate);
    }

    const updated = await prisma.projectDeliverable.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: { select: { id: true, name: true, email: true, avatarUrl: true } },
        projectPhase: { select: { id: true, name: true, projectId: true } },
      },
    });

    const projectId = existing.projectPhase.projectId;

    // Recalculate parent phase status
    await ProgressCalc.updatePhaseStatusFromDeliverables(existing.projectPhaseId);

    // Calculate project progress summary
    const progressSummary = await ProgressCalc.calculateProjectProgress(projectId);

    // ⚡ Real-Time WebSocket Broadcast to project room
    socketService.broadcastDeliverableUpdate(projectId, updated, {
      id: req.user!.id,
      name: req.user!.name,
      email: req.user!.email,
    });

    socketService.broadcastProjectProgress(projectId, progressSummary);

    res.json({
      deliverable: updated,
      progressSummary,
      message: 'Deliverable updated successfully.',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
