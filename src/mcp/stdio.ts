#!/usr/bin/env node
import dotenv from 'dotenv';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from '../config.js';
import { Logger } from '../logger.js';
import { AemConnector } from '../aem/connector.js';
import { createMcpServer } from './create-server.js';

dotenv.config();

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new Logger(config.logging);
  const aem = new AemConnector(config, logger);
  const server = createMcpServer(config, aem);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('AEM MCP stdio server started');

  const shutdown = async (): Promise<void> => {
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
}

main().catch(error => {
  process.stderr.write(
    `Fatal MCP stdio error: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
});
