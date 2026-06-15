/**
 * AST-based schema extraction for TypeScript/JavaScript ORMs.
 * Provides higher accuracy than regex for:
 * - Drizzle: pgTable/mysqlTable/sqliteTable with field types and chained modifiers
 * - TypeORM: @Entity + @Column/@PrimaryGeneratedColumn decorators
 */
import type { SchemaModel, SchemaField } from "../types.js";
import { parseSourceFile, getDecorators, parseDecorator, getText } from "./loader.js";

const AUDIT_FIELDS = new Set([
  "createdAt", "updatedAt", "deletedAt",
  "created_at", "updated_at", "deleted_at",
]);

/**
 * Extract Drizzle schema from a file using AST.
 */
export function extractDrizzleSchemaAST(
  ts: any,
  filePath: string,
  content: string
): SchemaModel[] {
  try {
    const sf = parseSourceFile(ts, filePath, content);
    return extractDrizzleTables(ts, sf, content);
  } catch {
    return [];
  }
}

/**
 * Extract TypeORM entities from a file using AST.
 */
export function extractTypeORMSchemaAST(
  ts: any,
  filePath: string,
  content: string
): SchemaModel[] {
  try {
    const sf = parseSourceFile(ts, filePath, content);
    return extractTypeORMEntities(ts, sf);
  } catch {
    return [];
  }
}

// ─── Drizzle ───

const DRIZZLE_TABLE_FUNCS = new Set(["pgTable", "mysqlTable", "sqliteTable"]);

