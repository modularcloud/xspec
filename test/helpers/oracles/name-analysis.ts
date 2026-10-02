// In-harness name analysis behind T6.5-22(a)'s universal assertion (TEST-SPEC
// 17 S-6; T6.5-22; SPEC 6.5's constraints on an added import's identifiers):
// for a receiving file — a spec source, a plain TypeScript code source, or a
// TSX one — the names it declares, in any scope and at value or type level,
// the names it references, and the names 6.5 bars there. Per S-6 the analysis
// passes its fixed vector suite (test/self/s6-name-analysis.test.ts), built
// from T6.5-22's stagings, before any test that adds an import trusts it.
// Harness machinery only: pure functions, no product imports, no I/O, no
// test-framework dependence.
//
// Reading. A file is read by the grammar SPEC 14.20 fixes for it, by the
// harness's own means (S-9's), and must be well-formed there — the analysis
// reads names, never judges, so a file outside the grammar is a harness
// error:
// * a spec source through S-9's MDX 3 parse (helpers/mdx-derivability.ts
//   `readMdxTree`: ECMAScript 2024 for its ESM blocks and expressions, every
//   S-9 allowance admitted, since a well-formed file may carry any of those
//   early errors) — its JSX elements' names and attributes from the mdast
//   tree, and the ESTree acorn attaches to each ESM block, expression, and
//   attribute expression walked node type by node type, an unknown type a
//   harness error, never a silent miss;
// * a code source through the harness's TypeScript 5.9.3, TSX or plain as
//   the caller names its kind (14.20: a name ending `.tsx` parses as TSX),
//   held to S-9's verdict and read as module code — 14.20 holds a well-formed
//   file to both readings, which differ only where a top-level `await`
//   stands, a name barred in every file.
//
// (a) Declared: the name of every declaration, in any scope, at value or type
// level — variable (`using` included), function, class, and parameter
// bindings, destructured ones included; a named function or class
// expression's own name; a catch binding; an import's local bindings (`t` of
// `{ text as t }`) and `import x = …`; type aliases, interfaces, enums, and
// enum members (TypeScript resolves a member unqualified inside its enum, a
// string-named one by its text); namespaces (`declare global` binds no
// name); type parameters, `infer` and mapped ones included; the parameters
// of signatures and function types; `export as namespace X`.
//
// (b) Referenced, by T6.5-22(a)'s definition: every identifier the file
// spells where name resolution looks it up through scope, at value or type
// level, whatever it resolves to — an expression's identifiers (an
// assignment target, a shorthand property, the local name of an
// `export { … }` without `from`, a decorator, a computed key among them);
// the leftmost identifier of a type reference, a `typeof` query, a heritage
// clause, or `import x = N.y`; and a JSX tag name that is a value reference —
// a plain tag that is not intrinsic (an intrinsic tag begins with an ASCII
// lowercase letter or holds a `-`, as TypeScript and MDX both judge it; a
// namespaced tag is intrinsic too), and the root of a member tag (`<a.b />`).
// Never counted: a property or member name (after `.` in an expression, a
// qualified type name, or an import type's qualifier; an object literal's
// non-shorthand key or a destructuring key; a class, interface, or enum
// member's; a JSX attribute's), a label, a tuple member's label, a type
// predicate's parameter name, the `meta` and `target` of `import.meta` and
// `new.target`, and every name an import or export specifier spells for the
// other module (`text` of `{ text as t }`; both names of a re-export).
//
// (c) Barred, by file kind (6.5; T6.5-22's constraint list): in every kind,
// ECMAScript 2024's reserved words, the words strict mode bars as a binding,
// `require` and `exports`, every `__`-prefixed name, the global object's
// properties (clause 19's value, function, constructor, and other
// properties, and Annex B's `escape` and `unescape`), `Iterator`,
// `AsyncIterator`, and `SuppressedError`; in a TSX source, `React` and the
// leading identifier of the factory any `@jsx` or `@jsxFrag` pragma in any
// of the file's comments names; in a spec source, the compiler-provided `S`,
// `Spec`, and `text` (2.1). A pragma is recognized as TypeScript 5.9.3 spells
// one — its single-line form in a line comment, its multi-line form in a
// block comment, the pragma's name matched regardless of ASCII case, the
// factory its first argument when TypeScript parses that as an entity name —
// but wherever the comment stands and whatever its kind, where TypeScript
// itself reads `@jsx` and `@jsxFrag` from block comments among the file's
// leading comments alone (T6.5-22(b)'s `// @jsx h` and in-function lures).

