import { type VerdictEnvelope } from "../verdict.js";
import { ChildServerManager } from "../child-server.js";
export declare function createSymbolsTool(manager: ChildServerManager): {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            query: {
                type: string;
                description: string;
            };
            directory: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    handler(args: any): Promise<VerdictEnvelope>;
};
