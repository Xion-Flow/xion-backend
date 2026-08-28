import { PrismaClient } from '@prisma/client';
import { DeliverableStatus, PhaseStatus } from '../types/enums.js';

const prisma = new PrismaClient();

export interface PhaseProgressResult {
  phaseId: string;
  name: string;
  order: number;
  status: string;
  totalDeliverables: number;
  completedDeliverables: number;
  requiredDeliverables: number;
  completedRequiredDeliverables: number;
  progressPercentage: number;
  isReadyForCompletion: boolean;
}

export interface ProjectProgressSummary {
  projectId: string;
  name: string;
  overallProgressPercentage: number;
  currentPhase: {
    id: string;
    name: string;
    order: number;
  } | null;
  totalDeliverables: number;
  completedDeliverables: number;
  phases: PhaseProgressResult[];
}

export class ProgressCalc {
  /**
   * Calculate detailed progress metrics for a project.
   */
  static async calculateProjectProgress(projectId: string): Promise<ProjectProgressSummary> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        phases: {
          orderBy: { order: 'asc' },
          include: {
            deliverables: true,
          },
        },
      },
    });

    if (!project) {
      throw new Error(`Project with ID ${projectId} not found.`);
    }

    let totalProjectDeliverables = 0;
    let completedProjectDeliverables = 0;
    let currentPhase: { id: string; name: string; order: number } | null = null;

    const phaseResults: PhaseProgressResult[] = [];

    for (const phase of project.phases) {
      const total = phase.deliverables.length;
      const completed = phase.deliverables.filter((d) => d.status === DeliverableStatus.COMPLETED).length;
      const required = phase.deliverables.filter((d) => d.isRequired).length;
      const completedRequired = phase.deliverables.filter((d) => d.isRequired && d.status === DeliverableStatus.COMPLETED).length;
      const hasStarted = phase.deliverables.some(
        (d) => d.status === DeliverableStatus.IN_PROGRESS || d.status === DeliverableStatus.COMPLETED || d.status === DeliverableStatus.BLOCKED
      );

      let computedStatus: string = PhaseStatus.NOT_STARTED;
      if (completed === total && total > 0) {
        computedStatus = PhaseStatus.COMPLETED;
      } else if (hasStarted) {
        computedStatus = PhaseStatus.IN_PROGRESS;
      } else {
        computedStatus = PhaseStatus.NOT_STARTED;
      }

      if (computedStatus !== phase.status) {
        await prisma.projectPhase.update({
          where: { id: phase.id },
          data: {
            status: computedStatus,
            completedAt: computedStatus === PhaseStatus.COMPLETED ? new Date() : null,
          },
        });
        phase.status = computedStatus;
      }

      totalProjectDeliverables += total;
      completedProjectDeliverables += completed;

      const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;
      const isReadyForCompletion = required > 0 ? completedRequired === required : true;

      if (!currentPhase && phase.status === PhaseStatus.IN_PROGRESS) {
        currentPhase = { id: phase.id, name: phase.name, order: phase.order };
      }

      phaseResults.push({
        phaseId: phase.id,
        name: phase.name,
        order: phase.order,
        status: phase.status,
        totalDeliverables: total,
        completedDeliverables: completed,
        requiredDeliverables: required,
        completedRequiredDeliverables: completedRequired,
        progressPercentage,
        isReadyForCompletion,
      });
    }

    if (!currentPhase && project.phases.length > 0) {
      const firstUncompleted = project.phases.find((p) => p.status !== PhaseStatus.COMPLETED);
      if (firstUncompleted) {
        currentPhase = { id: firstUncompleted.id, name: firstUncompleted.name, order: firstUncompleted.order };
      } else {
        const lastPhase = project.phases[project.phases.length - 1];
        currentPhase = { id: lastPhase.id, name: lastPhase.name, order: lastPhase.order };
      }
    }

    const overallProgressPercentage =
      totalProjectDeliverables > 0 ? Math.round((completedProjectDeliverables / totalProjectDeliverables) * 100) : 0;

    return {
      projectId: project.id,
      name: project.name,
      overallProgressPercentage,
      currentPhase,
      totalDeliverables: totalProjectDeliverables,
      completedDeliverables: completedProjectDeliverables,
      phases: phaseResults,
    };
  }

  /**
   * Recalculates phase status dynamically based on deliverable updates.
   */
  static async updatePhaseStatusFromDeliverables(projectPhaseId: string) {
    const phase = await prisma.projectPhase.findUnique({
      where: { id: projectPhaseId },
      include: { deliverables: true },
    });

    if (!phase) return;

    const total = phase.deliverables.length;
    const completed = phase.deliverables.filter((d) => d.status === DeliverableStatus.COMPLETED).length;
    const hasStarted = phase.deliverables.some(
      (d) => d.status === DeliverableStatus.IN_PROGRESS || d.status === DeliverableStatus.COMPLETED || d.status === DeliverableStatus.BLOCKED
    );

    let newStatus: string = PhaseStatus.NOT_STARTED;
    if (completed === total && total > 0) {
      newStatus = PhaseStatus.COMPLETED;
    } else if (hasStarted) {
      newStatus = PhaseStatus.IN_PROGRESS;
    } else {
      newStatus = PhaseStatus.NOT_STARTED;
    }

    if (newStatus !== phase.status) {
      await prisma.projectPhase.update({
        where: { id: projectPhaseId },
        data: {
          status: newStatus,
          completedAt: newStatus === PhaseStatus.COMPLETED ? new Date() : null,
        },
      });
    }
  }
}