import ts from "typescript-5.9.3";
import { readMdxTree } from "../mdx-derivability.js";
import { judgeTypeScript } from "../ts-derivability.js";

/** The kinds of receiving file SPEC 6.5 distinguishes (14.20). */
export type ReceivingFileKind = "spec-source" | "typescript" | "tsx";

export interface NameAnalysis {
  readonly kind: ReceivingFileKind;
  /** (a) Every name the file declares, in any scope, at value or type level. */
  readonly declared: ReadonlySet<string>;
  /** (b) Every name the file references, at value or type level. */
  readonly referenced: ReadonlySet<string>;
  /** In a TSX source, the leading identifier of the factory each `@jsx` or
   * `@jsxFrag` pragma in one of its comments names; empty otherwise. */
  readonly pragmaFactories: ReadonlySet<string>;
}

/** One way an added identifier breaches T6.5-22(a). */
export interface AddedIdentifierBreach {
  readonly identifier: string;
  /** The clause breached, in words. */
  readonly clause: string;
}

/** A name's standing in a receiving file. */
export interface NameVerdict {
  readonly declared: boolean;
  readonly referenced: boolean;
  /** Why 6.5 bars the name there, or undefined when it does not. */
  readonly barred: string | undefined;
}

// ---------------------------------------------------------------------------
// (c) The barred names (SPEC 6.5; T6.5-22's constraint list).

/** ECMAScript 2024's ReservedWord (12.7.2). */
// prettier-ignore
const RESERVED_WORDS = [
  "await", "break", "case", "catch", "class", "const", "continue", "debugger",
  "default", "delete", "do", "else", "enum", "export", "extends", "false",
  "finally", "for", "function", "if", "import", "in", "instanceof", "new",
  "null", "return", "super", "switch", "this", "throw", "true", "try",
  "typeof", "var", "void", "while", "with", "yield",
];

/** The further words strict code admits as no binding (6.5's list). */
// prettier-ignore
const STRICT_MODE_BARRED = [
  "let", "static", "implements", "interface", "package", "private",
  "protected", "public", "eval", "arguments",
];

/** What TypeScript's compiler reserves in a module it emits in any format
 * but ECMAScript's. */
const MODULE_EMIT_RESERVED = ["require", "exports"];

/** ECMAScript 2024's global object properties: clause 19's value (19.1),
 * function (19.2), constructor (19.3), and other (19.4) properties. */
// prettier-ignore
const GLOBAL_OBJECT_PROPERTIES = [
  "globalThis", "Infinity", "NaN", "undefined",
  "eval", "isFinite", "isNaN", "parseFloat", "parseInt", "decodeURI",
  "decodeURIComponent", "encodeURI", "encodeURIComponent",
  "AggregateError", "Array", "ArrayBuffer", "BigInt", "BigInt64Array",
  "BigUint64Array", "Boolean", "DataView", "Date", "Error", "EvalError",
  "FinalizationRegistry", "Float32Array", "Float64Array", "Function",
  "Int8Array", "Int16Array", "Int32Array", "Map", "Number", "Object",
  "Promise", "Proxy", "RangeError", "ReferenceError", "RegExp", "Set",
  "SharedArrayBuffer", "String", "Symbol", "SyntaxError", "TypeError",
  "Uint8Array", "Uint8ClampedArray", "Uint16Array", "Uint32Array", "URIError",
  "WeakMap", "WeakRef", "WeakSet",
  "Atomics", "JSON", "Math", "Reflect",
];

/** Annex B's global object properties (B.2.1). */
const ANNEX_B_GLOBAL_PROPERTIES = ["escape", "unescape"];

/** Barred by name, being no ECMAScript 2024 global object property. */
const NAMED_GLOBALS = ["Iterator", "AsyncIterator", "SuppressedError"];

/** A spec source's compiler-provided names (2.1). */
const SPEC_SOURCE_PROVIDED: ReadonlySet<string> = new Set([
  "S",
  "Spec",
  "text",
]);

/** Every barred name 6.5 lists for every kind of file, with its clause; a
 * name in two lists keeps the first. */
