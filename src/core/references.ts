// The shared static-reference analyzer (SPEC 2.4).
//
// IMPLEMENTATION (Key libraries): one shared static-reference analyzer
// serves MDX expression spans and TypeScript sources alike, built on the
// TypeScript compiler API. This module is that analyzer's core: it
// classifies one expression AST node as a static string literal, a static
// property chain, or dynamic, per the exact grammar of SPEC 2.4. The
// MDX-side drivers (./spec-references.ts) parse expression spans into
// standalone ASTs and feed them here; the TypeScript-side analysis feeds
// expressions of full parsed sources to the same function. What a
// classification *means* — which roots are import bindings, whether the
// string form is permitted (it is not in TypeScript `text` calls, SPEC
// 4.3), which condition a defect reports — is the caller's, not this
// module's: the analyzer is purely syntactic.
//
// All spans are UTF-16 code-unit offsets into the analyzed source text
// (the text of the `sourceFile` handed in); callers translate them into
// document byte ranges (SPEC 1.7).

import ts from "./ts-module.js";
import type * as tst from "typescript";

/**
 * A half-open span of UTF-16 code-unit offsets into the analyzed source
 * text — deliberately not a `ByteRange` (SPEC 1.7): callers translate.
 */
export interface TextSpan {
  readonly start: number;
  readonly end: number;
}

/**
 * SPEC 2.4: a static string literal — a plain single- or double-quoted
 * string (template literals are not static). In `d` and `text(...)` this
 * is the local reference form naming an ID path in the same file
 * (SPEC 2.2); in a TypeScript `text` call it is invalid (SPEC 4.3).
 */
export interface ClassifiedString {
  readonly kind: "string";
  /**
   * The literal's value (the named ID path, SPEC 2.2): the characters
   * between its delimiters exactly as spelled, no escape sequence
   * interpreted (SPEC 2.4).
   */
  readonly value: string;
  /** The quote character the author used (SPEC 6.4: preserved on rewrite). */
  readonly quote: '"' | "'";
  /** The literal token, quotes included. */
  readonly span: TextSpan;
}

/** One segment of a static property chain (SPEC 2.4). */
export interface ClassifiedSegment {
  /**
   * The segment name, read as spelled (SPEC 2.4): the identifier's own
   * characters for dot access, the index literal's characters between its
   * delimiters for computed access — no escape sequence interpreted, so a
   * name spelled with one contains `\`, which no ID segment does (1.4),
   * and names no node. Exactly one chain segment (SPEC 2.4); never split —
   * a name containing `.` can equal no ID segment (SPEC 1.4), so a dotted
   * computed index resolves to nothing (TEST-SPEC T2.4-4).
   */
  readonly name: string;
  /**
   * The access form (SPEC 2.4): non-computed property access whose name
   * is an identifier (`.login`), or computed access whose index is a
   * static string literal (`["login-v2"]`).
   */
  readonly access: "dot" | "computed";
  /** The index literal's quote character — null for dot access. */
  readonly quote: '"' | "'" | null;
  /**
   * The name token: the identifier, or the index string literal with its
   * quotes (SPEC 6.4: the minimal in-place edit of a renamed segment).
   */
  readonly nameSpan: TextSpan;
  /**
   * The whole access — from just past the base expression through the
   * access's last character (`.login`, or `["login-v2"]` through the
   * `]`), for rewrites that must replace the access form (SPEC 6.4).
   */
  readonly accessSpan: TextSpan;
}

/**
 * SPEC 2.4: a static property chain — a root identifier followed by zero
 * or more segments. Whether the root is an imported spec module's binding
 * (required for the chain to be a reference) is the caller's judgment.
 */
export interface ClassifiedChain {
  readonly kind: "chain";
  /**
   * The name the root identifier binds by the language's reading, escape
   * sequences interpreted (an import binding, when valid): which binding
   * roots a chain is the language's scoping question, not a spelling one
   * (SPEC 2.4, 2.1, 4.5).
   */
  readonly rootName: string;
  /** The root identifier token. */
  readonly rootSpan: TextSpan;
  /** The segments, outermost last (document order along the chain). */
  readonly segments: readonly ClassifiedSegment[];
  /** The whole chain expression. */
  readonly span: TextSpan;
}

