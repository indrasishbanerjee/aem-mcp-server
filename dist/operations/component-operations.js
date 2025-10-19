/**
 * Component Operations Module
 * Handles all AEM component-related operations including CRUD, validation, and bulk updates
 */
import { createAEMError, handleAEMHttpError, safeExecute, createSuccessResponse, AEM_ERROR_CODES, isValidContentPath, isValidComponentType, validateComponentOperation } from '../error-handler.js';
export class ComponentOperations {
    httpClient;
    logger;
    config;
    constructor(httpClient, logger, config) {
        this.httpClient = httpClient;
        this.logger = logger;
        this.config = config;
    }
    /**
     * Create a new component on a page
     */
    async createComponent(request) {
        return safeExecute(async () => {
            const { pagePath, componentType, resourceType, properties = {}, name } = request;
            if (!isValidContentPath(pagePath)) {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, `Invalid page path: ${String(pagePath)}`, { pagePath });
            }
            if (!isValidComponentType(componentType)) {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, `Invalid component type: ${componentType}`, { componentType });
            }
            const componentName = name || `${componentType}_${Date.now()}`;
            const componentPath = `${pagePath}/jcr:content/${componentName}`;
            await this.httpClient.post(componentPath, {
                'jcr:primaryType': 'nt:unstructured',
                'sling:resourceType': resourceType,
                ...properties,
                ':operation': 'import',
                ':contentType': 'json',
                ':replace': 'true',
            });
            return createSuccessResponse({
                success: true,
                componentPath,
                componentType,
                resourceType,
                properties,
                timestamp: new Date().toISOString(),
            }, 'createComponent');
        }, 'createComponent');
    }
    /**
     * Update component properties in AEM
     */
    async updateComponent(request) {
        return safeExecute(async () => {
            const { componentPath, properties } = request;
            if (!componentPath || typeof componentPath !== 'string') {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, 'Component path is required and must be a string');
            }
            if (!properties || typeof properties !== 'object') {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, 'Properties are required and must be an object');
            }
            if (!isValidContentPath(componentPath)) {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PATH, `Component path '${componentPath}' is not within allowed content roots`, {
                    path: componentPath,
                    allowedRoots: Object.values(this.config.contentPaths)
                });
            }
            // Verify component exists
            try {
                await this.httpClient.get(`${componentPath}.json`);
            }
            catch (error) {
                if (error.response?.status === 404) {
                    throw createAEMError(AEM_ERROR_CODES.COMPONENT_NOT_FOUND, `Component not found at path: ${componentPath}`, { componentPath });
                }
                throw handleAEMHttpError(error, 'updateComponent');
            }
            // Prepare form data for AEM
            const formData = new URLSearchParams();
            Object.entries(properties).forEach(([key, value]) => {
                if (value === null || value === undefined) {
                    formData.append(`${key}@Delete`, '');
                }
                else if (Array.isArray(value)) {
                    value.forEach((item) => {
                        formData.append(`${key}`, item.toString());
                    });
                }
                else if (typeof value === 'object') {
                    formData.append(key, JSON.stringify(value));
                }
                else {
                    formData.append(key, value.toString());
                }
            });
            // Update the component
            const response = await this.httpClient.post(componentPath, formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                },
                timeout: this.config.queries.timeoutMs,
            });
            // Verify the update
            const verificationResponse = await this.httpClient.get(`${componentPath}.json`);
            return createSuccessResponse({
                message: 'Component updated successfully',
                path: componentPath,
                properties,
                updatedProperties: verificationResponse.data,
                response: response.data,
                verification: {
                    success: true,
                    propertiesChanged: Object.keys(properties).length,
                    timestamp: new Date().toISOString(),
                },
            }, 'updateComponent');
        }, 'updateComponent');
    }
    /**
     * Delete a component from AEM
     */
    async deleteComponent(request) {
        return safeExecute(async () => {
            const { componentPath, force = false } = request;
            if (!isValidContentPath(componentPath)) {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, `Invalid component path: ${String(componentPath)}`, { componentPath });
            }
            let deleted = false;
            try {
                await this.httpClient.delete(componentPath);
                deleted = true;
            }
            catch (err) {
                if (err.response && err.response.status === 405) {
                    try {
                        await this.httpClient.post(componentPath, { ':operation': 'delete' });
                        deleted = true;
                    }
                    catch (slingErr) {
                        this.logger.error('Sling POST delete failed', {
                            error: slingErr.response?.status,
                            data: slingErr.response?.data
                        });
                        throw slingErr;
                    }
                }
                else {
                    this.logger.error('DELETE failed', {
                        status: err.response?.status,
                        data: err.response?.data
                    });
                    throw err;
                }
            }
            return createSuccessResponse({
                success: deleted,
                deletedPath: componentPath,
                timestamp: new Date().toISOString(),
            }, 'deleteComponent');
        }, 'deleteComponent');
    }
    /**
     * Validate component changes before applying them
     */
    async validateComponent(request) {
        return safeExecute(async () => {
            const { locale, pagePath, component, props } = request;
            validateComponentOperation(locale, pagePath, component, props);
            // Validate locale
            const normalizedLocale = locale.toLowerCase();
            const isValidLocale = this.config.validation.allowedLocales.some(l => l.toLowerCase() === normalizedLocale ||
                (normalizedLocale === 'en' && l.toLowerCase().startsWith('en')));
            if (!isValidLocale) {
                throw createAEMError(AEM_ERROR_CODES.INVALID_LOCALE, `Locale '${locale}' is not supported`, {
                    locale,
                    allowedLocales: this.config.validation.allowedLocales
                });
            }
            // Validate content path
            if (!isValidContentPath(pagePath)) {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PATH, `Path '${pagePath}' is not within allowed content roots`, {
                    path: pagePath,
                    allowedRoots: Object.values(this.config.contentPaths)
                });
            }
            // Validate component type
            if (!isValidComponentType(component)) {
                throw createAEMError(AEM_ERROR_CODES.INVALID_COMPONENT_TYPE, `Component type '${component}' is not allowed`, {
                    component,
                    allowedTypes: this.config.components.allowedTypes
                });
            }
            // Get page data for validation
            const response = await this.httpClient.get(`${pagePath}.json`, {
                params: { ':depth': '2' },
                timeout: this.config.queries.timeoutMs,
            });
            const validation = this.validateComponentProps(response.data, component, props);
            return createSuccessResponse({
                message: 'Component validation completed successfully',
                pageData: response.data,
                component,
                locale,
                validation,
                configUsed: {
                    allowedLocales: this.config.validation.allowedLocales,
                    allowedComponents: this.config.components.allowedTypes,
                },
            }, 'validateComponent');
        }, 'validateComponent');
    }
    /**
     * Scan a page to discover all components and their properties
     */
    async scanPageComponents(pagePath) {
        return safeExecute(async () => {
            const response = await this.httpClient.get(`${pagePath}.infinity.json`);
            const components = [];
            const processNode = (node, nodePath) => {
                if (!node || typeof node !== 'object')
                    return;
                if (node['sling:resourceType']) {
                    components.push({
                        path: nodePath,
                        resourceType: node['sling:resourceType'],
                        properties: { ...node },
                    });
                }
                Object.entries(node).forEach(([key, value]) => {
                    if (typeof value === 'object' && value !== null &&
                        !key.startsWith('rep:') && !key.startsWith('oak:')) {
                        const childPath = nodePath ? `${nodePath}/${key}` : key;
                        processNode(value, childPath);
                    }
                });
            };
            if (response.data['jcr:content']) {
                processNode(response.data['jcr:content'], 'jcr:content');
            }
            else {
                processNode(response.data, pagePath);
            }
            return createSuccessResponse({
                pagePath,
                components,
                totalComponents: components.length,
            }, 'scanPageComponents');
        }, 'scanPageComponents');
    }
    /**
     * Update multiple components in a single operation with validation and rollback support
     */
    async bulkUpdateComponents(request) {
        return safeExecute(async () => {
            const { updates, validateFirst = true, continueOnError = false } = request;
            if (!Array.isArray(updates) || updates.length === 0) {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, 'Updates array is required and cannot be empty');
            }
            const results = [];
            // Validation phase if requested
            if (validateFirst) {
                for (const update of updates) {
                    try {
                        await this.httpClient.get(`${update.componentPath}.json`);
                    }
                    catch (error) {
                        if (error.response?.status === 404) {
                            results.push({
                                componentPath: update.componentPath,
                                success: false,
                                error: `Component not found: ${update.componentPath}`,
                                phase: 'validation'
                            });
                            if (!continueOnError) {
                                return createSuccessResponse({
                                    success: false,
                                    message: 'Bulk update failed during validation phase',
                                    results,
                                    totalUpdates: updates.length,
                                    successfulUpdates: 0
                                }, 'bulkUpdateComponents');
                            }
                        }
                    }
                }
            }
            // Update phase
            let successCount = 0;
            for (const update of updates) {
                try {
                    const result = await this.updateComponent({
                        componentPath: update.componentPath,
                        properties: update.properties
                    });
                    results.push({
                        componentPath: update.componentPath,
                        success: true,
                        result: result,
                        phase: 'update'
                    });
                    successCount++;
                }
                catch (error) {
                    results.push({
                        componentPath: update.componentPath,
                        success: false,
                        error: error.message,
                        phase: 'update'
                    });
                    if (!continueOnError) {
                        break;
                    }
                }
            }
            return createSuccessResponse({
                success: successCount === updates.length,
                message: `Bulk update completed: ${successCount}/${updates.length} successful`,
                results,
                totalUpdates: updates.length,
                successfulUpdates: successCount,
                failedUpdates: updates.length - successCount
            }, 'bulkUpdateComponents');
        }, 'bulkUpdateComponents');
    }
    /**
     * Update the image path for an image component and verify the update
     */
    async updateImagePath(componentPath, newImagePath) {
        return this.updateComponent({
            componentPath,
            properties: { fileReference: newImagePath }
        });
    }
    /**
     * Validate component properties based on component type
     */
    validateComponentProps(pageData, componentType, props) {
        const warnings = [];
        const errors = [];
        if (componentType === 'text' && !props.text && !props.richText) {
            warnings.push('Text component should have text or richText property');
        }
        if (componentType === 'image' && !props.fileReference && !props.src) {
            errors.push('Image component requires fileReference or src property');
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings,
            componentType,
            propsValidated: Object.keys(props).length,
        };
    }
}
//# sourceMappingURL=component-operations.js.map