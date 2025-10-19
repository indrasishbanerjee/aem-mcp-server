/**
 * Enhanced AEM Connector with modular architecture
 * Composes all operation modules for better maintainability and testability
 */
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
export class AEMConnector {
    config;
    logger;
    httpClient;
    pageOps;
    componentOps;
    assetOps;
    searchOps;
    templateOps;
    replicationOps;
    utilityOps;
    workflowOps;
    versionOps;
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
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
    async testConnection() {
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
        }
        catch (error) {
            this.logger.error('AEM connection failed', {
                error: error.message,
                host: this.config.aem.host
            });
            return false;
        }
    }
    // Page Operations
    async createPage(request) {
        return this.pageOps.createPage(request);
    }
    async deletePage(request) {
        return this.pageOps.deletePage(request);
    }
    async listPages(siteRoot, depth, limit) {
        return this.pageOps.listPages(siteRoot, depth, limit);
    }
    async getPageContent(pagePath) {
        return this.pageOps.getPageContent(pagePath);
    }
    async getPageProperties(pagePath) {
        return this.pageOps.getPageProperties(pagePath);
    }
    async activatePage(request) {
        return this.pageOps.activatePage(request);
    }
    async deactivatePage(request) {
        return this.pageOps.deactivatePage(request);
    }
    async getAllTextContent(pagePath) {
        return this.pageOps.getAllTextContent(pagePath);
    }
    async getPageTextContent(pagePath) {
        return this.pageOps.getPageTextContent(pagePath);
    }
    async getPageImages(pagePath) {
        return this.pageOps.getPageImages(pagePath);
    }
    // Component Operations
    async createComponent(request) {
        return this.componentOps.createComponent(request);
    }
    async updateComponent(request) {
        return this.componentOps.updateComponent(request);
    }
    async deleteComponent(request) {
        return this.componentOps.deleteComponent(request);
    }
    async validateComponent(request) {
        return this.componentOps.validateComponent(request);
    }
    async scanPageComponents(pagePath) {
        return this.componentOps.scanPageComponents(pagePath);
    }
    async bulkUpdateComponents(request) {
        return this.componentOps.bulkUpdateComponents(request);
    }
    async updateImagePath(componentPath, newImagePath) {
        return this.componentOps.updateImagePath(componentPath, newImagePath);
    }
    // Asset Operations
    async uploadAsset(request) {
        return this.assetOps.uploadAsset(request);
    }
    async updateAsset(request) {
        return this.assetOps.updateAsset(request);
    }
    async deleteAsset(request) {
        return this.assetOps.deleteAsset(request);
    }
    async getAssetMetadata(assetPath) {
        return this.assetOps.getAssetMetadata(assetPath);
    }
    // Search Operations
    async searchContent(params) {
        return this.searchOps.searchContent(params);
    }
    async executeJCRQuery(query, limit) {
        return this.searchOps.executeJCRQuery(query, limit);
    }
    async enhancedPageSearch(params) {
        return this.searchOps.enhancedPageSearch(params);
    }
    // Template Operations
    async getTemplates(sitePath) {
        return this.templateOps.getTemplates(sitePath);
    }
    async getTemplateStructure(templatePath) {
        return this.templateOps.getTemplateStructure(templatePath);
    }
    // Replication Operations
    async replicateAndPublish(selectedLocales, componentData, localizedOverrides) {
        return this.replicationOps.replicateAndPublish(selectedLocales, componentData, localizedOverrides);
    }
    async unpublishContent(request) {
        return this.replicationOps.unpublishContent(request);
    }
    // Utility Operations
    async getNodeContent(path, depth) {
        return this.utilityOps.getNodeContent(path, depth);
    }
    async listChildren(path) {
        return this.utilityOps.listChildren(path);
    }
    async fetchSites() {
        return this.utilityOps.fetchSites();
    }
    async fetchLanguageMasters(site) {
        return this.utilityOps.fetchLanguageMasters(site);
    }
    async fetchAvailableLocales(site, languageMasterPath) {
        return this.utilityOps.fetchAvailableLocales(site, languageMasterPath);
    }
    // Additional methods for backward compatibility
    async createPageWithTemplate(request) {
        return this.createPage(request);
    }
    async getAvailableTemplates(parentPath) {
        return this.templateOps.getAvailableTemplates(parentPath);
    }
    async validateTemplate(templatePath, targetPath) {
        return this.templateOps.validateTemplate(templatePath, targetPath);
    }
    async getTemplateMetadata(templatePath, useCache = true) {
        return this.templateOps.getTemplateMetadata(templatePath, useCache);
    }
    clearTemplateCache() {
        this.templateOps.clearTemplateCache();
    }
    // Workflow Operations
    async startWorkflow(request) {
        return this.workflowOps.startWorkflow(request);
    }
    async getWorkflowStatus(workflowId) {
        return this.workflowOps.getWorkflowStatus(workflowId);
    }
    async completeWorkflowStep(workflowId, stepName, comment) {
        return this.workflowOps.completeWorkflowStep(workflowId, stepName, comment);
    }
    async cancelWorkflow(workflowId, reason) {
        return this.workflowOps.cancelWorkflow(workflowId, reason);
    }
    async listActiveWorkflows(limit) {
        return this.workflowOps.listActiveWorkflows(limit);
    }
    async suspendWorkflow(workflowId, reason) {
        return this.workflowOps.suspendWorkflow(workflowId, reason);
    }
    async resumeWorkflow(workflowId) {
        return this.workflowOps.resumeWorkflow(workflowId);
    }
    async getWorkflowModels() {
        return this.workflowOps.getWorkflowModels();
    }
    // Version Operations
    async getVersionHistory(path) {
        return this.versionOps.getVersionHistory(path);
    }
    async createVersion(path, label, comment) {
        return this.versionOps.createVersion(path, label, comment);
    }
    async restoreVersion(path, versionName) {
        return this.versionOps.restoreVersion(path, versionName);
    }
    async compareVersions(path, version1, version2) {
        return this.versionOps.compareVersions(path, version1, version2);
    }
    async deleteVersion(path, versionName) {
        return this.versionOps.deleteVersion(path, versionName);
    }
    async undoChanges(request) {
        return this.versionOps.undoChanges(request);
    }
}
//# sourceMappingURL=aem-connector-new.js.map