/**
 * SPEC 2.4: no other syntax participates in a chain — optional chaining,
 * non-null assertions, parentheses, and any other index or expression
 * form make the reference dynamic (14.8).
 */
export interface ClassifiedDynamic {
  readonly kind: "dynamic";
  /** Why the expression is dynamic, phrased for a finding message. */
  readonly reason: string;
  /** The whole analyzed expression. */
  readonly span: TextSpan;
}

/** The analyzer's classification of one expression (SPEC 2.4). */
export type ClassifiedReference =
  ClassifiedString | ClassifiedChain | ClassifiedDynamic;

/** The span of a node's own characters (leading trivia excluded). */
function spanOf(node: tst.Node, sourceFile: tst.SourceFile): TextSpan {
  return { start: node.getStart(sourceFile), end: node.getEnd() };
}

/**
 * SPEC 2.4: the value of a static string literal — the characters between
 * its delimiters exactly as spelled, no escape sequence interpreted — for
 * every string literal the specification reads: `d` and `text(...)` string
 * arguments and computed-access indices (here), and import specifiers in
 * spec and TypeScript sources alike (./spec-references.ts,
 * ./code-analysis.ts). The parser's own `text` is the interpreted value and
 * is never read. (An unterminated literal occurs only in a source failing
 * to parse, 14.20; its value runs to the token's end.)
 */
export function stringLiteralValue(
  literal: tst.StringLiteral,
  sourceFile: tst.SourceFile,
): string {
  const start = literal.getStart(sourceFile);
  const end = literal.getEnd();
  const quote = sourceFile.text[start];
  const terminated = end - start >= 2 && sourceFile.text[end - 1] === quote;
  return sourceFile.text.slice(start + 1, terminated ? end - 1 : end);
}

/**
 * SPEC 2.4: a chain segment's identifier read as spelled — its own
 * characters; one carrying a Unicode escape sequence spells a name
 * containing `\`, which no segment contains (1.4), so the reference names
 * no node (14.5–14.7).
 */
function identifierSpelling(
  identifier: tst.Identifier,
  sourceFile: tst.SourceFile,
): string {
  return sourceFile.text.slice(
    identifier.getStart(sourceFile),
    identifier.getEnd(),
  );
}

/** The quote character a string literal was written with. */
function quoteOf(
  literal: tst.StringLiteral,
  sourceFile: tst.SourceFile,
): '"' | "'" {
  const quote = sourceFile.text[literal.getStart(sourceFile)];
  if (quote !== '"' && quote !== "'") {
    throw new Error("xspec internal error: string literal without a quote");
  }
  return quote;
}

/**
 * Classify one expression per the static argument rule (SPEC 2.4): a
 * static string literal (plain single- or double-quoted; template
 * literals are not static), a static property chain (a root identifier
 * followed by zero or more segments, each a non-computed access whose
 * name is an identifier or a computed access whose index is a static
 * string literal), or dynamic — optional chaining, non-null assertions,
 * parentheses, and any other index or expression form.
 */
