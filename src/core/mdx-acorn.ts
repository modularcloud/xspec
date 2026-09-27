// The ECMAScript 2024 grammar of MDX 3's braces and ESM blocks, judged by
// derivability alone (SPEC 14.20).
//
// IMPLEMENTATION (Key libraries): remark-mdx parses every expression
// container, attribute value expression, spread attribute, and ESM block of a
// spec source with acorn, JSX added by acorn-jsx (SPEC 14.20 admits JSX in all
// three). SPEC 14.20 decides well-formedness "by derivability alone": the
// language's productions, and the supplemental grammars that refine what a
// covering production matches — an object or array literal read as an
// assignment pattern, a parenthesized list read as arrow parameters — derive
// the text or do not, and no rule beyond them takes part. ECMAScript's
// static-semantic early errors are such rules: a duplicate lexically declared
// name, an export naming no declaration, an assignment to a target that is not
// simple (`1 = 2`), a strict-mode restriction (`let` as an identifier
// reference, a legacy octal literal) — the SPEC's list is illustrative. Stock
// acorn enforces them while it parses, so a file failing only such a rule would
// report 14.20 where it is well-formed and must reach its ordinary outcome
// (14.8, 14.15, 14.16, 14.17).
//
// `mdxAcorn` is acorn extended to decide exactly the grammar. Every early error
// acorn raises is suppressed — the parse goes on as though the rule were absent
// — while every raise that reports a derivation failure still throws, at the
// position and in the order acorn raises it. Each rule below was verified
// against acorn 8.17's source (`node_modules/acorn/dist/acorn.js`): most early
// errors are told apart by acorn's own message; where acorn spells an early
// error and a derivation failure alike — "Unexpected token", "Assigning to
// rvalue", "Invalid number", a reserved word used as an identifier — the
// parser's state or the offending node tells them apart, as each rule records.
// Where acorn's grammar itself departs from ECMAScript 2024's, the extension
// restores the edition's: an escape-spelled reserved word is an identifier
// (its restriction an early error), a regular expression's pattern and flags
// are judged by early errors alone, and a class static block reads `await`
// as ECMAScript's [Await] parameter does there. One departure remains:
// acorn reads `await` where that parameter is on, and `yield` in a
// generator, as an AwaitExpression or YieldExpression before it can see a
// following `=>`, so `await => 1` and a generator's `yield => 1` — arrows
// whose one parameter derives, an early error — stay unparseable.

import type { TokenType } from "acorn";
import { Parser, tokTypes } from "acorn";
import acornJsx from "acorn-jsx";

/**
 * SPEC 14.20: the edition and goal MDX 3 parses with — ECMAScript 2024, a
 * module's top-level code (`await` admitted, `yield` an identifier). Two
 * acorn conveniences beyond the edition are turned off: a `#!` line is a
 * hashbang comment only at a Script's or Module's start, never at the start
 * of an expression container's content, which derives one `Expression`; and
 * private-name existence (`#x` declared by an enclosing class) is an early
 * error, never a derivation failure.
 */
export const MDX_ACORN_OPTIONS = {
  ecmaVersion: 2024,
  sourceType: "module",
  allowHashBang: false,
  checkPrivateFields: false,
} as const;

// acorn's scope flags (acorn 8.17, `SCOPE_*`).
const SCOPE_FUNCTION = 2;
const SCOPE_ASYNC = 4;
const SCOPE_CLASS_STATIC_BLOCK = 256;
const SCOPE_CLASS_FIELD_INIT = 512;

// acorn's binding types (acorn 8.17, `BIND_*`): an assignment target.
const BIND_NONE = 0;

/** A node as acorn builds it: the members the rules below read. */
interface AcornNode {
  readonly type: string;
  readonly start: number;
  readonly end: number;
  /** A ParenthesizedExpression's operand. */
  readonly expression?: AcornNode;
  /** An ExportSpecifier's local name. */
  readonly local?: AcornNode;
  /** A MethodDefinition's kind, key, and function. */
  readonly kind?: string;
  readonly key?: AcornNode;
  readonly value?: AcornNode;
  /** A function's parameters. */
  readonly params?: readonly AcornNode[];
}

