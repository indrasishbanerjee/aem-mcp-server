import { describe, expect, it } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../mcp/create-server.js';
import { makeConfig, makeConnector } from './helpers.js';

describe('MCP stdio-equivalent protocol', () => {
  it('lists enabled tools and returns structured content', async () => {
    const { connector } = makeConnector();
    const server = createMcpServer(makeConfig(), connector);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test', version: '0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const listed = await client.listTools();
    const names = listed.tools.map(tool => tool.name);
    expect(names).toContain('listPages');
    expect(names).not.toContain('getNodeContent');
    const tool = listed.tools.find(item => item.name === 'createPage');
    expect(tool?.annotations?.destructiveHint).toBe(false);
    const result = await client.callTool({
      name: 'listPages',
      arguments: { siteRoot: '/content/mysite', limit: 5 }
    });
    expect(result.isError).toBeUndefined();
    await client.close();
    await server.close();
  });
});
