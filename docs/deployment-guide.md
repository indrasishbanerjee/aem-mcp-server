# Deployment

This server is a standalone Node.js process. It does not deploy into AEM.

Follow [OPERATIONS.md](OPERATIONS.md) for Author access, the technical-user ACL checklist, CSRF, HTTP auth, and incident containment.

Container:

```bash
docker build -t aem-mcp-server .
docker run --rm -p 3001:3001 --env-file .env aem-mcp-server
```

Bind the published port only behind TLS. Stdio (`npm run mcp`) is the primary transport for IDE clients and does not need a container.
