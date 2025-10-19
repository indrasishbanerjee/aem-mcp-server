Reach out to me on [LinkedIn](https://www.linkedin.com/in/indrasish/) or [Email Me](mailto:indrasish00@gmail.com) to discuss customizations !

> **💡 For users interested in MCP server for AEM as a Cloud Service, check out my other GitHub project:** [**AEMaaCS MCP Server**](https://github.com/indrasishbanerjee/aemaacs-mcp-server) - A comprehensive read and write MCP server specifically designed for AEM as a Cloud Service with advanced features and enterprise-grade capabilities.

> **LICENSE UPDATE** : This project is now licensed under [AGPL-V3](LICENSE) 

# AEM MCP Server (aem-mcp-server)

[![Node.js CI](https://img.shields.io/badge/node-%3E=18-blue.svg)](https://nodejs.org/)
[![AEM Compatible](https://img.shields.io/badge/aem-6.5%2B-blue.svg)](https://www.adobe.com/marketing-cloud/experience-manager.html)
[![TypeScript](https://img.shields.io/badge/typescript-5.8%2B-blue.svg)](https://www.typescriptlang.org/)
[![MCP Protocol](https://img.shields.io/badge/MCP-1.15.0-green.svg)](https://modelcontextprotocol.io/)

AEM MCP Server is a comprehensive, production-ready Model Context Protocol (MCP) server for Adobe Experience Manager (AEM). It provides 35+ robust REST/JSON-RPC API methods for complete content, component, asset, and template management, with advanced integrations for AI, chatbots, and automation workflows. This project is designed for AEM developers, content teams, and automation engineers who want to manage AEM programmatically or via natural language interfaces.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Usage Examples](#usage-examples)
- [Configuration](#configuration)
- [API & Client Usage](#api--client-usage)
- [AI IDE Integration (Cursor, Cline, etc.)](#ai-ide-integration-cursor-cline-etc)
- [Security](#security)
- [Project Structure](#project-structure)
- [Integrations](#integrations)
- [Contribution](#contribution)
- [License](#license)

---

## Overview
- **Modern, TypeScript-based AEM MCP server**
- **REST/JSON-RPC API** for AEM content, component, and asset operations
- **AI/LLM integration** (OpenAI, Anthropic, Ollama, custom HTTP APIs)
- **Telegram bot** for conversational AEM management
- **Production-ready, modular, and extensible**

---

## Features

### 🚀 Core Capabilities (35+ Methods)

#### Page Operations (10 methods)
- **Page Lifecycle**: Create, delete, activate/deactivate pages with proper template integration
- **Content Management**: Get page content, properties, text extraction, and image management
- **Page Discovery**: List pages with depth control, pagination, and filtering
- **Publishing**: Activate/deactivate pages with tree operations

#### Component Operations (7 methods)
- **Component CRUD**: Create, update, delete, and validate components
- **Bulk Operations**: Update multiple components with validation and rollback support
- **Component Discovery**: Scan pages to discover all components and their properties
- **Image Management**: Update image paths with verification

#### Asset Operations (4 methods)
- **DAM Management**: Upload, update, delete assets in AEM DAM
- **Metadata Operations**: Get and update asset metadata
- **File Processing**: Support for multiple file types with MIME type detection

#### Search & Query Operations (3 methods)
- **Advanced Search**: QueryBuilder integration with fulltext search
- **JCR Queries**: Execute JCR SQL2-style queries with security validation
- **Enhanced Page Search**: Intelligent search with fallback strategies

#### Template Operations (2 methods)
- **Template Discovery**: Get available templates for sites and paths
- **Template Analysis**: Detailed template structure and metadata extraction

#### Site & Localization (3 methods)
- **Multi-site Management**: Fetch sites, language masters, and available locales
- **Localization Support**: Manage content across different languages and regions

#### Replication & Publishing (2 methods)
- **Content Replication**: Replicate and publish content to selected locales
- **Unpublishing**: Remove content from publish environments

#### Legacy & Utility Operations (5 methods)
- **JCR Node Access**: Direct node content access and child listing
- **System Utilities**: Method listing, status checking, and workflow management

### 🔧 Technical Features
- **REST & JSON-RPC APIs**: Dual API support for maximum compatibility
- **Interactive Dashboard**: Web-based interface for API exploration and testing
- **Comprehensive Testing**: Built-in test suite with automated issue tracking
- **Enhanced Error Handling**: Structured error responses with retry mechanisms
- **Security**: Authentication, path validation, and safe operation defaults
- **Performance**: Connection pooling, caching, and optimized queries

---

## Quick Start

### Prerequisites
- Node.js 18+
- Access to an AEM instance (local or remote)

### Installation
```sh
cd clone
npm install
```

### Build
```sh
npm run build
```

### Run (Production)
```sh
npm start
```

### Run (Development, hot reload)
```sh
npm run dev
```

---

## Usage Examples

### JSON-RPC API Examples

#### 1. List all pages under a path
```bash
curl -u admin:admin \
  -X POST http://localhost:3001/mcp \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "listPages",
    "params": {
      "siteRoot": "/content/mysite",
      "depth": 2,
      "limit": 10
    }
  }'
```

#### 2. Create a new page with template
```bash
curl -u admin:admin \
  -X POST http://localhost:3001/mcp \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "createPage",
    "params": {
      "parentPath": "/content/mysite/en",
      "title": "New Product Page",
      "template": "/conf/mysite/settings/wcm/templates/page-template"
    }
  }'
```

#### 3. Update a component property
```bash
curl -u admin:admin \
  -X POST http://localhost:3001/mcp \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "updateComponent",
    "params": {
      "componentPath": "/content/mysite/en/home/jcr:content/root/container/text",
      "properties": {
        "text": "Updated content",
        "textIsRich": true
      }
    }
  }'
```

#### 4. Search for content
```bash
curl -u admin:admin \
  -X POST http://localhost:3001/mcp \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "searchContent",
    "params": {
      "type": "cq:Page",
      "fulltext": "product",
      "path": "/content/mysite",
      "limit": 20
    }
  }'
```

#### 5. Upload an asset to DAM
```bash
curl -u admin:admin \
  -X POST http://localhost:3001/mcp \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "uploadAsset",
    "params": {
      "parentPath": "/content/dam/mysite/images",
      "fileName": "hero-image.jpg",
      "fileContent": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
      "mimeType": "image/jpeg",
      "metadata": {
        "dc:title": "Hero Image",
        "dc:description": "Main hero image for homepage"
      }
    }
  }'
```

### REST API Examples

#### 1. Get all available methods
```bash
curl -u admin:admin http://localhost:3001/api/methods
```

#### 2. Get method details
```bash
curl -u admin:admin http://localhost:3001/api/methods/createPage
```

#### 3. Execute method via REST
```bash
curl -u admin:admin \
  -X POST http://localhost:3001/api/methods/listPages \
  -H 'Content-Type: application/json' \
  -d '{
    "siteRoot": "/content/mysite",
    "depth": 1,
    "limit": 10
  }'
```

### Method Categories and Examples

#### Page Operations
- `createPage` - Create pages with proper template integration
- `deletePage` - Remove pages with force option
- `listPages` - List pages with depth and pagination
- `getPageContent` - Extract complete page content
- `getPageProperties` - Get page metadata and properties
- `activatePage` / `deactivatePage` - Publish/unpublish pages
- `getAllTextContent` / `getPageTextContent` - Extract text content
- `getPageImages` - Extract image references

#### Component Operations
- `validateComponent` - Validate component changes before applying
- `updateComponent` - Update component properties with verification
- `scanPageComponents` - Discover all components on a page
- `createComponent` - Add new components to pages
- `deleteComponent` - Remove components
- `updateImagePath` - Update image component references
- `bulkUpdateComponents` - Update multiple components atomically

#### Asset Operations
- `uploadAsset` - Upload files to DAM with metadata
- `updateAsset` - Update asset metadata and content
- `deleteAsset` - Remove assets from DAM
- `getAssetMetadata` - Retrieve asset metadata

#### Search Operations
- `searchContent` - Query Builder search with flexible parameters
- `executeJCRQuery` - Execute JCR queries (QueryBuilder wrapper)
- `enhancedPageSearch` - Intelligent page search with fallbacks

#### Template Operations
- `getTemplates` - List available templates for sites
- `getTemplateStructure` - Get detailed template structure

#### Site & Localization
- `fetchSites` - Get all available sites
- `fetchLanguageMasters` - Get language masters for sites
- `fetchAvailableLocales` - Get available locales

### Interactive Dashboard
Access the web dashboard at `http://localhost:3001/dashboard` for:
- Interactive method testing
- Parameter validation
- Response visualization
- API documentation
- Batch testing capabilities

---

## Configuration

### Environment Variables
Create a `.env` file in the project root with the following (edit as needed):

```
AEM_HOST=http://localhost:4502
AEM_SERVICE_USER=admin
AEM_SERVICE_PASSWORD=admin
MCP_PORT=8080
GATEWAY_PORT=3001
MCP_USERNAME=admin
MCP_PASSWORD=admin
```

### MCP Client Configuration
Sample for AI-based code editors or custom clients:

```json
{
  "mcpServers": {
    "aem-mcp": {
      "command": "node",
      "args": [
        "absolute path to dist/mcp-server.js"
      ]
    }
  }
}
```

### Advanced Configuration Options
```
# Optional: Advanced AEM Configuration
AEM_SITES_ROOT=/content
AEM_ASSETS_ROOT=/content/dam
AEM_TEMPLATES_ROOT=/conf
AEM_XF_ROOT=/content/experience-fragments
AEM_PUBLISHER_URLS=http://localhost:4503
AEM_DEFAULT_AGENT=publish
AEM_ALLOWED_COMPONENTS=text,image,hero,button,list,teaser,carousel
AEM_QUERY_MAX_LIMIT=100
AEM_QUERY_DEFAULT_LIMIT=20
AEM_QUERY_TIMEOUT=30000
AEM_MAX_DEPTH=5

# Optional: AI Integration (if needed)
# OPENAI_API_KEY=your-openai-key
# TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

---

## API & Client Usage
- **REST/JSON-RPC**: Exposes all AEM operations via HTTP endpoints
- **Supported Operations**: Page/asset CRUD, component validation/update, search, rollout, publish, text/image extraction, and more
- **AI/LLM**: Send natural language commands to the server (via API or Telegram)
- **Telegram Bot**: Connect your bot using `TELEGRAM_BOT_TOKEN` and chat with your AEM instance

---

## AI IDE Integration (Cursor, Cline, etc.)

AEM MCP Server is compatible with modern AI IDEs and code editors that support MCP protocol, such as **Cursor** and **Cline**.

### How to Connect:
1. **Install and run the AEM MCP Server** as described above.
2. **Configure your IDE** to connect to the MCP server. Example for Cursor/Cline:
   - Open your IDE's MCP server settings.
   - Add a new server with:
     - **Type:** Custom MCP
     - **Command:** `node`
     - **Args:** `["/absolute/path/to/dist/mcp-server.js"]`
     - **Port:** `8080` (or as configured)
     - **Auth:** Use `MCP_USERNAME`/`MCP_PASSWORD` from your `.env`
3. **Restart your IDE** and connect. The IDE will now be able to:
   - List, search, and manage AEM content
   - Run MCP methods (CRUD, search, rollout, etc.)
   - Use AI/LLM features if enabled

### Custom MCP Clients
- You can build your own MCP client in any language that supports HTTP/JSON-RPC.
- See the [Usage Examples](#usage-examples) for API call patterns.
- Authenticate using basic auth (`MCP_USERNAME`/`MCP_PASSWORD`).
- All MCP methods are available via the `/api` endpoint.

---

## Security
- Auth required for all operations (see `MCP_USERNAME`/`MCP_PASSWORD`)
- Environment-based configuration for safe deployment
- All destructive operations require explicit parameters and validation

---

## Project Structure
- `src/` — TypeScript source code
- `dist/` — Compiled JS output

---

## Integrations
- **AI/LLM**: OpenAI, Anthropic, Ollama, custom HTTP APIs
- **Telegram**: Chat-based AEM management

---

## Contribution
Contributions are welcome! Please open issues or pull requests for bug fixes, features, or documentation improvements.

---

## Troubleshooting

### Common Issues

#### Connection Issues
```bash
# Test AEM connection
curl -u admin:admin http://localhost:4502/libs/granite/core/content/login.html

# Check server health
curl http://localhost:3001/health
```

#### Authentication Problems
- Verify AEM credentials in `.env` file
- Check MCP_USERNAME and MCP_PASSWORD for API access
- Ensure AEM user has sufficient permissions

#### Page Creation Issues
- **Empty pages without jcr:content**: Use proper template parameter
- **Pages not visible in Author**: Ensure template exists and is valid
- **Template not found**: Verify template path and permissions

#### Component Update Failures
- **Component not found**: Verify component path exists
- **Update failed**: Check component properties and validation
- **Permission denied**: Ensure user has write access

### Performance Optimization
- Use pagination with `limit` parameter for large result sets
- Set appropriate `depth` values for page listing
- Configure `AEM_QUERY_TIMEOUT` for slow queries
- Use bulk operations for multiple component updates

### Debugging
```bash
# Enable debug logging
DEBUG=aem-mcp:* npm run dev

# Check detailed health status
curl http://localhost:3001/health

# List all available methods
curl -u admin:admin http://localhost:3001/api/methods
```

## Common Use Cases

### Content Migration
```javascript
// 1. List source pages
const pages = await listPages({ siteRoot: '/content/source', depth: 3 });

// 2. Create target pages with templates
for (const page of pages.data.pages) {
  await createPage({
    parentPath: '/content/target',
    title: page.title,
    template: '/conf/target/settings/wcm/templates/page'
  });
}

// 3. Copy components
const components = await scanPageComponents({ pagePath: sourcePage });
for (const component of components.data.components) {
  await createComponent({
    pagePath: targetPage,
    componentType: component.resourceType,
    properties: component.properties
  });
}
```

### Bulk Content Updates
```javascript
// Update multiple text components
const updates = [
  {
    componentPath: '/content/site/page1/jcr:content/text1',
    properties: { text: 'Updated content 1' }
  },
  {
    componentPath: '/content/site/page2/jcr:content/text2',
    properties: { text: 'Updated content 2' }
  }
];

await bulkUpdateComponents({
  updates,
  validateFirst: true,
  continueOnError: false
});
```

### Asset Management Workflow
```javascript
// 1. Upload assets
await uploadAsset({
  parentPath: '/content/dam/project',
  fileName: 'hero.jpg',
  fileContent: base64Content,
  metadata: { 'dc:title': 'Hero Image' }
});

// 2. Update page to use new asset
await updateComponent({
  componentPath: '/content/site/home/jcr:content/hero',
  properties: { fileReference: '/content/dam/project/hero.jpg' }
});

// 3. Publish changes
await activatePage({ pagePath: '/content/site/home' });
```

### Search and Discovery
```javascript
// Find pages by content
const results = await searchContent({
  type: 'cq:Page',
  fulltext: 'product launch',
  path: '/content/mysite'
});

// Get detailed page information
for (const result of results.data.results) {
  const content = await getPageContent({ pagePath: result.path });
  const components = await scanPageComponents({ pagePath: result.path });
}
```

## API Reference

### Authentication
All API endpoints require HTTP Basic Authentication:
```
Authorization: Basic base64(username:password)
```

### Response Format
All responses follow this structure:
```json
{
  "success": true,
  "operation": "methodName",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "data": {
    // Method-specific response data
  }
}
```

### Error Handling
Error responses include structured information:
```json
{
  "success": false,
  "operation": "methodName",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {},
    "recoverable": true,
    "retryAfter": 5000
  }
}
```

#### Error Handling Best Practices

The AEM MCP Server follows REST API best practices by returning HTTP 200 status codes with structured error information in the response body. This approach provides several benefits:

1. **Consistent Response Format**: All responses, whether successful or not, follow the same JSON structure
2. **Detailed Error Information**: Error responses include specific codes, messages, and details
3. **Client-Side Processing**: Clients can easily parse and handle errors programmatically
4. **Recoverable vs. Fatal Errors**: The `recoverable` flag indicates if retrying might succeed
5. **Retry Guidance**: When appropriate, `retryAfter` suggests a wait time before retrying

##### Example Error Handling in Client Code:

```javascript
async function callMcpMethod(method, params) {
  const response = await fetch(`/api/methods/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  
  const result = await response.json();
  
  if (!result.success) {
    // Handle error based on error code and details
    console.error(`Error in ${method}:`, result.error.message);
    
    if (result.error.recoverable && result.error.retryAfter) {
      // Implement retry logic
      console.log(`Retrying after ${result.error.retryAfter}ms`);
      await new Promise(resolve => setTimeout(resolve, result.error.retryAfter));
      return callMcpMethod(method, params); // Recursive retry
    }
    
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  
  return result.data;
}
```

##### Common Error Codes:

| Error Code | Description | Recoverable |
|------------|-------------|------------|
| `INVALID_PARAMS` | Missing or invalid parameters | No |
| `PATH_NOT_FOUND` | Specified path does not exist | No |
| `PERMISSION_DENIED` | Insufficient permissions | No |
| `TEMPLATE_NOT_FOUND` | Template does not exist | No |
| `COMPONENT_NOT_FOUND` | Component does not exist | No |
| `NETWORK_ERROR` | Connection to AEM failed | Yes |
| `TIMEOUT` | Operation timed out | Yes |
| `RESOURCE_LOCKED` | Resource is locked by another process | Yes |
| `SERVER_BUSY` | Server is under heavy load | Yes |
| `VALIDATION_FAILED` | Content validation failed | No |

## License
[AGPL-V3](LICENSE) 






