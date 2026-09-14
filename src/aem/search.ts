import type { AppConfig } from '../config.js';
import { AEM_ERROR_CODES, AemError } from '../errors.js';
import { isPrefix } from '../security/paths.js';
import { pathPolicy } from '../config.js';
import type { AemHttpClient } from './client.js';
import { asRecord, clampLimit, ok, requirePath, type SuccessEnvelope } from './util.js';

const ALLOWED_PREDICATES = new Set([
  'path',
  'type',
  'fulltext',
  'p.limit',
  'p.offset',
  'p.guessTotal',
  'p.hits',
  'orderby',
  'orderby.sort',
  '1_property',
  '1_property.value',
  '1_property.operation',
  '2_property',
  '2_property.value'
]);

export class SearchOperations {
  constructor(
    private readonly client: AemHttpClient,
    private readonly config: AppConfig
  ) {}

  async searchContent(
    params: Record<string, unknown>
  ): Promise<SuccessEnvelope<{ results: unknown[]; total?: unknown; more: boolean }>> {
    const query: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(params)) {
      if (!ALLOWED_PREDICATES.has(key)) {
        throw new AemError({
          code: AEM_ERROR_CODES.POLICY_DENIED,
          message: `QueryBuilder predicate '${key}' is not allowed`,
          statusCode: 400
        });
      }
      if (value !== undefined && value !== null) {
        query[key] =
          typeof value === 'boolean' || typeof value === 'number' ? value : String(value);
      }
    }
    const path = query.path
      ? requirePath(String(query.path), this.config)
      : this.config.aem.sitesRoot;
    query.path = path;
    query['p.limit'] = clampLimit(
      Number(query['p.limit'] ?? this.config.aem.defaultLimit),
      this.config
    );
    query['p.guessTotal'] = true;
    if (!query.type) {
      query.type = 'cq:Page';
    }
    const data = asRecord(await this.client.get('/bin/querybuilder.json', query));
    const results = Array.isArray(data.hits) ? data.hits : [];
    return ok('searchContent', {
      results,
      total: data.total,
      more: Boolean(data.more)
    });
  }

  async enhancedPageSearch(input: {
    searchTerm: string;
    basePath: string;
    includeAlternateLocales?: boolean;
  }): Promise<SuccessEnvelope<{ results: unknown[]; strategy: string }>> {
    const basePath = requirePath(input.basePath, this.config);
    const primary = await this.searchContent({
      path: basePath,
      type: 'cq:Page',
      fulltext: input.searchTerm,
      'p.limit': this.config.aem.defaultLimit
    });
    if (primary.data.results.length > 0) {
      return ok('enhancedPageSearch', { results: primary.data.results, strategy: 'fulltext' });
    }
    const titleSearch = await this.searchContent({
      path: basePath,
      type: 'cq:Page',
      '1_property': 'jcr:content/jcr:title',
      '1_property.value': `%${input.searchTerm}%`,
      '1_property.operation': 'like',
      'p.limit': this.config.aem.defaultLimit
    });
    if (titleSearch.data.results.length > 0 || !input.includeAlternateLocales) {
      return ok('enhancedPageSearch', { results: titleSearch.data.results, strategy: 'title' });
    }
    const parent = basePath.split('/').slice(0, -1).join('/') || this.config.aem.sitesRoot;
    if (!pathPolicy(this.config).allowedRoots.some(root => isPrefix(root, parent))) {
      return ok('enhancedPageSearch', { results: [], strategy: 'none' });
    }
    const localeSearch = await this.searchContent({
      path: parent,
      type: 'cq:Page',
      fulltext: input.searchTerm,
      'p.limit': this.config.aem.defaultLimit
    });
    return ok('enhancedPageSearch', {
      results: localeSearch.data.results,
      strategy: 'locale-parent'
    });
  }
}
