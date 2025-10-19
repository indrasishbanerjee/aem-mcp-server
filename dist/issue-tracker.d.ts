export interface Issue {
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    method: string;
    description: string;
    reproductionSteps: string[];
    expectedBehavior: string;
    actualBehavior: string;
    errorDetails?: any;
    status: 'open' | 'in-progress' | 'resolved' | 'closed';
    createdAt: string;
    resolvedAt?: string;
    testCaseId?: string;
    assignee?: string;
    tags?: string[];
    relatedIssues?: string[];
}
export interface IssueFilter {
    severity?: 'critical' | 'high' | 'medium' | 'low';
    category?: string;
    method?: string;
    status?: 'open' | 'in-progress' | 'resolved' | 'closed';
    assignee?: string;
    tags?: string[];
}
export interface IssueStats {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
    byMethod: Record<string, number>;
    openIssues: number;
    resolvedIssues: number;
    averageResolutionTime?: number;
}
export declare class IssueTracker {
    private issues;
    private filePath;
    constructor(filePath?: string);
    private loadIssues;
    private saveIssues;
    createIssue(issueData: Omit<Issue, 'id' | 'createdAt' | 'status'>): Issue;
    updateIssue(issueId: string, updates: Partial<Issue>): Issue | null;
    resolveIssue(issueId: string, resolution?: string): Issue | null;
    closeIssue(issueId: string): Issue | null;
    getIssue(issueId: string): Issue | null;
    getIssues(filter?: IssueFilter): Issue[];
    getOpenIssues(): Issue[];
    getCriticalIssues(): Issue[];
    getIssuesByMethod(method: string): Issue[];
    getIssuesByCategory(category: string): Issue[];
    getStats(): IssueStats;
    generateReport(format?: 'json' | 'html' | 'markdown'): string;
    private generateHtmlReport;
    private renderIssueHtml;
    private generateMarkdownReport;
    private renderIssueMarkdown;
    private generateIssueId;
    exportIssues(filePath: string, format?: 'json' | 'html' | 'markdown'): void;
    clearResolvedIssues(): number;
    bulkUpdateIssues(filter: IssueFilter, updates: Partial<Issue>): number;
}
export default IssueTracker;
//# sourceMappingURL=issue-tracker.d.ts.map