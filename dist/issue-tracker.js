import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
export class IssueTracker {
    issues = [];
    filePath;
    constructor(filePath = 'issues.json') {
        this.filePath = join(process.cwd(), 'logs', filePath);
        this.loadIssues();
    }
    loadIssues() {
        try {
            if (existsSync(this.filePath)) {
                const data = readFileSync(this.filePath, 'utf8');
                this.issues = JSON.parse(data);
            }
        }
        catch (error) {
            console.warn('Failed to load existing issues:', error);
            this.issues = [];
        }
    }
    saveIssues() {
        try {
            // Ensure logs directory exists
            const logsDir = join(process.cwd(), 'logs');
            if (!existsSync(logsDir)) {
                require('fs').mkdirSync(logsDir, { recursive: true });
            }
            writeFileSync(this.filePath, JSON.stringify(this.issues, null, 2), 'utf8');
        }
        catch (error) {
            console.error('Failed to save issues:', error);
        }
    }
    createIssue(issueData) {
        const issue = {
            id: this.generateIssueId(),
            createdAt: new Date().toISOString(),
            status: 'open',
            ...issueData
        };
        this.issues.push(issue);
        this.saveIssues();
        console.log(`🐛 Issue created: ${issue.id} - ${issue.description}`);
        return issue;
    }
    updateIssue(issueId, updates) {
        const issueIndex = this.issues.findIndex(issue => issue.id === issueId);
        if (issueIndex === -1) {
            console.error(`Issue ${issueId} not found`);
            return null;
        }
        const issue = this.issues[issueIndex];
        const oldStatus = issue.status;
        // Update issue
        Object.assign(issue, updates);
        // Set resolved timestamp if status changed to resolved
        if (oldStatus !== 'resolved' && updates.status === 'resolved') {
            issue.resolvedAt = new Date().toISOString();
        }
        this.saveIssues();
        console.log(`📝 Issue updated: ${issueId} - Status: ${issue.status}`);
        return issue;
    }
    resolveIssue(issueId, resolution) {
        const updates = {
            status: 'resolved',
            resolvedAt: new Date().toISOString()
        };
        if (resolution) {
            updates.description = `${this.getIssue(issueId)?.description} - Resolution: ${resolution}`;
        }
        return this.updateIssue(issueId, updates);
    }
    closeIssue(issueId) {
        return this.updateIssue(issueId, { status: 'closed' });
    }
    getIssue(issueId) {
        return this.issues.find(issue => issue.id === issueId) || null;
    }
    getIssues(filter) {
        let filteredIssues = [...this.issues];
        if (filter) {
            if (filter.severity) {
                filteredIssues = filteredIssues.filter(issue => issue.severity === filter.severity);
            }
            if (filter.category) {
                filteredIssues = filteredIssues.filter(issue => issue.category === filter.category);
            }
            if (filter.method) {
                filteredIssues = filteredIssues.filter(issue => issue.method === filter.method);
            }
            if (filter.status) {
                filteredIssues = filteredIssues.filter(issue => issue.status === filter.status);
            }
            if (filter.assignee) {
                filteredIssues = filteredIssues.filter(issue => issue.assignee === filter.assignee);
            }
            if (filter.tags && filter.tags.length > 0) {
                filteredIssues = filteredIssues.filter(issue => issue.tags && filter.tags.some(tag => issue.tags.includes(tag)));
            }
        }
        return filteredIssues.sort((a, b) => {
            // Sort by severity first, then by creation date
            const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
            if (severityDiff !== 0) {
                return severityDiff;
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }
    getOpenIssues() {
        return this.getIssues({ status: 'open' });
    }
    getCriticalIssues() {
        return this.getIssues({ severity: 'critical' });
    }
    getIssuesByMethod(method) {
        return this.getIssues({ method });
    }
    getIssuesByCategory(category) {
        return this.getIssues({ category });
    }
    getStats() {
        const stats = {
            total: this.issues.length,
            bySeverity: {},
            byCategory: {},
            byStatus: {},
            byMethod: {},
            openIssues: 0,
            resolvedIssues: 0
        };
        this.issues.forEach(issue => {
            // By severity
            stats.bySeverity[issue.severity] = (stats.bySeverity[issue.severity] || 0) + 1;
            // By category
            stats.byCategory[issue.category] = (stats.byCategory[issue.category] || 0) + 1;
            // By status
            stats.byStatus[issue.status] = (stats.byStatus[issue.status] || 0) + 1;
            // By method
            stats.byMethod[issue.method] = (stats.byMethod[issue.method] || 0) + 1;
            // Count open and resolved
            if (issue.status === 'open' || issue.status === 'in-progress') {
                stats.openIssues++;
            }
            else if (issue.status === 'resolved' || issue.status === 'closed') {
                stats.resolvedIssues++;
            }
        });
        // Calculate average resolution time
        const resolvedIssues = this.issues.filter(issue => issue.status === 'resolved' && issue.resolvedAt);
        if (resolvedIssues.length > 0) {
            const totalResolutionTime = resolvedIssues.reduce((sum, issue) => {
                const created = new Date(issue.createdAt).getTime();
                const resolved = new Date(issue.resolvedAt).getTime();
                return sum + (resolved - created);
            }, 0);
            stats.averageResolutionTime = Math.round(totalResolutionTime / resolvedIssues.length / 1000 / 60); // in minutes
        }
        return stats;
    }
    generateReport(format = 'json') {
        const stats = this.getStats();
        const issues = this.getIssues();
        switch (format) {
            case 'html':
                return this.generateHtmlReport(stats, issues);
            case 'markdown':
                return this.generateMarkdownReport(stats, issues);
            default:
                return JSON.stringify({ stats, issues }, null, 2);
        }
    }
    generateHtmlReport(stats, issues) {
        const criticalIssues = issues.filter(i => i.severity === 'critical');
        const openIssues = issues.filter(i => i.status === 'open');
        return `
<!DOCTYPE html>
<html>
<head>
    <title>AEM MCP Issue Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; color: #007bff; }
        .issue { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 8px; }
        .critical { border-left: 5px solid #dc3545; background: #fff5f5; }
        .high { border-left: 5px solid #fd7e14; background: #fff8f0; }
        .medium { border-left: 5px solid #ffc107; background: #fffbf0; }
        .low { border-left: 5px solid #28a745; background: #f0fff4; }
        .issue-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .issue-id { font-family: monospace; background: #f8f9fa; padding: 2px 6px; border-radius: 4px; }
        .status { padding: 4px 8px; border-radius: 12px; font-size: 0.8em; font-weight: bold; }
        .status.open { background: #dc3545; color: white; }
        .status.in-progress { background: #ffc107; color: black; }
        .status.resolved { background: #28a745; color: white; }
        .status.closed { background: #6c757d; color: white; }
        .method { font-family: monospace; background: #e9ecef; padding: 2px 6px; border-radius: 4px; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; }
        .section { margin: 30px 0; }
        .section h2 { color: #495057; border-bottom: 2px solid #dee2e6; padding-bottom: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🐛 AEM MCP Issue Report</h1>
        <p>Generated on ${new Date().toLocaleString()}</p>
    </div>

    <div class="section">
        <h2>📊 Summary Statistics</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${stats.total}</div>
                <div>Total Issues</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.openIssues}</div>
                <div>Open Issues</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.resolvedIssues}</div>
                <div>Resolved Issues</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.bySeverity.critical || 0}</div>
                <div>Critical Issues</div>
            </div>
        </div>
    </div>

    ${criticalIssues.length > 0 ? `
    <div class="section">
        <h2>🔴 Critical Issues</h2>
        ${criticalIssues.map(issue => this.renderIssueHtml(issue)).join('')}
    </div>
    ` : ''}

    ${openIssues.length > 0 ? `
    <div class="section">
        <h2>📋 Open Issues</h2>
        ${openIssues.map(issue => this.renderIssueHtml(issue)).join('')}
    </div>
    ` : ''}

    <div class="section">
        <h2>📈 Statistics Breakdown</h2>
        <h3>By Severity</h3>
        <ul>
            ${Object.entries(stats.bySeverity).map(([severity, count]) => `<li>${severity.toUpperCase()}: ${count}</li>`).join('')}
        </ul>
        
        <h3>By Category</h3>
        <ul>
            ${Object.entries(stats.byCategory).map(([category, count]) => `<li>${category}: ${count}</li>`).join('')}
        </ul>
        
        <h3>By Method</h3>
        <ul>
            ${Object.entries(stats.byMethod).map(([method, count]) => `<li>${method}: ${count}</li>`).join('')}
        </ul>
    </div>
</body>
</html>`;
    }
    renderIssueHtml(issue) {
        return `
        <div class="issue ${issue.severity}">
            <div class="issue-header">
                <div>
                    <span class="issue-id">${issue.id}</span>
                    <span class="method">${issue.method}</span>
                </div>
                <span class="status ${issue.status}">${issue.status.toUpperCase()}</span>
            </div>
            <h3>${issue.description}</h3>
            <p><strong>Category:</strong> ${issue.category}</p>
            <p><strong>Severity:</strong> ${issue.severity.toUpperCase()}</p>
            <p><strong>Expected:</strong> ${issue.expectedBehavior}</p>
            <p><strong>Actual:</strong> ${issue.actualBehavior}</p>
            <p><strong>Created:</strong> ${new Date(issue.createdAt).toLocaleString()}</p>
            ${issue.resolvedAt ? `<p><strong>Resolved:</strong> ${new Date(issue.resolvedAt).toLocaleString()}</p>` : ''}
            ${issue.errorDetails ? `
                <details>
                    <summary>Error Details</summary>
                    <pre>${JSON.stringify(issue.errorDetails, null, 2)}</pre>
                </details>
            ` : ''}
        </div>`;
    }
    generateMarkdownReport(stats, issues) {
        const criticalIssues = issues.filter(i => i.severity === 'critical');
        const openIssues = issues.filter(i => i.status === 'open');
        return `# 🐛 AEM MCP Issue Report

Generated on ${new Date().toLocaleString()}

## 📊 Summary Statistics

| Metric | Count |
|--------|-------|
| Total Issues | ${stats.total} |
| Open Issues | ${stats.openIssues} |
| Resolved Issues | ${stats.resolvedIssues} |
| Critical Issues | ${stats.bySeverity.critical || 0} |
| Average Resolution Time | ${stats.averageResolutionTime || 'N/A'} minutes |

## 📈 Breakdown

### By Severity
${Object.entries(stats.bySeverity).map(([severity, count]) => `- **${severity.toUpperCase()}**: ${count}`).join('\n')}

### By Category
${Object.entries(stats.byCategory).map(([category, count]) => `- **${category}**: ${count}`).join('\n')}

### By Status
${Object.entries(stats.byStatus).map(([status, count]) => `- **${status.toUpperCase()}**: ${count}`).join('\n')}

${criticalIssues.length > 0 ? `
## 🔴 Critical Issues

${criticalIssues.map(issue => this.renderIssueMarkdown(issue)).join('\n\n')}
` : ''}

${openIssues.length > 0 ? `
## 📋 Open Issues

${openIssues.map(issue => this.renderIssueMarkdown(issue)).join('\n\n')}
` : ''}

## 📋 All Issues

${issues.map(issue => this.renderIssueMarkdown(issue)).join('\n\n')}
`;
    }
    renderIssueMarkdown(issue) {
        return `### ${issue.id} - ${issue.description}

- **Method**: \`${issue.method}\`
- **Category**: ${issue.category}
- **Severity**: ${issue.severity.toUpperCase()}
- **Status**: ${issue.status.toUpperCase()}
- **Expected**: ${issue.expectedBehavior}
- **Actual**: ${issue.actualBehavior}
- **Created**: ${new Date(issue.createdAt).toLocaleString()}
${issue.resolvedAt ? `- **Resolved**: ${new Date(issue.resolvedAt).toLocaleString()}` : ''}

${issue.reproductionSteps.length > 0 ? `
**Reproduction Steps**:
${issue.reproductionSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}
` : ''}

${issue.errorDetails ? `
**Error Details**:
\`\`\`json
${JSON.stringify(issue.errorDetails, null, 2)}
\`\`\`
` : ''}`;
    }
    generateIssueId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `AEM-${timestamp}-${random}`.toUpperCase();
    }
    exportIssues(filePath, format = 'json') {
        const report = this.generateReport(format);
        const extension = format === 'html' ? 'html' : format === 'markdown' ? 'md' : 'json';
        const fullPath = filePath.endsWith(`.${extension}`) ? filePath : `${filePath}.${extension}`;
        writeFileSync(fullPath, report, 'utf8');
        console.log(`📄 Issue report exported to: ${fullPath}`);
    }
    clearResolvedIssues() {
        const initialCount = this.issues.length;
        this.issues = this.issues.filter(issue => issue.status !== 'resolved' && issue.status !== 'closed');
        const removedCount = initialCount - this.issues.length;
        if (removedCount > 0) {
            this.saveIssues();
            console.log(`🗑️  Cleared ${removedCount} resolved/closed issues`);
        }
        return removedCount;
    }
    bulkUpdateIssues(filter, updates) {
        const issuesToUpdate = this.getIssues(filter);
        let updatedCount = 0;
        issuesToUpdate.forEach(issue => {
            if (this.updateIssue(issue.id, updates)) {
                updatedCount++;
            }
        });
        console.log(`📝 Bulk updated ${updatedCount} issues`);
        return updatedCount;
    }
}
export default IssueTracker;
//# sourceMappingURL=issue-tracker.js.map