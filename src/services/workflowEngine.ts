import { PrismaClient } from '@prisma/client';
import { Role, ProjectStatus, PhaseStatus, DeliverableStatus } from '../types/enums.js';

const prisma = new PrismaClient();

export interface CreateProjectInput {
  name: string;
  description?: string;
  techStack?: string;
  githubUrl?: string;
  demoUrl?: string;
  targetDate?: string;
  type?: 'PERSONAL' | 'TEAM';
  createdById: string;
  memberIds?: string[];
}

export class WorkflowEngine {
  /**
   * Creates a project and snapshot-clones global lifecycle templates
   * into isolated project phase and deliverable records.
   */
  static async createProjectWithWorkflow(input: CreateProjectInput) {
    const { name, description, techStack, githubUrl, demoUrl, targetDate, type = 'TEAM', createdById, memberIds = [] } = input;

    return await prisma.$transaction(async (tx) => {
      // 1. Create Project
      const project = await tx.project.create({
        data: {
          name,
          description,
          techStack,
          githubUrl: githubUrl || null,
          demoUrl: demoUrl || null,
          targetDate: targetDate ? new Date(targetDate) : null,
          type,
          status: ProjectStatus.IN_PROGRESS,
          createdById,
        },
      });

      // 2. Add creator as Project Member
      await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId: createdById,
          role: Role.MEMBER,
        },
      });

      // Send join invitations for selected team members if TEAM project
      const uniqueMemberIds = type === 'PERSONAL' 
        ? [] 
        : Array.from(new Set(memberIds.filter((id) => id !== createdById)));

      if (uniqueMemberIds.length > 0) {
        const creator = await tx.user.findUnique({
          where: { id: createdById },
          select: { name: true, username: true },
        });

        for (const targetUserId of uniqueMemberIds) {
          const invite = await tx.projectInvite.create({
            data: {
              projectId: project.id,
              inviterId: createdById,
              inviteeId: targetUserId,
              status: 'PENDING',
            },
          });

          await tx.notification.create({
            data: {
              userId: targetUserId,
              title: 'Project Join Request',
              message: `${creator?.name || 'Project Lead'} (@${creator?.username || 'user'}) invited you to join project "${project.name}".`,
              type: 'PROJECT_INVITE',
              metadata: JSON.stringify({
                inviteId: invite.id,
                projectId: project.id,
                projectName: project.name,
                inviterName: creator?.name,
                inviterUsername: creator?.username,
              }),
            },
          });
        }
      }

      // 3. Fetch global Phase Templates ordered by sequence
      const phaseTemplates = await tx.phaseTemplate.findMany({
        include: { deliverables: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      });

      // 4. Clone phases and deliverables for this project
      for (const pt of phaseTemplates) {
        const projectPhase = await tx.projectPhase.create({
          data: {
            projectId: project.id,
            phaseTemplateId: pt.id,
            name: pt.name,
            description: pt.description,
            objective: pt.objective,
            order: pt.order,
            status: PhaseStatus.NOT_STARTED,
            startedAt: null,
          },
        });

        if (pt.deliverables.length > 0) {
          await tx.projectDeliverable.createMany({
            data: pt.deliverables.map((dt) => ({
              projectPhaseId: projectPhase.id,
              deliverableTemplateId: dt.id,
              name: dt.name,
              description: dt.description,
              isRequired: dt.isRequired,
              order: dt.order,
              status: DeliverableStatus.NOT_STARTED,
              assignedToId: type === 'PERSONAL' ? createdById : null,
            })),
          });
        }
      }

      return project;
    }, { timeout: 20000 });
  }
}
