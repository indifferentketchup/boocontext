import { type VerdictEnvelope } from "../verdict.js";
import { ChildServerManager } from "../child-server.js";
export declare function createTypesTool(manager: ChildServerManager): {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            file: {
                type: string;
                description: string;
            };
            symbol: {
                type: string;
                description: string;
            };
            line: {
                type: string;
                description: string;
            };
            column: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    handler(args: any): Promise<VerdictEnvelope>;
};
