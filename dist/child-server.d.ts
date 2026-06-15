interface ChildClient {
    callTool(params: {
        name: string;
        arguments?: any;
    }, options?: any): Promise<any>;
    close(): Promise<void>;
}
export interface ChildServerConfig {
    name: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
    tools: string[];
    cwd?: string;
}
export declare class ChildServerManager {
    private servers;
    private spawnServer;
    getServer(name: string): Promise<ChildClient>;
    callTool(serverName: string, tool: string, args: any): Promise<any>;
    shutdown(): Promise<void>;
    getActiveServers(): string[];
}
export declare const CHILD_SERVER_CONFIGS: ChildServerConfig[];
export {};
