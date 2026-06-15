/**
 * Event, job queue, and pub/sub detector.
 * Detects: BullMQ queues, Kafka topics, Redis pub/sub, Socket.io namespaces,
 * Node.js EventEmitter events.
 */
import type { EventInfo, ProjectInfo } from "../types.js";
export declare function detectEvents(files: string[], project: ProjectInfo): Promise<EventInfo[]>;
