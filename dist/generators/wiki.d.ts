import type { ScanResult } from "../types.js";
export interface WikiResult {
    articles: string[];
    wikiDir: string;
    tokenEstimate: number;
}
export declare function generateWiki(result: ScanResult, outputDir: string): Promise<WikiResult>;
export declare function readWikiArticle(outputDir: string, article: string): Promise<string | null>;
export declare function listWikiArticles(outputDir: string): Promise<string[]>;
export declare function lintWiki(result: ScanResult, outputDir: string): Promise<string>;