const BARRED_EVERYWHERE: ReadonlyMap<string, string> = (() => {
  const barred = new Map<string, string>();
  const add = (names: readonly string[], clause: string): void => {
    for (const name of names) if (!barred.has(name)) barred.set(name, clause);
  };
  add(RESERVED_WORDS, "an ECMAScript 2024 reserved word");
  add(STRICT_MODE_BARRED, "a word strict code admits as no binding");
  add(
    MODULE_EMIT_RESERVED,
    "reserved by TypeScript's compiler in a module it emits in any format but ECMAScript's",
  );
  add(
    GLOBAL_OBJECT_PROPERTIES,
    "a global object property ECMAScript 2024 defines (clause 19)",
  );
  add(
    ANNEX_B_GLOBAL_PROPERTIES,
    "a global object property ECMAScript 2024's Annex B defines (B.2.1)",
  );
  add(NAMED_GLOBALS, "a global 6.5 bars by name");
  return barred;
})();

/** Why SPEC 6.5 bars `name` as an added import's identifier in the file
 * `analysis` describes, or undefined when it does not. */
export function barredReason(
  analysis: NameAnalysis,
  name: string,
): string | undefined {
  const everywhere = BARRED_EVERYWHERE.get(name);
  if (everywhere !== undefined) return everywhere;
  if (name.startsWith("__")) {
    return "a name beginning with `__`, as the helpers TypeScript's emit declares do";
  }
  if (analysis.kind === "tsx") {
    if (name === "React") {
      return "`React` in a TSX source, through which TypeScript's classic JSX transform reaches the file's factories";
    }
    if (analysis.pragmaFactories.has(name)) {
      return "in a TSX source, the leading identifier of a factory a `@jsx` or `@jsxFrag` pragma in one of its comments names";
    }
  }
  if (analysis.kind === "spec-source" && SPEC_SOURCE_PROVIDED.has(name)) {
    return "a compiler-provided name in a spec source (`S`, `Spec`, `text`)";
  }
  return undefined;
}

/** A name's standing in the file `analysis` describes. */
export function nameVerdict(analysis: NameAnalysis, name: string): NameVerdict {
  return {
    declared: analysis.declared.has(name),
    referenced: analysis.referenced.has(name),
    barred: barredReason(analysis, name),
  };
}

/**
 * T6.5-22(a)'s verdict on the identifiers an operation's added import
 * declarations bind in one file, `analysis` describing the file before the
 * operation: every breach, in the order the identifiers are given — none
 * when each is barred nowhere there, bound by no declaration of the file,
 * referenced nowhere in it, and distinct from the others added.
 */
export function addedIdentifierBreaches(
  analysis: NameAnalysis,
  added: readonly string[],
): readonly AddedIdentifierBreach[] {
  const breaches: AddedIdentifierBreach[] = [];
  const seen = new Set<string>();
  for (const identifier of added) {
    const barred = barredReason(analysis, identifier);
    if (barred !== undefined) {
      breaches.push({ identifier, clause: `barred: ${barred}` });
    }
    if (analysis.declared.has(identifier)) {
      breaches.push({
        identifier,
        clause:
          "bound by a declaration of the pre-operation file (in some scope, at value or type level)",
      });
    }
    if (analysis.referenced.has(identifier)) {
      breaches.push({
        identifier,
        clause:
          "equal to a name the pre-operation file references (at value or type level)",
      });
    }
    if (seen.has(identifier)) {
      breaches.push({
        identifier,
        clause: "not distinct from another identifier added to the file",
      });
    }
    seen.add(identifier);
  }
  return breaches;
}

// ---------------------------------------------------------------------------
// The analysis.

class NameCollector {
  readonly declared = new Set<string>();
  readonly referenced = new Set<string>();

  declare(name: string): void {
    this.declared.add(name);
  }

  reference(name: string): void {
    this.referenced.add(name);
  }
}

/** Analyzes a receiving file's decoded content as a file of `kind`. */
export function analyzeNames(
  kind: ReceivingFileKind,
  text: string,
): NameAnalysis {
  const names = new NameCollector();
  let pragmaFactories: ReadonlySet<string> = new Set();
  if (kind === "spec-source") {
    walkMdast(readMdxTree(text) as unknown as MdastNode, names);
  } else {
    const file = readCodeSource(kind, text);
    walkTypeScript(file, names);
    if (kind === "tsx") pragmaFactories = jsxPragmaFactories(file);
  }
  return {
    kind,
    declared: names.declared,
    referenced: names.referenced,
    pragmaFactories,
  };
}

