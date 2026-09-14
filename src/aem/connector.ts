import type { AppConfig } from '../config.js';
import type { Logger } from '../logger.js';
import { AemHttpClient } from './client.js';
import { AssetOperations } from './assets.js';
import { ComponentOperations } from './components.js';
import { DiscoveryOperations } from './discovery.js';
import { IdempotencyStore } from './idempotency.js';
import { PageOperations } from './pages.js';
import { SearchOperations } from './search.js';
import { VersionOperations, WorkflowOperations } from './workflow.js';

export class AemConnector {
  readonly pages: PageOperations;
  readonly components: ComponentOperations;
  readonly assets: AssetOperations;
  readonly search: SearchOperations;
  readonly discovery: DiscoveryOperations;
  readonly workflows: WorkflowOperations;
  readonly versions: VersionOperations;
  readonly client: AemHttpClient;
  readonly idempotency: IdempotencyStore;

  constructor(config: AppConfig, logger: Logger, client?: AemHttpClient) {
    this.client = client ?? new AemHttpClient(config, logger);
    this.pages = new PageOperations(this.client, config);
    this.components = new ComponentOperations(this.client, config);
    this.assets = new AssetOperations(this.client, config);
    this.search = new SearchOperations(this.client, config);
    this.discovery = new DiscoveryOperations(this.client, config);
    this.workflows = new WorkflowOperations(this.client, config);
    this.versions = new VersionOperations(this.client, config);
    this.idempotency = new IdempotencyStore(15 * 60 * 1000);
  }

  testConnection(): Promise<boolean> {
    return this.discovery.testConnection();
  }
}
