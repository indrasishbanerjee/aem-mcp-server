/**
 * Enhanced AEM Connector with modular architecture
 * Composes all operation modules for better maintainability and testability
 */

import { AxiosInstance } from 'axios';
import { ILogger, IConfig, IAEMConnector } from './interfaces/index.js';
import { PageOperations } from './operations/page-operations.js';
import { ComponentOperations } from './operations/component-operations.js';
import { AssetOperations } from './operations/asset-operations.js';
import { SearchOperations } from './operations/search-operations.js';
import { TemplateOperations } from './operations/template-operations.js';
import { ReplicationOperations } from './operations/replication-operations.js';
import { UtilityOperations } from './operations/utility-operations.js';
import { WorkflowOperations } from './operations/workflow-operations.js';
import { VersionOperations } from './operations/version-operations.js';
import { createAxiosInstance } from './http-client.js';

export class AEMConnector implements IAEMConnector {
  private httpClient: AxiosInstance;
  private pageOps: PageOperations;
  private componentOps: ComponentOperations;
  private assetOps: AssetOperations;
  private searchOps: SearchOperations;
  private templateOps: TemplateOperations;
  private replicationOps: ReplicationOperations;
  private utilityOps: UtilityOperations;
  private workflowOps: WorkflowOperations;
  private versionOps: VersionOperations;

  constructor(
    private config: IConfig,
    private logger: ILogger
  ) {
    // Create HTTP client instance
    this.httpClient = createAxiosInstance(config);
    
    // Initialize operation modules
    this.pageOps = new PageOperations(this.httpClient, this.logger, config.aem);
    this.componentOps = new ComponentOperations(this.httpClient, this.logger, config.aem);
    this.assetOps = new AssetOperations(this.httpClient, this.logger, config.aem);
    this.searchOps = new SearchOperations(this.httpClient, this.logger, config.aem);
    this.templateOps = new TemplateOperations(this.httpClient, this.logger, config.aem);
    this.replicationOps = new ReplicationOperations(this.httpClient, this.logger, config.aem);
    this.utilityOps = new UtilityOperations(this.httpClient, this.logger, config.aem);
    this.workflowOps = new WorkflowOperations(this.httpClient, this.logger, config.aem);
    this.versionOps = new VersionOperations(this.httpClient, this.logger, config.aem);
  }

  /**
   * Test connection to AEM instance
   */
  async testConnection(): Promise<boolean> {
    try {
      this.logger.info('Testing AEM connection', {
        host: this.config.aem.host
      });
      
      const response = await this.httpClient.get('/libs/granite/core/content/login.html', {
        timeout: 5000,
        validateStatus: (status) => status < 500,
      });
      
      this.logger.info('AEM connection successful', {
        status: response.status
      });
      
      return true;
    } catch (error: any) {
      this.logger.error('AEM connection failed', {
        error: error.message,
        host: this.config.aem.host
      });
      return false;
    }
  }

  // Page Operations
  async createPage(request: any) {
    return this.pageOps.createPage(request);
  }

  async deletePage(request: any) {
    return this.pageOps.deletePage(request);
  }

  async listPages(siteRoot: string, depth?: number, limit?: number) {
    return this.pageOps.listPages(siteRoot, depth, limit);
  }

  async getPageContent(pagePath: string) {
    return this.pageOps.getPageContent(pagePath);
  }

  async getPageProperties(pagePath: string) {
    return this.pageOps.getPageProperties(pagePath);
  }

  async activatePage(request: any) {
    return this.pageOps.activatePage(request);
  }

  async deactivatePage(request: any) {
    return this.pageOps.deactivatePage(request);
  }

  async getAllTextContent(pagePath: string) {
    return this.pageOps.getAllTextContent(pagePath);
  }

  async getPageTextContent(pagePath: string) {
    return this.pageOps.getPageTextContent(pagePath);
  }

  async getPageImages(pagePath: string) {
    return this.pageOps.getPageImages(pagePath);
  }

  // Component Operations
  async createComponent(request: any) {
    return this.componentOps.createComponent(request);
  }

  async updateComponent(request: any) {
    return this.componentOps.updateComponent(request);
  }

  async deleteComponent(request: any) {
    return this.componentOps.deleteComponent(request);
  }

  async validateComponent(request: any) {
    return this.componentOps.validateComponent(request);
  }

  async scanPageComponents(pagePath: string) {
    return this.componentOps.scanPageComponents(pagePath);
  }