/** An intrinsic JSX tag name: an ASCII lowercase first letter, or a `-`
 * (TypeScript's `isIntrinsicJsxName`; MDX's compiler judges alike). */
function isIntrinsicJsxName(name: string): boolean {
  const first = name.charCodeAt(0);
  return (first >= 0x61 && first <= 0x7a) || name.includes("-");
}

// ---------------------------------------------------------------------------
// Spec sources: the mdast tree and the ESTree of its ESM and expressions.

interface MdastNode {
  readonly type: string;
  readonly children?: readonly MdastNode[];
  readonly name?: string | null;
  readonly attributes?: readonly MdastAttribute[];
  readonly data?: { readonly estree?: unknown };
}

interface MdastAttribute {
  readonly type: string;
  readonly value?: unknown;
  readonly data?: { readonly estree?: unknown };
}

type EsNode = { readonly type: string } & Readonly<Record<string, unknown>>;

function isEsNode(value: unknown): value is EsNode {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

function harnessError(message: string): Error {
  return new Error(`S-6's name analysis: ${message}`);
}

/** The ESTree program the parse attached to an mdast node. */
function estreeOf(node: {
  readonly type: string;
  readonly data?: { readonly estree?: unknown };
}): EsNode {
  const estree = node.data?.estree;
  if (!isEsNode(estree) || estree.type !== "Program") {
    throw harnessError(
      `the parse attached no ESTree program to a ${node.type}`,
    );
  }
  return estree;
}

function walkMdast(node: MdastNode, names: NameCollector): void {
  switch (node.type) {
    case "mdxjsEsm":
    case "mdxFlowExpression":
    case "mdxTextExpression":
      new EstreeWalker(names).visit(estreeOf(node));
      break;
    case "mdxJsxFlowElement":
    case "mdxJsxTextElement":
      referenceMdxJsxName(node.name, names);
      for (const attribute of node.attributes ?? []) {
        walkMdxJsxAttribute(attribute, names);
      }
      break;
    default:
      break;
  }
  for (const child of node.children ?? []) walkMdast(child, names);
}

/** A JSX element's name as the mdast tree spells it: `null` for a fragment,
 * `a:b` namespaced, `a.b.c` a member name, else a plain one. */
function referenceMdxJsxName(
  name: string | null | undefined,
  names: NameCollector,
): void {
  if (name === null || name === undefined || name.includes(":")) return;
  if (name.includes(".")) {
    const root = name.slice(0, name.indexOf("."));
    if (root !== "this") names.reference(root);
    return;
  }
  if (!isIntrinsicJsxName(name)) names.reference(name);
}

function walkMdxJsxAttribute(
  attribute: MdastAttribute,
  names: NameCollector,
): void {
  if (attribute.type === "mdxJsxExpressionAttribute") {
    new EstreeWalker(names).visit(estreeOf(attribute));
    return;
  }
  if (attribute.type !== "mdxJsxAttribute") {
    throw harnessError(
      `no reading of the JSX attribute type ${attribute.type}`,
    );
  }
  // The attribute's name is never counted; a braced value is an expression.
  const value = attribute.value;
  if (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "mdxJsxAttributeValueExpression"
  ) {
    new EstreeWalker(names).visit(
      estreeOf(value as Parameters<typeof estreeOf>[0]),
    );
  }
}

/** Reads an ESTree program's names, node type by node type (ECMAScript 2024
 * as acorn builds it, with acorn-jsx's JSX nodes). */
class EstreeWalker {
  constructor(private readonly names: NameCollector) {}

  private child(node: EsNode, key: string): EsNode | null {
    const value = node[key];
    if (value === null || value === undefined) return null;
    if (isEsNode(value)) return value;
    throw harnessError(`${node.type}.${key} holds no ESTree node`);
  }

  private list(node: EsNode, key: string): readonly (EsNode | null)[] {
    const value = node[key];
    if (!Array.isArray(value)) {
      throw harnessError(`${node.type}.${key} holds no node list`);
    }
    return value.map((entry: unknown) => {
      if (entry === null) return null;
      if (isEsNode(entry)) return entry;
      throw harnessError(`${node.type}.${key} holds a non-node entry`);
    });
  }

  private name(node: EsNode): string {
    const name = node["name"];
    if (typeof name !== "string") {
      throw harnessError(`${node.type} carries no name`);
    }
    return name;
  }

  private visitKeys(node: EsNode, ...keys: string[]): void {
    for (const key of keys) this.visit(this.child(node, key));
  }

  private visitList(node: EsNode, key: string): void {
    for (const entry of this.list(node, key)) this.visit(entry);
  }

  visit(node: EsNode | null): void {
    if (node === null) return;
    switch (node.type) {
      // Nothing here is looked up through scope: literals, `this`, `super`,
      // a private name, template text, JSX text, `import.meta`/`new.target`,
      // a label, and a re-export's names (the other module's and the
      // exported one).
      case "Literal":
      case "ThisExpression":
      case "Super":
      case "PrivateIdentifier":
      case "TemplateElement":
      case "MetaProperty":
      case "EmptyStatement":
      case "DebuggerStatement":
      case "BreakStatement":
      case "ContinueStatement":
      case "ExportAllDeclaration":
      case "JSXText":
      case "JSXEmptyExpression":
        return;
      case "Identifier":
        this.names.reference(this.name(node));
        return;
      case "Program":
      case "BlockStatement":
      case "StaticBlock":
      case "ClassBody":
        this.visitList(node, "body");
        return;
      case "ExpressionStatement":
      case "ChainExpression":
      case "ParenthesizedExpression":
      case "JSXExpressionContainer":
      case "JSXSpreadChild":
        this.visitKeys(node, "expression");
        return;
      case "ReturnStatement":
      case "ThrowStatement":
      case "SpreadElement":
      case "UnaryExpression":
      case "UpdateExpression":
      case "AwaitExpression":
      case "YieldExpression":
      case "JSXSpreadAttribute":
        this.visitKeys(node, "argument");
        return;
      case "LabeledStatement":
        this.visitKeys(node, "body");
        return;
      case "WithStatement":
        this.visitKeys(node, "object", "body");
        return;
      case "IfStatement":
      case "ConditionalExpression":
        this.visitKeys(node, "test", "consequent", "alternate");
        return;
      case "SwitchStatement":
        this.visitKeys(node, "discriminant");
        this.visitList(node, "cases");
        return;
      case "SwitchCase":
        this.visitKeys(node, "test");
        this.visitList(node, "consequent");
        return;
      case "TryStatement":
        this.visitKeys(node, "block", "handler", "finalizer");
        return;
      case "CatchClause":
        this.pattern(this.child(node, "param"), "binding");
        this.visitKeys(node, "body");
        return;
      case "WhileStatement":
      case "DoWhileStatement":
        this.visitKeys(node, "test", "body");
        return;
      case "ForStatement":
        this.visitKeys(node, "init", "test", "update", "body");
        return;
      case "ForInStatement":
      case "ForOfStatement": {
        const left = this.child(node, "left");
        if (left?.type === "VariableDeclaration") this.visit(left);
        else this.pattern(left, "assignment");
        this.visitKeys(node, "right", "body");
        return;
      }
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression": {
        const id = this.child(node, "id");
        if (id !== null) this.names.declare(this.name(id));
        for (const param of this.list(node, "params")) {
          this.pattern(param, "binding");
        }
        this.visitKeys(node, "body");
        return;
      }
      case "VariableDeclaration":
        this.visitList(node, "declarations");
        return;
      case "VariableDeclarator":
        this.pattern(this.child(node, "id"), "binding");
        this.visitKeys(node, "init");
        return;
      case "ClassDeclaration":
      case "ClassExpression": {
        const id = this.child(node, "id");
        if (id !== null) this.names.declare(this.name(id));
        this.visitKeys(node, "superClass", "body");
        return;
      }
      // A key is a property name unless computed; a shorthand property's
      // value is the identifier it references.
      case "MethodDefinition":
      case "PropertyDefinition":
      case "Property":
        if (node["computed"] === true) this.visitKeys(node, "key");
        this.visitKeys(node, "value");
        return;
      case "ImportDeclaration":
        for (const specifier of this.list(node, "specifiers")) {
          const local =
            specifier === null ? null : this.child(specifier, "local");
          if (local === null) {
            throw harnessError("an import specifier binds no local name");
          }
          this.names.declare(this.name(local));
        }
        return;
      case "ExportNamedDeclaration":
        this.visitKeys(node, "declaration");
        // Without `from`, a specifier's local name is looked up in the file;
        // the exported name, and both names of a re-export, never are.
        if (this.child(node, "source") === null) {
          for (const specifier of this.list(node, "specifiers")) {
            const local =
              specifier === null ? null : this.child(specifier, "local");
            if (local?.type === "Identifier")
              this.names.reference(this.name(local));
          }
        }
        return;
      case "ExportDefaultDeclaration":
        this.visitKeys(node, "declaration");
        return;
      case "ArrayExpression":
        this.visitList(node, "elements");
        return;
      case "ObjectExpression":
        this.visitList(node, "properties");
        return;
      case "BinaryExpression":
      case "LogicalExpression":
        this.visitKeys(node, "left", "right");
        return;
      case "AssignmentExpression":
        this.pattern(this.child(node, "left"), "assignment");
        this.visitKeys(node, "right");
        return;
      case "CallExpression":
      case "NewExpression":
        this.visitKeys(node, "callee");
        this.visitList(node, "arguments");
        return;
      case "MemberExpression":
        this.visitKeys(node, "object");
        if (node["computed"] === true) this.visitKeys(node, "property");
        return;
      case "SequenceExpression":
        this.visitList(node, "expressions");
        return;
      case "TemplateLiteral":
        this.visitList(node, "expressions");
        return;
      case "TaggedTemplateExpression":
        this.visitKeys(node, "tag", "quasi");
        return;
      case "ImportExpression":
        this.visitKeys(node, "source", "options");
        return;
      case "JSXElement":
        this.visitKeys(node, "openingElement");
        this.visitList(node, "children");
        this.visitKeys(node, "closingElement");
        return;
      case "JSXFragment":
        this.visitList(node, "children");
        return;
      case "JSXOpeningElement":
        this.jsxName(this.child(node, "name"));
        this.visitList(node, "attributes");
        return;
      case "JSXClosingElement":
        this.jsxName(this.child(node, "name"));
        return;
      case "JSXAttribute":
        // The attribute's name is never counted.
        this.visitKeys(node, "value");
        return;
      default:
        throw harnessError(`no reading of the ESTree node type ${node.type}`);
    }
  }

  /** A binding pattern's names are declared; an assignment target's are
   * references. */
  private pattern(node: EsNode | null, mode: "binding" | "assignment"): void {
    if (node === null) return;
    switch (node.type) {
      case "Identifier":
        if (mode === "binding") this.names.declare(this.name(node));
        else this.names.reference(this.name(node));
        return;
      case "ObjectPattern":
        for (const property of this.list(node, "properties")) {
          if (property?.type === "RestElement") {
            this.pattern(this.child(property, "argument"), mode);
          } else if (property?.type === "Property") {
            if (property["computed"] === true) this.visitKeys(property, "key");
            this.pattern(this.child(property, "value"), mode);
          } else {
            throw harnessError("an object pattern holds an unknown entry");
          }
        }
        return;
      case "ArrayPattern":
        for (const element of this.list(node, "elements")) {
          this.pattern(element, mode);
        }
        return;
      case "RestElement":
        this.pattern(this.child(node, "argument"), mode);
        return;
      case "AssignmentPattern":
        this.pattern(this.child(node, "left"), mode);
        this.visitKeys(node, "right");
        return;
      case "MemberExpression":
        if (mode === "assignment") {
          this.visit(node);
          return;
        }
        break;
      default:
        break;
    }
    throw harnessError(`no reading of a ${mode} pattern of type ${node.type}`);
  }

  /** A JSX element name: a plain tag counts unless intrinsic, a member tag
   * by its root, a namespaced tag never. */
  private jsxName(node: EsNode | null): void {
    if (node === null) throw harnessError("a JSX element carries no name");
    switch (node.type) {
      case "JSXIdentifier": {
        const name = this.name(node);
        if (!isIntrinsicJsxName(name)) this.names.reference(name);
        return;
      }
      case "JSXMemberExpression": {
        let root: EsNode | null = node;
        while (root?.type === "JSXMemberExpression") {
          root = this.child(root, "object");
        }
        if (root?.type !== "JSXIdentifier") {
          throw harnessError("a JSX member name has no identifier root");
        }
        const name = this.name(root);
        if (name !== "this") this.names.reference(name);
        return;
      }
      case "JSXNamespacedName":
        return;
      default:
        throw harnessError(`no reading of the JSX name type ${node.type}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Code sources: TypeScript 5.9.3's tree.

// TypeScript keeps the module indicator `setExternalModuleIndicator` sets off
// its public declarations.
interface ModuleIndicated {
  externalModuleIndicator?: unknown;
}

function readCodeSource(
  kind: "typescript" | "tsx",
  text: string,
): ts.SourceFile {
  const name = kind === "tsx" ? "s6-receiver.tsx" : "s6-receiver.ts";
  const verdict = judgeTypeScript(text, name);
  if (verdict.verdict !== "well-formed") {
    throw harnessError(
      `no names are read from a code source that is not well-formed under SPEC 14.20 (${verdict.reason})`,
    );
  }
  return ts.createSourceFile(
    name,
    text,
    {
      languageVersion: ts.ScriptTarget.ESNext,
      setExternalModuleIndicator: (sourceFile) => {
        (sourceFile as unknown as ModuleIndicated).externalModuleIndicator =
          true;
      },
    },
    true,
    kind === "tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function walkTypeScript(file: ts.SourceFile, names: NameCollector): void {
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      const role = identifierRole(node);
      if (role === "declared") names.declare(node.text);
      else if (role === "referenced") names.reference(node.text);
      return;
    }
    // A string-named enum member is resolved by its text inside its enum.
    if (ts.isEnumMember(node) && ts.isStringLiteral(node.name)) {
      names.declare(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
}

type IdentifierRole = "declared" | "referenced" | "neither";

/** What an identifier is, by where its parent holds it. */
function identifierRole(id: ts.Identifier): IdentifierRole {
  const parent = id.parent;
  const { SyntaxKind } = ts;
  const named = parent as unknown as { readonly name?: ts.Node };
  switch (parent.kind) {
    case SyntaxKind.Parameter:
      if (named.name !== id) return "referenced";
      return id.text === "this" ? "neither" : "declared";
    case SyntaxKind.VariableDeclaration:
    case SyntaxKind.FunctionDeclaration:
    case SyntaxKind.FunctionExpression:
    case SyntaxKind.ClassDeclaration:
    case SyntaxKind.ClassExpression:
    case SyntaxKind.InterfaceDeclaration:
    case SyntaxKind.TypeAliasDeclaration:
    case SyntaxKind.EnumDeclaration:
    case SyntaxKind.EnumMember:
    case SyntaxKind.TypeParameter:
    case SyntaxKind.ImportClause:
    case SyntaxKind.NamespaceImport:
    case SyntaxKind.ImportEqualsDeclaration:
    case SyntaxKind.NamespaceExportDeclaration:
      return named.name === id ? "declared" : "referenced";
    case SyntaxKind.BindingElement: {
      const element = parent as ts.BindingElement;
      if (element.name === id) return "declared";
      return element.propertyName === id ? "neither" : "referenced";
    }
    case SyntaxKind.ModuleDeclaration:
      if (named.name !== id) return "referenced";
      return (parent.flags & ts.NodeFlags.GlobalAugmentation) !== 0
        ? "neither"
        : "declared";
    case SyntaxKind.ImportSpecifier:
      return named.name === id ? "declared" : "neither";
    case SyntaxKind.ExportSpecifier: {
      const specifier = parent as ts.ExportSpecifier;
      if (specifier.parent.parent.moduleSpecifier !== undefined) {
        return "neither";
      }
      return (specifier.propertyName ?? specifier.name) === id
        ? "referenced"
        : "neither";
    }
    case SyntaxKind.PropertyAccessExpression:
    case SyntaxKind.PropertyDeclaration:
    case SyntaxKind.PropertySignature:
    case SyntaxKind.PropertyAssignment:
    case SyntaxKind.MethodDeclaration:
    case SyntaxKind.MethodSignature:
    case SyntaxKind.GetAccessor:
    case SyntaxKind.SetAccessor:
    case SyntaxKind.NamedTupleMember:
    case SyntaxKind.JsxAttribute:
      return named.name === id ? "neither" : "referenced";
    case SyntaxKind.QualifiedName: {
      const qualified = parent as ts.QualifiedName;
      if (qualified.right === id) return "neither";
      return inImportTypeQualifier(qualified) ? "neither" : "referenced";
    }
    case SyntaxKind.TypePredicate:
      return (parent as ts.TypePredicateNode).parameterName === id
        ? "neither"
        : "referenced";
    case SyntaxKind.LabeledStatement:
    case SyntaxKind.BreakStatement:
    case SyntaxKind.ContinueStatement:
      return (parent as unknown as { readonly label?: ts.Node }).label === id
        ? "neither"
        : "referenced";
    case SyntaxKind.JsxOpeningElement:
    case SyntaxKind.JsxSelfClosingElement:
    case SyntaxKind.JsxClosingElement: {
      const element = parent as unknown as { readonly tagName: ts.Node };
      if (element.tagName !== id) return "referenced";
      return isIntrinsicJsxName(id.text) ? "neither" : "referenced";
    }
    case SyntaxKind.ImportType:
    case SyntaxKind.NamespaceExport:
    case SyntaxKind.ImportAttribute:
    case SyntaxKind.MetaProperty:
    case SyntaxKind.JsxNamespacedName:
      return "neither";
    default:
      return "referenced";
  }
}

/** Whether a qualified name's left side lies in an import type's qualifier
 * (`import("m").A.B`): names of the module's exports, never looked up in
 * the file. */
function inImportTypeQualifier(name: ts.QualifiedName): boolean {
  let top: ts.Node = name;
  while (ts.isQualifiedName(top.parent) && top.parent.left === top) {
    top = top.parent;
  }
  return ts.isImportTypeNode(top.parent) && top.parent.qualifier === top;
}

// ---------------------------------------------------------------------------
// A TSX source's `@jsx` and `@jsxFrag` pragmas, in any of its comments.

// TypeScript 5.9.3's pragma spellings (its `extractPragmas`): a line comment
// that is a triple-slash XML directive holds no other pragma; a line
// comment's one pragma begins the comment; a block comment holds a pragma at
// each `@` its multi-line pattern matches.
const TRIPLE_SLASH_XML = /^\/\/\/\s*<(\S+)\s.*?\/>/m;
const SINGLE_LINE_PRAGMA = /^\/\/\/?\s*@([^\s:]+)((?:[^\S\r\n]|:).*)?$/m;
const MULTI_LINE_PRAGMA = /@(\S+)(\s+(?:\S.*)?)?$/gm;

const JSX_FACTORY_PRAGMAS: ReadonlySet<string> = new Set(["jsx", "jsxfrag"]);

function jsxPragmaFactories(file: ts.SourceFile): ReadonlySet<string> {
  const factories = new Set<string>();
  for (const range of commentRanges(file)) {
    const comment = file.text.slice(range.pos, range.end);
    for (const match of pragmaMatches(comment, range.kind)) {
      if (!JSX_FACTORY_PRAGMAS.has((match[1] ?? "").toLowerCase())) continue;
      // The factory is the first argument, an entity name TypeScript parses.
      const factory = (match[2] ?? "").trim().split(/\s+/)[0] ?? "";
      if (factory === "") continue;
      let entity = ts.parseIsolatedEntityName(factory, ts.ScriptTarget.ESNext);
      if (entity === undefined) continue;
      while (ts.isQualifiedName(entity)) entity = entity.left;
      factories.add(entity.text);
    }
  }
  return factories;
}

function pragmaMatches(
  comment: string,
  kind: ts.CommentKind,
): readonly RegExpExecArray[] {
  if (kind === ts.SyntaxKind.SingleLineCommentTrivia) {
    if (TRIPLE_SLASH_XML.test(comment)) return [];
    const match = SINGLE_LINE_PRAGMA.exec(comment);
    return match === null ? [] : [match];
  }
  return [...comment.matchAll(MULTI_LINE_PRAGMA)];
}

/**
 * Every comment of the file: the trivia before each token — read from the
 * token's full start, both the comments TypeScript calls trailing (before
 * the first line break) and leading (after it). A JSX text's content is no
 * trivia, and a JSDoc node's comment lies in the trivia of the token after it.
 */
function commentRanges(file: ts.SourceFile): readonly ts.CommentRange[] {
  const { text } = file;
  const found = new Map<number, ts.CommentRange>();
  const gather = (pos: number): void => {
    for (const range of [
      ...(ts.getTrailingCommentRanges(text, pos) ?? []),
      ...(ts.getLeadingCommentRanges(text, pos) ?? []),
    ]) {
      found.set(range.pos, range);
    }
  };
  const visit = (node: ts.Node): void => {
    if (node.kind === ts.SyntaxKind.JsxText) return;
    if (
      node.kind >= ts.SyntaxKind.FirstJSDocNode &&
      node.kind <= ts.SyntaxKind.LastJSDocNode
    ) {
      return;
    }
    const children = node.getChildren(file);
    if (children.length === 0) {
      gather(node.pos);
      return;
    }
    for (const child of children) visit(child);
  };
  visit(file);
  return [...found.values()].sort((a, b) => a.pos - b.pos);
}
