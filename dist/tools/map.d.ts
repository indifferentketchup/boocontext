import { type VerdictEnvelope } from "../verdict.js";
export declare function createMapTool(): {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            directory: {
                type: string;
                description: string;
            };
            compress: {
                type: string;
                description: string;
            };
        };
    };
    handler(args: any): Promise<VerdictEnvelope>;
};
