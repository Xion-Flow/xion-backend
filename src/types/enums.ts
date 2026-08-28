export const Role = {
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ProjectStatus = {
  PLANNING: 'PLANNING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  ON_HOLD: 'ON_HOLD',
  ARCHIVED: 'ARCHIVED',
} as const;

export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const PhaseStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;

export type PhaseStatus = (typeof PhaseStatus)[keyof typeof PhaseStatus];

export const DeliverableStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  BLOCKED: 'BLOCKED',
} as const;

export type DeliverableStatus = (typeof DeliverableStatus)[keyof typeof DeliverableStatus];
