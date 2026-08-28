import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, requireRole, requireProjectMember, AuthenticatedRequest } from '../middleware/auth.js';
import { WorkflowEngine } from '../services/workflowEngine.js';
import { ProgressCalc } from '../services/progressCalc.js';
import { AuditLogger } from '../services/auditLogger.js';
import { Role } from '../types/enums.js';

const router = Router();
const prisma = new PrismaClient();

const createProjectSchema = z.object({
  name: z.string().min(2, 'Project name is required'),
  description: z.string().optional(),
  techStack: z.string().optional(),
  githubUrl: z.string().url().nullable().optional().or(z.literal('')),
  demoUrl: z.string().url().nullable().optional().or(z.literal('')),
  targetDate: z.string().nullable().optional(),
  type: z.enum(['PERSONAL', 'TEAM']).default('TEAM'),
  memberIds: z.array(z.string()).optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  techStack: z.string().optional(),
  githubUrl: z.string().url().nullable().optional().or(z.literal('')),
  demoUrl: z.string().url().nullable().optional().or(z.literal('')),
  targetDate: z.string().nullable().optional(),
  status: z.enum(['PLANNING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'ARCHIVED']).optional(),
});

const addMembersSchema = z.object({
  memberIds: z.array(z.string()).min(1, 'At least one member ID is required'),
});

// GET /api/projects — Get projects accessible to current user
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;

    const projects = await prisma.project.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
          },
        },
        _count: { select: { phases: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enriched with calculated progress
    const enrichedProjects = await Promise.all(
      projects.map(async (p) => {
        const progressSummary = await ProgressCalc.calculateProjectProgress(p.id);
        return {
          ...p,
          progress: progressSummary.overallProgressPercentage,
          currentPhase: progressSummary.currentPhase,
          deliverablesCount: progressSummary.totalDeliverables,
          completedDeliverablesCount: progressSummary.completedDeliverables,
        };
      })
    );

    res.json({ projects: enrichedProjects });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects — Create project & snapshot workflow (accessible to non-admin users)
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (req.user!.role === Role.ADMIN) {
      return res.status(403).json({ error: 'System Admins are responsible for user provisioning and maintenance and cannot create projects.' });
    }

    const { name, description, techStack, type, memberIds } = createProjectSchema.parse(req.body);

    const project = await WorkflowEngine.createProjectWithWorkflow({
      name,
      description,
      techStack,
      type,
      createdById: req.user!.id,
      memberIds,
    });

    const progressSummary = await ProgressCalc.calculateProjectProgress(project.id);

    res.status(201).json({
      project: {
        ...project,
        progress: progressSummary.overallProgressPercentage,
        currentPhase: progressSummary.currentPhase,
      },
      message: 'Project created and lifecycle workflow generated successfully.',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:id — Get full project details with roadmap & progress
router.get('/:id', authenticate, requireProjectMember, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
          },
        },
        invites: {
          where: { status: 'PENDING' },
          include: {
            invitee: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
        phases: {
          orderBy: { order: 'asc' },
          include: {
            deliverables: {
              orderBy: { order: 'asc' },
              include: {
                assignedTo: { select: { id: true, name: true, email: true, avatarUrl: true } },
              },
            },
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const progressSummary = await ProgressCalc.calculateProjectProgress(project.id);

    res.json({
      project,
      progressSummary,
    });
  } catch (error) {
    next(error);
  }
});

// PUT & PATCH /api/projects/:id — Update project info
const handleUpdateProject = async (req: AuthenticatedRequest, res: Response, next: any) => {
  try {
    const { id } = req.params;
    const { targetDate, githubUrl, demoUrl, ...rest } = updateProjectSchema.parse(req.body);

    const updateData: any = { ...rest };
    if (githubUrl !== undefined) updateData.githubUrl = githubUrl || null;
    if (demoUrl !== undefined) updateData.demoUrl = demoUrl || null;
    if (targetDate !== undefined) updateData.targetDate = targetDate ? new Date(targetDate) : null;

    const updatedProject = await prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
          },
        },
        invites: {
          where: { status: 'PENDING' },
          include: {
            invitee: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
        phases: {
          orderBy: { order: 'asc' },
          include: {
            deliverables: {
              orderBy: { order: 'asc' },
              include: {
                assignedTo: { select: { id: true, name: true, email: true, avatarUrl: true } },
              },
            },
          },
        },
      },
    });

    res.json({ project: updatedProject, message: 'Project updated successfully.' });
  } catch (error) {
    next(error);
  }
};

router.put('/:id', authenticate, requireProjectMember, handleUpdateProject);
router.patch('/:id', authenticate, requireProjectMember, handleUpdateProject);

// POST /api/projects/:id/members — Send join invitations to team members
router.post('/:id/members', authenticate, requireProjectMember, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const existingProject = await prisma.project.findUnique({ where: { id } });
    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    if (existingProject.type === 'PERSONAL') {
      return res.status(400).json({ error: 'Cannot add team members to a personal project.' });
    }

    const { memberIds } = addMembersSchema.parse(req.body);

    const adminUsers = await prisma.user.findMany({
      where: {
        id: { in: memberIds },
        role: Role.ADMIN,
      },
    });
    if (adminUsers.length > 0) {
      return res.status(400).json({ error: 'System Admins cannot be added to project teams.' });
    }

    let sentCount = 0;
    for (const userId of memberIds) {
      // Check if already a member
      const isMember = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: id, userId } },
      });
      if (isMember) continue;

      // Upsert invite
      const existingInvite = await prisma.projectInvite.findUnique({
        where: { projectId_inviteeId: { projectId: id, inviteeId: userId } },
      });

      if (!existingInvite || existingInvite.status !== 'PENDING') {
        await prisma.projectInvite.upsert({
          where: { projectId_inviteeId: { projectId: id, inviteeId: userId } },
          create: {
            projectId: id,
            inviterId: req.user!.id,
            inviteeId: userId,
            status: 'PENDING',
          },
          update: {
            status: 'PENDING',
            inviterId: req.user!.id,
          },
        });

        // Send notification
        await prisma.notification.create({
          data: {
            userId,
            title: 'Project Join Request',
            message: `${req.user!.name} invited you to join project "${existingProject.name}".`,
            type: 'PROJECT_INVITE',
            data: JSON.stringify({ projectId: id }),
          },
        });

        sentCount++;
      }
    }

    res.json({ message: `Project join requests sent to ${sentCount} user(s). They will join once accepted.` });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/projects/:id/members/:userId — Remove member from project (Creator/Admin or Self Leave)
