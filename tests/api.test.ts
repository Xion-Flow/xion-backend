import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Xion REST API & Security Test Suite', () => {
  let adminToken: string;
  let leaderToken: string;
  let memberToken: string;
  let testProjectId: string;

  beforeAll(async () => {
    // 1. Admin Login
    const adminRes = await request(app).post('/api/auth/login').send({
      email: 'admin@xion.local',
      password: 'AdminPassword123!',
    });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;

    // 2. Leader Login
    const leaderRes = await request(app).post('/api/auth/login').send({
      email: 'leader@xion.local',
      password: 'LeaderPassword123!',
    });
    expect(leaderRes.status).toBe(200);
    leaderToken = leaderRes.body.token;

    // 3. Member Login
    const memberRes = await request(app).post('/api/auth/login').send({
      email: 'alex@xion.local',
      password: 'MemberPassword123!',
    });
    expect(memberRes.status).toBe(200);
    memberToken = memberRes.body.token;
  });

  describe('Authentication & Password Security', () => {
    it('should reject invalid password with 401 Unauthorized', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'admin@xion.local',
        password: 'WrongPassword!',
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('should return user profile for authenticated GET /api/auth/me', async () => {
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${leaderToken}`);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('leader@xion.local');
      expect(res.body.user.role).toBe('MEMBER');
    });
  });

  describe('Admin Capabilities', () => {
    it('should allow ADMIN to fetch system stats', async () => {
      const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.stats.totalUsers).toBeGreaterThan(0);
      expect(res.body.stats.totalProjects).toBeGreaterThan(0);
    });

    it('should prevent MEMBER from accessing Admin stats (403 Forbidden)', async () => {
      const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Project Creation & Workflow Generation Engine', () => {
    it('should create project and snapshot 10 engineering phase templates', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({
          name: 'Arixen Platform Test Project',
          description: 'Automated workflow verification project',
          techStack: 'React, Node.js, Prisma',
        });

      expect(res.status).toBe(201);
      expect(res.body.project.name).toBe('Arixen Platform Test Project');
      testProjectId = res.body.project.id;

      // Verify Project Details & Workflow
      const detailsRes = await request(app)
        .get(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${leaderToken}`);

      expect(detailsRes.status).toBe(200);
      expect(detailsRes.body.project.phases.length).toBe(10);
      expect(detailsRes.body.project.phases[0].name).toContain('01 Idea');
      expect(detailsRes.body.project.phases[0].deliverables.length).toBeGreaterThan(0);
    }, 15000);
  });

  describe('Deliverable Tracking & Progress Metrics', () => {
    it('should return My Work queue for logged in user', async () => {
      const res = await request(app).get('/api/deliverables/my-work').set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.deliverables)).toBe(true);
    });
  });

  describe('Development Guide', () => {
    it('should return 10 engineering lifecycle phase guides', async () => {
      const res = await request(app).get('/api/guide').set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(200);
      expect(res.body.phases.length).toBe(10);
      expect(res.body.phases[0].activities).toBeDefined();
    });
  });
});
