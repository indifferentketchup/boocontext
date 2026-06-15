import { readFile } from "node:fs/promises";
import { join } from "node:path";
const HOOK_NAMES = new Set([
    "pre-commit", "commit-msg", "prepare-commit-msg", "post-commit",
    "pre-push", "post-merge", "post-checkout", "pre-rebase", "post-rewrite",
]);
export async function parseLefthook(root) {
    for (const name of ["lefthook.yml", "lefthook.yaml", "lefthook.json"]) {
        try {
            const content = await readFile(join(root, name), "utf-8");
            return name.endsWith(".json")
                ? parseJson(JSON.parse(content), name)
                : parseYaml(content, name);
        }
        catch {
            // file doesn't exist, try next
        }
    }
    return [];
}
// Minimal line-by-line parser for lefthook's YAML structure.
// Handles the common pattern: lifecycle > commands > name > run.
function parseYaml(content, source) {
    const commandsByLifecycle = new Map();
    let currentLifecycle = null;
    let inCommands = false;
    let currentCommand = null;
    for (const raw of content.split("\n")) {
        const trimmed = raw.trim();
        if (!trimmed || trimmed.startsWith("#"))
            continue;
        const indent = raw.search(/\S/);
        if (indent === 0 && trimmed.endsWith(":")) {
            const key = trimmed.slice(0, -1);
            currentLifecycle = HOOK_NAMES.has(key) ? key : null;
            inCommands = false;
            currentCommand = null;
            if (currentLifecycle && !commandsByLifecycle.has(key)) {
                commandsByLifecycle.set(key, []);
            }
            continue;
        }
        if (!currentLifecycle)
            continue;
        if (indent === 2 && (trimmed === "commands:" || trimmed === "scripts:")) {
            inCommands = true;
            continue;
        }
        if (inCommands && indent === 4 && trimmed.endsWith(":") && !trimmed.startsWith("run:")) {
            currentCommand = trimmed.slice(0, -1);
            continue;
        }
        if (inCommands && currentCommand && indent === 6 && trimmed.startsWith("run:")) {
            const run = trimmed.slice(4).trim().replace(/^['"]|['"]$/g, "");
            commandsByLifecycle.get(currentLifecycle).push({ name: currentCommand, run });
            continue;
        }
        // run: directly under hook (no commands block)
        if (!inCommands && indent === 2 && trimmed.startsWith("run:")) {
            const run = trimmed.slice(4).trim().replace(/^['"]|['"]$/g, "");
            commandsByLifecycle.get(currentLifecycle).push({ name: currentLifecycle, run });
        }
    }
    return [...commandsByLifecycle.entries()]
        .filter(([, cmds]) => cmds.length > 0)
        .map(([lifecycle, commands]) => ({ lifecycle, tool: "lefthook", commands, source }));
}
function parseJson(obj, source) {
    const hooks = [];
    for (const lifecycle of HOOK_NAMES) {
        const hook = obj[lifecycle];
        if (!hook)
            continue;
        const commands = [];
        const block = hook.commands ?? hook.scripts;
        if (block && typeof block === "object") {
            for (const [name, cmd] of Object.entries(block)) {
                const c = cmd;
                if (typeof c?.run === "string")
                    commands.push({ name, run: c.run });
            }
        }
        if (commands.length > 0)
            hooks.push({ lifecycle, tool: "lefthook", commands, source });
    }
    return hooks;
}
