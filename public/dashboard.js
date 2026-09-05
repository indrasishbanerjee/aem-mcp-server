class AEMDashboard {
    constructor() {
        this.methods = [];
        this.currentMethod = null;
        this.currentCategory = 'all';
        this.init();
    }

    async init() {
        this.restoreAuth();
        document.getElementById('saveAuthBtn')?.addEventListener('click', () => this.saveAuth());
        await this.loadMethods();
        this.setupEventListeners();
        this.checkHealth();
        setInterval(() => this.checkHealth(), 30000);
    }

    restoreAuth() {
        const apiKey = document.getElementById('mcpApiKey');
        const user = document.getElementById('mcpUser');
        const pass = document.getElementById('mcpPass');
        if (apiKey) apiKey.value = sessionStorage.getItem('mcpApiKey') || '';
        if (user) user.value = sessionStorage.getItem('mcpUser') || '';
        if (pass) pass.value = sessionStorage.getItem('mcpPass') || '';
    }

    saveAuth() {
        sessionStorage.setItem('mcpApiKey', document.getElementById('mcpApiKey')?.value || '');
        sessionStorage.setItem('mcpUser', document.getElementById('mcpUser')?.value || '');
        sessionStorage.setItem('mcpPass', document.getElementById('mcpPass')?.value || '');
        this.loadMethods();
    }

    authHeaders(extra = {}) {
        const headers = { ...extra };
        const apiKey = sessionStorage.getItem('mcpApiKey');
        const user = sessionStorage.getItem('mcpUser');
        const pass = sessionStorage.getItem('mcpPass');
        if (apiKey) {
            headers['X-API-Key'] = apiKey;
        } else if (user && pass) {
            headers['Authorization'] = 'Basic ' + btoa(`${user}:${pass}`);
        }
        return headers;
    }

    async loadMethods() {
        try {
            const response = await fetch('/api/methods', { headers: this.authHeaders() });
            const data = await response.json();
            
            if (data.success) {
                this.methods = this.flattenMethods(data.data.methods);
                this.renderCategories(data.data.categories);
                this.renderMethods();
            } else {
                this.showError('Failed to load methods: ' + data.error.message);
            }
        } catch (error) {
            this.showError('Failed to load methods: ' + error.message);
        }
    }

    flattenMethods(categorizedMethods) {
        const methods = [];
        for (const [category, categoryMethods] of Object.entries(categorizedMethods)) {
            categoryMethods.forEach(method => {
                methods.push({
                    ...method,
                    category: category
                });
            });
        }
        return methods;
    }

    renderCategories(categories) {
        const container = document.getElementById('categoryFilters');
        const allButton = container.querySelector('[data-category="all"]');
        
        categories.forEach(category => {
            const button = document.createElement('button');
            button.className = 'category-btn';
            button.dataset.category = category;
            button.textContent = this.formatCategoryName(category);
            container.appendChild(button);
        });
    }

    formatCategoryName(category) {
        return category.charAt(0).toUpperCase() + category.slice(1).replace(/([A-Z])/g, ' $1');
    }

    renderMethods() {
        const container = document.getElementById('methodsList');
        const filteredMethods = this.getFilteredMethods();
        
        if (filteredMethods.length === 0) {
            container.innerHTML = '<div class="loading">No methods found</div>';
            return;
        }

        container.innerHTML = filteredMethods.map(method => `
            <div class="method-item" data-method="${method.name}">
                <div class="method-item-name">${method.name}</div>
                <div class="method-item-description">${method.description}</div>
                <div class="method-item-category">${this.formatCategoryName(method.category)}</div>
            </div>
        `).join('');
    }

    getFilteredMethods() {
        let filtered = this.methods;
        
        // Filter by category
        if (this.currentCategory !== 'all') {
            filtered = filtered.filter(method => method.category === this.currentCategory);
        }
        
        // Filter by search
        const searchTerm = document.getElementById('methodSearch').value.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(method => 
                method.name.toLowerCase().includes(searchTerm) ||
                method.description.toLowerCase().includes(searchTerm)
            );
        }
        
        return filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    setupEventListeners() {
        // Category filters
        document.getElementById('categoryFilters').addEventListener('click', (e) => {
            if (e.target.classList.contains('category-btn')) {
                document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                this.currentCategory = e.target.dataset.category;
                this.renderMethods();
            }
        });

        // Method search
        document.getElementById('methodSearch').addEventListener('input', () => {
            this.renderMethods();
        });

        // Method selection
        document.getElementById('methodsList').addEventListener('click', (e) => {
            const methodItem = e.target.closest('.method-item');
            if (methodItem) {
                document.querySelectorAll('.method-item').forEach(item => item.classList.remove('active'));
                methodItem.classList.add('active');
                this.selectMethod(methodItem.dataset.method);
            }
        });

        // Execute button
        document.getElementById('executeBtn').addEventListener('click', () => {
            this.executeMethod();
        });

        // Clear button
        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearParameters();
        });

        // Response tabs
        document.querySelector('.response-tabs').addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-btn')) {
                document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                
                e.target.classList.add('active');
                document.getElementById(e.target.dataset.tab + 'Response').classList.add('active');
            }
        });

        // Footer buttons
        document.getElementById('testRunnerBtn').addEventListener('click', () => {
            this.showTestRunner();
        });

        document.getElementById('healthBtn').addEventListener('click', () => {
            this.checkHealth(true);
        });

        document.getElementById('helpBtn').addEventListener('click', () => {
            this.showHelp();
        });
    }

    async selectMethod(methodName) {
        this.currentMethod = this.methods.find(m => m.name === methodName);
        if (!this.currentMethod) return;

        // Hide welcome screen, show method details
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('methodDetails').style.display = 'block';
        document.getElementById('testRunner').style.display = 'none';

        // Update method details
        document.getElementById('methodName').textContent = this.currentMethod.name;
        document.getElementById('methodCategory').textContent = this.formatCategoryName(this.currentMethod.category);
        document.getElementById('methodDescription').textContent = this.currentMethod.description;

        // Render parameters
        this.renderParameters();
        
        // Clear previous responses
        this.clearResponse();
    }

    renderParameters() {
        const container = document.getElementById('parametersContainer');
        
        if (!this.currentMethod.parameters || this.currentMethod.parameters.length === 0) {
            container.innerHTML = '<p class="no-params">No parameters required</p>';
            return;
        }

        container.innerHTML = this.currentMethod.parameters.map(param => `
            <div class="parameter-group">
                <label class="parameter-label">
                    ${param}
                    ${this.isRequiredParameter(param) ? '<span class="required-indicator">*</span>' : ''}
                </label>
                <div class="parameter-description">${this.getParameterDescription(param)}</div>
                ${param === 'template' && this.currentMethod.name === 'createPage' ? 
                    `<div class="template-selector">
                        <input 
                            type="text" 
                            class="parameter-input" 
                            data-param="${param}"
                            placeholder="${this.getParameterPlaceholder(param)}"
                        />
                        <button class="btn btn-small template-select-btn">Select Template</button>
                    </div>` :
                    `<input 
                        type="text" 
                        class="parameter-input" 
                        data-param="${param}"
                        placeholder="${this.getParameterPlaceholder(param)}"
                        ${this.isObjectParameter(param) ? 'data-type="object"' : ''}
                    />`
                }
            </div>
        `).join('');

        // Convert object parameters to textareas
        container.querySelectorAll('[data-type="object"]').forEach(input => {
            const textarea = document.createElement('textarea');
            textarea.className = 'parameter-input textarea';
            textarea.dataset.param = input.dataset.param;
            textarea.placeholder = input.placeholder;
            textarea.value = '{}';
            input.parentNode.replaceChild(textarea, input);
        });

        // Add template selection functionality
        if (this.currentMethod.name === 'createPage') {
            const templateSelectBtn = container.querySelector('.template-select-btn');
            if (templateSelectBtn) {
                templateSelectBtn.addEventListener('click', () => this.showTemplateSelector());
            }
        }
    }

    async showTemplateSelector() {
        // Get the parent path to fetch available templates
        const parentPathInput = document.querySelector('[data-param="parentPath"]');
        const parentPath = parentPathInput ? parentPathInput.value : '/content';
        
        if (!parentPath) {
            alert('Please enter a parent path first to load available templates');
            return;
        }

        const loadingOverlay = document.getElementById('loadingOverlay');
        loadingOverlay.style.display = 'flex';
        
        try {
            // Fetch available templates for the path
            const response = await fetch('/api/methods/getTemplates', {
                method: 'POST',
                headers: this.authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ sitePath: parentPath })
            });

            const result = await response.json();
            loadingOverlay.style.display = 'none';
            
            if (!result.success || !result.data || !result.data.templates || result.data.templates.length === 0) {
                alert('No templates available for this path. Please check the path or try another location.');
                return;
            }

            // Show template selection dialog
            this.displayTemplateSelector(result.data.templates);
            
        } catch (error) {
            loadingOverlay.style.display = 'none';
            alert('Failed to fetch templates: ' + error.message);
        }
    }

    displayTemplateSelector(templates) {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'template-modal';
        
        // Create template list
        const templateList = templates.map(template => `
            <div class="template-item" data-path="${template.path}">
                <div class="template-name">${template.title || template.name}</div>
                <div class="template-path">${template.path}</div>
                ${template.description ? `<div class="template-description">${template.description}</div>` : ''}
            </div>
        `).join('');
        
        modal.innerHTML = `
            <div class="template-modal-content">
                <div class="template-modal-header">
                    <h3>Select Template</h3>
                    <button class="template-modal-close">&times;</button>
                </div>
                <div class="template-modal-body">
                    <div class="template-list">
                        ${templateList}
                    </div>
                </div>
                <div class="template-modal-footer">
                    <button class="btn btn-secondary template-modal-cancel">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners
        modal.querySelector('.template-modal-close').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.querySelector('.template-modal-cancel').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.querySelectorAll('.template-item').forEach(item => {
            item.addEventListener('click', () => {
                const templatePath = item.dataset.path;
                document.querySelector('[data-param="template"]').value = templatePath;
                document.body.removeChild(modal);
            });
        });
    }

    isRequiredParameter(param) {
        // Basic heuristics for required parameters
        const requiredParams = ['pagePath', 'componentPath', 'parentPath', 'title', 'template', 'assetPath', 'query'];
        return requiredParams.includes(param);
    }

    getParameterDescription(param) {
        const descriptions = {
            'pagePath': 'Full path to the AEM page (e.g., /content/mysite/en/home)',
            'componentPath': 'Full path to the component (e.g., /content/mysite/en/home/jcr:content/root/container/text)',
            'parentPath': 'Parent path where content will be created',
            'title': 'Title for the page or content',
            'template': 'Template path (e.g., /conf/mysite/settings/wcm/templates/page-template)',
            'properties': 'JSON object with component properties',
            'siteRoot': 'Root path to search from (defaults to /content)',
            'depth': 'Maximum depth to traverse (default: 1)',
            'limit': 'Maximum number of results (default: 20)',
            'fulltext': 'Text to search for',
            'type': 'JCR node type (e.g., cq:Page, dam:Asset)',
            'path': 'JCR path to query',
            'query': 'Search query string',
            'assetPath': 'Path to the asset in DAM',
            'fileName': 'Name of the file to upload',
            'fileContent': 'Base64 encoded file content or file path',
            'mimeType': 'MIME type of the file',
            'metadata': 'JSON object with asset metadata'
        };
        return descriptions[param] || 'Parameter for the method';
    }

    getParameterPlaceholder(param) {
        const placeholders = {
            'pagePath': '/content/mysite/en/home',
            'componentPath': '/content/mysite/en/home/jcr:content/root/container/text',
            'parentPath': '/content/mysite/en',
            'title': 'My New Page',
            'template': '/conf/mysite/settings/wcm/templates/page-template',
            'properties': '{"text": "Hello World"}',
            'siteRoot': '/content/mysite',
            'depth': '2',
            'limit': '10',
            'fulltext': 'search term',
            'type': 'cq:Page',
            'path': '/content',
            'query': 'product',
            'assetPath': '/content/dam/mysite/image.jpg',
            'fileName': 'image.jpg',
            'fileContent': 'data:image/jpeg;base64,...',
            'mimeType': 'image/jpeg',
            'metadata': '{"dc:title": "My Image"}'
        };
        return placeholders[param] || '';
    }

    isObjectParameter(param) {
        return ['properties', 'metadata'].includes(param);
    }

    async executeMethod() {
        if (!this.currentMethod) return;

        const parameters = this.collectParameters();
        const loadingOverlay = document.getElementById('loadingOverlay');
        
        try {
            loadingOverlay.style.display = 'flex';
            
            const response = await fetch(`/api/methods/${this.currentMethod.name}`, {
                method: 'POST',
                headers: this.authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(parameters)
            });

            const result = await response.json();
            this.displayResponse(result, parameters);
            
        } catch (error) {
            this.displayResponse({
                success: false,
                error: {
                    code: 'NETWORK_ERROR',
                    message: error.message
                }
            }, parameters);
        } finally {
            loadingOverlay.style.display = 'none';
        }
    }

    collectParameters() {
        const parameters = {};
        const inputs = document.querySelectorAll('.parameter-input');
        
        inputs.forEach(input => {
            const param = input.dataset.param;
            let value = input.value.trim();
            
            if (value) {
                // Try to parse JSON for object parameters
                if (input.dataset.type === 'object') {
                    try {
                        value = JSON.parse(value);
                    } catch (e) {
                        // Keep as string if JSON parsing fails
                    }
                } else if (!isNaN(value) && value !== '') {
                    // Convert numeric strings to numbers
                    const numValue = Number(value);
                    if (Number.isInteger(numValue)) {
                        value = numValue;
                    }
                }
                
                parameters[param] = value;
            }
        });
        
        return parameters;
    }

    displayResponse(result, parameters) {
        // Formatted response
        const formattedContainer = document.getElementById('formattedResponse');
        const isSuccess = result.success !== false;
        
        formattedContainer.innerHTML = `
            <div class="response-${isSuccess ? 'success' : 'error'}">
                <h4>${isSuccess ? 'Success' : 'Error'}</h4>
                <pre><code class="language-json">${JSON.stringify(result, null, 2)}</code></pre>
            </div>
        `;

        // Raw JSON response
        const rawContainer = document.getElementById('rawResponse');
        rawContainer.innerHTML = `<pre><code class="language-json">${JSON.stringify(result, null, 2)}</code></pre>`;

        // cURL example
        const curlContainer = document.getElementById('curlExample');
        const curlCommand = this.generateCurlCommand(parameters);
        curlContainer.innerHTML = `<pre><code class="language-bash">${curlCommand}</code></pre>`;

        // Trigger syntax highlighting
        if (window.Prism) {
            Prism.highlightAll();
        }
    }

    generateCurlCommand(parameters) {
        const baseUrl = window.location.origin;

        return `# Streamable HTTP MCP (API key)
curl -H "X-API-Key: $MCP_API_KEY" \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' \\
  -X POST ${baseUrl}/mcp \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"${this.currentMethod.name}","arguments":${JSON.stringify(parameters)}}}'

