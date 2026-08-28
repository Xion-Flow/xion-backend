import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import request from 'supertest';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import app from '../src/app.js';
import { socketService } from '../src/services/socketService.js';

describe('Socket.io Real-Time WebSockets Engine Test Suite', () => {
  let server: http.Server;
  let port: number;
  let leaderToken: string;
  let testProjectId: string;
  let testDeliverableId: string;

  beforeAll(async () => {
    server = http.createServer(app);
    socketService.init(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as any;
        port = addr.port;
        resolve();
      });
    });

    // Login as leader
    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'leader@xion.local',
      password: 'LeaderPassword123!',
    });
    leaderToken = loginRes.body.token;

    // Create a test project for socket testing
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({
        name: 'Socket Realtime Test Project',
        description: 'Testing live WebSocket synchronization',
      });

    testProjectId = projRes.body.project.id;

    // Fetch project details to get a deliverable ID
    const detailsRes = await request(app)
      .get(`/api/projects/${testProjectId}`)
      .set('Authorization', `Bearer ${leaderToken}`);

    testDeliverableId = detailsRes.body.project.phases[0].deliverables[0].id;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('should reject WebSocket connection without valid token', async () => {
    const socket: ClientSocket = ioClient(`http://localhost:${port}`, {
      autoConnect: false,
      reconnection: false,
    });

    await new Promise<void>((resolve) => {
      socket.on('connect_error', (err) => {
        expect(err.message).toContain('Authentication error');
        socket.disconnect();
        resolve();
      });
      socket.connect();
    });
  });

  it('should connect successfully with valid JWT token and receive live events', async () => {
    const socket: ClientSocket = ioClient(`http://localhost:${port}`, {
      auth: { token: leaderToken },
      reconnection: false,
    });

    await new Promise<void>((resolve) => {
      socket.on('connect', () => {
        expect(socket.connected).toBe(true);
        resolve();
      });
    });

    // Join project room
    socket.emit('join:project', { projectId: testProjectId });

    // Set up real-time event listener promise
    const eventReceivedPromise = new Promise<void>((resolve) => {
      socket.on('deliverable:updated', (data) => {
        expect(data.projectId).toBe(testProjectId);
        expect(data.deliverable.id).toBe(testDeliverableId);
        expect(data.deliverable.status).toBe('COMPLETED');
        socket.disconnect();
        resolve();
      });
    });

    // Trigger deliverable update API
    const updateRes = await request(app)
      .patch(`/api/deliverables/${testDeliverableId}`)
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ status: 'COMPLETED', notes: 'Completed via live WebSocket test' });

    expect(updateRes.status).toBe(200);

    // Wait for WebSocket event
    await eventReceivedPromise;
  });
});
