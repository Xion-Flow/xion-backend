import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, requireProjectMember, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

const sendInviteSchema = z.object({
  username: z.string().optional(),
  userId: z.string().optional(),
  email: z.string().optional(),
});

const respondInviteSchema = z.object({
  action: z.enum(['ACCEPT', 'DECLINE']),
});

// POST /api/projects/:id/invites — Send project join invitation
router.post('/projects/:id/invites', authenticate, requireProjectMember, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: projectId } = req.params;
    const { username, userId, email } = sendInviteSchema.parse(req.body);

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    if (project.type === 'PERSONAL') {
      return res.status(400).json({ error: 'Cannot send invitations for a personal project.' });
    }

    let invitee = null;
    if (userId) {
      invitee = await prisma.user.findUnique({ where: { id: userId } });
    } else if (email) {
      invitee = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    } else if (username) {
      const cleanUsername = username.replace(/^@/, '').toLowerCase().trim();
      invitee = await prisma.user.findUnique({ where: { username: cleanUsername } });
    }

    if (!invitee || !invitee.isActive) {
      return res.status(404).json({ error: 'Selected user was not found.' });
    }

    if (invitee.role === 'ADMIN') {
      return res.status(400).json({ error: 'System Admins cannot be added or invited to projects.' });
    }

    if (invitee.id === req.user!.id) {
      return res.status(400).json({ error: 'You are already the creator/lead of this project.' });
    }

    // Check if user is already a project member
    const existingMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: invitee.id },
      },
    });
    if (existingMember) {
      return res.status(400).json({ error: `@${invitee.username} is already a member of this project.` });
    }

    // Check existing invite
    const existingInvite = await prisma.projectInvite.findUnique({
      where: {
        projectId_inviteeId: { projectId, inviteeId: invitee.id },
      },
    });

    if (existingInvite && existingInvite.status === 'PENDING') {
      return res.status(400).json({ error: `A join request has already been sent to @${invitee.username}.` });
    }

    // Create or re-open invite
    const invite = existingInvite
      ? await prisma.projectInvite.update({
          where: { id: existingInvite.id },
          data: { status: 'PENDING', inviterId: req.user!.id },
        })
      : await prisma.projectInvite.create({
          data: {
            projectId,
            inviterId: req.user!.id,
            inviteeId: invitee.id,
            status: 'PENDING',
          },
        });

    // Create Notification for invitee
    await prisma.notification.create({
      data: {
        userId: invitee.id,
        title: 'Project Join Request',
        message: `${req.user!.name} (@${req.user!.username}) invited you to join project "${project.name}".`,
        type: 'PROJECT_INVITE',
        metadata: JSON.stringify({
          inviteId: invite.id,
          projectId: project.id,
          projectName: project.name,
          inviterName: req.user!.name,
          inviterUsername: req.user!.username,
        }),
      },
    });

    res.status(201).json({
      message: `Join request sent to @${invitee.username}.`,
      invite,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:id/invites — Get pending invites for a project
router.get('/projects/:id/invites', authenticate, requireProjectMember, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: projectId } = req.params;
    const invites = await prisma.projectInvite.findMany({
      where: { projectId },
      include: {
        invitee: { select: { id: true, name: true, username: true, email: true, avatarUrl: true } },
        inviter: { select: { id: true, name: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ invites });
  } catch (error) {
    next(error);
  }
});

// GET /api/notifications — Fetch current user notifications (last 30 days) and pending project invites
router.get('/notifications', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // 1. Auto-purge read notifications older than 30 days to keep system clean & fast
    await prisma.notification.deleteMany({
      where: {
        userId,
        isRead: true,
        createdAt: { lt: thirtyDaysAgo },
      },
    });

    // 2. Fetch last 30 days notifications & pending invites
    const [notifications, pendingInvites] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId,
          createdAt: { gte: thirtyDaysAgo },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.projectInvite.findMany({
        where: { inviteeId: userId, status: 'PENDING' },
        include: {
          project: { select: { id: true, name: true, description: true, techStack: true } },
          inviter: { select: { id: true, name: true, username: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const unreadCount = notifications.filter((n) => !n.isRead).length + pendingInvites.length;

    res.json({
      notifications,
      pendingInvites,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/invites/:inviteId/respond — Accept or decline project join request
router.post('/invites/:inviteId/respond', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { inviteId } = req.params;
    const { action } = respondInviteSchema.parse(req.body);
    const userId = req.user!.id;

    const invite = await prisma.projectInvite.findUnique({
      where: { id: inviteId },
      include: { project: { select: { id: true, name: true } } },
    });

    if (!invite || invite.inviteeId !== userId) {
      return res.status(404).json({ error: 'Project invitation not found.' });
    }

    if (invite.status !== 'PENDING') {
      return res.status(400).json({ error: `This invitation has already been ${invite.status.toLowerCase()}.` });
    }

    if (action === 'ACCEPT') {
      await prisma.$transaction(async (tx) => {
        // Update invite status
        await tx.projectInvite.update({
          where: { id: inviteId },
          data: { status: 'ACCEPTED' },
        });

        // Add member to project if not already present
        const existingMember = await tx.projectMember.findUnique({
          where: { projectId_userId: { projectId: invite.projectId, userId } },
        });

        if (!existingMember) {
          await tx.projectMember.create({
            data: {
              projectId: invite.projectId,
              userId,
              role: 'MEMBER',
            },
          });
        }
      });

      // Send notification to project inviter
      await prisma.notification.create({
        data: {
          userId: invite.inviterId,
          title: 'Invitation Accepted',
          message: `${req.user!.name} (@${req.user!.username}) accepted your request to join project "${invite.project.name}".`,
          type: 'SYSTEM',
        },
      });

      res.json({ message: `Successfully joined project "${invite.project.name}".` });
    } else {
      await prisma.projectInvite.update({
        where: { id: inviteId },
        data: { status: 'DECLINED' },
      });

      res.json({ message: 'Project invitation declined.' });
    }
  } catch (error) {
    next(error);
  }
});

// PATCH /api/notifications/read-all — Mark all user notifications as read
router.patch('/notifications/read-all', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true },
    });

    res.json({ message: 'All notifications marked as read.' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/notifications/clear — Clear read notifications for current user
router.delete('/notifications/clear', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    await prisma.notification.deleteMany({
      where: { userId: req.user!.id, isRead: true },
    });

    res.json({ message: 'Read activity logs cleared.' });
  } catch (error) {
    next(error);
  }
});

export default router;
