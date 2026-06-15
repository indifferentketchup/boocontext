/**
 * GraphQL, gRPC, and WebSocket detector.
 *
 * GraphQL:  .graphql SDL files, gql`` template literals, Apollo Server typeDefs,
 *           Pothos SchemaBuilder, Strawberry (Python), graphene (Python)
 * gRPC:     .proto service/rpc definitions
 * WebSocket: Socket.io events, ws events, native WebSocket handlers
 */
import type { RouteInfo, ProjectInfo } from "../types.js";
export declare function detectGraphQLRoutes(files: string[], project: ProjectInfo): Promise<RouteInfo[]>;
export declare function detectGRPCRoutes(files: string[], project: ProjectInfo): Promise<RouteInfo[]>;
export declare function detectWebSocketRoutes(files: string[], project: ProjectInfo): Promise<RouteInfo[]>;
