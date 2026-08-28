import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const Role = {
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
};

const ProjectStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
};

const PhaseStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
};

const DeliverableStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
};

async function main() {
  console.log('🌱 Starting Xion database seeding...');

  await prisma.notification.deleteMany();
  await prisma.projectInvite.deleteMany();
  await prisma.projectDeliverable.deleteMany();
  await prisma.projectPhase.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.deliverableTemplate.deleteMany();
  await prisma.phaseTemplate.deleteMany();
  await prisma.user.deleteMany();

  const adminPasswordHash = await bcrypt.hash('AdminPassword123!', 10);
  const leaderPasswordHash = await bcrypt.hash('LeaderPassword123!', 10);
  const memberPasswordHash = await bcrypt.hash('MemberPassword123!', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@xion.in',
      username: 'admin_xion',
      name: 'System Admin',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin',
    },
  });

  const leader = await prisma.user.create({
    data: {
      email: 'ilakkiyanj@xion.in',
      username: 'ilakkiyan_lead',
      name: 'Ilakkiyan J (Lead Architect)',
      passwordHash: leaderPasswordHash,
      role: Role.MEMBER,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ilakkiyan',
    },
  });

  const userDemo = await prisma.user.create({
    data: {
      email: 'user-deomo@xion.in',
      username: 'user_demo',
      name: 'Demo User',
      passwordHash: memberPasswordHash,
      role: Role.MEMBER,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DemoUser',
    },
  });

  console.log('✅ Users seeded: admin@xion.in, ilakkiyanj@xion.in, user-deomo@xion.in.');

  const phasesData = [
    {
      order: 1,
      name: '01 Idea & Problem Definition',
      description: 'Define the core problem statement, product vision, target audience, and solution value proposition.',
      objective: 'Establish a clear, validated problem definition before writing any code or architecture documents.',
      activities: [
        'Identify target user personas and pain points',
        'Define core product value proposition',
        'Analyze existing alternatives and market gaps',
        'Formulate initial product scope boundaries',
      ],
      deliverables: [
        { name: 'Problem Statement Document', description: 'Detailed definition of the target problem and target users.', isRequired: true, order: 1 },
        { name: 'Product Vision & Core Value Prop', description: 'Concise explanation of what the product does and why it exists.', isRequired: true, order: 2 },
        { name: 'Market & Competitor Analysis', description: 'Analysis of market gap and competitor benchmarks.', isRequired: false, order: 3 },
      ],
    },
    {
      order: 2,
      name: '02 Requirements',
      description: 'Gather and document functional requirements, non-functional constraints, user stories, and acceptance criteria.',
      objective: 'Translate product vision into complete, implementation-ready software requirements with clear IDs.',
      activities: [
        'Define functional system features',
        'Define non-functional rules (latency, security, scale)',
        'Draft detailed user stories',
        'Define strict acceptance criteria per requirement',
      ],
      deliverables: [
        { name: 'Functional Requirements Document', description: 'Enumerated feature requirements with priority levels and criteria.', isRequired: true, order: 1 },
        { name: 'User Stories & Scenarios', description: 'User stories covering key workflows.', isRequired: true, order: 2 },
        { name: 'Acceptance Criteria Specification', description: 'Explicit criteria defining done state for each feature.', isRequired: true, order: 3 },
        { name: 'Non-Functional Requirements', description: 'Performance, availability, security, and compliance bounds.', isRequired: false, order: 4 },
      ],
    },
    {
      order: 3,
      name: '03 Product Planning',
      description: 'Structure information architecture, map out user flows, prioritize MVP scope, and build roadmap schedules.',
      objective: 'Organize features into achievable milestones and prevent scope creep.',
      activities: [
        'Define MVP feature list',
        'Map out core user navigation flows',
        'Create information architecture hierarchy',
        'Define release milestones',
      ],
      deliverables: [
        { name: 'MVP Scope Definition', description: 'Strict boundary list of P0 features vs future scope.', isRequired: true, order: 1 },
        { name: 'Information Architecture Map', description: 'App page hierarchy and navigation tree.', isRequired: true, order: 2 },
        { name: 'Development Milestone Schedule', description: 'Phase schedule and deliverable timelines.', isRequired: false, order: 3 },
      ],
    },
    {
      order: 4,
      name: '04 UX/UI Design',
      description: 'Create user interfaces, define design system tokens, build wireframes, and design responsive components.',
      objective: 'Deliver a visually stunning, accessible, intuitive UI design system.',
      activities: [
        'Establish design system tokens (colors, typography, spacing)',
        'Design low-fidelity wireframes',
        'Design high-fidelity component layouts and cards',
        'Design responsive mobile and desktop viewports',
      ],
      deliverables: [
        { name: 'Design System & Token Spec', description: 'Color palette, typography tokens, badge states, and CSS variables.', isRequired: true, order: 1 },
        { name: 'Dashboard & Core Page Layouts', description: 'High-fidelity designs for main navigation, dashboard, and project views.', isRequired: true, order: 2 },
        { name: 'Interactive Wireframe Prototypes', description: 'Interactive clickable design flows.', isRequired: false, order: 3 },
      ],
    },
    {
      order: 5,
      name: '05 System Design',
      description: 'Architect the technical solution: components, database schema, API contracts, security, and infrastructure.',
      objective: 'Produce complete engineering blueprints before starting implementation.',
      activities: [
        'Design high-level component architecture',
        'Design relational database ER diagrams & Prisma schemas',
        'Define RESTful API endpoints and payloads',
        'Design authentication and server-side RBAC',
      ],
      deliverables: [
        { name: 'System Architecture Specification', description: 'High-level component diagrams and interaction flows.', isRequired: true, order: 1 },
        { name: 'Database Schema & ER Blueprint', description: 'Tables, foreign keys, indexes, and constraints.', isRequired: true, order: 2 },
        { name: 'API Specification Document', description: 'REST endpoints, request/response models, and status codes.', isRequired: true, order: 3 },
        { name: 'Authentication & Security Architecture', description: 'Password hashing, JWT, session, and RBAC rules.', isRequired: true, order: 4 },
      ],
    },
    {
      order: 6,
      name: '06 Development',
      description: 'Implement the full-stack codebase: backend REST APIs, workflow engine, database layer, and frontend SPA.',
      objective: 'Build working, production-quality code following the architecture specs.',
      activities: [
        'Setup monorepo structure and packages',
        'Implement database migrations and seed script',
        'Implement backend endpoints and business services',
        'Implement responsive frontend React components',
      ],
      deliverables: [
        { name: 'Repository & Monorepo Initialization', description: 'Configured TypeScript packages, dependencies, and environment setup.', isRequired: true, order: 1 },
        { name: 'Backend Express REST API', description: 'Fully working backend with Zod validation, JWT, and services.', isRequired: true, order: 2 },
        { name: 'Frontend React SPA Application', description: 'Working frontend connecting to live state and backend APIs.', isRequired: true, order: 3 },
        { name: 'Full-Stack Integration', description: 'End-to-end data flow from database to UI views.', isRequired: true, order: 4 },
      ],
    },
    {
      order: 7,
      name: '07 Testing',
      description: 'Verify system correctness with automated unit tests, API integration tests, and manual workflow verification.',
      objective: 'Ensure zero critical bugs, strong test coverage, and complete requirement fulfillment.',
      activities: [
        'Write backend service and API unit tests',
        'Verify authorization enforcement across endpoints',
        'Perform end-to-end user workflow testing',
        'Conduct security and error handling audit',
      ],
      deliverables: [
        { name: 'Test Plan & Test Cases Document', description: 'Comprehensive checklist of automated and manual test scenarios.', isRequired: true, order: 1 },
        { name: 'Backend Vitest Suite', description: 'Passing automated test suite covering Auth, Workflow, and RBAC.', isRequired: true, order: 2 },
        { name: 'User Acceptance & QA Report', description: 'Verification report of complete end-to-end user journeys.', isRequired: true, order: 3 },
      ],
    },
    {
      order: 8,
      name: '08 Deployment',
      description: 'Prepare production environments, configure environment variables, create Docker containers, and deploy.',
      objective: 'Deploy a stable, secure, containerized build ready for real-world usage.',
      activities: [
        'Configure environment variables (.env.example)',
        'Write Dockerfile for backend and frontend',
        'Create docker-compose setup',
        'Deploy database and run production migrations',
      ],
      deliverables: [
        { name: 'Production Environment Setup', description: 'Configured environment variables and secrets handling.', isRequired: true, order: 1 },
        { name: 'Docker Containerization Suite', description: 'Dockerfile and docker-compose configurations.', isRequired: true, order: 2 },
        { name: 'Production Deployment Guide', description: 'Step-by-step instructions for deploying Xion.', isRequired: true, order: 3 },
      ],
    },
    {
      order: 9,
      name: '09 Launch',
      description: 'Execute launch checklist, onboard initial users, distribute credentials, and monitor early activity.',
      objective: 'Hand over operational product to users smoothly.',
      activities: [
        'Run pre-launch verification checklist',
        'Provision initial user accounts',
        'Distribute credentials securely',
        'Gather initial user feedback',
      ],
      deliverables: [
        { name: 'Launch Verification Checklist', description: 'Final operational checklist signoff.', isRequired: true, order: 1 },
        { name: 'User Onboarding & Documentation Guide', description: 'Guide for team leaders and members.', isRequired: true, order: 2 },
        { name: 'Post-Launch Activity Report', description: 'Initial user feedback and system metrics review.', isRequired: false, order: 3 },
      ],
    },
    {
      order: 10,
      name: '10 Maintenance',
      description: 'Triage bugs, monitor system performance, perform backups, and plan future roadmap iterations.',
      objective: 'Maintain long-term product health, security, and continuous improvement.',
      activities: [
        'Monitor error logs and API performance',
        'Fix reported issues and update dependencies',
        'Maintain database backup routines',
        'Plan v2 feature roadmap',
      ],
      deliverables: [
        { name: 'Bug Triage & Maintenance Protocol', description: 'Procedure for reporting and resolving issues.', isRequired: true, order: 1 },
        { name: 'System Performance Report', description: 'Metrics on API response times and uptime.', isRequired: false, order: 2 },
        { name: 'v2 Feature Roadmap', description: 'Future improvement plan.', isRequired: false, order: 3 },
      ],
    },
  ];

  for (const p of phasesData) {
    const createdPhase = await prisma.phaseTemplate.create({
      data: {
        order: p.order,
        name: p.name,
        description: p.description,
        objective: p.objective,
        activitiesJson: JSON.stringify(p.activities),
      },
    });

    for (const d of p.deliverables) {
      await prisma.deliverableTemplate.create({
        data: {
          phaseTemplateId: createdPhase.id,
          name: d.name,
          description: d.description,
          isRequired: d.isRequired,
          order: d.order,
        },
      });
    }
  }

  console.log('✅ 10 Engineering Phase Templates & Deliverables seeded successfully.');

  const project = await prisma.project.create({
    data: {
      name: 'Xion Project Tracker',
      description: 'Structured software-development project tracker designed for personal and team engineering projects.',
      techStack: 'React, Node.js, Express, TypeScript, Prisma, SQLite',
      status: ProjectStatus.IN_PROGRESS,
      createdById: leader.id,
    },
  });

  await prisma.projectMember.createMany({
    data: [
      { projectId: project.id, userId: leader.id, role: Role.MEMBER },
      { projectId: project.id, userId: userDemo.id, role: Role.MEMBER },
    ],
  });

  const templates = await prisma.phaseTemplate.findMany({
    include: { deliverables: true },
    orderBy: { order: 'asc' },
  });

  for (const t of templates) {
    let status = PhaseStatus.NOT_STARTED;
    if (t.order <= 4) status = PhaseStatus.COMPLETED;
    else if (t.order === 5) status = PhaseStatus.IN_PROGRESS;

    const projectPhase = await prisma.projectPhase.create({
      data: {
        projectId: project.id,
        phaseTemplateId: t.id,
        name: t.name,
        description: t.description,
        objective: t.objective,
        order: t.order,
        status: status,
        startedAt: t.order <= 5 ? new Date() : null,
        completedAt: t.order <= 4 ? new Date() : null,
      },
    });

    for (const d of t.deliverables) {
      let dStatus = DeliverableStatus.NOT_STARTED;
      let assignedToId: string | null = null;
      let completedAt: Date | null = null;
      let docUrl: string | null = null;

      if (t.order <= 4) {
        dStatus = DeliverableStatus.COMPLETED;
        completedAt = new Date();
        assignedToId = d.order % 2 === 0 ? leader.id : userDemo.id;
        docUrl = `https://github.com/project/xion/docs/${d.name.toLowerCase().replace(/ /g, '_')}.md`;
      } else if (t.order === 5) {
        if (d.order === 1 || d.order === 2) {
          dStatus = DeliverableStatus.COMPLETED;
          completedAt = new Date();
          assignedToId = leader.id;
          docUrl = 'file:///.ai/ARCHITECTURE.md';
        } else {
          dStatus = DeliverableStatus.IN_PROGRESS;
          assignedToId = userDemo.id;
        }
      }

      await prisma.projectDeliverable.create({
        data: {
          projectPhaseId: projectPhase.id,
          deliverableTemplateId: d.id,
          name: d.name,
          description: d.description,
          isRequired: d.isRequired,
          order: d.order,
          status: dStatus,
          assignedToId: assignedToId,
          documentUrl: docUrl,
          completedAt: completedAt,
        },
      });
    }
  }

  console.log('✅ Demo Project "Xion Project Tracker" created with full workflow snapshot!');
  console.log('🎉 Seeding complete.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
