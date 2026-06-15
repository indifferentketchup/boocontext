# Dependency Graph

## Most Imported Files (change these carefully)

- `src/types.ts` — imported by **48** files
- `src/scanner.ts` — imported by **16** files
- `src/child-server.ts` — imported by **7** files
- `src/verdict.ts` — imported by **7** files
- `src/ast/loader.ts` — imported by **6** files
- `src/plugins/terraform/types.ts` — imported by **6** files
- `src/ast/extract-brightscript.ts` — imported by **5** files
- `src/formatter.ts` — imported by **5** files
- `src/plugins/cicd/types.ts` — imported by **5** files
- `src/plugins/githooks/types.ts` — imported by **5** files
- `src/scan-cache.ts` — imported by **4** files
- `src/detectors/routes.ts` — imported by **3** files
- `src/detectors/schema.ts` — imported by **3** files
- `src/detectors/components.ts` — imported by **3** files
- `src/detectors/config.ts` — imported by **3** files
- `src/detectors/middleware.ts` — imported by **3** files
- `src/ast/extract-dart.ts` — imported by **3** files
- `src/ast/extract-swift.ts` — imported by **3** files
- `src/ast/extract-android.ts` — imported by **3** files
- `src/ast/extract-scenegraph.ts` — imported by **3** files

## Import Map (who imports what)

- `src/types.ts` ← `src/ast/extract-android.ts`, `src/ast/extract-brighterscript.ts`, `src/ast/extract-brightscript.ts`, `src/ast/extract-components.ts`, `src/ast/extract-csharp.ts` +43 more
- `src/scanner.ts` ← `src/core.ts`, `src/detectors/components.ts`, `src/detectors/config.ts`, `src/detectors/contracts.ts`, `src/detectors/coverage.ts` +11 more
- `src/child-server.ts` ← `src/mcp-server.ts`, `src/tools/callgraph.ts`, `src/tools/health.ts`, `src/tools/impact.ts`, `src/tools/symbols.ts` +2 more
- `src/verdict.ts` ← `src/tools/callgraph.ts`, `src/tools/health.ts`, `src/tools/impact.ts`, `src/tools/map.ts`, `src/tools/overview.ts` +2 more
- `src/ast/loader.ts` ← `src/ast/extract-components.ts`, `src/ast/extract-routes.ts`, `src/ast/extract-schema.ts`, `src/detectors/components.ts`, `src/detectors/routes.ts` +1 more
- `src/plugins/terraform/types.ts` ← `src/plugins/terraform/file-collector.ts`, `src/plugins/terraform/formatter.ts`, `src/plugins/terraform/hcl-parser.ts`, `src/plugins/terraform/index.ts`, `src/plugins/terraform/index.ts` +1 more
- `src/ast/extract-brightscript.ts` ← `src/ast/extract-brighterscript.ts`, `src/detectors/events.ts`, `src/detectors/libs.ts`, `src/detectors/middleware.ts`, `src/detectors/routes.ts`
- `src/formatter.ts` ← `src/core.ts`, `src/index.ts`, `src/mcp-server.ts`, `src/scan-cache.ts`, `src/tools/map.ts`
- `src/plugins/cicd/types.ts` ← `src/plugins/cicd/circleci.ts`, `src/plugins/cicd/formatter.ts`, `src/plugins/cicd/github-actions.ts`, `src/plugins/cicd/index.ts`, `src/plugins/cicd/index.ts`
- `src/plugins/githooks/types.ts` ← `src/plugins/githooks/formatter.ts`, `src/plugins/githooks/husky.ts`, `src/plugins/githooks/index.ts`, `src/plugins/githooks/lefthook.ts`, `src/plugins/githooks/raw.ts`