/**
 * Structural view of acorn's parser (not in its public types), verified
 * against acorn 8.17: the state the rules read, the methods overridden, and
 * this module's own per-parse state (one parser instance parses one text).
 */
interface DerivingParser {
  readonly input: string;
  /** The tokenizer's position. */
  readonly pos: number;
  /** The current token's type and start. */
  readonly type: TokenType;
  readonly start: number;
  /** Whether the current word was spelled with a `\u` escape. */
  readonly containsEsc: boolean;
  /** The edition's keywords, as acorn tokenizes them. */
  readonly keywords: RegExp;
  readonly scopeStack: readonly { readonly flags: number }[];
  readonly inGenerator: boolean;
  readWord1(): string;
  finishToken(type: TokenType, value?: unknown): unknown;
  raiseRecoverable(pos: number, message: string): void;
  /** Whether a line terminator (or `}` or the end) precedes the token. */
  canInsertSemicolon(): boolean;

  /** Depth of `toAssignable` calls in progress (the "Unexpected token" rule). */
  xspecAssignableDepth?: number;
  /** The token after a `const` declarator's binding, pending its initializer. */
  xspecConstAfterBinding?: number;
  /** The start of the labelled item being parsed. */
  xspecLabelledItem?: number;
  /** Whether an identifier parsed now is a binding or a reference. */
  xspecNames?: "binding" | "reference";
  /** The local names of an export's specifier list, by start. */
  xspecExportLocals?: Set<number>;
  /** Accessor keys named `constructor`, by start (their arity rule). */
  xspecAccessorConstructors?: Set<number>;
}

/** acorn's parser methods overridden below, as its prototype holds them. */
interface ParserMethods {
  raise(this: DerivingParser, pos: number, message: string): void;
  raiseRecoverable(this: DerivingParser, pos: number, message: string): void;
  readWord(this: DerivingParser): unknown;
  validateRegExpFlags(this: DerivingParser, state: unknown): void;
  validateRegExpPattern(this: DerivingParser, state: unknown): void;
  checkExpressionErrors(
    this: DerivingParser,
    refDestructuringErrors: unknown,
    andThrow?: boolean,
  ): boolean;
  toAssignable(
    this: DerivingParser,
    node: AcornNode | null,
    isBinding: boolean,
    refDestructuringErrors?: unknown,
  ): AcornNode | null;
  checkLValSimple(
    this: DerivingParser,
    expr: AcornNode,
    bindingType?: number,
    checkClashes?: unknown,
  ): void;
  parseVarId(this: DerivingParser, decl: unknown, kind: string): void;
  parseLabeledStatement(this: DerivingParser, ...args: unknown[]): unknown;
  parseClassElement(this: DerivingParser, ...args: unknown[]): AcornNode | null;
  parseExportSpecifiers(this: DerivingParser, ...args: unknown[]): AcornNode[];
  parseExprAtom(this: DerivingParser, ...args: unknown[]): unknown;
  parseBindingAtom(this: DerivingParser, ...args: unknown[]): unknown;
  parseFunction(this: DerivingParser, ...args: unknown[]): unknown;
  parseClassId(this: DerivingParser, ...args: unknown[]): unknown;
  parseBreakContinueStatement(
    this: DerivingParser,
    ...args: unknown[]
  ): unknown;
}

/**
 * acorn's messages that report an early error and nothing else, wherever
 * raised (each the ECMAScript 2024 rule named beside it). acorn continues
 * correctly after each: it raises them from checks whose parse goes on.
 */