# Convenience REST
curl -H "X-API-Key: $MCP_API_KEY" \\
  -X POST ${baseUrl}/api/methods/${this.currentMethod.name} \\
  -H 'Content-Type: application/json' \\
  -d '${JSON.stringify(parameters, null, 2)}'`;
    }

    clearParameters() {
        document.querySelectorAll('.parameter-input').forEach(input => {
            if (input.dataset.type === 'object') {
                input.value = '{}';
            } else {
                input.value = '';
            }
        });
        this.clearResponse();
    }

    clearResponse() {
        document.getElementById('formattedResponse').innerHTML = '<div class="response-placeholder">Execute a method to see the response here</div>';
        document.getElementById('rawResponse').innerHTML = '<pre><code class="language-json">Execute a method to see raw JSON response</code></pre>';
        document.getElementById('curlExample').innerHTML = '<pre><code class="language-bash">Execute a method to see cURL example</code></pre>';
    }

    async checkHealth(showAlert = false) {
        try {
            const response = await fetch('/health/live');
            const health = await response.json();
            
            const indicator = document.getElementById('healthIndicator');
            const statusDot = indicator.querySelector('.status-dot');
            const statusText = indicator.querySelector('.status-text');
            
            if (health.status === 'ok' || health.status === 'healthy') {
                statusDot.className = 'status-dot healthy';
                statusText.textContent = 'Healthy';
            } else {
                statusDot.className = 'status-dot unhealthy';
                statusText.textContent = 'Degraded';
            }
            
            if (showAlert) {
                alert(`System Status: ${health.status}\nAEM Connected: ${health.aem.connected}\nMethods Available: ${health.mcp.methodCount}`);
            }
            
        } catch (error) {
            const indicator = document.getElementById('healthIndicator');
            const statusDot = indicator.querySelector('.status-dot');
            const statusText = indicator.querySelector('.status-text');
            
            statusDot.className = 'status-dot unhealthy';
            statusText.textContent = 'Error';
            
            if (showAlert) {
                alert('Health check failed: ' + error.message);
            }
        }
    }

    showTestRunner() {
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('methodDetails').style.display = 'none';
        document.getElementById('testRunner').style.display = 'block';
    }

    showHelp() {
        const helpText = `AEM MCP Server Dashboard Help

This dashboard provides an interactive interface to explore and test all available AEM MCP methods.

Getting Started:
1. Select a method category from the sidebar
2. Choose a specific method to see its details
3. Fill in the required parameters
4. Click "Execute Method" to test it

Features:
- 35+ AEM operations for pages, components, assets, and more
- Real-time parameter validation
- Formatted response display with syntax highlighting
- cURL command generation for external use
- Health monitoring and status checking

Tips:
- Required parameters are marked with *
- Object parameters expect JSON format
- Use the search box to quickly find methods
- Check the health indicator for system status

For more information, visit the API documentation or check the project README.`;
        
        alert(helpText);
    }

    showError(message) {
        console.error(message);
        // You could implement a toast notification system here
        alert('Error: ' + message);
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AEMDashboard();
});