router.delete('/:id/members/:userId', authenticate, requireProjectMember, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id, userId } = req.params;

    const existingProject = await prisma.project.findUnique({ where: { id } });
    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Only Project Leader, Admin, or the user themselves can remove membership
    if (req.user!.role !== Role.ADMIN && existingProject.createdById !== req.user!.id && req.user!.id !== userId) {
      return res.status(403).json({ error: 'Only the project leader or Admin can remove other team members.' });
    }

    await prisma.projectMember.deleteMany({
      where: {
        projectId: id,
        userId,
      },
    });

    // Cancel any pending invite
    await prisma.projectInvite.deleteMany({
      where: {
        projectId: id,
        inviteeId: userId,
      },
    });

    // Unassign pending deliverables
    await prisma.projectDeliverable.updateMany({
      where: {
        projectPhase: { projectId: id },
        assignedToId: userId,
        status: { not: 'COMPLETED' },
      },
      data: { assignedToId: null },
    });

    const isSelf = req.user!.id === userId;
    res.json({ message: isSelf ? 'You have left the project.' : 'Member removed from project.' });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/projects/:id/archive — Archive or unarchive a project
router.patch('/:id/archive', authenticate, requireProjectMember, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { archive } = req.body;

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (req.user!.role !== Role.ADMIN && existing.createdById !== req.user!.id) {
      return res.status(403).json({ error: 'Only the project creator or an Admin can archive this project.' });
    }

    const newStatus = archive ? 'ARCHIVED' : 'IN_PROGRESS';
    const updated = await prisma.project.update({
      where: { id },
      data: { status: newStatus },
    });

    await AuditLogger.log({
      action: archive ? 'PROJECT_ARCHIVE' : 'PROJECT_UNARCHIVE',
      details: { projectId: id, name: existing.name },
      userId: req.user!.id,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.json({
      project: updated,
      message: archive ? 'Project has been archived.' : 'Project has been unarchived.',
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/projects/:id — Permanently delete a project (Creator & Admin only)
router.delete('/:id', authenticate, requireProjectMember, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (req.user!.role !== Role.ADMIN && existing.createdById !== req.user!.id) {
      return res.status(403).json({ error: 'Only the project creator or an Admin can delete this project.' });
    }

    await prisma.project.delete({
      where: { id },
    });

    await AuditLogger.log({
      action: 'PROJECT_DELETE',
      details: { projectId: id, name: existing.name },
      userId: req.user!.id,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.json({ message: 'Project deleted permanently.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/:id/leave — Allow non-creator team members to leave project
router.post('/:id/leave', authenticate, requireProjectMember, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (existing.createdById === userId) {
      return res.status(400).json({ error: 'As the project creator, you cannot leave the project. You must delete the project or manage membership.' });
    }

    // Remove user membership
    await prisma.projectMember.deleteMany({
      where: {
        projectId: id,
        userId,
      },
    });

    // Unassign pending deliverables in this project
    await prisma.projectDeliverable.updateMany({
      where: {
        projectPhase: { projectId: id },
        assignedToId: userId,
        status: { not: 'COMPLETED' },
      },
      data: { assignedToId: null },
    });

    // Notify project creator
    await prisma.notification.create({
      data: {
        userId: existing.createdById,
        title: 'Team Member Left Project',
        message: `${req.user!.name} (@${req.user!.username}) has left project "${existing.name}".`,
        type: 'SYSTEM',
      },
    });

    res.json({ message: `You have left project "${existing.name}".` });
  } catch (error) {
    next(error);
  }
});

export default router;