  async bulkUpdateComponents(request: any) {
    return this.componentOps.bulkUpdateComponents(request);
  }

  async updateImagePath(componentPath: string, newImagePath: string) {
    return this.componentOps.updateImagePath(componentPath, newImagePath);
  }

  // Asset Operations
  async uploadAsset(request: any) {
    return this.assetOps.uploadAsset(request);
  }

  async updateAsset(request: any) {
    return this.assetOps.updateAsset(request);
  }

  async deleteAsset(request: any) {
    return this.assetOps.deleteAsset(request);
  }

  async getAssetMetadata(assetPath: string) {
    return this.assetOps.getAssetMetadata(assetPath);
  }

  // Search Operations
  async searchContent(params: any) {
    return this.searchOps.searchContent(params);
  }

  async executeJCRQuery(query: string, limit?: number) {
    return this.searchOps.executeJCRQuery(query, limit);
  }

  async enhancedPageSearch(params: any) {
    return this.searchOps.enhancedPageSearch(params);
  }

  // Template Operations
  async getTemplates(sitePath?: string) {
    return this.templateOps.getTemplates(sitePath);
  }

  async getTemplateStructure(templatePath: string) {
    return this.templateOps.getTemplateStructure(templatePath);
  }

  // Replication Operations
  async replicateAndPublish(selectedLocales: any, componentData: any, localizedOverrides?: any) {
    return this.replicationOps.replicateAndPublish(selectedLocales, componentData, localizedOverrides);
  }

  async unpublishContent(request: any) {
    return this.replicationOps.unpublishContent(request);
  }

  // Utility Operations
  async getNodeContent(path: string, depth?: number) {
    return this.utilityOps.getNodeContent(path, depth);
  }

  async listChildren(path: string) {
    return this.utilityOps.listChildren(path);
  }

  async fetchSites() {
    return this.utilityOps.fetchSites();
  }

  async fetchLanguageMasters(site: string) {
    return this.utilityOps.fetchLanguageMasters(site);
  }

  async fetchAvailableLocales(site: string, languageMasterPath: string) {
    return this.utilityOps.fetchAvailableLocales(site, languageMasterPath);
  }


  // Additional methods for backward compatibility
  async createPageWithTemplate(request: any) {
    return this.createPage(request);
  }

  async getAvailableTemplates(parentPath: string) {
    return this.templateOps.getAvailableTemplates(parentPath);
  }

  async validateTemplate(templatePath: string, targetPath: string) {
    return this.templateOps.validateTemplate(templatePath, targetPath);
  }

  async getTemplateMetadata(templatePath: string, useCache = true) {
    return this.templateOps.getTemplateMetadata(templatePath, useCache);
  }

  clearTemplateCache(): void {
    this.templateOps.clearTemplateCache();
  }

  // Workflow Operations
  async startWorkflow(request: any) {
    return this.workflowOps.startWorkflow(request);
  }

  async getWorkflowStatus(workflowId: string) {
    return this.workflowOps.getWorkflowStatus(workflowId);
  }

  async completeWorkflowStep(workflowId: string, stepName: string, comment?: string) {
    return this.workflowOps.completeWorkflowStep(workflowId, stepName, comment);
  }

  async cancelWorkflow(workflowId: string, reason?: string) {
    return this.workflowOps.cancelWorkflow(workflowId, reason);
  }

  async listActiveWorkflows(limit?: number) {
    return this.workflowOps.listActiveWorkflows(limit);
  }

  async suspendWorkflow(workflowId: string, reason?: string) {
    return this.workflowOps.suspendWorkflow(workflowId, reason);
  }

  async resumeWorkflow(workflowId: string) {
    return this.workflowOps.resumeWorkflow(workflowId);
  }

  async getWorkflowModels() {
    return this.workflowOps.getWorkflowModels();
  }

  // Version Operations
  async getVersionHistory(path: string) {
    return this.versionOps.getVersionHistory(path);
  }

  async createVersion(path: string, label?: string, comment?: string) {
    return this.versionOps.createVersion(path, label, comment);
  }

  async restoreVersion(path: string, versionName: string) {
    return this.versionOps.restoreVersion(path, versionName);
  }

  async compareVersions(path: string, version1: string, version2: string) {
    return this.versionOps.compareVersions(path, version1, version2);
  }

  async deleteVersion(path: string, versionName: string) {
    return this.versionOps.deleteVersion(path, versionName);
  }

  async undoChanges(request: any) {
    return this.versionOps.undoChanges(request);
  }
}
