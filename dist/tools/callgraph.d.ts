import { type VerdictEnvelope } from "../verdict.js";
import { ChildServerManager } from "../child-server.js";
export declare function createCallgraphTool(manager: ChildServerManager): {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            symbol: {
                type: string;
                description: string;
            };
            direction: {
                type: string;
                enum: string[];
                description: string;
            };
            depth: {
                type: string;
                description: string;
            };
            file: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    handler(args: any): Promise<VerdictEnvelope>;
};