const EARLY_ERROR_MESSAGES: ReadonlySet<string> = new Set([
  // PropertyDefinition : CoverInitializedName, outside a pattern.
  "Shorthand property assignments are valid only in destructuring patterns",
  // Duplicate `__proto__: …` entries of one object literal.
  "Redefinition of __proto__ property",
  // Arrow and generator parameters containing YieldExpression/AwaitExpression.
  "Yield expression cannot be a default value",
  "Await expression cannot be a default value",
  // ContainsUndefinedBreakTarget / ContainsUndefinedContinueTarget and the
  // enclosing-statement rules of `break` and `continue`.
  "Unsyntactic break",
  "Unsyntactic continue",
  // WithStatement in strict mode code.
  "'with' in strict mode",
  // Class bodies: constructor, `#constructor`, and `prototype` rules (an
  // accessor named `constructor` has its own rule, `isEarlyError`).
  "Duplicate constructor in the same class",
  "Classes can't have an element named '#constructor'",
  "Constructor can't be a generator",
  "Constructor can't be an async method",
  "Classes may not have a static property named prototype",
  "Classes can't have a field named 'constructor'",
  "Classes can't have a static field named 'prototype'",
  // ExportDeclaration : export NamedExports ; — a string ReferencedBinding.
  "A string literal cannot be used as an exported binding without `from`.",
  // ModuleExportName : StringLiteral — IsStringWellFormedUnicode.
  "An export name cannot include a lone surrogate.",
  // AssignmentTargetType of an OptionalExpression (as a binding, a
  // derivation failure: `OPTIONAL_CHAIN_TARGET`).
  "Optional chaining cannot appear in left-hand side",
  // BoundNames of a LexicalDeclaration containing "let".
  "let is disallowed as a lexically bound name",
  // Duplicate formal parameters.
  "Argument name clash",
  // `delete` of an identifier (strict mode) or a private member.
  "Deleting local variable in strict mode",
  "Private fields can not be deleted",
  // NewTarget, SuperProperty, SuperCall outside what may contain them.
  "'new.target' can only be used in functions and class static block",
  "'super' keyword outside a method",
  "super() call outside constructor of a subclass",
  // OptionalChain : ?. TemplateLiteral / OptionalChain TemplateLiteral.
  "Optional chaining cannot appear in the tag of tagged template expressions",
  // NotEscapeSequence in an untagged template.
  "Bad escape sequence in untagged template literal",
  // "use strict" in a function with non-simple parameters.
  "Illegal 'use strict' directive in function with non-simple parameter list",
  // ContainsArguments of a field initializer or static block.
  "Cannot use 'arguments' in class field initializer",
  "Cannot use arguments in class static initialization block",
  // LegacyOctalEscapeSequence and NonOctalDecimalEscapeSequence in strict
  // mode code.
  "Octal literal in strict mode",
  "Invalid escape sequence",
  // IdentifierStart/IdentifierPart :: \ UnicodeEscapeSequence whose code
  // point is no IdentifierStartChar/IdentifierPartChar.
  "Invalid Unicode escape",
]);

/** Early-error messages naming a binding, label, or export (acorn 8.17). */
const EARLY_ERROR_PATTERNS: readonly RegExp[] = [
  // A duplicate lexically declared name (private names included).
  /^Identifier '.+' has already been declared$/u,
  // ExportedBindings not declared in the module.
  /^Export '.+' is not defined$/u,
  // Duplicate ExportedNames.
  /^Duplicate export '.+'$/u,
  // ContainsDuplicateLabels.
  /^Label '.+' is already declared$/u,
  // AllPrivateIdentifiersValid.
  /^Private field '#.+' must be declared in an enclosing class$/u,
  // `eval`, `arguments`, and the strict-mode reserved words assigned to or
  // bound in strict mode code.
  /^(?:Assigning to|Binding) \S+ in strict mode$/u,
];

/**
 * The strict-mode reserved words (ECMAScript 2024, 13.1.1): an Identifier's
 * StringValue among them is an early error in strict mode code, never a
 * derivation failure. `yield` has its own rule below.
 */
const STRICT_RESERVED: ReadonlySet<string> = new Set([
  "implements",
  "interface",
  "let",
  "package",
  "private",
  "protected",
  "public",
  "static",
]);

