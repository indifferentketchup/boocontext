/**
 * Roku SceneGraph XML extraction.
 *
 * SceneGraph components are XML files that declare:
 * - a component name + parent type  (`<component name="X" extends="Group">`)
 * - public fields/functions (`<interface> <field ... /> </interface>`)
 * - script includes             (`<script uri="pkg:/..." />`)
 * - nested child components     (`<children> <Label .../> </children>`)
 *
 * This file exposes two regex-based extractors — no XML parser dependency,
 * matching the style of every other extractor in src/ast/.
 */
import type { SchemaField } from "../types.js";
export interface SceneGraphComponent {
    /** Value of the `name=` attribute on the top-level <component>. */
    name: string;
    /** Value of the `extends=` attribute, or "Group" as a conservative default. */
    extendsType: string;
    /** Fields declared under <interface> — drives schema + components detectors. */
    interfaceFields: SchemaField[];
    /** Functions declared under <interface> — drives libs detector for XML side. */
    interfaceFunctions: string[];
    /** Script include targets from <script uri="pkg:/..." />. */
    scriptIncludes: string[];
    /** Direct child component type names declared under <children>. */
    childComponents: string[];
}
/**
 * Parse a single SceneGraph component XML file.
 *
 * Returns null for XML that is not a SceneGraph component (Android layouts,
 * Spring configs, raw XML data, etc.). The signature is a top-level
 * `<component name="..." extends="...">` element.
 */
export declare function extractSceneGraphComponent(content: string): SceneGraphComponent | null;
/**
 * For a MainScene xml, return the map of `{ id -> componentType }` describing
 * every child view slot. Values of `m.top.findNode("xxx")` in MainScene.brs
 * resolve back to these IDs.
 *
 * Roku Scene XML typically looks like:
 *   <component name="MainScene" extends="Scene">
 *     <children>
 *       <HomeView id="homeView" />
 *       <LoginView id="loginView" />
 *     </children>
 *   </component>
 */
export declare function extractMainSceneScreens(content: string): Record<string, string>;
/**
 * Cheap content sniff: is this XML file a SceneGraph component?
 * Used by detectors to filter the broad `.xml` file set down to SceneGraph XML.
 */
export declare function isSceneGraphXml(content: string): boolean;
