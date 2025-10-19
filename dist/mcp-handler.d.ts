import { AEMConnector } from './aem-connector.js';
export declare class MCPRequestHandler {
    aemConnector: AEMConnector;
    constructor(aemConnector: AEMConnector);
    handleRequest(method: string, params: any): Promise<any>;
    getAvailableMethods(): {
        name: string;
        description: string;
        parameters: string[];
    }[];
}
//# sourceMappingURL=mcp-handler.d.ts.map