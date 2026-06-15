import { type VerdictEnvelope } from "../verdict.js";
import { ChildServerManager } from "../child-server.js";
export declare function createHealthTool(manager: ChildServerManager): {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            directory: {
                type: string;
                description: string;
            };
            file: {
                type: string;
                description: string;
            };
        };
    };
    handler(args: any): Promise<VerdictEnvelope>;
};
