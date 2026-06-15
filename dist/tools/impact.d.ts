import { type VerdictEnvelope } from "../verdict.js";
import { ChildServerManager } from "../child-server.js";
export declare function createImpactTool(manager: ChildServerManager): {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            symbol: {
                type: string;
                description: string;
            };
            file: {
                type: string;
                description: string;
            };
            directory: {
                type: string;
                description: string;
            };
        };
    };
    handler(args: any): Promise<VerdictEnvelope>;
};
