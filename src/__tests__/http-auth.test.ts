import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../http/gateway.js';
import { makeConfig, makeConnector, silentLogger } from './helpers.js';

describe('HTTP auth and MCP surface', () => {
  it('exposes unauthenticated liveness only', async () => {
    const { connector } = makeConnector();
    const app = createApp(makeConfig(), silentLogger(), connector);
    await request(app).get('/health/live').expect(200);
    await request(app).get('/health/ready').expect(401);
    await request(app).post('/api/methods/listPages').send({}).expect(401);
  });

  it('accepts API key for method listing', async () => {
    const { connector } = makeConnector();
    const app = createApp(makeConfig(), silentLogger(), connector);
    const response = await request(app)
      .get('/api/methods')
      .set('x-api-key', 'test-api-key')
      .expect(200);
    expect(response.body.data.totalMethods).toBeGreaterThan(10);
    const names = Object.values(
      response.body.data.methods as Record<string, Array<{ name: string }>>
    )
      .flat()
      .map(item => item.name);
    expect(names).not.toContain('executeJCRQuery');
    expect(names).toContain('createPage');
  });

  it('rejects invalid Host headers', async () => {
    const { connector } = makeConnector();
    const app = createApp(makeConfig(), silentLogger(), connector);
    await request(app).get('/health/live').set('Host', 'evil.example').expect(403);
  });
});