/** acorn's messages rejecting an identifier's name (`checkUnreserved`). */
const NAME_MESSAGES: readonly {
  readonly pattern: RegExp;
  readonly name?: string;
}[] = [
  { pattern: /^Unexpected keyword '(.+)'$/u },
  { pattern: /^The keyword '(.+)' is reserved$/u },
  {
    pattern: /^Cannot use keyword 'await' outside an async function$/u,
    name: "await",
  },
  {
    pattern: /^Cannot use 'await' as identifier inside an async function$/u,
    name: "await",
  },
  {
    pattern: /^Cannot use await in class static initialization block$/u,
    name: "await",
  },
  {
    pattern: /^Cannot use 'yield' as identifier inside a generator$/u,
    name: "yield",
  },
];

/** acorn's message for an accessor named `constructor` (see its rule). */
const ACCESSOR_CONSTRUCTOR = "Constructor can't have get/set modifier";

/**
 * acorn's message for an optional chain as an assignment target — an early
 * error (13.15.1) — and as a binding, a derivation failure (`toAssignable`).
 */
const OPTIONAL_CHAIN_TARGET =
  "Optional chaining cannot appear in left-hand side";

/** acorn's message for `await` bound or referenced in an async function. */
const AWAIT_IN_ASYNC =
  "Cannot use 'await' as identifier inside an async function";

/**
 * LeftHandSideExpression forms acorn does not convert into a pattern and
 * that are no simple assignment target: an assignment to one derives, its
 * AssignmentTargetType an early error (ECMAScript 2024, 13.15.1, 13.4).
 */
const NON_SIMPLE_LHS_TYPES: ReadonlySet<string> = new Set([
  "Literal",
  "ThisExpression",
  "TemplateLiteral",
  "TaggedTemplateExpression",
  "FunctionExpression",
  "ClassExpression",
  "CallExpression",
  "NewExpression",
  "MetaProperty",
  "ImportExpression",
  "JSXElement",
  "JSXFragment",
]);

/** The simple assignment targets: acorn's own checks apply to them. */
const SIMPLE_TARGET_TYPES: ReadonlySet<string> = new Set([
  "Identifier",
  "MemberExpression",
]);

/**
 * UnaryExpression forms that are no LeftHandSideExpression: one derives as a
 * target only as the operand of a prefix `++`/`--` (ECMAScript 2024, 13.4).
 */
const UNARY_OPERAND_TYPES: ReadonlySet<string> = new Set([
  "UnaryExpression",
  "UpdateExpression",
  "AwaitExpression",
]);

/** The keyword token type of `word` (acorn's `keywordTypes`, by name). */
function keywordType(word: string): TokenType {
  const types = tokTypes as unknown as Readonly<
    Record<string, TokenType | undefined>
  >;
  return types[`_${word}`] ?? tokTypes.name;
}

/**
 * Whether a raise of acorn's at `pos` with `message` reports an early error
 * — suppressed — rather than a derivation failure (SPEC 14.20).
 * `recoverable` tells acorn's `raiseRecoverable` from its `raise`.
 */
function isEarlyError(
  parser: DerivingParser,
  pos: number,
  message: string,
  recoverable: boolean,
): boolean {
  if (message === ACCESSOR_CONSTRUCTOR) {
    // A `get`/`set` method named `constructor` is an early error
    // (ECMAScript 2024, 15.7.1), but acorn then parses it as the
    // constructor and skips the accessor's parameter grammar, which
    // `parseClassElement` below applies instead.
    (parser.xspecAccessorConstructors ??= new Set()).add(pos);
    return true;
  }
  if (
    EARLY_ERROR_MESSAGES.has(message) ||
    EARLY_ERROR_PATTERNS.some((pattern) => pattern.test(message))
  ) {
    return true;
  }
  switch (message) {
    case "Assigning to rvalue":
      // acorn raises it recoverably for a parenthesized non-simple target
      // inside a pattern (`[(a + b)] = c`): a ParenthesizedExpression is a
      // LeftHandSideExpression, so an early error. Every other raise of it
      // is one `toAssignable`/`checkLValSimple` below leave to acorn: a
      // target no LeftHandSideExpression derives (`a + b = c`).
      return recoverable;
    case "Invalid number":
      // A legacy octal-like integer (`010`, `09`) in strict mode code is an
      // early error (ECMAScript 2024, 12.9.3.1), raised at the literal's
      // start once its digits are read; acorn raises the same message for
      // an exponent with no digits (`1e`), after reading past the `e`.
      return /^0[0-9]+$/u.test(parser.input.slice(pos, parser.pos));
    case "Unexpected token":
      return unexpectedTokenIsEarlyError(parser, pos);
    case AWAIT_IN_ASYNC:
      if (!recoverable) {
        // Raised (not recoverably) for an identifier already admitted by
        // acorn's reserved-word check: an assignment target or an async
        // arrow's parameter named `await` — a binding.
        return true;
      }
      break;
    default:
      break;
  }
  for (const { pattern, name } of NAME_MESSAGES) {
    const match = pattern.exec(message);
    if (match !== null) {
      return nameIsEarlyError(parser, pos, name ?? match[1]);
    }
  }
  return false;
}

