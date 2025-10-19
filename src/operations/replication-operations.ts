/**
 * Replication Operations Module
 * Handles all AEM replication and publishing operations including activation, deactivation, and content distribution
 */

import { AxiosInstance } from 'axios';
import { 
  IAEMConnector,
  ActivatePageRequest,
  DeactivatePageRequest,
  UnpublishContentRequest,
  ActivateResponse,
  DeactivateResponse,
  UnpublishResponse,
  ReplicateResponse,
  ILogger,
  AEMConfig
} from '../interfaces/index.js';
import { 
  AEMOperationError,
  createAEMError,
  handleAEMHttpError,
  safeExecute,
  createSuccessResponse,
  AEM_ERROR_CODES,
  isValidContentPath
} from '../error-handler.js';

export class ReplicationOperations implements Partial<IAEMConnector> {
  constructor(
    private httpClient: AxiosInstance,
    private logger: ILogger,
    private config: AEMConfig
  ) {}

  /**
   * Activate (publish) a single page
   */
  async activatePage(request: ActivatePageRequest): Promise<ActivateResponse> {
    return safeExecute<ActivateResponse>(async () => {
      const { pagePath, activateTree = false } = request;
      
      if (!isValidContentPath(pagePath)) {
        throw createAEMError(
          AEM_ERROR_CODES.INVALID_PARAMETERS, 
          `Invalid page path: ${String(pagePath)}`, 
          { pagePath }
        );
      }
      
      try {
        // Use the correct AEM replication servlet endpoint
        const formData = new URLSearchParams();
        formData.append('cmd', 'Activate');
        formData.append('path', pagePath);
        formData.append('ignoredeactivated', 'false');
        formData.append('onlymodified', 'false');
        
        if (activateTree) {
          formData.append('deep', 'true');
        }
        
        const response = await this.httpClient.post('/bin/replicate.json', formData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
        
        return createSuccessResponse({
          success: true,
          activatedPath: pagePath,
          activateTree,
          response: response.data,
          timestamp: new Date().toISOString(),
        }, 'activatePage') as ActivateResponse;
      } catch (error: any) {
        // Fallback to alternative replication methods
        try {
          const wcmResponse = await this.httpClient.post('/bin/wcmcommand', {
            cmd: 'activate',
            path: pagePath,
            ignoredeactivated: false,
            onlymodified: false,
          });
          
          return createSuccessResponse({
            success: true,
            activatedPath: pagePath,
            activateTree,
            response: wcmResponse.data,
            fallbackUsed: 'WCM Command',
            timestamp: new Date().toISOString(),
          }, 'activatePage') as ActivateResponse;
        } catch (fallbackError: any) {
          throw handleAEMHttpError(error, 'activatePage');
        }
      }
    }, 'activatePage');
  }

  /**
   * Deactivate (unpublish) a single page
   */
  async deactivatePage(request: DeactivatePageRequest): Promise<DeactivateResponse> {
    return safeExecute<DeactivateResponse>(async () => {
      const { pagePath, deactivateTree = false } = request;
      
      if (!isValidContentPath(pagePath)) {
        throw createAEMError(
          AEM_ERROR_CODES.INVALID_PARAMETERS, 
          `Invalid page path: ${String(pagePath)}`, 
          { pagePath }
        );
      }
      
      try {
        // Use the correct AEM replication servlet endpoint
        const formData = new URLSearchParams();
        formData.append('cmd', 'Deactivate');
        formData.append('path', pagePath);
        formData.append('ignoredeactivated', 'false');
        formData.append('onlymodified', 'false');
        
        if (deactivateTree) {
          formData.append('deep', 'true');
        }
        
        const response = await this.httpClient.post('/bin/replicate.json', formData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
        
        return createSuccessResponse({
          success: true,
          deactivatedPath: pagePath,
          deactivateTree,
          response: response.data,
          timestamp: new Date().toISOString(),
        }, 'deactivatePage') as DeactivateResponse;
      } catch (error: any) {
        // Fallback to alternative replication methods
        try {
          const wcmResponse = await this.httpClient.post('/bin/wcmcommand', {
            cmd: 'deactivate',
            path: pagePath,
            ignoredeactivated: false,
            onlymodified: false,
          });
          
          return createSuccessResponse({
            success: true,
            deactivatedPath: pagePath,
            deactivateTree,
            response: wcmResponse.data,
            fallbackUsed: 'WCM Command',
            timestamp: new Date().toISOString(),
          }, 'deactivatePage') as DeactivateResponse;
        } catch (fallbackError: any) {
          throw handleAEMHttpError(error, 'deactivatePage');
        }
      }
    }, 'deactivatePage');
  }

  /**
   * Unpublish content from the publish environment
   */
  async unpublishContent(request: UnpublishContentRequest): Promise<UnpublishResponse> {
    return safeExecute<UnpublishResponse>(async () => {
      const { contentPaths, unpublishTree = false } = request;
      
      if (!contentPaths || (Array.isArray(contentPaths) && contentPaths.length === 0)) {
        throw createAEMError(
          AEM_ERROR_CODES.INVALID_PARAMETERS, 
          'Content paths array is required and cannot be empty', 
          { contentPaths }
        );
      }
      
      const results: Array<{
        path: string;
        success: boolean;
        response?: unknown;
        error?: unknown;
      }> = [];
      
      // Process each path individually using the correct AEM replication API
      for (const path of Array.isArray(contentPaths) ? contentPaths : [contentPaths]) {
        try {
          // Use the correct AEM replication servlet endpoint
          const formData = new URLSearchParams();
          formData.append('cmd', 'Deactivate');
          formData.append('path', path);
          formData.append('ignoredeactivated', 'false');
          formData.append('onlymodified', 'false');
          
          if (unpublishTree) {
            formData.append('deep', 'true');
          }
          
          const response = await this.httpClient.post('/bin/replicate.json', formData, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          });
          
          results.push({
            path,
            success: true,
            response: response.data
          });
        } catch (error: any) {
          results.push({
            path,
            success: false,
            error: error.response?.data || error.message
          });
        }
      }
      
      return createSuccessResponse({
        success: results.every(r => r.success),
        results,
        unpublishedPaths: contentPaths,
        unpublishTree,
        timestamp: new Date().toISOString(),
      }, 'unpublishContent') as UnpublishResponse;
    }, 'unpublishContent');
  }

  /**
   * Replicate and publish content to selected locales with real AEM integration
   */
  async replicateAndPublish(
    selectedLocales: string[], 
    componentData: unknown, 
    localizedOverrides?: unknown
  ): Promise<ReplicateResponse> {
    return safeExecute<ReplicateResponse>(async () => {
      if (!selectedLocales || selectedLocales.length === 0) {
        throw createAEMError(
          AEM_ERROR_CODES.INVALID_PARAMETERS,
          'selectedLocales array is required and cannot be empty',
          { selectedLocales }
        );
      }

      const results: Array<{
        locale: string;
        success: boolean;
        message: string;
        path?: string;
        error?: string;
        replicationId?: string;
      }> = [];

      const successfulReplications: string[] = [];
      let hasFailures = false;

      for (const locale of selectedLocales) {
        try {
          this.logger.info(`Starting replication to locale: ${locale}`, {
            componentData: typeof componentData,
            hasOverrides: !!localizedOverrides
          });

          // Step 1: Validate locale path exists
          const localePath = this.validateAndBuildLocalePath(locale);
          
          // Step 2: Check if content is part of MSM structure
          const isMSMContent = await this.checkMSMStructure(localePath);
          
          let replicationResult: any;
          
          if (isMSMContent) {
            // Step 3a: Use MSM APIs for live copy updates
            replicationResult = await this.handleMSMReplication(
              localePath, 
              componentData, 
              localizedOverrides
            );
          } else {
            // Step 3b: Standard replication process
            replicationResult = await this.handleStandardReplication(
              localePath, 
              componentData, 
              localizedOverrides
            );
          }

          // Step 4: Activate content in the target locale
          await this.activateContentInLocale(localePath);

          results.push({
            locale,
            success: true,
            message: `Content replicated and activated successfully to ${locale}`,
            path: localePath,
            replicationId: replicationResult.replicationId
          });

          successfulReplications.push(locale);
          
          this.logger.info(`Content replicated successfully to locale: ${locale}`, {
            path: localePath,
            replicationId: replicationResult.replicationId
          });

        } catch (error: any) {
          hasFailures = true;
          
          results.push({
            locale,
            success: false,
            message: `Failed to replicate to ${locale}: ${error.message}`,
            error: error.message
          });
          
          this.logger.error(`Failed to replicate to locale: ${locale}`, {
            error: error.message,
            stack: error.stack
          });

          // If we have a strict policy, rollback successful replications
          if (this.config.strictReplication) {
            await this.rollbackSuccessfulReplications(successfulReplications);
          }
        }
      }

      return createSuccessResponse({
        message: hasFailures 
          ? `Replication completed with errors. ${successfulReplications.length}/${selectedLocales.length} locales successful.`
          : 'All replications completed successfully',
        selectedLocales,
        successfulLocales: successfulReplications,
        failedLocales: results.filter(r => !r.success).map(r => r.locale),
        componentData,
        localizedOverrides,
        results,
        success: !hasFailures,
        summary: {
          total: selectedLocales.length,
          successful: successfulReplications.length,
          failed: selectedLocales.length - successfulReplications.length
        }
      }, 'replicateAndPublish') as ReplicateResponse;
    }, 'replicateAndPublish');
  }

  /**
   * Validate and build locale-specific path
   */
  private validateAndBuildLocalePath(locale: string): string {
    if (!locale || typeof locale !== 'string') {
      throw createAEMError(
        AEM_ERROR_CODES.INVALID_PARAMETERS,
        'Locale must be a non-empty string',
        { locale }
      );
    }

    // Validate locale format (e.g., en-us, en_US, en-US)
    const localePattern = /^[a-z]{2}(-[A-Z]{2})?$/i;
    if (!localePattern.test(locale)) {
      throw createAEMError(
        AEM_ERROR_CODES.INVALID_PARAMETERS,
        'Invalid locale format. Expected format: en, en-US, en_US',
        { locale }
      );
    }

    // Normalize locale to AEM format (e.g., en-us -> en_us)
    const normalizedLocale = locale.toLowerCase().replace('-', '_');
    
    // Build locale-specific path
    return `/content/${this.config.siteName || 'we-retail'}/${normalizedLocale}`;
  }

  /**
   * Check if content is part of MSM (Multi-Site Manager) structure
   */
  private async checkMSMStructure(localePath: string): Promise<boolean> {
    try {
      const response = await this.httpClient.get(`${localePath}.json`, {
        params: { ':depth': '1' }
      });
      
      // Check for MSM properties
      return !!(response.data?.['jcr:content']?.['cq:liveSyncConfig'] || 
                response.data?.['jcr:content']?.['cq:blueprint']);
    } catch (error: any) {
      this.logger.warn(`Could not check MSM structure for ${localePath}`, {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Handle MSM replication using live copy APIs
   */
  private async handleMSMReplication(
    localePath: string,
    componentData: unknown,
    localizedOverrides?: unknown
  ): Promise<{ replicationId: string }> {
    const formData = new URLSearchParams();
    formData.append('cmd', 'Rollout');
    formData.append('path', localePath);
    formData.append('deep', 'true');
    
    // Add component data if provided
    if (componentData) {
      formData.append('componentData', JSON.stringify(componentData));
    }

    // Add localized overrides if provided
    if (localizedOverrides) {
      formData.append('localizedOverrides', JSON.stringify(localizedOverrides));
    }

    const response = await this.httpClient.post('/bin/wcm/msm/rollout', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return {
      replicationId: response.data?.replicationId || `msm_${Date.now()}`
    };
  }

  /**
   * Handle standard replication process
   */
  private async handleStandardReplication(
    localePath: string,
    componentData: unknown,
    localizedOverrides?: unknown
  ): Promise<{ replicationId: string }> {
    // Step 1: Create or update content in target locale
    if (componentData) {
      const formData = new URLSearchParams();
      formData.append('cmd', 'update');
      formData.append('_charset_', 'utf-8');
      
      // Add component data
      Object.entries(componentData as Record<string, unknown>).forEach(([key, value]) => {
        formData.append(key, String(value));
      });

      // Add localized overrides
      if (localizedOverrides) {
        Object.entries(localizedOverrides as Record<string, unknown>).forEach(([key, value]) => {
          formData.append(`localized_${key}`, String(value));
        });
      }

      await this.httpClient.post(localePath, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    }

    return {
      replicationId: `std_${Date.now()}`
    };
  }

  /**
   * Activate content in the target locale
   */
  private async activateContentInLocale(localePath: string): Promise<void> {
    const formData = new URLSearchParams();
    formData.append('cmd', 'Activate');
    formData.append('path', localePath);
    formData.append('ignoredeactivated', 'false');
    formData.append('onlymodified', 'false');

    await this.httpClient.post('/bin/replicate.json', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  /**
   * Rollback successful replications on failure
   */
  private async rollbackSuccessfulReplications(successfulLocales: string[]): Promise<void> {
    this.logger.info(`Rolling back ${successfulLocales.length} successful replications`);

    for (const locale of successfulLocales) {
      try {
        const localePath = this.validateAndBuildLocalePath(locale);
        
        // Deactivate content
        const formData = new URLSearchParams();
        formData.append('cmd', 'Deactivate');
        formData.append('path', localePath);
        formData.append('ignoredeactivated', 'false');
        formData.append('onlymodified', 'false');

        await this.httpClient.post('/bin/replicate.json', formData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        this.logger.info(`Rolled back replication for locale: ${locale}`);
      } catch (error: any) {
        this.logger.error(`Failed to rollback locale: ${locale}`, {
          error: error.message
        });
      }
    }
  }

  /**
   * Get replication status for content
   */
  async getReplicationStatus(contentPath: string): Promise<{
    contentPath: string;
    status: 'active' | 'inactive' | 'pending' | 'error';
    lastReplicated?: string;
    replicationAgent?: string;
    error?: string;
  }> {
    return safeExecute(async () => {
      try {
        // Query replication status using AEM's replication status API
        const response = await this.httpClient.get('/bin/querybuilder.json', {
          params: {
            type: 'cq:ReplicationStatus',
            path: contentPath,
            'p.limit': 1
          }
        });

        if (response.data.hits && response.data.hits.length > 0) {
          const status = response.data.hits[0];
          return {
            contentPath,
            status: status['jcr:content/status'] || 'unknown',
            lastReplicated: status['jcr:content/cq:lastReplicated'],
            replicationAgent: status['jcr:content/cq:replicationAgent']
          };
        }

        return {
          contentPath,
          status: 'inactive'
        };
      } catch (error: any) {
        return {
          contentPath,
          status: 'error',
          error: error.message
        };
      }
    }, 'getReplicationStatus');
  }

  /**
   * Bulk activate multiple pages
   */
  async bulkActivatePages(
    pagePaths: string[], 
    activateTree = false
  ): Promise<{
    success: boolean;
    results: Array<{
      pagePath: string;
      success: boolean;
      error?: string;
    }>;
    totalPages: number;
    successfulActivations: number;
  }> {
    return safeExecute(async () => {
      const results: Array<{
        pagePath: string;
        success: boolean;
        error?: string;
      }> = [];

      let successfulActivations = 0;

      for (const pagePath of pagePaths) {
        try {
          const result = await this.activatePage({
            pagePath,
            activateTree
          });

          results.push({
            pagePath,
            success: result.data.success
          });

          if (result.data.success) {
            successfulActivations++;
          }
        } catch (error: any) {
          results.push({
            pagePath,
            success: false,
            error: error.message
          });
        }
      }

      return {
        success: successfulActivations === pagePaths.length,
        results,
        totalPages: pagePaths.length,
        successfulActivations
      };
    }, 'bulkActivatePages');
  }

  /**
   * Bulk deactivate multiple pages
   */
  async bulkDeactivatePages(
    pagePaths: string[], 
    deactivateTree = false
  ): Promise<{
    success: boolean;
    results: Array<{
      pagePath: string;
      success: boolean;
      error?: string;
    }>;
    totalPages: number;
    successfulDeactivations: number;
  }> {
    return safeExecute(async () => {
      const results: Array<{
        pagePath: string;
        success: boolean;
        error?: string;
      }> = [];

      let successfulDeactivations = 0;

      for (const pagePath of pagePaths) {
        try {
          const result = await this.deactivatePage({
            pagePath,
            deactivateTree
          });

          results.push({
            pagePath,
            success: result.data.success
          });

          if (result.data.success) {
            successfulDeactivations++;
          }
        } catch (error: any) {
          results.push({
            pagePath,
            success: false,
            error: error.message
          });
        }
      }

      return {
        success: successfulDeactivations === pagePaths.length,
        results,
        totalPages: pagePaths.length,
        successfulDeactivations
      };
    }, 'bulkDeactivatePages');
  }
}
