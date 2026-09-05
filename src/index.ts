import dotenv from 'dotenv';
import { loadConfig } from './config.js';
import { Logger } from './logger.js';
import { AemConnector } from './aem/connector.js';
import { startGateway } from './http/gateway.js';

dotenv.config();

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new Logger(config.logging);
  const aem = new AemConnector(config, logger);
  if (!config.http.enabled) {
    logger.error('HTTP gateway disabled. Use npm run mcp for stdio.');
    process.exit(1);
  }
  await startGateway(config, logger, aem);
}

main().catch(error => {
  process.stderr.write(
    `Fatal gateway error: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
});