export function classifyReference(
  expression: tst.Expression,
  sourceFile: tst.SourceFile,
): ClassifiedReference {
  const whole = spanOf(expression, sourceFile);
  const dynamic = (reason: string): ClassifiedDynamic => ({
    kind: "dynamic",
    reason,
    span: whole,
  });

  if (ts.isStringLiteral(expression)) {
    // SPEC 2.4: a plain single- or double-quoted string is static; its
    // value is its characters as spelled.
    return {
      kind: "string",
      value: stringLiteralValue(expression, sourceFile),
      quote: quoteOf(expression, sourceFile),
      span: whole,
    };
  }
  if (
    ts.isNoSubstitutionTemplateLiteral(expression) ||
    ts.isTemplateExpression(expression)
  ) {
    // SPEC 2.4: template literals are not static.
    return dynamic(
      "a template literal is not a static string literal — only plain " +
        "single- or double-quoted strings are static",
    );
  }

  // Walk a candidate property chain from the outermost access inward
  // (SPEC 2.4); segments are collected outermost-first and reversed.
  const collected: ClassifiedSegment[] = [];
  let node: tst.Expression = expression;
  for (;;) {
    if (ts.isIdentifier(node)) {
      return {
        kind: "chain",
        // SPEC 2.4: the root binds by the language's reading (scoping, 2.1,
        // 4.5), escapes interpreted; only segments are read as spelled.
        rootName: node.text,
        rootSpan: spanOf(node, sourceFile),
        segments: collected.reverse(),
        span: whole,
      };
    }
    if (ts.isPropertyAccessExpression(node)) {
      if (node.questionDotToken !== undefined) {
        // SPEC 2.4: optional chaining makes the reference dynamic.
        return dynamic(
          "optional chaining does not participate in a static property chain",
        );
      }
      if (!ts.isIdentifier(node.name)) {
        return dynamic(
          "a private-name access does not participate in a static " +
            "property chain",
        );
      }
      collected.push({
        // SPEC 2.4: the segment's identifier is read as spelled.
        name: identifierSpelling(node.name, sourceFile),
        access: "dot",
        quote: null,
        nameSpan: spanOf(node.name, sourceFile),
        accessSpan: { start: node.expression.getEnd(), end: node.getEnd() },
      });
      node = node.expression;
      continue;
    }
    if (ts.isElementAccessExpression(node)) {
      if (node.questionDotToken !== undefined) {
        // SPEC 2.4: optional chaining makes the reference dynamic.
        return dynamic(
          "optional chaining does not participate in a static property chain",
        );
      }
      const index = node.argumentExpression;
      if (!ts.isStringLiteral(index)) {
        // SPEC 2.4: any other index form makes the reference dynamic.
        return dynamic(
          "a computed access is static only when its index is a plain " +
            "single- or double-quoted string literal",
        );
      }
      collected.push({
        // SPEC 2.4: the index literal's value is its characters as spelled.
        name: stringLiteralValue(index, sourceFile),
        access: "computed",
        quote: quoteOf(index, sourceFile),
        nameSpan: spanOf(index, sourceFile),
        accessSpan: { start: node.expression.getEnd(), end: node.getEnd() },
      });
      node = node.expression;
      continue;
    }
    if (ts.isNonNullExpression(node)) {
      // SPEC 2.4: non-null assertions make the reference dynamic.
      return dynamic(
        "a non-null assertion does not participate in a static property chain",
      );
    }
    if (ts.isParenthesizedExpression(node)) {
      // SPEC 2.4: parentheses make the reference dynamic.
      return dynamic(
        "parentheses do not participate in a static property chain",
      );
    }
    return dynamic(
      "it is neither a static string literal nor a static property chain " +
        "rooted at an import binding",
    );
  }
}

/**
 * Parse one expression span's exact source text (an MDX `d` value or
 * `{...}` container content, SPEC 2.2, 2.3) into a standalone AST for the
 * analyzer. `expression` is null when the text is not a single expression
 * statement — an object literal (parsed as a block), several statements,
 * or nothing — every such value is dynamic for the caller's purposes
 * (SPEC 2.7 → 14.8). Positions in the returned AST are UTF-16 offsets
 * into `text`.
 */
export function parseExpressionText(text: string): {
  readonly sourceFile: tst.SourceFile;
  readonly expression: tst.Expression | null;
} {
  const sourceFile = ts.createSourceFile(
    "xspec-expression.ts",
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
  const statement =
    sourceFile.statements.length === 1 ? sourceFile.statements[0] : undefined;
  const expression =
    statement !== undefined && ts.isExpressionStatement(statement)
      ? statement.expression
      : null;
  return { sourceFile, expression };
}
