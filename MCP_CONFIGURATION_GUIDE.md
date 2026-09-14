# MCP client configuration

Stdio is the supported IDE transport. HTTP is optional and uses API key or Basic auth. OAuth is not implemented.

```json
{
  "mcpServers": {
    "aem-65": {
      "command": "node",
      "args": ["dist/mcp/stdio.js"],
      "env": {
        "AEM_HOST": "http://localhost:4502",
        "AEM_SERVICE_USER": "mcp-technical",
        "AEM_SERVICE_PASSWORD": "<secret>"
      }
    }
  }
}
```

See [OPERATIONS.md](OPERATIONS.md) for Streamable HTTP examples.
