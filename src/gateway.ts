/**
 * AEM MCP Server
 * Copyright (C) 2025 Indra
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 * 
 * For commercial licensing options, please contact: indrasish00@gmail.com
 * See COMMERCIAL_LICENSE.md for details.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { AEMConnector } from './aem-connector.js';
import { MCPRequestHandler } from './mcp-handler.js';
import { logger, loggingMiddleware, generateRequestId } from './logger.js';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';
// import llmRouter from './llm-integration.js';
// import telegramIntegration from './telegram-integration.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const MCP_PORT = parseInt(process.env.MCP_PORT || '8080', 10);
const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT || '3000', 10);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, '../public')));
app.use(loggingMiddleware);

const basicAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
  const [username, password] = credentials.split(':');
  const validUsername = process.env.MCP_USERNAME || 'admin';
  const validPassword = process.env.MCP_PASSWORD || 'admin';
  if (username !== validUsername || password !== validPassword) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  next();
};

if (process.env.MCP_USERNAME && process.env.MCP_PASSWORD) {
  app.use('/mcp', basicAuth);
}

const aemConnector = new AEMConnector();
const mcpHandler = new MCPRequestHandler(aemConnector);

// Method validation middleware
const validateMethod = (req: Request, res: Response, next: NextFunction) => {
  const { method, params } = req.body;
  
  if (!method || typeof method !== 'string') {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_METHOD',
        message: 'Method name is required and must be a string',
        timestamp: new Date().toISOString()
      }
    });
    return;
  }
  
  const availableMethods = mcpHandler.getAvailableMethods();
  const methodExists = availableMethods.some(m => m.name === method);
  
  if (!methodExists) {
    res.status(404).json({
      success: false,
      error: {
        code: 'METHOD_NOT_FOUND',
        message: `Method '${method}' not found`,
        availableMethods: availableMethods.map(m => m.name),
        timestamp: new Date().toISOString()
      }
    });
    return;
  }
  
  next();
};

// Enhanced error handling middleware
const handleError = (error: any, req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).requestId || generateRequestId();
  
  logger.error('Gateway Error', {
    requestId,
    method: req.method,
    error,
    metadata: {
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      body: req.body
    }
  });
  
  const errorResponse = {
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      requestId
    }
  };
  
  if (process.env.NODE_ENV === 'development') {
    (errorResponse.error as any).stack = error.stack;
  }
  
  const statusCode = error.statusCode || error.status || 500;
  res.status(statusCode).json(errorResponse);
};

// Enhanced health check endpoint
app.get('/health', async (req, res) => {
  try {
    const aemConnected = await aemConnector.testConnection();
    const healthData = {
      status: aemConnected ? 'healthy' : 'degraded',
      aem: {
        connected: aemConnected,
        host: process.env.AEM_HOST || 'http://localhost:4502',
        lastChecked: new Date().toISOString()
      },
      mcp: {
        status: 'ready',
        methodCount: mcpHandler.getAvailableMethods().length,
        version: '1.0.0'
      },
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        ports: { gateway: GATEWAY_PORT, mcp: MCP_PORT }
      }
    };
    
    res.status(aemConnected ? 200 : 503).json(healthData);
  } catch (error: any) {
    res.status(500).json({ 
      status: 'unhealthy', 
      error: {
        message: error.message,
        code: error.code || 'HEALTH_CHECK_FAILED',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Detailed health check endpoint
app.get('/health/detailed', async (req, res) => {
  try {
    const aemConnected = await aemConnector.testConnection();
    const methods = mcpHandler.getAvailableMethods();
    
    const detailedHealth = {
      status: aemConnected ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      aem: {
        connected: aemConnected,
        host: process.env.AEM_HOST || 'http://localhost:4502',
        credentials: {
          username: process.env.AEM_SERVICE_USER || 'admin',
          configured: !!(process.env.AEM_SERVICE_USER && process.env.AEM_SERVICE_PASSWORD)
        }
      },
      mcp: {
        status: 'ready',
        methodCount: methods.length,
        methodsByCategory: methods.reduce((acc: any, method) => {
          const category = method.name.includes('Page') ? 'page' : 
                          method.name.includes('Component') ? 'component' :
                          method.name.includes('Asset') ? 'asset' : 'other';
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        }, {}),
        version: '1.0.0'
      },
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform,
        environment: process.env.NODE_ENV || 'development'
      },
      configuration: {
        gatewayPort: GATEWAY_PORT,
        mcpPort: MCP_PORT,
        authEnabled: !!(process.env.MCP_USERNAME && process.env.MCP_PASSWORD),
        corsEnabled: true
      }
    };
    
    res.status(aemConnected ? 200 : 503).json(detailedHealth);
  } catch (error: any) {
    res.status(500).json({
      status: 'unhealthy',
      error: {
        message: error.message,
        code: error.code || 'DETAILED_HEALTH_CHECK_FAILED',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/mcp', async (req, res) => {
  const requestId = (req as any).requestId;
  const startTime = Date.now();
  
  try {
    const { jsonrpc, id, method, params } = req.body;
    
    logger.methodStart(method || 'unknown', params, requestId);
    
    if (jsonrpc !== '2.0' || !method) {
      logger.warn('Invalid JSON-RPC request', {
        requestId,
        metadata: { jsonrpc, method, hasParams: !!params }
      });
      
      res.status(400).json({
        jsonrpc: '2.0',
        id: id || null,
        error: { code: -32600, message: 'Invalid Request', data: 'Must be valid JSON-RPC 2.0' },
      });
      return;
    }
    
    const result = await mcpHandler.handleRequest(method, params || {});
    const duration = Date.now() - startTime;
    
    logger.methodEnd(method, duration, true, requestId, result);
    
    res.json({ jsonrpc: '2.0', id: id || null, result });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const method = req.body?.method || 'unknown';
    
    logger.methodError(method, error, duration, requestId, req.body?.params);
    
    res.json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: { code: -32000, message: error.message || 'Internal error', data: error.stack },
    });
  }
});

app.get('/mcp/methods', async (req, res) => {
  try {
    const methods = mcpHandler.getAvailableMethods();
    res.json({ methods, total: methods.length, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// REST-style API endpoints
app.get('/api/methods', async (req, res) => {
  try {
    const methods = mcpHandler.getAvailableMethods();
    const categorizedMethods = methods.reduce((acc: any, method) => {
      const category = method.name.includes('Page') ? 'page' : 
                      method.name.includes('Component') ? 'component' :
                      method.name.includes('Asset') ? 'asset' :
                      method.name.includes('Template') ? 'template' :
                      method.name.includes('search') || method.name.includes('Search') ? 'search' :
                      method.name.includes('Site') || method.name.includes('Language') || method.name.includes('Locale') ? 'site' :
                      method.name.includes('publish') || method.name.includes('activate') || method.name.includes('replicate') ? 'replication' :
                      method.name.includes('Node') || method.name.includes('Children') ? 'legacy' : 'utility';
      
      if (!acc[category]) acc[category] = [];
      acc[category].push(method);
      return acc;
    }, {});
    
    res.json({
      success: true,
      data: {
        methods: categorizedMethods,
        totalMethods: methods.length,
        categories: Object.keys(categorizedMethods),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'METHOD_LIST_FAILED',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

app.get('/api/methods/:methodName', async (req, res) => {
  try {
    const { methodName } = req.params;
    const methods = mcpHandler.getAvailableMethods();
    const method = methods.find(m => m.name === methodName);
    
    if (!method) {
      res.status(404).json({
        success: false,
        error: {
          code: 'METHOD_NOT_FOUND',
          message: `Method '${methodName}' not found`,
          availableMethods: methods.map(m => m.name),
          timestamp: new Date().toISOString()
        }
      });
      return;
    }
    
    res.json({
      success: true,
      data: {
        method,
        examples: {
          jsonrpc: {
            method: 'POST',
            url: '/mcp',
            body: {
              jsonrpc: '2.0',
              id: 1,
              method: methodName,
              params: {}
            }
          },
          rest: {
            method: 'POST',
            url: `/api/methods/${methodName}`,
            body: {}
          }
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'METHOD_DETAILS_FAILED',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

app.post('/api/methods/:methodName', async (req, res) => {
  try {
    const { methodName } = req.params;
    const params = req.body;
    
    const methods = mcpHandler.getAvailableMethods();
    const methodExists = methods.some(m => m.name === methodName);
    
    if (!methodExists) {
      res.status(404).json({
        success: false,
        error: {
          code: 'METHOD_NOT_FOUND',
          message: `Method '${methodName}' not found`,
          availableMethods: methods.map(m => m.name),
          timestamp: new Date().toISOString()
        }
      });
      return;
    }
    
    const result = await mcpHandler.handleRequest(methodName, params);
    res.json({
      success: true,
      method: methodName,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      method: req.params.methodName,
      error: {
        code: error.code || 'METHOD_EXECUTION_FAILED',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// app.use('/api', llmRouter);
// app.use('/webhook', telegramIntegration);

// Dashboard route
app.get('/dashboard', (req, res) => {
  res.sendFile(join(__dirname, '../public/dashboard.html'));
});

app.get('/', (req, res) => {
  res.json({
    name: 'AEM MCP Gateway Server',
    description: 'A Model Context Protocol server for Adobe Experience Manager',
    version: process.env.npm_package_version || '1.0.0',
    endpoints: {
      health: { method: 'GET', path: '/health', description: 'Health check for all services' },
      dashboard: { method: 'GET', path: '/dashboard', description: 'Interactive web dashboard' },
      mcp: { method: 'POST', path: '/mcp', description: 'JSON-RPC endpoint for MCP calls' },
      mcpMethods: { method: 'GET', path: '/mcp/methods', description: 'List all available MCP methods' },
      apiMethods: { method: 'GET', path: '/api/methods', description: 'REST API methods listing' },
    },
    architecture: 'MCP integration',
    timestamp: new Date().toISOString(),
  });
});

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'AEM MCP Gateway API',
    version: '1.0.0',
    description: 'API documentation for the AEM MCP Gateway Server',
  },
  servers: [
    { url: `http://localhost:${GATEWAY_PORT}` },
  ],
};

const options = {
  swaggerDefinition,
  apis: [], // No JSDoc comments, so we define paths below
};

const openapiSpec: any = swaggerJSDoc(options);
openapiSpec.paths = {
  '/mcp': {
    post: {
      summary: 'JSON-RPC endpoint for MCP calls',
      description: 'Call MCP methods using JSON-RPC 2.0. The method and params must be provided in the request body.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                jsonrpc: { type: 'string', example: '2.0' },
                id: { type: 'integer', example: 1 },
                method: { type: 'string', example: 'listMethods' },
                params: { type: 'object' },
              },
              required: ['jsonrpc', 'id', 'method'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'JSON-RPC response',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  jsonrpc: { type: 'string', example: '2.0' },
                  id: { type: 'integer', example: 1 },
                  result: { type: 'object' },
                  error: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
  },
  '/mcp/methods': {
    get: {
      summary: 'List all available MCP methods',
      description: 'Returns a list of all available MCP methods and their parameters.',
      responses: {
        200: {
          description: 'A list of MCP methods',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  methods: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        description: { type: 'string' },
                        parameters: {
                          type: 'array',
                          items: { type: 'string' },
                        },
                      },
                    },
                  },
                  total: { type: 'integer' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
  },
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));
app.get('/openapi.json', (req: express.Request, res: express.Response) => { res.json(openapiSpec); });

export async function startGateway() {
  app.listen(GATEWAY_PORT, () => {
    // eslint-disable-next-line no-console
    console.log('\n' + '='.repeat(80));
    console.log('🚀 AEM MCP Server - Gateway Started');
    console.log('='.repeat(80));
    console.log(`📡 Gateway Port: ${GATEWAY_PORT}`);
    console.log(`📡 MCP Port: ${MCP_PORT}`);
    console.log(`📚 API Documentation: http://localhost:${GATEWAY_PORT}/api-docs`);
    console.log(`🎛️  Dashboard: http://localhost:${GATEWAY_PORT}/dashboard`);
    console.log('='.repeat(80));
    console.log('📜 LICENSE: AGPL-3.0-or-later');
    console.log('   This program comes with ABSOLUTELY NO WARRANTY.');
    console.log('   This is free software, and you are welcome to redistribute it');
    console.log('   under certain conditions. See LICENSE file for details.');
    console.log('');
    console.log('💼 Commercial Licensing Available');
    console.log('   For use without AGPL obligations, contact: indrasish00@gmail.com');
    console.log('   See COMMERCIAL_LICENSE.md for details.');
    console.log('='.repeat(80) + '\n');
  });
} 