function extractDrizzleTables(ts: any, sf: any, _content: string): SchemaModel[] {
  const models: SchemaModel[] = [];
  const SK = ts.SyntaxKind;

  function visit(node: any) {
    // Look for: const xxx = pgTable("name", { ... })
    if (node.kind === SK.CallExpression) {
      const callee = node.expression;
      const funcName = callee?.kind === SK.Identifier ? getText(sf, callee) : "";

      if (DRIZZLE_TABLE_FUNCS.has(funcName) && node.arguments?.length >= 2) {
        const nameArg = node.arguments[0];
        const fieldsArg = node.arguments[1];

        // Table name from first argument
        let tableName = "";
        if (nameArg.kind === SK.StringLiteral || nameArg.kind === SK.NoSubstitutionTemplateLiteral) {
          tableName = nameArg.text;
        }
        if (!tableName) {
          ts.forEachChild(node, visit);
          return;
        }

        // Fields from second argument (ObjectLiteralExpression or arrow returning one)
        let fieldsObj: any = null;
        if (fieldsArg.kind === SK.ObjectLiteralExpression) {
          fieldsObj = fieldsArg;
        } else if (fieldsArg.kind === SK.ArrowFunction || fieldsArg.kind === SK.FunctionExpression) {
          // (t) => ({ ... }) — body might be ParenthesizedExpression containing ObjectLiteralExpression
          const body = fieldsArg.body;
          if (body?.kind === SK.ObjectLiteralExpression) {
            fieldsObj = body;
          } else if (body?.kind === SK.ParenthesizedExpression && body.expression?.kind === SK.ObjectLiteralExpression) {
            fieldsObj = body.expression;
          }
        }

        if (!fieldsObj) {
          ts.forEachChild(node, visit);
          return;
        }

        const fields: SchemaField[] = [];
        const relations: string[] = [];

        for (const prop of fieldsObj.properties || []) {
          if (prop.kind !== SK.PropertyAssignment) continue;
          const fieldName = prop.name ? getText(sf, prop.name) : "";
          if (!fieldName || AUDIT_FIELDS.has(fieldName)) continue;

          // Parse the initializer chain: serial("id").primaryKey()
          const { type, flags, refTarget } = parseFieldChain(ts, sf, prop.initializer);

          if (refTarget) {
            relations.push(`${fieldName} -> ${refTarget}`);
          }
          if (fieldName.endsWith("Id") || fieldName.endsWith("_id")) {
            if (!flags.includes("fk")) flags.push("fk");
          }

          fields.push({ name: fieldName, type, flags });
        }

        if (fields.length > 0) {
          models.push({ name: tableName, fields, relations, orm: "drizzle", confidence: "ast" as any });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sf);

  // Also extract Drizzle relations() calls
  extractDrizzleRelations(ts, sf, models);

  return models;
}

function parseFieldChain(ts: any, sf: any, node: any): { type: string; flags: string[]; refTarget: string | null } {
  const SK = ts.SyntaxKind;
  const flags: string[] = [];
  let type = "unknown";
  let refTarget: string | null = null;

  // Walk the chain from outermost to innermost call
  // e.g., serial("id").primaryKey().notNull() is:
  // CallExpression(.notNull)
  //   expression: PropertyAccessExpression
  //     expression: CallExpression(.primaryKey)
  //       expression: PropertyAccessExpression
  //         expression: CallExpression(serial)

  function walkChain(n: any) {
    if (!n) return;

    if (n.kind === SK.CallExpression) {
      const expr = n.expression;

      if (expr?.kind === SK.PropertyAccessExpression) {
        const methodName = getText(sf, expr.name);

        switch (methodName) {
          case "primaryKey": flags.push("pk"); break;
          case "notNull": flags.push("required"); break;
          case "unique": flags.push("unique"); break;
          case "default":
          case "defaultNow":
          case "$default":
          case "$defaultFn":
            flags.push("default"); break;
          case "references":
            flags.push("fk");
            // Try to extract reference target: .references(() => users.id)
            if (n.arguments?.length > 0) {
              const refArg = n.arguments[0];
              if (refArg.kind === SK.ArrowFunction || refArg.kind === SK.FunctionExpression) {
                const refBody = refArg.body;
                if (refBody?.kind === SK.PropertyAccessExpression) {
                  refTarget = getText(sf, refBody);
                }
              }
            }
            break;
        }

        // Recurse into the receiver
        walkChain(expr.expression);
      } else if (expr?.kind === SK.Identifier) {
        // Base function call: serial("id"), text("name"), etc.
        type = getText(sf, expr);
      } else if (expr?.kind === SK.PropertyAccessExpression) {
        // Could be t.serial("id") — method on a prefix
        type = getText(sf, expr.name);
        // Walk further for nested chains
      }
    }
  }

  walkChain(node);
  return { type, flags, refTarget };
}

function extractDrizzleRelations(ts: any, sf: any, models: SchemaModel[]) {
  const SK = ts.SyntaxKind;

  function visit(node: any) {
    // relations(tableVar, ({ one, many }) => ({ ... }))
    if (node.kind === SK.CallExpression) {
      const callee = node.expression;
      const funcName = callee?.kind === SK.Identifier ? getText(sf, callee) : "";

      if (funcName === "relations" && node.arguments?.length >= 2) {
        const tableArg = node.arguments[0];
        const tableName = tableArg?.kind === SK.Identifier ? getText(sf, tableArg) : "";

        // Find matching model by variable name (approximate match)
        const model = models.find((m) =>
          m.name === tableName ||
          m.name === tableName.replace(/s$/, "") ||
          tableName.startsWith(m.name)
        );
        if (!model) {
          ts.forEachChild(node, visit);
          return;
        }

        const relArg = node.arguments[1];
        // Arrow function body should be an ObjectLiteralExpression
        let relObj: any = null;
        if (relArg?.kind === SK.ArrowFunction) {
          const body = relArg.body;
          if (body?.kind === SK.ObjectLiteralExpression) {
            relObj = body;
          } else if (body?.kind === SK.ParenthesizedExpression && body.expression?.kind === SK.ObjectLiteralExpression) {
            relObj = body.expression;
          }
        }

        if (!relObj) {
          ts.forEachChild(node, visit);
          return;
        }

        for (const prop of relObj.properties || []) {
          if (prop.kind !== SK.PropertyAssignment) continue;
          const relName = prop.name ? getText(sf, prop.name) : "";
          if (!relName) continue;

          const init = prop.initializer;
          if (init?.kind === SK.CallExpression && init.expression?.kind === SK.Identifier) {
            const relType = getText(sf, init.expression); // "one" or "many"
            const targetArg = init.arguments?.[0];
            const target = targetArg?.kind === SK.Identifier ? getText(sf, targetArg) : "?";
            const existing = model.relations.find((r) => r.startsWith(`${relName}:`));
            if (!existing) {
              model.relations.push(`${relName}: ${relType}(${target})`);
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sf);
}

// ─── TypeORM ───

function extractTypeORMEntities(ts: any, sf: any): SchemaModel[] {
  const models: SchemaModel[] = [];
  const SK = ts.SyntaxKind;

  function visitNode(node: any) {
    if (node.kind === SK.ClassDeclaration) {
      const decorators = getDecorators(ts, node);
      let isEntity = false;
      let entityName = "";

      for (const dec of decorators) {
        const parsed = parseDecorator(ts, sf, dec);
        if (parsed.name === "Entity") {
          isEntity = true;
          entityName = parsed.arg || "";
          break;
        }
      }

      if (!isEntity) {
        ts.forEachChild(node, visitNode);
        return;
      }

      // Class name as fallback
      const className = node.name ? getText(sf, node.name) : "Unknown";
      const name = entityName || className;

      const fields: SchemaField[] = [];
      const relations: string[] = [];

      for (const member of node.members || []) {
        if (member.kind !== SK.PropertyDeclaration) continue;
        const memberDecs = getDecorators(ts, member);
        const memberName = member.name ? getText(sf, member.name) : "";
        if (!memberName || AUDIT_FIELDS.has(memberName)) continue;

        // Get type annotation
        const memberType = member.type ? getText(sf, member.type) : "unknown";

        for (const dec of memberDecs) {
          const parsed = parseDecorator(ts, sf, dec);

          // Column decorators
          if (parsed.name === "PrimaryGeneratedColumn" || parsed.name === "PrimaryColumn") {
            const flags: string[] = ["pk"];
            if (parsed.name === "PrimaryGeneratedColumn") flags.push("default");
            fields.push({ name: memberName, type: parsed.arg || memberType, flags });
            break;
          }

          if (parsed.name === "Column" || parsed.name === "CreateDateColumn" || parsed.name === "UpdateDateColumn") {
            const flags: string[] = [];
            // Parse column options from decorator argument
            const decExpr = dec.expression;
            if (decExpr?.kind === SK.CallExpression && decExpr.arguments?.length > 0) {
              const optArg = decExpr.arguments[0];
              const optText = getText(sf, optArg);
              if (optText.includes("unique: true") || optText.includes("unique:true")) flags.push("unique");
              if (optText.includes("nullable: true") || optText.includes("nullable:true")) flags.push("nullable");
              if (optText.includes("default:")) flags.push("default");
            }
            fields.push({ name: memberName, type: parsed.arg || memberType, flags });
            break;
          }

          // Relation decorators
          if (["OneToMany", "ManyToOne", "OneToOne", "ManyToMany"].includes(parsed.name)) {
            relations.push(`${memberName}: ${parsed.name}(${memberType})`);
            break;
          }
        }
      }

      if (fields.length > 0) {
        models.push({ name, fields, relations, orm: "typeorm", confidence: "ast" as any });
      }
    }

    ts.forEachChild(node, visitNode);
  }

  visitNode(sf);
  return models;
}
