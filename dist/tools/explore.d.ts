import { type VerdictEnvelope } from "../verdict.js";
import { ChildServerManager } from "../child-server.js";
export interface Citation {
    cite: string;
    reason: string;
    facet: "route" | "schema" | "component" | "lib" | "middleware" | "event" | "hot-file" | "symbol";
    score: number;
}
export declare function createExploreTool(manager: ChildServerManager): {
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
            k: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    handler(args: any): Promise<VerdictEnvelope>;
};