/**
 * The "Unexpected token" raises of acorn's that report an early error: each
 * identified by the parser's state at the raise, since acorn spells every
 * derivation failure of a token the same way.
 */
function unexpectedTokenIsEarlyError(
  parser: DerivingParser,
  pos: number,
): boolean {
  if ((parser.xspecAssignableDepth ?? 0) > 0) {
    // Converting an assignment target into a pattern, acorn raises it for
    // an AssignmentRestProperty whose target is an object or array literal
    // (`({...{a}} = b)`) — an early error (ECMAScript 2024, 13.15.5.1) —
    // and for nothing else.
    return true;
  }
  if (pos === parser.start && pos === parser.xspecConstAfterBinding) {
    // A `const` binding with no initializer is an early error (14.3.1.1);
    // acorn raises at the token after the binding, once (the statement's
    // own terminator check raises there again, a derivation failure).
    parser.xspecConstAfterBinding = -1;
    return true;
  }
  // LabelledItem : FunctionDeclaration is an early error (14.13.1); acorn
  // raises at the `function` token beginning the labelled item.
  return (
    pos === parser.start &&
    pos === parser.xspecLabelledItem &&
    parser.type === tokTypes._function
  );
}

/**
 * The raises of acorn's reserved-word check for an identifier named `name`
 * at `pos` (ECMAScript 2024, 13.1): a ReservedWord matches its code points
 * as spelled, and an identifier whose StringValue is reserved is an early
 * error — so a name spelled with an escape derives, as does every
 * restriction of strict mode code. A plainly spelled ReservedWord is no
 * Identifier at all — a derivation failure — except as an export's
 * IdentifierName reference (`export { if }`, 16.2.3.1). `await` and `yield`
 * are identifiers wherever the edition's [Await] or [Yield] parameter is
 * off; where it is on, BindingIdentifier still derives them (an early
 * error) while IdentifierReference and LabelIdentifier do not.
 */
function nameIsEarlyError(
  parser: DerivingParser,
  pos: number,
  name: string,
): boolean {
  if (!parser.input.startsWith(name, pos)) {
    return true;
  }
  if (parser.xspecExportLocals?.has(pos) === true) {
    return true;
  }
  // An identifier followed by `=>` is an arrow's one parameter, a
  // BindingIdentifier (`async await => 1`); acorn reads on to the arrow.
  const binds =
    parser.xspecNames !== "reference" || parser.type === tokTypes.arrow;
  if (name === "await") {
    return awaitIsIdentifier(parser) || binds;
  }
  if (name === "yield") {
    return !parser.inGenerator || binds;
  }
  return STRICT_RESERVED.has(name);
}

/**
 * Whether ECMAScript's [Await] parameter is off at the parser's position —
 * `await` an identifier: inside a function that is not async (its
 * parameters included; an arrow's parameters are read before its scope
 * opens). It is on at a module's top level, in async functions, and in
 * class static blocks, and a class field initializer inherits it from
 * the class's context (ECMAScript 2024, 15.7).
 */
