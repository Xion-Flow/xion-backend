import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { Role } from '../types/enums.js';

const prisma = new PrismaClient();

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    name: string;
    role: string;
    avatarUrl?: string | null;
  };
}

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { sub: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, username: true, name: true, role: true, avatarUrl: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User account is inactive or no longer exists.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
};

export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Required role level (${allowedRoles.join(' or ')}) is missing.`,
      });
    }

    next();
  };
};

export const requireProjectMember = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  // Admins can access all projects
  if (req.user.role === Role.ADMIN) {
    return next();
  }

  const projectId = req.params.projectId || req.params.id;
  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is missing.' });
  }

  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: req.user.id,
      },
    },
  });

  if (!membership) {
    return res.status(403).json({ error: 'Access denied: You are not a member of this project.' });
  }

  next();
};
