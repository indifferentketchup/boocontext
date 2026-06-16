## Design

### Dispatch map

A `GETTER_SECTIONS: Record<string, (args) => Promise<string>>` maps section names to the existing handler functions, unchanged:

```
summary       -> toolGetSummary
routes        -> toolGetRoutes
schema        -> toolGetSchema
env           -> toolGetEnv
hot_files     -> toolGetHotFiles
events        -> toolGetEvents
coverage      -> toolGetCoverage
blast_radius  -> toolGetBlastRadius
wiki_index    -> toolGetWikiIndex
wiki_article  -> toolGetWikiArticle
wiki_lint     -> toolLintWiki
knowledge     -> toolGetKnowledge
```

### boocontext_get handler

```
async handler(args):
  section = args.section
  fn = GETTER_SECTIONS[section]
  if !fn: return "Unknown section '<section>'. Valid: <list>."
  return fn(args)   // existing handlers read args.tag/model/file/etc directly
```

Filters pass through untouched: the legacy handlers already read `args.prefix`, `args.tag`, `args.method`, `args.model`, `args.file`, `args.files`, `args.depth`, `args.required_only`, `args.limit`, `args.system`, `args.article` off the single args object, so forwarding `args` preserves every filter with zero per-section glue.

### Backward-compatible hiding (non-breaking) — as built

Simpler than a separate alias-dispatch map: the 12 getter `ToolDefinition`s stay in the `TOOLS` array, so the existing `tools/call` lookup (`TOOLS.find(t => t.name === toolName)`) keeps resolving the old names with zero new dispatch code. Only `tools/list` changes: it filters out `HIDDEN_FROM_LIST` (a `Set` of the 12 legacy names derived from `GETTER_SECTIONS`). Net effect is identical to an alias map — old names callable, not advertised — with less surface area.

### Why output stays homogeneous (not the anti-pattern)

Workato/Speakeasy warn against tools whose *action semantics* branch on input (`get_or_create`). Here every section returns the same kind of thing: a read-only markdown slice of the cached scan. The verb ("get a context slice") is constant; only which slice varies. That is the consolidation Anthropic endorses, not branching semantics.

### What is deliberately NOT consolidated

`scan` (full map), `refresh` (cache mutation), and the 7 verdict-envelope analysis verbs are distinct high-leverage capabilities with different output contracts. Folding them in would create the branching anti-pattern, so they stay separate.

### Risks

- A consumer parsing `tools/list` expecting the getter names would no longer see them, though calls still succeed. Mitigated: README is the only in-repo reference; no test asserts getter listing.
- Section typo returns a helpful error listing valid sections rather than failing silently.
