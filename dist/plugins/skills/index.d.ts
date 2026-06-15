import type { BoocontextPlugin } from "../../types.js";
export interface Skill {
    name: string;
    description: string;
    path: string;
}
export declare function createSkillsPlugin(): BoocontextPlugin;
