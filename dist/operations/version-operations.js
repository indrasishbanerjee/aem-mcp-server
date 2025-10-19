/**
 * Version Operations Module
 * Handles all AEM version management operations including creating, restoring, comparing, and deleting versions
 */
import { createAEMError, handleAEMHttpError, safeExecute, createSuccessResponse, AEM_ERROR_CODES, isValidContentPath } from '../error-handler.js';
export class VersionOperations {
    httpClient;
    logger;
    config;
    constructor(httpClient, logger, config) {
        this.httpClient = httpClient;
        this.logger = logger;
        this.config = config;
    }
    /**
     * Get version history for a content path
     */
    async getVersionHistory(path) {
        return safeExecute(async () => {
            if (!isValidContentPath(path)) {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, `Invalid content path: ${path}`, { path });
            }
            try {
                // Get version history using AEM's versioning API
                const response = await this.httpClient.get(`${path}.versionhistory.json`, {
                    params: { ':depth': '2' }
                });
                const versions = [];
                let baseVersion;
                if (response.data && typeof response.data === 'object') {
                    Object.entries(response.data).forEach(([key, value]) => {
                        if (key === 'jcr:versionLabels') {
                            // Handle version labels
                            return;
                        }
                        if (value && typeof value === 'object' && value['jcr:frozenNode']) {
                            const versionInfo = {
                                name: key,
                                label: value['jcr:frozenNode']?.['jcr:versionLabel'],
                                created: value['jcr:created'] || new Date().toISOString(),
                                createdBy: value['jcr:createdBy'] || 'unknown',
                                comment: value['jcr:versionComment'],
                                isBaseVersion: value['jcr:isCheckedOut'] === false
                            };
                            if (versionInfo.isBaseVersion) {
                                baseVersion = key;
                            }
                            versions.push(versionInfo);
                        }
                    });
                }
                // Sort versions by creation date (newest first)
                versions.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
                this.logger.info(`Retrieved version history for path: ${path}`, {
                    versionCount: versions.length,
                    baseVersion
                });
                return createSuccessResponse({
                    path,
                    versions,
                    totalCount: versions.length,
                    baseVersion
                }, 'getVersionHistory');
            }
            catch (error) {
                throw handleAEMHttpError(error, 'getVersionHistory');
            }
        }, 'getVersionHistory');
    }
    /**
     * Create a new version of content
     */
    async createVersion(path, label, comment) {
        return safeExecute(async () => {
            if (!isValidContentPath(path)) {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, `Invalid content path: ${path}`, { path });
            }
            try {
                // Check out the content first
                await this.checkOutContent(path);
                // Create version using AEM's versioning API
                const formData = new URLSearchParams();
                formData.append('cmd', 'createVersion');
                formData.append('path', path);
                if (label) {
                    formData.append('label', label);
                }
                if (comment) {
                    formData.append('comment', comment);
                }
                const response = await this.httpClient.post('/bin/wcm/versioning/createVersion', formData, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                });
                // Check the content back in
                await this.checkInContent(path);
                const versionName = response.data?.versionName || `v${Date.now()}`;
                this.logger.info(`Created version for path: ${path}`, {
                    versionName,
                    label,
                    comment
                });
                return createSuccessResponse({
                    path,
                    versionName,
                    label,
                    comment,
                    created: new Date().toISOString(),
                    createdBy: this.config.serviceUser.username
                }, 'createVersion');
            }
            catch (error) {
                throw handleAEMHttpError(error, 'createVersion');
            }
        }, 'createVersion');
    }
    /**
     * Restore content to a specific version
     */
    async restoreVersion(path, versionName) {
        return safeExecute(async () => {
            if (!isValidContentPath(path)) {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, `Invalid content path: ${path}`, { path });
            }
            if (!versionName || typeof versionName !== 'string') {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, 'Version name is required', { versionName });
            }
            try {
                // Get current version before restore
                const versionHistory = await this.getVersionHistory(path);
                const currentVersion = versionHistory.data.baseVersion;
                // Restore version using AEM's versioning API
                const formData = new URLSearchParams();
                formData.append('cmd', 'restoreVersion');
                formData.append('path', path);
                formData.append('version', versionName);
                await this.httpClient.post('/bin/wcm/versioning/restoreVersion', formData, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                });
                this.logger.info(`Restored version for path: ${path}`, {
                    versionName,
                    previousVersion: currentVersion
                });
                return createSuccessResponse({
                    path,
                    restoredVersion: versionName,
                    previousVersion: currentVersion,
                    restoredAt: new Date().toISOString(),
                    restoredBy: this.config.serviceUser.username
                }, 'restoreVersion');
            }
            catch (error) {
                throw handleAEMHttpError(error, 'restoreVersion');
            }
        }, 'restoreVersion');
    }
    /**
     * Compare two versions of content
     */
    async compareVersions(path, version1, version2) {
        return safeExecute(async () => {
            if (!isValidContentPath(path)) {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, `Invalid content path: ${path}`, { path });
            }
            if (!version1 || !version2 || version1 === version2) {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, 'Two different version names are required for comparison', { version1, version2 });
            }
            try {
                // Get both versions
                const version1Response = await this.httpClient.get(`${path}.version.${version1}.json`, {
                    params: { ':depth': '2' }
                });
                const version2Response = await this.httpClient.get(`${path}.version.${version2}.json`, {
                    params: { ':depth': '2' }
                });
                // Compare the versions
                const differences = this.compareVersionData(version1Response.data, version2Response.data);
                const summary = {
                    added: differences.filter(d => d.type === 'added').length,
                    removed: differences.filter(d => d.type === 'removed').length,
                    modified: differences.filter(d => d.type === 'modified').length
                };
                this.logger.info(`Compared versions for path: ${path}`, {
                    version1,
                    version2,
                    differencesCount: differences.length,
                    summary
                });
                return createSuccessResponse({
                    path,
                    version1,
                    version2,
                    differences,
                    summary
                }, 'compareVersions');
            }
            catch (error) {
                throw handleAEMHttpError(error, 'compareVersions');
            }
        }, 'compareVersions');
    }
    /**
     * Delete a specific version
     */
    async deleteVersion(path, versionName) {
        return safeExecute(async () => {
            if (!isValidContentPath(path)) {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, `Invalid content path: ${path}`, { path });
            }
            if (!versionName || typeof versionName !== 'string') {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, 'Version name is required', { versionName });
            }
            try {
                // Delete version using AEM's versioning API
                const formData = new URLSearchParams();
                formData.append('cmd', 'deleteVersion');
                formData.append('path', path);
                formData.append('version', versionName);
                await this.httpClient.post('/bin/wcm/versioning/deleteVersion', formData, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                });
                this.logger.info(`Deleted version for path: ${path}`, {
                    versionName
                });
                return createSuccessResponse({
                    path,
                    deletedVersion: versionName,
                    deletedAt: new Date().toISOString(),
                    deletedBy: this.config.serviceUser.username
                }, 'deleteVersion');
            }
            catch (error) {
                throw handleAEMHttpError(error, 'deleteVersion');
            }
        }, 'deleteVersion');
    }
    /**
     * Update undoChanges to use version operations
     */
    async undoChanges(request) {
        return safeExecute(async () => {
            const { jobId, path } = request;
            // If jobId looks like a version name, try to restore it
            if (path && (jobId.startsWith('v') || jobId.includes('.'))) {
                try {
                    const restoreResult = await this.restoreVersion(path, jobId);
                    return createSuccessResponse({
                        message: `Successfully restored version ${jobId} for path ${path}`,
                        request,
                        versionInfo: {
                            restoredVersion: restoreResult.data.restoredVersion,
                            path: restoreResult.data.path
                        },
                        timestamp: new Date().toISOString()
                    }, 'undoChanges');
                }
                catch (error) {
                    // If restore fails, fall back to original message
                }
            }
            // Fallback to original implementation
            return createSuccessResponse({
                message: 'undoChanges requires a valid path and version name. Use version operations for proper rollback functionality.',
                request,
                timestamp: new Date().toISOString()
            }, 'undoChanges');
        }, 'undoChanges');
    }
    /**
     * Helper method to check out content
     */
    async checkOutContent(path) {
        const formData = new URLSearchParams();
        formData.append('cmd', 'checkout');
        formData.append('path', path);
        await this.httpClient.post('/bin/wcm/versioning/checkout', formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
    }
    /**
     * Helper method to check in content
     */
    async checkInContent(path) {
        const formData = new URLSearchParams();
        formData.append('cmd', 'checkin');
        formData.append('path', path);
        await this.httpClient.post('/bin/wcm/versioning/checkin', formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
    }
    /**
     * Helper method to compare version data
     */
    compareVersionData(data1, data2, prefix = '') {
        const differences = [];
        const keys1 = new Set(Object.keys(data1 || {}));
        const keys2 = new Set(Object.keys(data2 || {}));
        // Check for added and modified properties
        for (const key of keys2) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (!keys1.has(key)) {
                differences.push({
                    property: fullKey,
                    type: 'added',
                    newValue: data2[key]
                });
            }
            else if (JSON.stringify(data1[key]) !== JSON.stringify(data2[key])) {
                differences.push({
                    property: fullKey,
                    type: 'modified',
                    oldValue: data1[key],
                    newValue: data2[key]
                });
            }
        }
        // Check for removed properties
        for (const key of keys1) {
            if (!keys2.has(key)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                differences.push({
                    property: fullKey,
                    type: 'removed',
                    oldValue: data1[key]
                });
            }
        }
        return differences;
    }
}
//# sourceMappingURL=version-operations.js.map