function awaitIsIdentifier(parser: DerivingParser): boolean {
  for (let index = parser.scopeStack.length - 1; index >= 0; index -= 1) {
    const flags = parser.scopeStack[index].flags;
    if ((flags & SCOPE_CLASS_STATIC_BLOCK) !== 0) {
      return false;
    }
    if ((flags & SCOPE_CLASS_FIELD_INIT) !== 0) {
      continue;
    }
    if ((flags & SCOPE_FUNCTION) !== 0) {
      return (flags & SCOPE_ASYNC) === 0;
    }
  }
  return false;
}

/**
 * ECMAScript 2024, 13.15.1: whether an `=` assignment's target (or a
 * for-in/of head's) derives while its AssignmentTargetType is not simple —
 * an early error (`1 = 2`, `f() = 1`, `(a + b) = 1`, `({a}) = 1`). A
 * parenthesized expression is a LeftHandSideExpression whatever it
 * encloses, never refined into a pattern; an unparenthesized object or
 * array literal is refined (acorn's conversion applies), an identifier or
 * member access is simple (acorn's checks apply), and a target that is no
 * LeftHandSideExpression (`a + b = 1`) does not derive (acorn raises).
 */
function assignmentTargetIsEarlyError(node: AcornNode): boolean {
  if (node.type === "ParenthesizedExpression") {
    let inner: AcornNode = node;
    while (
      inner.type === "ParenthesizedExpression" &&
      inner.expression !== undefined
    ) {
      inner = inner.expression;
    }
    return !SIMPLE_TARGET_TYPES.has(inner.type);
  }
  return NON_SIMPLE_LHS_TYPES.has(node.type);
}

/**
 * ECMAScript 2024, 13.4 and 13.15.1: whether a target of `++`/`--` or of a
 * compound or logical assignment derives while its AssignmentTargetType is
 * not simple — an early error. A compound assignment's or postfix
 * operator's target is any LeftHandSideExpression (an object or array
 * literal included, never refined there); a prefix operator's operand is
 * any UnaryExpression (`++-a`, `++ ++a`). acorn checks a prefix operand
 * once the operand is read, the token after it current; it checks an
 * assignment's target with the assignment operator current, and a postfix
 * operand with the postfix `++`/`--` current (no line terminator before
 * it, else it would be no postfix operator) — and no UnaryExpression that
 * is no LeftHandSideExpression derives as either (`-a += 1`, `a-- ++`).
 * A complete prefix operand is never followed by a postfix operator.
 */
function simpleTargetIsEarlyError(
  parser: DerivingParser,
  expr: AcornNode,
): boolean {
  if (
    expr.type === "ObjectExpression" ||
    expr.type === "ArrayExpression" ||
    expr.type === "ObjectPattern" ||
    expr.type === "ArrayPattern"
  ) {
    return true;
  }
  if (UNARY_OPERAND_TYPES.has(expr.type)) {
    const current = parser.type as TokenType & { readonly isAssign?: boolean };
    const postfix =
      parser.type === tokTypes.incDec && !parser.canInsertSemicolon();
    return current.isAssign !== true && !postfix;
  }
  return assignmentTargetIsEarlyError(expr);
}

/**
 * The accessor grammar of a `get`/`set` method named `constructor`
 * (ECMAScript 2024, 15.4): `get` takes no parameter, `set` exactly one that
 * is no rest parameter — derivation failures, raised as acorn raises them
 * for every other accessor.
 */
function checkAccessorParameters(
  parser: DerivingParser,
  modifier: string,
  method: AcornNode | undefined,
): void {
  const params = method?.params ?? [];
  const at = method?.start ?? parser.start;
  if (modifier === "get" && params.length !== 0) {
    parser.raiseRecoverable(at, "getter should have no params");
  } else if (modifier === "set" && params.length !== 1) {
    parser.raiseRecoverable(at, "setter should have exactly one param");
  } else if (modifier === "set" && params[0].type === "RestElement") {
    parser.raiseRecoverable(params[0].start, "Setter cannot use rest params");
  }
}

/**
 * Wrap a parse method so the identifiers it parses directly are bindings or
 * references (`nameIsEarlyError`): expression atoms and `break`/`continue`
 * labels refer; binding atoms, function names, and class names bind.
 * Outside every such method — an ESM block's own declarations — names bind.
 */
function namingAs(
  kind: "binding" | "reference",
  method: (this: DerivingParser, ...args: unknown[]) => unknown,
): (this: DerivingParser, ...args: unknown[]) => unknown {
  return function (this: DerivingParser, ...args: unknown[]): unknown {
    const saved = this.xspecNames;
    this.xspecNames = kind;
    try {
      return method.apply(this, args);
    } finally {
      this.xspecNames = saved;
    }
  };
}

/** The acorn plugin excluding early errors (see the module comment). */
function excludeEarlyErrors(BaseParser: typeof Parser): typeof Parser {
  // One more derivation level, so the class handed in stays untouched.
  const Extended = class extends (BaseParser as unknown as new (
    ...args: never[]
  ) => object) {};
  const prototype = Extended.prototype as unknown as ParserMethods;
  const base = BaseParser.prototype as unknown as ParserMethods;

  prototype.raise = function (pos, message) {
    if (!isEarlyError(this, pos, message, false)) {
      base.raise.call(this, pos, message);
    }
  };
  prototype.raiseRecoverable = function (pos, message) {
    if (!isEarlyError(this, pos, message, true)) {
      base.raiseRecoverable.call(this, pos, message);
    }
  };

  // ECMAScript 2024, 12.7: a ReservedWord matches its code points as
  // spelled, so an escape-spelled one (`if`) is an IdentifierName and
  // never the keyword; acorn tokenizes it as the keyword. Its use as an
  // identifier is then an early error, raised by acorn's reserved-word
  // check (`nameIsEarlyError`); its use as the keyword derives nothing.
  prototype.readWord = function () {
    const word = this.readWord1();
    const type =
      !this.containsEsc && this.keywords.test(word)
        ? keywordType(word)
        : tokTypes.name;
    return this.finishToken(type, word);
  };

  // A regular expression literal whose pattern or flags the RegExp grammar
  // rejects is an early error (13.2.7: IsValidRegularExpressionLiteral);
  // the literal's own lexical grammar is acorn's tokenizer's.
  prototype.validateRegExpFlags = function () {};
  prototype.validateRegExpPattern = function () {};

  // CoverInitializedName (`{a = 1}`) and duplicate `__proto__` entries are
  // early errors outside a pattern (13.2.5.1). acorn stops reading
  // operators after an object literal holding one, `=` its only
  // continuation, where the grammar derives every other (`{a = 1} ? b : c`).
  prototype.checkExpressionErrors = function (
    refDestructuringErrors,
    andThrow,
  ) {
    return andThrow === true
      ? base.checkExpressionErrors.call(this, refDestructuringErrors, true)
      : false;
  };

  prototype.toAssignable = function (node, isBinding, refDestructuringErrors) {
    if (isBinding && node?.type === "ChainExpression") {
      // An optional chain as an arrow's parameter (`(a?.b) => 1`): no
      // binding element derives it — a derivation failure, where acorn's
      // message is the assignment target's early error.
      base.raise.call(this, node.start, OPTIONAL_CHAIN_TARGET);
    }
    if (isBinding || node === null) {
      return base.toAssignable.call(
        this,
        node,
        isBinding,
        refDestructuringErrors,
      );
    }
    if (assignmentTargetIsEarlyError(node)) {
      return node;
    }
    const depth = this.xspecAssignableDepth ?? 0;
    this.xspecAssignableDepth = depth + 1;
    try {
      return base.toAssignable.call(this, node, false, refDestructuringErrors);
    } finally {
      this.xspecAssignableDepth = depth;
    }
  };

  prototype.checkLValSimple = function (expr, bindingType, checkClashes) {
    if (
      (bindingType ?? BIND_NONE) === BIND_NONE &&
      simpleTargetIsEarlyError(this, expr)
    ) {
      return;
    }
    base.checkLValSimple.call(this, expr, bindingType, checkClashes);
  };

  prototype.parseVarId = function (decl, kind) {
    base.parseVarId.call(this, decl, kind);
    const declarator = decl as { readonly id?: AcornNode; init?: unknown };
    // The token after a `const` binding identifier, where acorn raises a
    // missing initializer (`unexpectedTokenIsEarlyError`) — a binding
    // pattern's initializer the grammar requires. A declarator acorn reads
    // no initializer for has the ESTree `init: null`.
    this.xspecConstAfterBinding =
      kind === "const" && declarator.id?.type === "Identifier"
        ? this.start
        : -1;
    declarator.init = null;
  };

  prototype.parseLabeledStatement = function (...args) {
    const saved = this.xspecLabelledItem;
    // acorn has read the label and its colon: the labelled item begins.
    this.xspecLabelledItem = this.start;
    try {
      return base.parseLabeledStatement.apply(this, args);
    } finally {
      this.xspecLabelledItem = saved;
    }
  };

  prototype.parseClassElement = function (...args) {
    const start = this.start;
    const element = base.parseClassElement.apply(this, args);
    if (
      element !== null &&
      element.kind === "constructor" &&
      element.key !== undefined &&
      this.xspecAccessorConstructors?.has(element.key.start) === true
    ) {
      // The element began with its `get` or `set` (a constructor is never
      // static, async, or a generator).
      checkAccessorParameters(
        this,
        this.input.slice(start, start + 3),
        element.value,
      );
    }
    return element;
  };

  prototype.parseExportSpecifiers = function (...args) {
    const specifiers = base.parseExportSpecifiers.apply(this, args);
    const locals = (this.xspecExportLocals ??= new Set());
    for (const specifier of specifiers) {
      if (specifier.local !== undefined) {
        locals.add(specifier.local.start);
      }
    }
    return specifiers;
  };

  // ECMAScript 2024, 15.7.1: a class static block's statements have the
  // [Await] parameter set — `await x` there is an AwaitExpression, whose
  // presence is an early error — where acorn reads `await` as an
  // identifier. Elsewhere, acorn's own rule.
  const baseCanAwait = Object.getOwnPropertyDescriptor(
    Parser.prototype,
    "canAwait",
  )?.get;
  Object.defineProperty(prototype, "canAwait", {
    configurable: true,
    get(this: DerivingParser): boolean {
      for (let index = this.scopeStack.length - 1; index >= 0; index -= 1) {
        const flags = this.scopeStack[index].flags;
        if ((flags & SCOPE_CLASS_STATIC_BLOCK) !== 0) {
          return true;
        }
        if ((flags & (SCOPE_CLASS_FIELD_INIT | SCOPE_FUNCTION)) !== 0) {
          break;
        }
      }
      return baseCanAwait?.call(this) === true;
    },
  });

  prototype.parseExprAtom = namingAs("reference", base.parseExprAtom);
  prototype.parseBreakContinueStatement = namingAs(
    "reference",
    base.parseBreakContinueStatement,
  );
  prototype.parseBindingAtom = namingAs("binding", base.parseBindingAtom);
  prototype.parseFunction = namingAs("binding", base.parseFunction);
  prototype.parseClassId = namingAs("binding", base.parseClassId);

  return Extended as unknown as typeof Parser;
}

/**
 * The parser remark-mdx is handed (SPEC 14.20): acorn with JSX, deriving the
 * ECMAScript 2024 grammar alone — early errors excluded.
 */
export const mdxAcorn: typeof Parser = Parser.extend(
  acornJsx(),
  excludeEarlyErrors,
);

/**
 * SPEC 2.7, 14.20: whether an expression container's content, as MDX 3
 * derives it, is the empty expression — whitespace and comments alone, so
 * that it lexes to no token under the grammar (whitespace and line
 * terminators ECMAScript 2024's: U+00A0, U+FEFF, U+2028, and U+2029
 * included, U+0085 and U+200B not). Content holding a token, or failing to
 * lex (an unterminated comment), is no empty expression.
 */
export function isEmptyExpression(content: string): boolean {
  try {
    const tokenizer = mdxAcorn.tokenizer(content, { ...MDX_ACORN_OPTIONS });
    return tokenizer.getToken().type === tokTypes.eof;
  } catch {
    return false;
  }
}
